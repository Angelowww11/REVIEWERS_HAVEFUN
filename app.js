/* Packet Party is intentionally static: questions and progress stay in this browser. */
const $ = id => document.getElementById(id);
const modeInfo = {
  all: { name: 'All questions', eyebrow: 'COMPLETE DECK', description: 'Play the complete deck in its original order.' },
  shuffle: { name: 'Shuffle run', eyebrow: 'FRESH EACH TIME', description: 'Play every question in a new order.' },
  adaptive: { name: 'Level up', eyebrow: '20 QUESTION SPRINT', description: 'The original questions get longer when you are answering quickly.' },
  blitz: { name: 'Boss blitz', eyebrow: 'BEAT THE CLOCK', description: 'Survive 15 questions while each countdown gets shorter.' },
  matching: { name: 'Match maker', eyebrow: 'TAP TO PAIR', description: 'Connect 12 short question cards to their original answers.' },
  typing: { name: 'Type it out', eyebrow: 'NO CHOICES', description: 'Recall short original answers without seeing the choices.' }
};
const quotes = [
  'One packet at a time', 'Small wins add up', 'Your next answer is a fresh start',
  'The streak starts with one', 'Learn it, link it, beat it', 'Progress looks good on you',
  'A wrong answer is useful data', 'You know more than you think', 'Stay curious, stay connected'
];
const app = {
  questions: [], mode: 'shuffle', view: 'home', game: null, bankLimit: 16,
  bankAll: false, bankRevealAll: false, bankRevealed: new Set(), importedGhost: null,
  favorites: new Set(readJSON('pp_favorites', [])),
  stats: readJSON('pp_stats', { runs: 0, correct: 0, bestStreak: 0, bestScore: 0 }),
  soundOn: readJSON('pp_sound', false), timer: null, toastTimer: null, audio: null
};

function readJSON(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function normalize(value) { return String(value ?? '').trim().toLocaleLowerCase().replace(/[“”‘’]/g, '').replace(/[^\p{L}\p{N}.:/+-]+/gu, ' ').replace(/\s+/g, ' ').trim(); }
function shuffle(items) { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
function formatNumber(n) { return Number(n || 0).toLocaleString(); }
function sourceName(q) { const match = String(q.sourceFile || '').match(/pool\s+(\w+)/i); return match ? `Pool ${match[1].replace(/^./, c => c.toUpperCase())}` : 'Question pool'; }
function typeName(q) { return q.type === 'true_false_question' ? 'True / false' : q.type === 'short_answer_question' ? 'Short answer' : q.correctAnswers.length > 1 ? 'Multiple answers' : 'Multiple choice'; }
function hasImage(q) { return /<img\b/i.test(q.questionHtml || ''); }
function isCorrectOption(q, option) { return (q.correctAnswers || []).some(a => normalize(a) === normalize(option)); }
function answerText(q) { return (q.correctAnswers || []).join(' · '); }
function announce(message) { $('announcer').textContent = ''; setTimeout(() => { $('announcer').textContent = message; }, 10); }
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('is-visible'); clearTimeout(app.toastTimer); app.toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800); }

// Saved Canvas HTML is treated as content, never as executable markup.
function safeQuestionHTML(q) {
  const raw = q.questionHtml || escapeHTML(q.question || '');
  const parsed = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
  const allowed = new Set(['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SUB', 'SUP', 'CODE', 'PRE', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'IMG', 'DIV', 'SPAN']);
  const discard = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'SVG', 'MATH']);
  function copy(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE || discard.has(node.tagName)) return null;
    if (!allowed.has(node.tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of node.childNodes) { const item = copy(child); if (item) fragment.append(item); }
      return fragment;
    }
    if (node.tagName === 'IMG') {
      const src = (node.getAttribute('src') || '').replace(/^\.\//, '');
      if (!/^exhibits\/[a-z0-9._-]+\.(?:png|jpe?g|gif|webp|svg)$/i.test(src)) return null;
      const img = document.createElement('img');
      img.setAttribute('src', src); img.setAttribute('alt', node.getAttribute('alt') || 'Question exhibit');
      img.setAttribute('loading', 'lazy'); return img;
    }
    const element = document.createElement(node.tagName.toLowerCase());
    for (const child of node.childNodes) { const item = copy(child); if (item) element.append(item); }
    if (['P', 'DIV', 'SPAN'].includes(node.tagName) && !element.textContent.replace(/\u00a0/g, '').trim() && !element.querySelector('img')) return null;
    return element;
  }
  const outer = document.createElement('div'); outer.className = 'question-html';
  for (const child of parsed.body.firstElementChild?.childNodes || []) { const item = copy(child); if (item) outer.append(item); }
  return outer.outerHTML;
}

function playTone(kind) {
  if (!app.soundOn) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    app.audio ||= new Audio();
    if (app.audio.state === 'suspended') app.audio.resume();
    const now = app.audio.currentTime;
    const tones = kind === 'good' ? [[530, 0], [660, .075], [840, .15]] : kind === 'bad' ? [[330, 0], [250, .13]] : [[590, 0]];
    tones.forEach(([frequency, offset]) => {
      const oscillator = app.audio.createOscillator(); const gain = app.audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.001, now + offset); gain.gain.exponentialRampToValueAtTime(.07, now + offset + .012); gain.gain.exponentialRampToValueAtTime(.001, now + offset + .16);
      oscillator.connect(gain).connect(app.audio.destination); oscillator.start(now + offset); oscillator.stop(now + offset + .17);
    });
  } catch { /* Audio is optional. */ }
}
function burst() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = $('particleLayer'); const colors = ['#a7f2ed', '#ffb45c', '#f58fca', '#ada7ff', '#75dfb0'];
  const x = innerWidth * .5, y = Math.min(innerHeight * .55, 420);
  for (let i = 0; i < 21; i++) {
    const dot = document.createElement('span'); dot.className = 'burst-particle';
    const angle = Math.random() * Math.PI * 2; const distance = 60 + Math.random() * 170;
    dot.style.left = `${x}px`; dot.style.top = `${y}px`; dot.style.setProperty('--dx', `${Math.cos(angle) * distance}px`); dot.style.setProperty('--dy', `${Math.sin(angle) * distance}px`); dot.style.setProperty('--particle-color', colors[i % colors.length]);
    layer.append(dot); setTimeout(() => dot.remove(), 800);
  }
}
function updateSoundButton() { const button = $('soundButton'); button.setAttribute('aria-pressed', String(app.soundOn)); button.setAttribute('aria-label', `Turn sound ${app.soundOn ? 'off' : 'on'}`); button.title = `Sound ${app.soundOn ? 'on' : 'off'}`; }
function updateStats() { $('headerBest').textContent = formatNumber(app.stats.bestStreak); $('homeBest').textContent = formatNumber(app.stats.bestStreak); $('runsCount').textContent = formatNumber(app.stats.runs); $('totalCorrect').textContent = formatNumber(app.stats.correct); }
function setView(view) {
  app.view = view;
  for (const id of ['home', 'bank', 'game', 'result']) $(`${id}View`).hidden = id !== view;
  document.querySelectorAll('.nav-link').forEach(button => { const active = button.dataset.view === view; button.classList.toggle('is-active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  if (view === 'bank') renderBank();
  scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function renderHome() {
  const sources = new Set(app.questions.map(q => q.sourceFile).filter(Boolean));
  $('questionCount').textContent = formatNumber(app.questions.length);
  $('sourceCount').textContent = formatNumber(sources.size || 8);
  $('bankCountBadge').textContent = `${formatNumber(app.questions.length)} questions`;
  updateStats();
  const ticker = [...quotes, ...quotes].map(q => `<span><b>✳</b>${escapeHTML(q)}</span>`).join('');
  $('quoteTrack').innerHTML = ticker;
  let index = 0;
  setInterval(() => { index = (index + 1) % quotes.length; $('motivationText').textContent = quotes[index] + '.'; }, 13000);
  const sourceSelect = $('bankSource');
  [...sources].sort((a, b) => { const an = +(a.match(/\d+/)?.[0] || 0), bn = +(b.match(/\d+/)?.[0] || 0); return an - bn; }).forEach(source => { const option = document.createElement('option'); option.value = source; option.textContent = source.replace(/\.html$/i, ''); sourceSelect.append(option); });
  if (!sources.size) sourceSelect.parentElement.hidden = true;
}

function filteredBank() {
  const query = $('bankSearch').value.trim().toLocaleLowerCase(); const source = $('bankSource').value; const type = $('bankType').value;
  return app.questions.filter(q => {
    if (source !== 'all' && q.sourceFile !== source) return false;
    if (type === 'favorites' && !app.favorites.has(q.id)) return false;
    if (type !== 'all' && type !== 'favorites' && q.type !== type) return false;
    if (!query) return true;
    return [q.question, ...(q.options || []), ...(q.correctAnswers || [])].some(value => String(value).toLocaleLowerCase().includes(query));
  });
}
function renderBank() {
  const matches = filteredBank(); const visible = app.bankAll ? matches : matches.slice(0, app.bankLimit);
  $('bankResultText').textContent = `Showing ${visible.length} of ${matches.length} questions`;
  $('bankShowAll').textContent = app.bankAll ? 'Show fewer' : 'Show all at once';
  $('bankMore').hidden = app.bankAll || visible.length >= matches.length;
  $('revealAllButton').textContent = app.bankRevealAll ? 'Hide answers' : 'Reveal answers';
  $('revealAllButton').setAttribute('aria-pressed', String(app.bankRevealAll));
  $('bankList').innerHTML = visible.length ? visible.map(q => {
    const revealed = app.bankRevealAll || app.bankRevealed.has(q.id);
    const options = q.type === 'short_answer_question' ? [] : q.options || [];
    return `<article class="bank-question" data-id="${q.id}"><div class="bank-q-top"><span class="bank-number">#${q.id}</span><span class="chip chip-source">${escapeHTML(sourceName(q))}</span><span class="chip">${escapeHTML(typeName(q))}</span><button type="button" class="star-button ${app.favorites.has(q.id) ? 'is-starred' : ''}" data-bank-action="star" aria-label="${app.favorites.has(q.id) ? 'Remove star from' : 'Star'} question ${q.id}" aria-pressed="${app.favorites.has(q.id)}">★</button></div><div class="bank-prompt">${safeQuestionHTML(q)}</div>${options.length ? `<div class="bank-choices">${options.map((option, index) => `<div class="bank-choice ${revealed && isCorrectOption(q, option) ? 'is-answer' : ''}"><i>${String.fromCharCode(65 + index)}</i><span>${escapeHTML(option)}</span></div>`).join('')}</div>` : ''}<div class="bank-actions"><button type="button" class="bank-reveal" data-bank-action="reveal">${revealed ? 'Hide answer' : 'Reveal answer'}</button>${revealed ? `<span class="bank-answer-note">✓ ${escapeHTML(answerText(q))}</span>` : ''}</div></article>`;
  }).join('') : `<div class="bank-empty"><strong>No questions found</strong>Try a different search or filter.</div>`;
}

function openSetup(mode) {
  if (!app.questions.length) { toast('The question deck is still loading.'); return; }
  app.mode = mode; const info = modeInfo[mode];
  $('setupTitle').textContent = info.name; $('setupDescription').textContent = info.description;
  const count = mode === 'typing' ? Math.min(20, typingPool().length) : mode === 'matching' ? Math.min(12, matchingPool().length) : mode === 'adaptive' ? Math.min(20, app.questions.length) : mode === 'blitz' ? Math.min(15, app.questions.length) : app.questions.length;
  $('setupQuestionCount').textContent = `${count} questions`;
  $('correctFirstToggle').checked = readJSON('pp_correct_first', false);
  $('correctFirstToggle').closest('.switch-row').hidden = mode === 'typing' || mode === 'matching';
  $('setupNote').textContent = mode === 'blitz' ? 'Freeze Time unlocks during a streak. The clock starts when a question appears.' : 'Your progress is saved on this device.';
  $('setupDialog').showModal();
}
function typingPool() { return app.questions.filter(q => q.correctAnswers.length === 1 && q.correctAnswers[0].length <= 52 && !hasImage(q)); }
function matchingPool() {
  const seen = new Set();
  return shuffle(app.questions.filter(q => q.correctAnswers.length === 1 && q.question.length <= 145 && q.correctAnswers[0].length <= 80 && !hasImage(q))).filter(q => { const key = normalize(q.correctAnswers[0]); if (seen.has(key)) return false; seen.add(key); return true; });
}
function difficulty(q) { return q._difficulty ?? .5; }
function prepareDifficulty() {
  const sorted = [...app.questions].sort((a, b) => complexity(a) - complexity(b));
  sorted.forEach((q, index) => { q._difficulty = sorted.length > 1 ? index / (sorted.length - 1) : .5; });
}
function complexity(q) { return String(q.question || '').length + (q.options || []).reduce((sum, option) => sum + String(option).length * .2, 0) + (hasImage(q) ? 55 : 0); }
function startGame() {
  const mode = app.mode; writeJSON('pp_correct_first', $('correctFirstToggle').checked);
  const questions = app.questions;
  let order = mode === 'all' ? [...questions] : mode === 'shuffle' ? shuffle(questions) : mode === 'typing' ? shuffle(typingPool()).slice(0, 20) : mode === 'matching' ? matchingPool().slice(0, 12) : mode === 'blitz' ? shuffle(questions).slice(0, 15) : [];
  if (mode === 'matching' && order.length < 4) { toast('Not enough matching pairs in this deck.'); return; }
  if (mode === 'typing' && !order.length) { toast('No short answers are available.'); return; }
  const total = mode === 'adaptive' ? Math.min(20, questions.length) : order.length;
  let ghost = null;
  if ($('ghostToggle').checked) {
    const candidate = app.importedGhost || readJSON(`pp_ghost_${mode}`, null);
    if (validGhost(candidate) && candidate.mode === mode) ghost = candidate;
    else toast('No ghost for this mode yet. Finish a run or import one.');
  }
  app.game = {
    mode, order, remaining: mode === 'adaptive' ? shuffle(questions) : [], total, completed: 0, current: null,
    score: 0, streak: 0, bestStreak: 0, correct: 0, attempts: 0, hearts: 3, missed: [], selected: new Set(),
    answered: false, wager: 0, hiddenChoices: new Set(), hintStep: 0, coachOpen: false,
    unlocked: { fifty: false, shield: false, freeze: false }, used: { fifty: false, shield: false, freeze: false }, activeShield: false,
    startedAt: performance.now(), questionAt: performance.now(), timerLast: performance.now(), remainingTime: 0, freezeUntil: 0,
    events: [], ghost, firstCorrect: $('correctFirstToggle').checked, matchPairs: [], matchChoice: { left: null, right: null }
  };
  $('gameModeEyebrow').textContent = modeInfo[mode].eyebrow; $('gameModeName').textContent = modeInfo[mode].name;
  $('ghostBadge').hidden = !ghost;
  setView('game'); updateHUD();
  clearInterval(app.timer); app.timer = setInterval(tick, 100);
  if (mode === 'matching') renderMatchBoard(); else nextQuestion();
}
function selectAdaptiveQuestion(g, preferHard) {
  const speed = g.events.slice(-4).map(e => e.responseMs).filter(Number.isFinite);
  const average = speed.length ? speed.reduce((a, b) => a + b, 0) / speed.length : 8500;
  let target = .48;
  if (g.streak >= 3 && average < 6500) target = .88;
  else if (g.streak >= 2 && average < 9500) target = .7;
  else if (g.streak === 0 && g.completed > 0) target = .24;
  if (preferHard) target = .9;
  g.remaining.sort((a, b) => Math.abs(difficulty(a) - target) - Math.abs(difficulty(b) - target));
  return g.remaining.shift();
}
function nextQuestion() {
  const g = app.game; if (!g) return;
  if (g.completed >= g.total || g.hearts <= 0) { finishGame(); return; }
  const preferHard = g.completed > 0 && g.completed % 5 === 0 && g.score >= 100;
  g.current = g.mode === 'adaptive' ? selectAdaptiveQuestion(g, preferHard) : g.order[g.completed];
  if (!g.current) { finishGame(); return; }
  g.selected = new Set(); g.answered = false; g.wager = 0; g.hiddenChoices = new Set(); g.hintStep = 0; g.coachOpen = false;
  g.questionAt = performance.now();
  if (g.mode === 'blitz') { g.remainingTime = Math.max(5, 15 - Math.floor(g.completed * .7)); g.timerLast = performance.now(); }
  const wagerRound = g.completed > 0 && g.completed % 5 === 0 && g.score >= 100 && difficulty(g.current) >= .55 && g.mode !== 'typing';
  if (wagerRound) renderWager(); else renderQuestion();
  updateHUD();
}
function renderWager() {
  const g = app.game;
  $('gameContent').innerHTML = `<div class="wager-card"><div class="wager-coin" aria-hidden="true">◉</div><span class="section-kicker" style="color:#686cbb">HIGH STAKES ROUND</span><h2>Wager your points?</h2><p>A tougher original question is coming. Pick a stake before you see it. Win extra points or lose your wager.</p><span class="wager-balance">Current score: ${formatNumber(g.score)}</span><div class="wager-options"><button type="button" data-wager="0">Play safe</button><button type="button" data-wager="25">25% stake</button><button type="button" data-wager="50">50% stake</button></div></div>`;
  announce('High stakes question. Choose a wager before the question appears.');
}
function optionOrder(q, firstCorrect) {
  if (q.type === 'short_answer_question' || !(q.options || []).length) return [];
  if (firstCorrect) return [...q.options.filter(o => isCorrectOption(q, o)), ...shuffle(q.options.filter(o => !isCorrectOption(q, o)))];
  return shuffle(q.options);
}
function powerMarkup(g, q) {
  const fiftyUsable = g.mode !== 'typing' && q.type !== 'short_answer_question' && q.correctAnswers.length === 1 && (q.options || []).length >= 4;
  const powers = [
    ['fifty', '½ 50/50', 'streak 2', fiftyUsable],
    ['shield', '◇ Shield', 'streak 3', true],
    ['freeze', '❄ Freeze', 'streak 4', g.mode === 'blitz']
  ];
  return powers.map(([id, label, unlock, usable]) => {
    const locked = !g.unlocked[id] || !usable;
    const title = !usable ? (id === 'freeze' ? 'Available in Boss blitz' : 'Available for four-choice questions') : locked ? `Unlock at ${unlock}` : g.used[id] ? 'Already used this run' : id === 'shield' ? 'Protect your streak from one wrong answer' : id === 'freeze' ? 'Pause the clock for eight seconds' : 'Remove two wrong choices';
    return `<button type="button" class="power-button ${locked ? 'is-locked' : ''} ${id === 'shield' && g.activeShield ? 'is-active' : ''}" data-power="${id}" title="${title}" ${locked || g.used[id] ? 'disabled' : ''}>${label}${locked ? ' 🔒' : ''}</button>`;
  }).join('');
}
function renderQuestion() {
  const g = app.game, q = g.current;
  g.displayOptions = optionOrder(q, g.firstCorrect);
  const isType = g.mode === 'typing' || q.type === 'short_answer_question' || !g.displayOptions.length;
  const isMulti = !isType && q.correctAnswers.length > 1;
  let answers;
  if (isType) answers = `<label class="sr-only" for="answerInput">Type your answer</label><input id="answerInput" class="answer-input" type="text" autocomplete="off" spellcheck="false" placeholder="Type your answer…"><p class="input-helper">${q.type === 'short_answer_question' ? 'Follow the format in the question.' : 'Use the same answer wording. Capitalization is ignored.'}</p>`;
  else answers = `<div class="game-choices" role="group" aria-label="Answer choices">${g.displayOptions.map((option, index) => `<button type="button" class="choice-button" data-choice-index="${index}" aria-pressed="false"><span class="choice-key">${String.fromCharCode(65 + index)}</span><span>${escapeHTML(option)}</span></button>`).join('')}</div>`;
  $('gameContent').innerHTML = `<article class="question-card"><div class="question-card-head"><span class="question-tag">${escapeHTML(typeName(q).toUpperCase())} · ${escapeHTML(sourceName(q).toUpperCase())}</span><span class="difficulty-tag">${difficulty(q) > .72 ? 'HARD' : difficulty(q) > .38 ? 'MEDIUM' : 'WARM-UP'} · ${100 + Math.round(difficulty(q) * 75)} PTS</span></div><div class="question-prompt" id="currentQuestion">${safeQuestionHTML(q)}</div>${answers}<div id="feedbackSlot"></div><div class="question-actions"><div class="question-actions-left">${powerMarkup(g, q)}<button type="button" class="hint-button" data-action="hint">💡 Hint bot</button></div><button type="button" id="answerAction" class="question-submit" data-action="${isType || isMulti ? 'submit' : 'skip'}" ${isType || isMulti ? 'disabled' : ''}>${isType || isMulti ? 'Check answer' : 'Skip question'}</button></div><div id="coachSlot"></div></article>`;
  if (isType) $('answerInput').focus();
  g.questionAt = performance.now();
  announce(`Question ${g.completed + 1} of ${g.total}. ${q.question}`);
}
function showCoach() {
  const g = app.game; if (!g || g.answered) return;
  g.coachOpen = true;
  const q = g.current; const stem = q.question.toLocaleLowerCase();
  const topic = stem.includes('etherchannel') ? 'EtherChannel negotiation and settings' : stem.includes('stp') || stem.includes('spanning') ? 'spanning tree roles and states' : stem.includes('dhcp') ? 'DHCP configuration and addressing' : stem.includes('vlan') ? 'VLAN behavior' : stem.includes('ipv6') ? 'IPv6 addressing' : 'the exact term used in the question';
  let message = `Start with ${topic}. Read the last sentence first, then look for the choice that answers it directly.`;
  if (g.hintStep >= 1) {
    const words = answerText(q).split(/\s+/).filter(Boolean);
    message = `The answer has ${words.length} word${words.length === 1 ? '' : 's'} and begins with “${(words[0] || '?')[0]}”. Compare the choices carefully.`;
  }
  if (g.hintStep >= 2) {
    const words = answerText(q).replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(w => w.length >= 4);
    const cue = words[Math.floor(words.length / 2)] || answerText(q).slice(0, 4);
    message = `Final clue: look for the word “${cue}” in the answer. You can still solve this yourself.`;
  }
  $('coachSlot').innerHTML = `<div class="coach-panel"><div class="coach-title">💡 HINT BOT · OFFLINE COACH</div><p class="coach-chat">${escapeHTML(message)}</p><button type="button" data-action="more-hint" ${g.hintStep >= 2 ? 'disabled' : ''}>${g.hintStep >= 2 ? 'All hints shown' : 'One more hint'}</button></div>`;
}
function usePower(name) {
  const g = app.game, q = g?.current;
  if (!g || !q || g.answered || !g.unlocked[name] || g.used[name]) return;
  if (name === 'fifty') {
    const wrong = g.displayOptions.map((option, index) => ({ option, index })).filter(item => !isCorrectOption(q, item.option));
    if (wrong.length < 2) return;
    shuffle(wrong).slice(0, 2).forEach(item => { g.hiddenChoices.add(item.index); const button = document.querySelector(`[data-choice-index="${item.index}"]`); if (button) { button.disabled = true; button.classList.add('is-muted'); } });
  } else if (name === 'shield') g.activeShield = true;
  else if (name === 'freeze') g.freezeUntil = performance.now() + 8000;
  g.used[name] = true; playTone('click'); toast(name === 'fifty' ? 'Two wrong choices removed.' : name === 'shield' ? 'Shield ready for one missed answer.' : 'Clock frozen for 8 seconds.');
  document.querySelectorAll(`[data-power="${name}"]`).forEach(button => { button.disabled = true; button.classList.add('is-active'); });
}
function checkTypedAnswer(q, typed) {
  const exactCase = /lowercase only/i.test(q.question);
  return q.correctAnswers.some(answer => exactCase ? typed.trim() === answer.trim() : normalize(typed) === normalize(answer));
}
function checkAnswer() {
  const g = app.game, q = g?.current; if (!g || !q || g.answered) return;
  const typed = g.mode === 'typing' || q.type === 'short_answer_question' || !g.displayOptions.length;
  let correct = false, response = '';
  if (typed) { response = $('answerInput')?.value || ''; if (!response.trim()) return; correct = checkTypedAnswer(q, response); }
  else { if (!g.selected.size) return; const picks = [...g.selected].map(index => g.displayOptions[index]); response = picks.join(' · '); const expected = new Set(q.correctAnswers.map(normalize)); correct = picks.length === expected.size && picks.every(option => expected.has(normalize(option))); }
  resolveAnswer(correct, response);
}
function resolveAnswer(correct, response = '') {
  const g = app.game, q = g?.current; if (!g || !q || g.answered) return;
  g.answered = true;
  g.attempts++;
  const responseMs = Math.round(performance.now() - g.questionAt);
  const base = 100 + Math.round(difficulty(q) * 75);
  let points = 0;
  if (correct) {
    g.streak++; g.correct++; g.bestStreak = Math.max(g.bestStreak, g.streak);
    points = Math.round(base * (1 + Math.min(g.streak - 1, 9) * .12)) + g.wager;
    if (g.mode === 'blitz') points += Math.round(Math.max(0, g.remainingTime) * 3);
    g.score += points;
    if (g.streak >= 2) g.unlocked.fifty = true;
    if (g.streak >= 3) g.unlocked.shield = true;
    if (g.streak >= 4) g.unlocked.freeze = true;
    playTone('good'); burst();
  } else {
    g.hearts = Math.max(0, g.hearts - 1);
    if (g.activeShield) { g.activeShield = false; toast('Shield saved your streak!'); }
    else g.streak = 0;
    g.score = Math.max(0, g.score - g.wager);
    g.missed.push(q);
    playTone('bad');
  }
  g.completed++;
  g.events.push({ t: Math.round(performance.now() - g.startedAt), score: g.score, completed: g.completed, correct, responseMs });
  updateHUD();
  const slot = $('feedbackSlot');
  const resultWord = correct ? ['Nice link!', 'You got it!', 'Great call!', 'That is the one!'][Math.floor(Math.random() * 4)] : 'Keep going — you are learning.';
  slot.innerHTML = `<div class="feedback ${correct ? 'is-correct' : 'is-wrong'}"><strong>${resultWord}</strong>${correct ? `+${formatNumber(points)} points${g.wager ? ` · ${formatNumber(g.wager)} wager won` : ''}` : `${response ? 'Your answer: ' + escapeHTML(response) + '. ' : ''}${g.wager ? `${formatNumber(g.wager)} points lost. ` : ''}<span class="answer-line">Correct answer: ${escapeHTML(answerText(q))}</span>`}</div>`;
  document.querySelectorAll('.choice-button').forEach(button => {
    const index = +button.dataset.choiceIndex, option = g.displayOptions[index];
    button.disabled = true;
    if (isCorrectOption(q, option)) button.classList.add('is-correct');
    else if (g.selected.has(index)) button.classList.add('is-wrong');
  });
  const input = $('answerInput'); if (input) { input.disabled = true; input.classList.add(correct ? 'is-correct' : 'is-wrong'); }
  document.querySelectorAll('.power-button,.hint-button').forEach(button => { button.disabled = true; });
  $('answerAction').disabled = false; $('answerAction').dataset.action = 'next'; $('answerAction').textContent = g.hearts <= 0 || g.completed >= g.total ? 'See results ↗' : 'Next question ↗';
  announce(`${correct ? 'Correct' : 'Incorrect'}. ${correct ? points + ' points earned.' : 'Correct answer: ' + answerText(q)} ${g.hearts} hearts remain.`);
  if (g.mode === 'blitz' && correct) setTimeout(() => { if (app.game === g && g.answered && app.view === 'game') nextQuestion(); }, 1000);
}
function tick() {
  const g = app.game; if (!g || app.view !== 'game') return;
  const now = performance.now();
  if (g.mode === 'blitz' && !g.answered && g.current && !$('gameContent').querySelector('.wager-card')) {
    const delta = now - g.timerLast; if (now >= g.freezeUntil) g.remainingTime = Math.max(0, g.remainingTime - delta / 1000);
    g.timerLast = now;
    if (g.remainingTime <= 0) { resolveAnswer(false); toast('Time is up!'); }
  } else g.timerLast = now;
  updateHUD();
}
function elapsedTime(ms) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function updateHUD() {
  const g = app.game; if (!g) return;
  $('heartsDisplay').textContent = '♥ '.repeat(g.hearts) + '♡ '.repeat(3 - g.hearts);
  $('heartsDisplay').setAttribute('aria-label', `${g.hearts} hearts remaining`);
  $('streakDisplay').textContent = `⚡ ${g.streak}`; $('scoreDisplay').textContent = formatNumber(g.score);
  $('timerDisplay').textContent = g.mode === 'blitz' ? (performance.now() < g.freezeUntil ? `❄ ${Math.ceil(g.remainingTime)}s` : `${Math.ceil(g.remainingTime)}s`) : elapsedTime(performance.now() - g.startedAt);
  $('timerDisplay').parentElement.classList.toggle('is-urgent', g.mode === 'blitz' && g.remainingTime <= 4 && !g.answered);
  const percent = g.total ? Math.min(100, Math.round((g.completed / g.total) * 100)) : 0;
  $('progressFill').style.width = `${percent}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', String(percent));
  const shown = g.mode === 'matching' ? g.completed + 1 : g.answered ? g.completed : g.completed + 1;
  $('questionPosition').textContent = `${g.mode === 'matching' ? 'Pair' : 'Question'} ${Math.min(shown, g.total)} of ${g.total}`;
  if (g.ghost) {
    const elapsed = performance.now() - g.startedAt;
    const past = g.ghost.events.filter(e => e.t <= elapsed); const ghostEvent = past[past.length - 1];
    $('ghostProgress').textContent = `👻 Ghost ${formatNumber(ghostEvent?.score || 0)} pts · ${ghostEvent?.completed || 0}/${g.ghost.total}`;
    $('raceTrack').hidden = false;
    $('playerRaceFill').style.width = `${percent}%`;
    $('ghostRaceFill').style.width = `${Math.min(100, Math.round(((ghostEvent?.completed || 0) / g.ghost.total) * 100))}%`;
  } else { $('ghostProgress').textContent = ''; $('raceTrack').hidden = true; }
}

function renderMatchBoard() {
  const g = app.game; if (!g) return;
  if (g.completed >= g.total || g.hearts <= 0) { finishGame(); return; }
  const group = g.order.slice(g.completed, g.completed + Math.min(4, g.total - g.completed));
  g.matchPairs = group.map(q => ({ q, matched: false })); g.matchChoice = { left: null, right: null };
  const answers = shuffle(group);
  $('gameContent').innerHTML = `<div class="match-card"><span class="question-tag">MATCH MAKER · ROUND ${Math.floor(g.completed / 4) + 1}</span><h2>Connect the dots.</h2><p>Tap a question, then its answer. Each correct pair earns points.</p><div class="match-grid"><div class="match-column"><h3>QUESTIONS</h3>${group.map(q => `<button type="button" class="match-option" data-match-side="left" data-match-id="${q.id}">${escapeHTML(q.question)}</button>`).join('')}</div><div class="match-column"><h3>ANSWERS</h3>${answers.map(q => `<button type="button" class="match-option" data-match-side="right" data-match-id="${q.id}">${escapeHTML(answerText(q))}</button>`).join('')}</div></div></div>`;
  announce(`Match maker round ${Math.floor(g.completed / 4) + 1}. Match four questions with their answers.`);
  updateHUD();
}
function handleMatchClick(button) {
  const g = app.game; if (!g || g.mode !== 'matching' || button.disabled) return;
  const side = button.dataset.matchSide, id = +button.dataset.matchId;
  if (g.matchChoice[side] === id) { g.matchChoice[side] = null; button.classList.remove('is-selected'); return; }
  document.querySelectorAll(`[data-match-side="${side}"].is-selected`).forEach(el => el.classList.remove('is-selected'));
  g.matchChoice[side] = id; button.classList.add('is-selected');
  if (g.matchChoice.left === null || g.matchChoice.right === null) return;
  const left = document.querySelector(`[data-match-side="left"][data-match-id="${g.matchChoice.left}"]`);
  const right = document.querySelector(`[data-match-side="right"][data-match-id="${g.matchChoice.right}"]`);
  if (g.matchChoice.left === g.matchChoice.right) {
    left.classList.remove('is-selected'); right.classList.remove('is-selected');
    left.classList.add('is-matched'); right.classList.add('is-matched'); left.disabled = true; right.disabled = true;
    g.attempts++; g.streak++; g.bestStreak = Math.max(g.bestStreak, g.streak); g.correct++; g.score += 70 + Math.min(90, g.streak * 10); g.completed++;
    if (g.streak >= 2) g.unlocked.fifty = true; if (g.streak >= 3) g.unlocked.shield = true;
    g.events.push({ t: Math.round(performance.now() - g.startedAt), score: g.score, completed: g.completed, correct: true, responseMs: 0 });
    playTone('good'); burst(); announce(`Matched. ${g.streak} streak.`);
    if (g.matchPairs.every(pair => document.querySelector(`[data-match-side="left"][data-match-id="${pair.q.id}"]`)?.disabled)) setTimeout(() => { if (app.game === g) renderMatchBoard(); }, 850);
  } else {
    g.attempts++; g.hearts = Math.max(0, g.hearts - 1); g.streak = 0; playTone('bad');
    g.events.push({ t: Math.round(performance.now() - g.startedAt), score: g.score, completed: g.completed, correct: false, responseMs: 0 });
    left.classList.add('is-error'); right.classList.add('is-error');
    toast('Not a match. Try another connection.'); announce(`Not a match. ${g.hearts} hearts remain.`);
    setTimeout(() => { left?.classList.remove('is-error', 'is-selected'); right?.classList.remove('is-error', 'is-selected'); if (g.hearts <= 0 && app.game === g) finishGame(); }, 480);
  }
  g.matchChoice = { left: null, right: null }; updateHUD();
}
function validGhost(record) {
  return record && record.version === 1 && modeInfo[record.mode] && Number.isFinite(record.total) && record.total > 0 && Array.isArray(record.events) && record.events.length <= 1000 && record.events.every(e => Number.isFinite(e.t) && e.t >= 0 && Number.isFinite(e.score) && Number.isFinite(e.completed));
}
function finishGame() {
  const g = app.game; if (!g || app.view === 'result') return;
  clearInterval(app.timer); app.timer = null;
  const duration = Math.round(performance.now() - g.startedAt);
  const record = { version: 1, mode: g.mode, total: g.total, completed: g.completed, score: g.score, duration, events: g.events };
  writeJSON(`pp_ghost_${g.mode}`, record);
  app.stats.runs++; app.stats.correct += g.correct; app.stats.bestStreak = Math.max(app.stats.bestStreak, g.bestStreak); app.stats.bestScore = Math.max(app.stats.bestScore, g.score); writeJSON('pp_stats', app.stats); updateStats();
  g.record = record;
  const won = g.completed === g.total && g.hearts > 0;
  const accuracy = g.attempts ? Math.round((g.correct / g.attempts) * 100) : 0;
  $('resultContent').innerHTML = `<div class="result-card"><div class="result-burst" aria-hidden="true">✳</div><span class="section-kicker" style="color:#676ac0">RUN COMPLETE</span><h1>${won ? 'You cleared the deck!' : 'One more run?'} </h1><p>${won ? 'That was a clean finish. Your next personal best is waiting.' : 'Every attempt makes the next answer easier. Your progress is saved here.'}</p><div class="result-metrics"><div><strong>${formatNumber(g.score)}</strong><span>POINTS</span></div><div><strong>${accuracy}%</strong><span>ACCURACY</span></div><div><strong>${g.bestStreak}</strong><span>BEST STREAK</span></div><div><strong>${elapsedTime(duration)}</strong><span>TIME</span></div></div><div class="result-actions"><button type="button" class="button button-primary" data-result="again">Play again ↗</button><button type="button" class="button button-outline" data-result="bank">Browse questions</button><button type="button" class="button button-outline" data-result="export">Export ghost ↓</button></div>${g.missed.length ? `<div class="review-list"><h2>Worth another look</h2>${g.missed.slice(0, 8).map(q => `<div class="review-item"><strong>#${q.id} ${escapeHTML(q.question)}</strong><span>Answer: ${escapeHTML(answerText(q))}</span></div>`).join('')}</div>` : ''}<p class="result-note">Ghost files store your time and score only. Share a file to race a friend offline.</p></div>`;
  setView('result'); announce(`Run complete. ${g.score} points, ${accuracy} percent accuracy.`);
}
function exportGhost() {
  const record = app.game?.record; if (!record) return;
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `packet-party-${record.mode}-ghost.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Ghost run exported. Share the file with a friend.');
}

async function loadQuestions() {
  try {
    const response = await fetch('./questions.json', { cache: 'no-cache' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json(); if (!Array.isArray(data.questions)) throw new Error('Missing questions');
    app.questions = data.questions.filter(q => q && q.question && Array.isArray(q.correctAnswers) && q.correctAnswers.length && Array.isArray(q.options)).map((q, index) => ({ ...q, id: Number(q.id) || index + 1 }));
    prepareDifficulty(); renderHome(); renderBank();
  } catch (error) {
    $('questionCount').textContent = '0'; $('bankList').innerHTML = `<div class="bank-empty"><strong>The deck could not load</strong>Open this site through a web server or refresh the page. (${escapeHTML(error.message)})</div>`;
    toast('The question deck could not load.');
  }
}
function attachEvents() {
  $('brandButton').addEventListener('click', () => setView('home'));
  document.querySelectorAll('.nav-link').forEach(button => button.addEventListener('click', () => { if (app.game && app.view === 'game') clearInterval(app.timer); setView(button.dataset.view); }));
  $('heroStart').addEventListener('click', () => openSetup('shuffle'));
  $('heroBrowse').addEventListener('click', () => setView('bank'));
  $('progressBrowse').addEventListener('click', () => setView('bank'));
  document.querySelectorAll('.mode-card').forEach(button => button.addEventListener('click', () => openSetup(button.dataset.mode)));
  $('soundButton').addEventListener('click', () => { app.soundOn = !app.soundOn; writeJSON('pp_sound', app.soundOn); updateSoundButton(); if (app.soundOn) playTone('click'); });
  $('closeSetup').addEventListener('click', () => $('setupDialog').close());
  $('setupForm').addEventListener('submit', event => { event.preventDefault(); $('setupDialog').close(); startGame(); });
  $('ghostFile').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 1000000) { toast('That ghost file is too large.'); return; }
    try { const record = JSON.parse(await file.text()); if (!validGhost(record)) throw new Error('Invalid ghost file'); app.importedGhost = record; $('ghostFileName').textContent = `${file.name} · ${modeInfo[record.mode].name}`; $('ghostToggle').checked = true; toast('Ghost imported.'); }
    catch { app.importedGhost = null; $('ghostFileName').textContent = 'Could not read that ghost file'; toast('That file is not a Packet Party ghost.'); }
  });
  for (const id of ['bankSearch', 'bankSource', 'bankType']) $(id).addEventListener(id === 'bankSearch' ? 'input' : 'change', () => { app.bankLimit = 16; app.bankAll = false; renderBank(); });
  $('revealAllButton').addEventListener('click', () => { app.bankRevealAll = !app.bankRevealAll; renderBank(); });
  $('bankShowAll').addEventListener('click', () => { app.bankAll = !app.bankAll; app.bankLimit = 16; renderBank(); });
  $('bankMore').addEventListener('click', () => { app.bankLimit += 16; renderBank(); });
  $('bankList').addEventListener('click', event => {
    const button = event.target.closest('[data-bank-action]'); if (!button) return;
    const id = +button.closest('[data-id]').dataset.id;
    if (button.dataset.bankAction === 'star') { if (app.favorites.has(id)) app.favorites.delete(id); else app.favorites.add(id); writeJSON('pp_favorites', [...app.favorites]); }
    else { if (app.bankRevealed.has(id)) app.bankRevealed.delete(id); else app.bankRevealed.add(id); }
    renderBank();
  });
  $('leaveGame').addEventListener('click', () => { clearInterval(app.timer); app.timer = null; app.game = null; setView('home'); });
  $('gameContent').addEventListener('click', event => {
    const wager = event.target.closest('[data-wager]'); if (wager) { const g = app.game; g.wager = Math.floor(g.score * (+wager.dataset.wager / 100)); playTone('click'); renderQuestion(); return; }
    const match = event.target.closest('[data-match-side]'); if (match) { handleMatchClick(match); return; }
    const power = event.target.closest('[data-power]'); if (power) { usePower(power.dataset.power); return; }
    const choice = event.target.closest('[data-choice-index]');
    if (choice && app.game && !app.game.answered) {
      const index = +choice.dataset.choiceIndex, g = app.game, multi = g.current.correctAnswers.length > 1;
      if (multi) { if (g.selected.has(index)) g.selected.delete(index); else g.selected.add(index); choice.classList.toggle('is-selected', g.selected.has(index)); choice.setAttribute('aria-pressed', String(g.selected.has(index))); $('answerAction').disabled = !g.selected.size; }
      else { g.selected = new Set([index]); checkAnswer(); }
      return;
    }
    const action = event.target.closest('[data-action]'); if (!action) return;
    if (action.dataset.action === 'hint') showCoach();
    else if (action.dataset.action === 'more-hint') { app.game.hintStep++; showCoach(); }
    else if (action.dataset.action === 'submit') checkAnswer();
    else if (action.dataset.action === 'skip') resolveAnswer(false);
    else if (action.dataset.action === 'next') nextQuestion();
  });
  $('gameContent').addEventListener('input', event => { if (event.target.id === 'answerInput') $('answerAction').disabled = !event.target.value.trim(); });
  $('gameContent').addEventListener('keydown', event => { if (event.target.id === 'answerInput' && event.key === 'Enter') { event.preventDefault(); checkAnswer(); } });
  $('resultContent').addEventListener('click', event => { const action = event.target.closest('[data-result]')?.dataset.result; if (action === 'again') openSetup(app.mode); else if (action === 'bank') setView('bank'); else if (action === 'export') exportGhost(); });
  document.addEventListener('keydown', event => {
    if (app.view !== 'game' || !app.game || event.target.matches('input, textarea, select') || $('setupDialog').open) return;
    if (event.key >= '1' && event.key <= '9') { const choice = document.querySelector(`[data-choice-index="${+event.key - 1}"]`); if (choice && !choice.disabled) choice.click(); }
    if (event.key === 'Enter' && app.game.answered) $('answerAction')?.click();
  });
}
updateSoundButton(); updateStats(); attachEvents(); loadQuestions();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
