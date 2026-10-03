import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

const MODES = new Set(['all', 'shuffle', 'adaptive', 'blitz']);
const HEARTS = new Set(['1', '3', '5', 'unlimited']);
const DECKS = new Set(['pools', 'ccst']);
const BADGE_TIERS = [
  ['Noob', 0], ['Beginner', 1000], ['Intermediate', 5000],
  ['Pro', 15000], ['Packet Hacker', 40000], ['Packet Gods', 100000]
];
function badgeForPoints(points) { return [...BADGE_TIERS].reverse().find(([, required]) => points >= required)?.[0] || 'Noob'; }
const SAVE_SCORE = `
redis.call('ZADD', KEYS[1], tonumber(ARGV[1]), ARGV[2])
local count = redis.call('ZCARD', KEYS[1])
if count > 50 then redis.call('ZREMRANGEBYRANK', KEYS[1], 0, count - 51) end
return 1
`;
const RATE_COUNTER = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
return count
`;

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token || !/^https:\/\//i.test(url)) throw new ApiError(503, 'Leaderboards are temporarily unavailable.');
  const response = await fetch(url.replace(/\/+$/, ''), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(7000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) throw new ApiError(503, 'Leaderboards are temporarily unavailable.');
  return payload.result;
}

function category(deck, mode, hearts) {
  if (!DECKS.has(deck) || !MODES.has(mode) || !HEARTS.has(String(hearts))) throw new ApiError(400, 'Choose a valid deck, mode, and hearts category.');
  const key = deck === 'pools' ? `packet-party:leaderboard:v1:${mode}:${hearts}` : `packet-party:leaderboard:v1:${deck}:${mode}:${hearts}`;
  return { deck, mode, hearts: String(hearts), key };
}

async function bodyOf(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 4096) throw new ApiError(413, 'Request is too large.');
  const raw = await request.text();
  if (raw.length > 4096) throw new ApiError(413, 'Request is too large.');
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    return body;
  } catch { throw new ApiError(400, 'Send a valid score.'); }
}

function cleanName(value) {
  if (typeof value !== 'string') throw new ApiError(400, 'Enter your name.');
  const name = value.replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (name.length < 2) throw new ApiError(400, 'Use a name with at least 2 characters.');
  return name;
}

function integer(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new ApiError(400, `Enter a valid ${label}.`);
  return value;
}

async function limitSubmissions(request) {
  const forwarded = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0].trim();
  if (!isIP(ip)) return;
  const hash = createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const count = await redis(['EVAL', RATE_COUNTER, 1, `packet-party:leaderboard:rate:${hash}`, 600]);
  if (count > 10) throw new ApiError(429, 'Too many scores sent. Try again later.');
}

async function listScores(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'all';
  const hearts = url.searchParams.get('hearts') || 'all';
  const deck = url.searchParams.get('deck') || 'pools';
  if (!DECKS.has(deck) || !MODES.has(mode) || (hearts !== 'all' && !HEARTS.has(hearts))) throw new ApiError(400, 'Choose a valid deck, mode, and hearts category.');
  const categories = hearts === 'all' ? [...HEARTS] : [hearts];
  const boards = await Promise.all(categories.map(value => redis(['ZREVRANGE', category(deck, mode, value).key, 0, 49])));
  const entries = boards.flatMap((members, boardIndex) => (members || []).flatMap(raw => {
    try {
      const entry = JSON.parse(raw);
      const lifetimePoints = Number.isSafeInteger(entry.lifetimePoints) ? entry.lifetimePoints : entry.score;
      return [{ name: entry.name, score: entry.score, lifetimePoints, title: badgeForPoints(lifetimePoints), correct: entry.correct, total: entry.total, duration: entry.duration, hearts: entry.hearts || categories[boardIndex], at: entry.at }];
    } catch { return []; }
  }));
  entries.sort((a, b) => b.score - a.score || b.correct - a.correct || a.duration - b.duration || a.at - b.at);
  return json({ deck, mode, hearts, entries: entries.slice(0, 50) });
}

async function submitScore(request) {
  const body = await bodyOf(request);
  const { deck, mode, hearts, key } = category(body.deck || 'pools', body.mode, body.hearts);
  if (body.firstCorrect !== false) throw new ApiError(400, 'First-choice-correct runs are practice only and cannot enter leaderboards.');
  const name = cleanName(body.name);
  const score = integer(body.score, 1, 1_000_000_000, 'score');
  const lifetimePoints = integer(body.lifetimePoints ?? score, score, 1_000_000_000, 'lifetime points');
  const total = integer(body.total, 1, 200, 'question count');
  const correct = integer(body.correct, 0, total, 'correct count');
  const duration = integer(body.duration, 1, 86_400_000, 'time');
  await limitSubmissions(request);
  const entry = { id: randomUUID(), name, deck, mode, hearts, score, lifetimePoints, title: badgeForPoints(lifetimePoints), correct, total, duration, at: Date.now() };
  await redis(['EVAL', SAVE_SCORE, 1, key, score, JSON.stringify(entry)]);
  return json({ ok: true, deck, mode, hearts }, 201);
}

export default {
  async fetch(request) {
    try {
      if (request.method === 'GET') return await listScores(request);
      if (request.method === 'POST') return await submitScore(request);
      return json({ error: 'Route not found.' }, 404);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      console.error('Leaderboard request failed:', error?.name || 'unknown error');
      return json({ error: 'Leaderboards are temporarily unavailable.' }, 503);
    }
  }
};
