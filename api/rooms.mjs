import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { isIP } from 'node:net';

const require = createRequire(import.meta.url);
const questionBanks = {
  pools: require('../questions.json').questions,
  ccst: require('../ccst-questions.json').questions
};
const questionsByDeck = Object.fromEntries(Object.entries(questionBanks).map(([deck, questions]) => [deck, new Map(questions.map(question => [question.id, question]))]));

const ROOM_TTL_SECONDS = 6 * 60 * 60;
const MAX_PLAYERS = 20;
const QUESTION_MS = 25_000;
const REVEAL_MS = 5_000;
const FREEZE_MS = 4_000;
const POWER_COSTS = { fifty: 70, shield: 45, freeze: 60, splat: 40, zap: 60, ward: 35 };
const ROUND_MS = QUESTION_MS + REVEAL_MS;
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ALLOWED_REACTIONS = new Set(['🎉', '🔥', '⚡', '💀', '😂', '😎', '👏', '😱', '🫡', '❤️']);
const COMPARE_AND_SWAP = `
local previous = redis.call('GET', KEYS[1])
if previous ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;
const RATE_COUNTER = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
return count
`;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
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

function storageConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new ApiError(503, 'Live rooms are not configured yet.');
  if (!/^https:\/\//i.test(url)) throw new ApiError(503, 'Live room storage is misconfigured.');
  return { url: url.replace(/\/+$/, ''), token };
}

async function redis(command) {
  const { url, token } = storageConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(7000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) {
    throw new ApiError(503, 'Live room storage is temporarily unavailable.');
  }
  return payload.result;
}

function roomKey(code) { return `packet-party:room:${code}`; }
function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }

async function limitAnonymous(request, kind, maximum) {
  const forwarded = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0].trim();
  if (!isIP(ip)) return;
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const count = await redis(['EVAL', RATE_COUNTER, 1, `packet-party:rate:${kind}:${ipHash}`, 600]);
  if (count > maximum) throw new ApiError(429, 'Too many room requests. Try again in a few minutes.');
}

function roomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)];
  return code;
}

function cleanName(value) {
  if (typeof value !== 'string') throw new ApiError(400, 'Enter a player name.');
  const name = value.replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (name.length < 2) throw new ApiError(400, 'Use a name with at least 2 characters.');
  return name;
}

function cleanCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!new RegExp(`^[${ROOM_ALPHABET}]{6}$`).test(code)) throw new ApiError(400, 'Enter a valid 6-character room code.');
  return code;
}

function createPlayer(name, now) {
  const token = randomBytes(24).toString('base64url');
  const player = {
    id: randomUUID(),
    name,
    tokenHash: tokenHash(token),
    ready: false,
    joinedAt: now,
    lastChatAt: 0,
    lastReactAt: 0,
    answers: {},
    powers: {}
  };
  return { player, token };
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalizeAnswer(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[“”‘’]/g, '')
    .replace(/[^\p{L}\p{N}.:/+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phaseAt(state, now) {
  if (!state.startedAt) return { status: 'lobby', phase: 'lobby', index: 0, endsAt: null };
  if (state.mode === 'coop') {
    const index = state.coopIndex || 0;
    if (index >= state.sequence.length) return { status: 'finished', phase: 'finished', index, endsAt: null };
    return { status: 'live', phase: state.coopRevealed ? 'reveal' : 'question', index, endsAt: null };
  }
  for (let index = 0; index < state.sequence.length; index++) {
    const round = state.sequence[index];
    const questionEndsAt = round.revealAt ?? state.startedAt + index * ROUND_MS + QUESTION_MS;
    const revealEndsAt = round.endsAt ?? questionEndsAt + REVEAL_MS;
    if (now < questionEndsAt) return {
      status: 'live', phase: 'question', index, endsAt: questionEndsAt
    };
    if (now < revealEndsAt) return {
      status: 'live', phase: 'reveal', index, endsAt: revealEndsAt
    };
  }
  return { status: 'finished', phase: 'finished', index: state.sequence.length, endsAt: null };
}

function roundQuestion(state, index) {
  const round = state.sequence[index];
  if (!round) return null;
  return questionsByDeck[state.deck || 'pools']?.get(round.id) || null;
}

function currentQuestion(state, index) {
  const round = state.sequence[index];
  const question = roundQuestion(state, index);
  if (!round || !question) return null;
  return {
    id: question.id,
    question: question.question,
    questionHtml: question.questionHtml,
    type: question.type,
    multiple: question.correctAnswers.length > 1,
    options: question.type === 'short_answer_question'
      ? []
      : round.optionOrder.map(optionIndex => question.options[optionIndex])
  };
}

function revealResult(state, index) {
  const question = roundQuestion(state, index);
  if (!question) return null;
  return {
    correctAnswers: question.correctAnswers,
    players: state.players.map(player => {
      const answer = player.answers[index];
      return {
        id: player.id,
        correct: Boolean(answer?.correct),
        answer: answer?.answer ?? null,
        points: answer?.points ?? 0,
        shielded: Boolean(answer?.shielded)
      };
    })
  };
}

function completedRoundIndex(state, time) {
  if (time.phase === 'lobby') return -1;
  if (time.phase === 'question') return time.index - 1;
  if (time.phase === 'reveal') return time.index;
  return state.sequence.length - 1;
}

function visibleTotals(player, lastCompleted) {
  let score = 0;
  let streak = 0;
  for (let index = 0; index <= lastCompleted; index++) {
    const answer = player.answers[index];
    score = Math.max(0, score + (answer?.points || 0) - (player.powers?.[index]?.spent || 0) - (player.powers?.[index]?.penalty || 0));
    streak = answer?.correct ? streak + 1 : answer?.shielded ? streak : 0;
  }
  return { score, streak };
}

function publicRoom(state, viewer, now) {
  const time = phaseAt(state, now);
  const shownIndex = time.phase === 'finished' ? Math.max(0, state.sequence.length - 1) : time.index;
  const answer = viewer.answers[shownIndex];
  const lastCompleted = completedRoundIndex(state, time);
  return {
    code: state.code,
    deck: state.deck || 'pools',
    mode: state.mode || 'competitive',
    playful: state.playful !== false,
    team: { mastered: (state.coopSolved || []).length, total: state.questionCount },
    myEffect: time.phase === 'question' && (viewer.powers?.[shownIndex]?.splatUntil || 0) > now ? { until: viewer.powers[shownIndex].splatUntil } : null,
    streakPerk: visibleTotals(viewer, time.index - 1).streak > 0 && visibleTotals(viewer, time.index - 1).streak % 3 === 0 && !viewer.answers[time.index - 1]?.shielded,
    status: time.status,
    phase: time.phase,
    players: state.players
      .map(player => ({ player, ...visibleTotals(player, lastCompleted) }))
      .sort((a, b) => (state.mode === 'coop' ? 0 : b.score - a.score) || a.player.joinedAt - b.player.joinedAt)
      .map(({ player, score, streak }) => ({
        id: player.id,
        name: player.name,
        score: state.mode === 'coop' ? 0 : score,
        streak: state.mode === 'coop' ? 0 : streak,
        ready: player.ready,
        answered: Boolean(player.answers[shownIndex])
      })),
    hostId: state.hostId,
    maxPlayers: MAX_PLAYERS,
    questionIndex: time.index,
    total: state.questionCount,
    currentQuestion: time.phase === 'lobby' || time.phase === 'finished'
      ? null : currentQuestion(state, time.index),
    endsAt: time.endsAt,
    result: time.phase === 'reveal' || time.phase === 'finished'
      ? revealResult(state, shownIndex) : null,
    myAnswer: answer?.answer ?? null,
    myPowers: viewer.powers?.[shownIndex] || {},
    mySpendablePoints: time.phase === 'question' ? Math.max(0, visibleTotals(viewer, time.index - 1).score - (viewer.powers?.[shownIndex]?.spent || 0) - (viewer.powers?.[shownIndex]?.penalty || 0)) : visibleTotals(viewer, lastCompleted).score,
    freezeUsed: Boolean(state.sequence[shownIndex]?.freezeUsed),
    messages: state.messages,
    reactions: state.reactions.filter(reaction => now - reaction.at < 7000)
  };
}

function publicPayload(state, viewer, now) {
  return { room: publicRoom(state, viewer, now), serverTime: now };
}

function bearerToken(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{32})$/.exec(request.headers.get('authorization') || '');
  if (!match) throw new ApiError(401, 'This room needs your player token.');
  return match[1];
}

function authorizedPlayer(state, token) {
  const hash = tokenHash(token);
  const player = state.players.find(candidate => candidate.tokenHash === hash);
  if (!player) throw new ApiError(401, 'Your room session was not found. Join again.');
  return player;
}

async function bodyOf(request, allowEmpty = false) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 4096) throw new ApiError(413, 'Request is too large.');
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new ApiError(413, 'Request is too large.');
    if (!raw.trim() && allowEmpty) return {};
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Send a valid JSON request.');
  }
}

async function getState(code) {
  const raw = await redis(['GET', roomKey(code)]);
  if (!raw) throw new ApiError(404, 'Room not found or expired.');
  let state;
  try { state = JSON.parse(raw); }
  catch { throw new ApiError(503, 'This room could not be loaded.'); }
  return { raw, state };
}

async function mutateRoom(code, token, mutate, authenticated = true) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { raw, state } = await getState(code);
    const player = authenticated ? authorizedPlayer(state, token) : null;
    const now = Date.now();
    const result = mutate(state, player, now);
    const next = JSON.stringify(state);
    const saved = await redis(['EVAL', COMPARE_AND_SWAP, 1, roomKey(code), raw, next, ROOM_TTL_SECONDS]);
    if (saved === 1) return { state, now, ...result };
  }
  throw new ApiError(409, 'The room changed. Please try again.');
}

async function createRoom(request) {
  const body = await bodyOf(request);
  const name = cleanName(body.name);
  const deck = body.deck || 'pools';
  if (typeof deck !== 'string' || !Object.hasOwn(questionBanks, deck)) throw new ApiError(400, 'Choose a valid study deck.');
  const questionCount = Number(body.questionCount || 10);
  if (![10, 20, 30, 50].includes(questionCount) || questionCount > questionBanks[deck].length) throw new ApiError(400, 'Choose a 10, 20, 30, or 50 question match.');
  await limitAnonymous(request, 'create', 8);
  const now = Date.now();
  const { player, token } = createPlayer(name, now);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = roomCode();
    const state = {
      version: 2,
      mode: body.mode === 'coop' ? 'coop' : 'competitive',
      playful: body.playful !== false,
      code,
      deck,
      hostId: player.id,
      questionCount,
      players: [player],
      sequence: [],
      startedAt: null,
      messages: [],
      reactions: []
    };
    const saved = await redis(['SET', roomKey(code), JSON.stringify(state), 'NX', 'EX', ROOM_TTL_SECONDS]);
    if (saved === 'OK') return json({ ...publicPayload(state, player, now), playerId: player.id, token }, 201);
  }
  throw new ApiError(503, 'Could not create a room. Please try again.');
}

async function joinRoom(code, request) {
  const body = await bodyOf(request);
  const name = cleanName(body.name);
  await limitAnonymous(request, 'join', 60);
  const { player, token } = createPlayer(name, Date.now());
  const { state, now } = await mutateRoom(code, null, (room, _viewer, mutationTime) => {
    if (body.deck && body.deck !== (room.deck || 'pools')) throw new ApiError(409, 'This room uses a different study deck. Open its invite link or switch deck.');
    if (phaseAt(room, mutationTime).status !== 'lobby') throw new ApiError(409, 'This match has already started.');
    if (room.players.length >= MAX_PLAYERS) throw new ApiError(409, 'This room is full.');
    if (room.players.some(existing => existing.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new ApiError(409, 'That name is already in this room.');
    }
    player.joinedAt = mutationTime;
    room.players.push(player);
    if (!room.hostId) room.hostId = player.id;
  }, false);
  return json({ ...publicPayload(state, player, now), playerId: player.id, token }, 201);
}

function handleReady(room, player, now, body) {
  if (phaseAt(room, now).status !== 'lobby') throw new ApiError(409, 'The match has started.');
  player.ready = typeof body.ready === 'boolean' ? body.ready : !player.ready;
}

function handleStart(room, player, now) {
  if (player.id !== room.hostId) throw new ApiError(403, 'Only the host can start the match.');
  if (phaseAt(room, now).status !== 'lobby') throw new ApiError(409, 'The match has already started.');
  if (room.players.length < 2) throw new ApiError(409, 'Invite at least one friend to start.');
  const selected = shuffled(questionBanks[room.deck || 'pools']).slice(0, room.questionCount);
  room.sequence = selected.map((question, index) => ({
    id: question.id,
    optionOrder: shuffled(question.options.map((_, optionIndex) => optionIndex)),
    revealAt: now + index * ROUND_MS + QUESTION_MS,
    endsAt: now + (index + 1) * ROUND_MS
  }));
  room.startedAt = now;
}

function normalizeSubmittedAnswer(value) {
  const answers = Array.isArray(value) ? value : [value];
  if (answers.length < 1 || answers.length > 8 || answers.some(answer => typeof answer !== 'string' || answer.length > 200)) {
    throw new ApiError(400, 'Choose an answer before submitting.');
  }
  const trimmed = answers.map(answer => answer.trim()).filter(Boolean);
  if (trimmed.length !== answers.length) throw new ApiError(400, 'Choose an answer before submitting.');
  return Array.isArray(value) ? trimmed : trimmed[0];
}

function revealIfEveryoneAnswered(room, now) {
  const time = phaseAt(room, now);
  if (time.phase !== 'question' || !room.players.length ||
      !room.players.every(contender => contender.answers[time.index])) return;
  if (room.mode === 'coop') { recordCoopRound(room, time.index); room.coopRevealed = true; return; }
  const round = room.sequence[time.index];
  const scheduledReveal = round.revealAt ?? room.startedAt + time.index * ROUND_MS + QUESTION_MS;
  const savedTime = Math.max(0, scheduledReveal - now);
  round.revealAt = scheduledReveal - savedTime;
  round.endsAt = (round.endsAt ?? scheduledReveal + REVEAL_MS) - savedTime;
  for (let index = time.index + 1; index < room.sequence.length; index++) {
    const laterRound = room.sequence[index];
    laterRound.revealAt = (laterRound.revealAt ?? room.startedAt + index * ROUND_MS + QUESTION_MS) - savedTime;
    laterRound.endsAt = (laterRound.endsAt ?? room.startedAt + (index + 1) * ROUND_MS) - savedTime;
  }
}

function handleAnswer(room, player, now, body) {
  const time = phaseAt(room, now);
  if (time.phase !== 'question' || (body.questionIndex != null && body.questionIndex !== time.index)) throw new ApiError(409, 'This question is closed.');
  const question = roundQuestion(room, time.index);
  if (!question) throw new ApiError(503, 'Question unavailable.');
  const answer = normalizeSubmittedAnswer(body.answer);
  const selected = Array.isArray(answer) ? answer : [answer];
  if (question.type !== 'short_answer_question' && selected.some(item => !question.options.some(option => normalizeAnswer(option) === normalizeAnswer(item)))) {
    throw new ApiError(400, 'Choose one of the displayed answers.');
  }
  const previous = player.answers[time.index];
  if (previous && JSON.stringify(previous.answer) === JSON.stringify(answer)) return;
  const right = question.correctAnswers.map(normalizeAnswer).sort();
  const given = selected.map(normalizeAnswer).sort();
  const correct = right.length === given.length && right.every((value, index) => value === given[index]);
  const streak = correct ? visibleTotals(player, time.index - 1).streak + 1 : 0;
  const secondsLeft = Math.max(0, time.endsAt - now);
  const points = correct ? room.mode === 'coop' ? 100 : 100 + Math.round(Math.min(1, secondsLeft / QUESTION_MS) * 50) + Math.min(streak, 5) * 10 + (streak % 5 === 0 ? 25 : 0) : 0;
  const previousStreak = visibleTotals(player, time.index - 1).streak;
  const perk = previousStreak > 0 && previousStreak % 3 === 0 && !player.answers[time.index - 1]?.shielded;
  player.answers[time.index] = { answer, correct, points, at: now, shielded: !correct && Boolean(player.powers?.[time.index]?.shield || perk) };
  revealIfEveryoneAnswered(room, now);
}

function handlePower(room, player, now, body) {
  const time = phaseAt(room, now);
  if (time.phase !== 'question' || (body.questionIndex != null && body.questionIndex !== time.index)) throw new ApiError(409, 'This question is closed.');
  const name = body.name;
  if (!Object.hasOwn(POWER_COSTS, name) && name !== 'clear') throw new ApiError(400, 'Choose an available power-up.');
  player.powers ||= {};
  const used = player.powers[time.index] ||= {};
  if (name === 'clear') { used.splatUntil = 0; return; }
  if (room.mode === 'coop' && name !== 'fifty') throw new ApiError(409, 'Co-op uses helpful hints and 50/50 only.');
  if (['splat', 'zap', 'ward'].includes(name) && room.playful === false) throw new ApiError(409, 'Playful attacks are off in this room.');
  if (used[name]) throw new ApiError(409, 'This power-up was already used on this question.');
  const available = visibleTotals(player, time.index - 1).score - (used.spent || 0) - (used.penalty || 0);
  const cost = room.mode === 'coop' ? 0 : POWER_COSTS[name];
  if (available < cost) throw new ApiError(409, `Earn ${POWER_COSTS[name]} points to use this power-up.`);
  if (['splat', 'zap'].includes(name)) {
    if (used.attack) throw new ApiError(409, 'One playful attack per question.');
    const target = room.players.find(p => p.id === body.targetId && p.id !== player.id);
    if (!target || target.answers[time.index]) throw new ApiError(409, 'Choose a player who is still thinking.');
    target.powers ||= {}; const targetPower = target.powers[time.index] ||= {};
    if (targetPower.attacked) throw new ApiError(409, 'That player has already received an attack this round.');
    const targetAvailable = Math.max(0, visibleTotals(target, time.index - 1).score - (targetPower.spent || 0));
    if (name === 'zap' && !targetPower.ward && targetAvailable === 0) throw new ApiError(409, 'That player has no points to zap.');
    targetPower.attacked = true; used.attack = true; used[name] = true;
    if (targetPower.ward) { targetPower.blocked = true; }
    else if (name === 'splat') targetPower.splatUntil = now + 4000;
    else targetPower.penalty = Math.min(20, targetAvailable);
  } else if (name === 'ward') { used.ward = true; used.splatUntil = 0; }
  else if (name === 'fifty') {
    const question = roundQuestion(room, time.index);
    const options = currentQuestion(room, time.index)?.options || [];
    if (!question || question.correctAnswers.length !== 1 || options.length < 4) throw new ApiError(409, '50/50 is for four-choice questions.');
    const wrong = options.map((option, index) => question.correctAnswers.some(answer => normalizeAnswer(answer) === normalizeAnswer(option)) ? -1 : index).filter(index => index >= 0);
    if (wrong.length < 2) throw new ApiError(409, '50/50 is unavailable for this question.');
    used.fifty = shuffled(wrong).slice(0, 2);
  } else if (name === 'shield') {
    used.shield = true;
    const answer = player.answers[time.index];
    if (answer && !answer.correct) answer.shielded = true;
  } else {
    const round = room.sequence[time.index];
    if (round.freezeUsed) throw new ApiError(409, 'Freeze was already used this round.');
    round.freezeUsed = true;
    round.revealAt += FREEZE_MS;
    round.endsAt += FREEZE_MS;
    for (let index = time.index + 1; index < room.sequence.length; index++) {
      room.sequence[index].revealAt += FREEZE_MS;
      room.sequence[index].endsAt += FREEZE_MS;
    }
    used.freeze = true;
  }
  used.spent = (used.spent || 0) + cost;
}

function recordCoopRound(room, index) {
  room.coopSolved ||= [];
  if (!room.coopSolved.includes(index) && room.players.some(p => p.answers[index]?.correct)) room.coopSolved.push(index);
}
function handleAdvance(room, player, now, body) {
  if (room.mode !== 'coop' || player.id !== room.hostId) throw new ApiError(403, 'Only the co-op host can move the group forward.');
  const time = phaseAt(room, now);
  if (body.questionIndex !== time.index || body.phase !== time.phase) throw new ApiError(409, 'The group has already moved forward.');
  if (time.phase === 'question') { recordCoopRound(room, time.index); room.coopRevealed = true; }
  else if (time.phase === 'reveal') { room.coopIndex = time.index + 1; room.coopRevealed = false; }
  else throw new ApiError(409, 'No active question to advance.');
}

function handleChat(room, player, now, body) {
  if (typeof body.text !== 'string') throw new ApiError(400, 'Enter a message.');
  const text = body.text.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!text) throw new ApiError(400, 'Enter a message.');
  if (now - player.lastChatAt < 1200) throw new ApiError(429, 'Wait a moment before sending another message.');
  player.lastChatAt = now;
  room.messages.push({ id: randomUUID(), playerId: player.id, name: player.name, text, at: now });
  room.messages = room.messages.slice(-40);
}

function handleReact(room, player, now, body) {
  if (!ALLOWED_REACTIONS.has(body.emoji)) throw new ApiError(400, 'Choose an available reaction.');
  if (now - player.lastReactAt < 350) throw new ApiError(429, 'Give the reactions a moment.');
  player.lastReactAt = now;
  room.reactions.push({ id: randomUUID(), playerId: player.id, emoji: body.emoji, at: now });
  room.reactions = room.reactions.filter(reaction => now - reaction.at < 7000).slice(-32);
}

function handleLeave(room, player, now) {
  room.players = room.players.filter(existing => existing.id !== player.id);
  if (room.hostId === player.id) room.hostId = room.players[0]?.id || null;
  revealIfEveryoneAnswered(room, now);
}

async function roomAction(code, action, request) {
  const token = bearerToken(request);
  const body = await bodyOf(request, true);
  const handlers = {
    ready: handleReady,
    start: handleStart,
    answer: handleAnswer,
    power: handlePower,
    advance: handleAdvance,
    chat: handleChat,
    react: handleReact,
    leave: handleLeave
  };
  const handler = handlers[action];
  if (!handler) throw new ApiError(404, 'Room action not found.');
  const { state, now } = await mutateRoom(code, token, (room, player, mutationTime) => {
    handler(room, player, mutationTime, body);
    return { playerId: player.id };
  });
  if (action === 'leave') return json({ left: true, serverTime: now });
  const viewer = authorizedPlayer(state, token);
  return json(publicPayload(state, viewer, now));
}

async function getRoom(code, request) {
  const token = bearerToken(request);
  const { state } = await getState(code);
  const viewer = authorizedPlayer(state, token);
  const now = Date.now();
  return json(publicPayload(state, viewer, now));
}

function routeOf(request) {
  const url = new URL(request.url);
  let code = url.searchParams.get('code');
  let action = url.searchParams.get('action');
  if (!code) {
    const match = /^\/api\/rooms\/([^/]+)(?:\/([^/]+))?\/?$/.exec(url.pathname);
    if (match) { code = match[1]; action = match[2] || action; }
  }
  return { code: code ? cleanCode(code) : null, action: action || null };
}

export default {
  async fetch(request) {
    try {
      const { code, action } = routeOf(request);
      if (request.method === 'POST' && !code && !action) return await createRoom(request);
      if (request.method === 'POST' && code && action === 'join') return await joinRoom(code, request);
      if (request.method === 'GET' && code && !action) return await getRoom(code, request);
      if (request.method === 'POST' && code && action) return await roomAction(code, action, request);
      return json({ error: 'Route not found.' }, 404);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      console.error('Live room request failed:', error?.name || 'unknown error');
      return json({ error: 'Live rooms are temporarily unavailable.' }, 503);
    }
  }
};
