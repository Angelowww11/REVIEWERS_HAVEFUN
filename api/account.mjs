import { createHash, randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const PREFIX = 'packet-party:account:';
const COOKIE = '__Host-pp_account';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const MAX_BODY = 1024 * 1024;
const KDF = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const DATA_KEY = /^(?:pp_(?:ccst_)?(?:practice_v1|stats|favorites|heart_limit|ranked_run_(?:all|shuffle|adaptive|blitz))|pp_(?:theme|motion|sound|leaderboard_name|live_name))$/;
const RATE = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`;
const REGISTER = `
if redis.call('EXISTS',KEYS[1])==1 then return 0 end
redis.call('SET',KEYS[1],ARGV[1]); redis.call('SET',KEYS[2],ARGV[2]); return 1`;
const CAS = `
local old=redis.call('GET',KEYS[1]); if (old or '')~=ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2]); return 1`;

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const hash = value => createHash('sha256').update(value).digest('hex');
const userKey = id => `${PREFIX}user:${id}`;
const nameKey = name => `${PREFIX}name:${name}`;
const stateKey = id => `${PREFIX}progress:${id}`;
const sessionKey = token => `${PREFIX}session:${hash(token)}`;
function json(payload, status = 200, cookie) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private, max-age=0', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(payload), { status, headers });
}
function cookieFor(token, maxAge = SESSION_SECONDS) { return `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`; }
async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token || !/^https:\/\//i.test(url)) throw new ApiError(503, 'Accounts are temporarily unavailable. Guest play still works.');
  const response = await fetch(url.replace(/\/+$/, ''), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(7000) });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.error) throw new ApiError(503, 'Account storage is temporarily unavailable. Your local progress is safe.');
  return result.result;
}
async function rate(kind, identity, limit, seconds = 900) {
  const value = await redis(['EVAL', RATE, 1, `${PREFIX}rate:${kind}:${hash(identity).slice(0, 32)}`, seconds]);
  if (value > limit) throw new ApiError(429, 'Too many attempts. Please try again in a few minutes.');
}
function clientIP(request) { return (request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 80); }
function checkMutation(request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('x-packet-account') !== '1') throw new ApiError(403, 'Open Packet Party directly to update your account.');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new ApiError(415, 'Send account requests as JSON.');
}
async function bodyOf(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new ApiError(413, 'This save is too large to sync.');
  // Bound actual streamed bytes as well as the untrusted Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Missing account request.');
  const chunks = []; let bytes = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY) { await reader.cancel(); throw new ApiError(413, 'This save is too large to sync.'); }
    chunks.push(value);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ApiError(400, 'Invalid account request.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Invalid account request.');
  return body;
}
function username(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(value.trim())) throw new ApiError(400, 'Use 3–24 letters, numbers, or underscores for your username.');
  return value.trim().toLowerCase();
}
function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128 || Buffer.byteLength(value) > 512) throw new ApiError(400, 'Use a password with 12–128 characters. A few memorable words work well.');
  return value;
}
async function passwordHash(value, salt = randomBytes(16).toString('hex')) {
  const key = await scrypt(value, salt, 64, KDF);
  return { salt, hash: key.toString('hex') };
}
async function validPassword(value, user) {
  // Spend the same KDF work when the username does not exist.
  const derived = await passwordHash(value, user?.password?.salt || '47c293c337742c260f238346b6d950b50');
  const expected = Buffer.from(user?.password?.hash || '0'.repeat(128), 'hex');
  return expected.length === 64 && timingSafeEqual(Buffer.from(derived.hash, 'hex'), expected) && Boolean(user);
}
function recoveryKey() { return randomBytes(24).toString('hex').toUpperCase().match(/.{8}/g).join('-'); }
function recoveryHash(value) { return hash(String(value || '').replace(/[\s-]/g, '').toUpperCase()); }
function opaqueToken(request) {
  const value = (request.headers.get('cookie') || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
async function getUserByName(name) {
  const id = await redis(['GET', nameKey(name)]); if (!id) return null;
  const raw = await redis(['GET', userKey(id)]); return raw ? JSON.parse(raw) : null;
}
async function current(request, required = true) {
  const token = opaqueToken(request);
  if (token) {
    const raw = await redis(['GET', sessionKey(token)]);
    if (raw) {
      const session = JSON.parse(raw), userRaw = await redis(['GET', userKey(session.userId)]);
      const user = userRaw ? JSON.parse(userRaw) : null;
      if (user && session.authVersion === user.authVersion && session.expiresAt > Date.now()) return { user, token };
    }
  }
  if (required) throw new ApiError(401, 'Please sign in again. Your local progress is safe.');
  return null;
}
async function cloud(user) {
  const raw = await redis(['GET', stateKey(user.id)]);
  return raw ? JSON.parse(raw) : { revision: 0, updatedAt: null, data: {} };
}
const publicUser = user => ({ id: user.id, username: user.username });
async function startSession(user, oldRequest) {
  const token = randomBytes(32).toString('base64url');
  await redis(['SET', sessionKey(token), JSON.stringify({ userId: user.id, authVersion: user.authVersion, expiresAt: Date.now() + SESSION_SECONDS * 1000 }), 'EX', SESSION_SECONDS]);
  const oldToken = opaqueToken(oldRequest); if (oldToken) await redis(['DEL', sessionKey(oldToken)]);
  return token;
}
function validateData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length > 32) throw new ApiError(400, 'Invalid progress data.');
  let nodes = 0;
  function walk(value, depth = 0) {
    if (++nodes > 75000 || depth > 16) throw new ApiError(400, 'Progress data is too complex.');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value === 'string' && value.length <= 20000) return;
    if (Array.isArray(value) && value.length <= 5000) { value.forEach(item => walk(item, depth + 1)); return; }
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length <= 5000) {
      for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key) || key.length > 100) throw new ApiError(400, 'Invalid progress field.');
        walk(item, depth + 1);
      }
      return;
    }
    throw new ApiError(400, 'Invalid progress value.');
  }
  for (const [key, value] of Object.entries(data)) {
    if (!DATA_KEY.test(key)) throw new ApiError(400, 'Only study progress and preferences can be synced.');
    walk(value);
  }
  return data;
}

export default {
  async fetch(request) {
    try {
      if (request.method === 'GET') {
        const session = await current(request, false);
        return json(session ? { user: publicUser(session.user), cloud: await cloud(session.user) } : { user: null });
      }
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      checkMutation(request);
      const body = await bodyOf(request), action = body.action;
      if (['register', 'login', 'recover'].includes(action)) {
        await rate(`auth:${action}`, clientIP(request), action === 'register' ? 8 : 40);
        const name = username(body.username);
        await rate(`name:${action}`, name, action === 'register' ? 5 : 12);
        const pass = password(body.password);
        if (action === 'register') {
          const recovery = recoveryKey();
          const user = { id: randomUUID(), username: name, password: await passwordHash(pass), recoveryHash: recoveryHash(recovery), authVersion: randomUUID(), createdAt: Date.now() };
          const created = await redis(['EVAL', REGISTER, 2, nameKey(name), userKey(user.id), user.id, JSON.stringify(user)]);
          if (created !== 1) throw new ApiError(409, 'That username is unavailable. Choose another one.');
          const token = await startSession(user, request);
          return json({ user: publicUser(user), cloud: await cloud(user), recoveryKey: recovery }, 201, cookieFor(token));
        }
        const user = await getUserByName(name);
        if (action === 'login') {
          if (!await validPassword(pass, user)) throw new ApiError(401, 'The username or password is incorrect.');
          const token = await startSession(user, request);
          return json({ user: publicUser(user), cloud: await cloud(user) }, 200, cookieFor(token));
        }
        if (typeof body.recoveryKey !== 'string' || body.recoveryKey.length > 100) throw new ApiError(401, 'The username or recovery key is incorrect.');
        const provided = Buffer.from(recoveryHash(body.recoveryKey), 'hex');
        const expected = Buffer.from(user?.recoveryHash || '0'.repeat(64), 'hex');
        if (!timingSafeEqual(provided, expected) || !user) throw new ApiError(401, 'The username or recovery key is incorrect.');
        const recovery = recoveryKey(), updated = { ...user, password: await passwordHash(pass), recoveryHash: recoveryHash(recovery), authVersion: randomUUID() };
        const changed = await redis(['EVAL', CAS, 1, userKey(user.id), JSON.stringify(user), JSON.stringify(updated)]);
        if (changed !== 1) throw new ApiError(409, 'Your account changed. Please try signing in again.');
        const token = await startSession(updated, request);
        return json({ user: publicUser(updated), cloud: await cloud(updated), recoveryKey: recovery }, 200, cookieFor(token));
      }
      const { user, token } = await current(request);
      if (action === 'logout') {
        await redis(['DEL', sessionKey(token)]);
        return json({ signedOut: true }, 200, cookieFor('', 0));
      }
      if (action === 'save') {
        if (body.userId !== user.id) throw new ApiError(409, 'The signed-in account changed. Open Account to choose which progress to keep.');
        await rate('save', user.id, 30, 60);
        const data = validateData(body.data);
        if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw new ApiError(400, 'Invalid save revision.');
        const raw = await redis(['GET', stateKey(user.id)]);
        const previous = raw ? JSON.parse(raw) : { revision: 0 };
        if (previous.revision !== body.revision) throw new ApiError(409, 'Another device saved new progress. Open Account to merge or restore it.');
        const next = { revision: previous.revision + 1, updatedAt: Date.now(), data };
        const changed = await redis(['EVAL', CAS, 1, stateKey(user.id), raw || '', JSON.stringify(next)]);
        if (changed !== 1) throw new ApiError(409, 'Another device saved at the same time. Open Account to merge or restore it.');
        return json({ revision: next.revision, updatedAt: next.updatedAt });
      }
      throw new ApiError(400, 'Unknown account action.');
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      console.error('Account request failed:', error?.name || 'UnknownError');
      return json({ error: 'Accounts are temporarily unavailable. Your local progress is safe.' }, 503);
    }
  }
};
