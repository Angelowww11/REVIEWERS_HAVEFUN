/* Solo progress stays in this browser; ranked scores and live rooms use the API. */
const $ = id => document.getElementById(id);
const deckId = new URL(location.href).searchParams.get('deck') === 'ccst' ? 'ccst-notebook' : 'pools';
function deckStorageKey(key) { return deckId === 'ccst-notebook' ? key.replace(/^pp_/, 'pp_ccst_notebook_') : key; }
const modeInfo = {
  all: { name: 'All questions', eyebrow: 'COMPLETE DECK', description: 'The full deck, in order.' },
  shuffle: { name: 'Shuffle run', eyebrow: 'FRESH EACH TIME', description: 'The full deck, reshuffled.' },
  adaptive: { name: 'Level up', eyebrow: '20 QUESTION SPRINT', description: '20 questions that respond to your pace.' },
  blitz: { name: 'Boss blitz', eyebrow: 'BEAT THE CLOCK', description: '15 questions against the clock.' },
  matching: { name: 'Match maker', eyebrow: 'TAP TO PAIR', description: 'Pair questions with answers.' },
  typing: { name: 'Type it out', eyebrow: 'NO CHOICES', description: 'Answer from memory.' },
  training: { name: 'Training loop', eyebrow: 'MASTER EVERY QUESTION', description: 'Choose 20, 30, or all 99. Retry misses until every answer is right.' }
};
const rankedModes = ['all', 'shuffle', 'adaptive', 'blitz'];
const resumableModes = [...rankedModes, 'training'];
const badgeTiers = [
  { name: 'Noob', points: 0, icon: '○' },
  { name: 'Beginner', points: 1000, icon: '✦' },
  { name: 'Intermediate', points: 5000, icon: '◆' },
  { name: 'Pro', points: 15000, icon: '★' },
  { name: 'Packet Hacker', points: 40000, icon: '⚡' },
  { name: 'Packet Gods', points: 100000, icon: '♛' }
];
const savedRunVersion = 1;
const powerCosts = { fifty: 70, shield: 45, freeze: 60 };
const quotes = [
  'One packet at a time', 'Small wins add up', 'Your next answer is a fresh start',
  'The streak starts with one', 'Learn it, link it, beat it', 'Progress looks good on you',
  'A wrong answer is useful data', 'You know more than you think', 'Stay curious, stay connected'
];
const app = {
  questions: [], explanations: {}, mode: 'shuffle', view: 'home', game: null, bankLimit: 16,
  bankAll: false, bankRevealAll: false, bankRevealed: new Set(), importedGhost: null,
  favorites: new Set(readJSON(deckStorageKey('pp_favorites'), [])),
  stats: readJSON(deckStorageKey('pp_stats'), { runs: 0, correct: 0, bestStreak: 0, bestScore: 0 }),
  soundOn: readJSON('pp_sound', false), timer: null, toastTimer: null, audio: null
};

function readJSON(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); window.packetAccountProgressChanged?.(key); } catch { /* Private browsing can disable storage. */ } }
function savedRunKey(mode) { return deckStorageKey(`pp_ranked_run_${mode}`); }
function readSavedRun(mode) {
  if (!resumableModes.includes(mode)) return null;
  const saved = readJSON(savedRunKey(mode), null);
  const valid = saved?.version === savedRunVersion && saved.mode === mode && Array.isArray(saved.order) && Number.isInteger(saved.total) && saved.total > 0 && Number.isInteger(saved.completed) && saved.completed >= 0 && saved.completed <= saved.total;
  return valid && (mode !== 'training' || saved.training && Number.isInteger(saved.training.originalTotal) && saved.training.originalTotal > 0 && Number.isInteger(saved.training.pass) && saved.training.pass > 0 && Array.isArray(saved.training.misses)) ? saved : null;
}
function clearSavedRun(mode) {
  try { localStorage.removeItem(savedRunKey(mode)); window.packetAccountProgressChanged?.(savedRunKey(mode)); } catch { /* Storage can be unavailable. */ }
  renderSavedRuns();
}
function saveRankedRun(stageOverride = null) {
  const g = app.game; if (!g || !resumableModes.includes(g.mode) || !g.current || app.view === 'result') return;
  const now = g.pausedAt || performance.now();
  writeJSON(savedRunKey(g.mode), {
    version: savedRunVersion, mode: g.mode, order: g.order.map(q => q.id), remaining: g.remaining.map(q => q.id), total: g.total,
    completed: g.completed, currentId: g.current.id, score: g.score, streak: g.streak, bestStreak: g.bestStreak,
    correct: g.correct, attempts: g.attempts, hearts: g.heartLimit === 'unlimited' ? 'unlimited' : g.hearts, heartLimit: g.heartLimit,
    missed: g.missed.map(q => q.id), selected: [...g.selected], answered: g.answered, wager: g.wager,
    hiddenChoices: [...g.hiddenChoices], displayOptions: g.displayOptions, hintStep: g.hintStep, coachOpen: g.coachOpen,
    used: g.used, activeShield: g.activeShield, elapsedMs: Math.max(0, now - g.startedAt),
    questionElapsedMs: Math.max(0, now - g.questionAt), remainingTime: g.remainingTime,
    freezeRemainingMs: Math.max(0, g.freezeUntil - now), events: g.events, history: g.history, ghost: g.ghost,
    firstCorrect: g.firstCorrect, lastResult: g.lastResult || null, dragMapping: g.dragMapping, dragItemOrder: g.dragItemOrder, dragTargetOrder: g.dragTargetOrder,
    draftAnswer: $('answerInput')?.value || '',
    training: g.training ? { originalTotal: g.training.originalTotal, pass: g.training.pass, misses: g.training.misses.map(item => ({ questionId: item.question.id, response: item.response })) } : null,
    stage: stageOverride || ($('gameContent')?.querySelector('.wager-card') ? 'wager' : 'question')
  });
}
function pauseRankedRun() {
  const g = app.game; if (!g || !resumableModes.includes(g.mode) || app.view !== 'game') return;
  g.pausedAt ||= performance.now();
  clearInterval(app.timer); app.timer = null;
  saveRankedRun();
}
function unpauseRankedRun() {
  const g = app.game; if (!g || !resumableModes.includes(g.mode) || app.view !== 'game' || document.hidden) return;
  if (g.pausedAt) {
    const pausedFor = performance.now() - g.pausedAt;
    g.startedAt += pausedFor; g.questionAt += pausedFor; g.freezeUntil += pausedFor;
    g.pausedAt = null;
  }
  g.timerLast = performance.now();
  if (!app.timer) app.timer = setInterval(tick, 100);
  updateHUD();
}
function renderSavedRuns() {
  const panel = $('savedRuns'); if (!panel) return;
  const runs = resumableModes.map(mode => readSavedRun(mode)).filter(Boolean);
  panel.hidden = !runs.length;
  panel.innerHTML = runs.length ? `<div class="saved-runs-heading"><span class="section-kicker">PICK UP WHERE YOU LEFT OFF</span><strong>Continue a run</strong></div><div class="saved-runs-list">${runs.map(run => { const detail = run.mode === 'training' ? run.stage === 'training-review' ? `Pass ${run.training.pass} complete · ${run.training.misses.length} to retry` : `Pass ${run.training.pass} · Question ${Math.min(run.completed + (run.answered ? 0 : 1), run.total)} of ${run.total}` : `Question ${Math.min(run.completed + (run.answered ? 0 : 1), run.total)} of ${run.total} · ${formatNumber(run.score)} pts`; return `<button type="button" class="saved-run-button" data-resume-mode="${run.mode}"><span><b>${escapeHTML(modeInfo[run.mode].name)}</b><small>${detail}</small></span><em>Continue ↗</em></button>`; }).join('')}</div>` : '';
}
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function normalize(value) { return String(value ?? '').trim().toLocaleLowerCase().replace(/[“”‘’]/g, '').replace(/[^\p{L}\p{N}.:/+-]+/gu, ' ').replace(/\s+/g, ' ').trim(); }
function shuffle(items) { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
function formatNumber(n) { return Number(n || 0).toLocaleString(); }
function lifetimeRankedPoints() { return Math.max(0, Number(app.stats.rankedPoints) || 0); }
function badgeForPoints(points) { return [...badgeTiers].reverse().find(tier => points >= tier.points) || badgeTiers[0]; }
function leaderboardBadge(entry) { return badgeForPoints(Number(entry.lifetimePoints ?? entry.score) || 0); }
function sourceName(q) { if (q.sourcePage) return `Reviewer p. ${q.sourcePage}`; const match = String(q.sourceFile || '').match(/pool\s+(\w+)/i); return match ? `Pool ${match[1].replace(/^./, c => c.toUpperCase())}` : 'Question pool'; }
function typeName(q) { return q.type === 'matching_question' ? 'Drag to match' : q.type === 'true_false_question' ? 'True / false' : q.type === 'short_answer_question' ? 'Short answer' : q.correctAnswers.length > 1 ? 'Multiple answers' : 'Multiple choice'; }
function isDragMatch(q) { return q?.type === 'matching_question' && (Array.isArray(q.dragPairs) ? q.dragPairs.length : q.dragItems?.length) > 1; }
function dragItems(q) { return q.dragItems || (q.dragPairs || []).map(pair => pair.item); }
function dragTargets(q) { return q.dragTargets || (q.dragPairs || []).map(pair => pair.target); }
function dragAnswer(q, pairIndex, targetIndex) { return `${dragItems(q)[pairIndex]} → ${dragTargets(q)[targetIndex]}`; }
function displayOrder(length, previous = null) {
  const indexes = Array.from({ length }, (_, index) => index);
  let order = shuffle(indexes);
  if (length > 1 && Array.isArray(previous) && order.every((value, index) => value === previous[index])) order = [...order.slice(1), order[0]];
  return order;
}
function validDisplayOrder(order, length) { return Array.isArray(order) && order.length === length && new Set(order).size === length && order.every(index => Number.isInteger(index) && index >= 0 && index < length); }
function renderDragMatch(q, mapping, disabled = false, side = 'solo', itemOrder = null, targetOrder = null) {
  const id = side === 'live' ? 'liveDrag' : side === 'practice' ? 'practiceDrag' : 'drag';
  const items = dragItems(q), targetList = dragTargets(q), itemIndexes = validDisplayOrder(itemOrder, items.length) ? itemOrder : items.map((_, index) => index), targets = validDisplayOrder(targetOrder, targetList.length) ? targetOrder : shuffle(targetList.map((_, index) => index));
  if (targets.length > 1 && targets.every((targetIndex, index) => targetIndex === index)) targets.push(targets.shift());
  const targetFor = index => mapping?.[index] ?? '';
  const left = itemIndexes.map(index => { const item = items[index]; return `<div class="drag-match-row"><button type="button" class="drag-match-prompt" data-drag-prompt="${index}" aria-label="Choose prompt ${escapeHTML(item)}" ${disabled ? 'disabled' : ''}><span class="drag-match-grip" aria-hidden="true">⠿</span><span>${escapeHTML(item)}</span></button><span class="drag-match-connector" aria-hidden="true">↔</span><select class="drag-match-slot drag-match-target ${targetFor(index) !== '' && targetFor(index) >= 0 ? 'has-match' : ''}" data-drag-slot="${index}" data-drag-select="${index}" aria-label="Drop or choose a match for ${escapeHTML(item)}" ${disabled ? 'disabled' : ''}><option value="">Drop answer here</option>${targets.map(targetIndex => `<option value="${targetIndex}" ${String(targetFor(index)) === String(targetIndex) ? 'selected' : ''}>${escapeHTML(targetList[targetIndex])}</option>`).join('')}</select></div>`; }).join('');
  const right = targets.map(targetIndex => { const target = targetList[targetIndex]; return `<button type="button" class="drag-match-chip" draggable="${!disabled}" data-drag-right="${targetIndex}" aria-label="Choose answer ${escapeHTML(target)}" aria-pressed="false" ${disabled ? 'disabled' : ''}><span aria-hidden="true">⠿</span>${escapeHTML(target)}</button>`; }).join('');
  return `<div class="drag-match-board ${side === 'live' ? 'drag-match-live' : ''}" data-drag-board="${id}"><div class="drag-match-list">${left}</div><div class="drag-match-targets"><span class="drag-match-caption">Tap an answer, then its prompt · or use the slot menu</span>${right}</div></div>`;
}
function dragMappingFrom(board) { return [...board.querySelectorAll('[data-drag-select]')].sort((a, b) => Number(a.dataset.dragSelect) - Number(b.dataset.dragSelect)).map(select => select.value === '' ? -1 : Number(select.value)); }
function dragPayload(q, mapping) { return mapping.map((target, index) => target < 0 ? '' : dragAnswer(q, index, target)); }
function isCompleteDrag(mapping) { return mapping.length > 1 && mapping.every(index => index >= 0); }
function gradeDrag(q, mapping) { const answers = dragPayload(q, mapping); const expected = new Set(q.correctAnswers.map(normalize)); return isCompleteDrag(mapping) && answers.length === expected.size && answers.every(answer => expected.has(normalize(answer))); }
function attachDragInteraction(container, selector, disabled = false) {
  if (disabled) return;
  let dragged = null;
  let pickedTarget = null;
  const caption = container.querySelector('.drag-match-caption');
  const defaultCaption = caption?.textContent || '';
  container.addEventListener('dragstart', event => { const chip = event.target.closest('[data-drag-right]'); if (!chip) return; dragged = Number(chip.dataset.dragRight); event.dataTransfer?.setData('text/plain', String(dragged)); });
  container.addEventListener('dragend', () => { dragged = null; });
  container.addEventListener('dragover', event => { if (event.target.closest('[data-drag-slot]')) event.preventDefault(); });
  container.addEventListener('drop', event => { const select = event.target.closest('[data-drag-slot]'); if (!select) return; event.preventDefault(); const index = Number(event.dataTransfer?.getData('text/plain') || dragged); if (index >= 0) { select.value = String(index); select.dispatchEvent(new Event('change', { bubbles: true })); } });
  container.addEventListener('click', event => {
    const prompt = event.target.closest('[data-drag-prompt]');
    if (prompt) {
      if (pickedTarget == null) { caption?.replaceChildren(document.createTextNode('Tap an answer first, or use the slot menu.')); const select = container.querySelector(`[data-drag-select="${prompt.dataset.dragPrompt}"]`); select?.focus(); try { select?.showPicker?.(); } catch { /* Native picker is optional. */ } return; }
      const select = container.querySelector(`[data-drag-select="${prompt.dataset.dragPrompt}"]`); if (!select || select.disabled) return;
      const other = [...container.querySelectorAll('[data-drag-select]')].find(candidate => candidate !== select && candidate.value === String(pickedTarget));
      const previous = select.value;
      select.value = String(pickedTarget);
      if (other) other.value = previous;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      if (other) other.dispatchEvent(new Event('change', { bubbles: true }));
      pickedTarget = null;
      container.querySelectorAll('[data-drag-right]').forEach(button => { button.classList.remove('is-picked'); button.setAttribute('aria-pressed', 'false'); });
      if (caption) caption.textContent = defaultCaption;
      return;
    }
    const chip = event.target.closest('[data-drag-right]'); if (!chip) return;
    const target = Number(chip.dataset.dragRight);
    pickedTarget = pickedTarget === target ? null : target;
    if (caption) caption.textContent = pickedTarget == null ? defaultCaption : 'Answer picked · tap its matching prompt';
    container.querySelectorAll('[data-drag-right]').forEach(button => { const isPicked = Number(button.dataset.dragRight) === pickedTarget; button.classList.toggle('is-picked', isPicked); button.setAttribute('aria-pressed', String(isPicked)); });
  });
  container.addEventListener('change', event => {
    const select = event.target.closest('[data-drag-select]'); if (!select) return;
    select.classList.toggle('has-match', select.value !== '');
  });
}
function hasImage(q) { return /<img\b/i.test(q.questionHtml || ''); }
function isCorrectOption(q, option) { return (q.correctAnswers || []).some(a => normalize(a) === normalize(option)); }
function answerText(q) { return (q.correctAnswers || []).join(' · '); }
function explanationText(q) { return app.explanations[q.id] || 'Compare the key term in the question with the correct answer, then try this card again later.'; }
function hintMessages(q) {
  const prompt = String(q.question || '').toLocaleLowerCase();
  return [
    'First identify what the question asks for: a command, a role, a cause, or a result. Then read every condition before choosing.',
    /\b(not|except|least|incorrect)\b/.test(prompt)
      ? 'This asks for an exception. Check which option fails the stated condition rather than picking a familiar true statement.'
      : 'Compare each choice with the exact condition in the question. A related fact is not enough unless it fits this scenario.',
    hasImage(q)
      ? 'Trace one device, port, or packet at a time through the exhibit. Check where the state or path changes.'
      : 'Predict the behavior in your own words before looking at the choices again, then test the remaining options against it.'
  ];
}
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
      img.setAttribute('loading', 'lazy'); img.setAttribute('tabindex', '0'); img.setAttribute('role', 'button');
      img.setAttribute('title', 'Tap to enlarge'); return img;
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
    const tones = ({ good: [[530, 0], [660, .075], [840, .15]], bad: [[330, 0], [250, .13]], power: [[520, 0], [720, .07]], fifty: [[660, 0], [900, .06], [1120, .13]], shield: [[440, 0], [660, .08], [880, .16]], freeze: [[950, 0], [720, .11], [1050, .2]], splat: [[310, 0], [220, .08], [410, .16]], zap: [[880, 0], [520, .06], [980, .13]], ward: [[440, 0], [590, .08], [760, .16]], scramble: [[710, 0], [470, .07], [790, .14]], lucky: [[520, 0], [690, .07], [920, .14]], clear: [[610, 0], [820, .07]] })[kind] || [[590, 0]];
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
function updateStats() {
  $('headerBest').textContent = formatNumber(app.stats.bestStreak); $('runsCount').textContent = formatNumber(app.stats.runs);
  const points = lifetimeRankedPoints(), current = badgeForPoints(points), next = badgeTiers[badgeTiers.indexOf(current) + 1];
  $('careerBadgeTitle').textContent = `${current.icon} ${current.name}`;
  $('careerBadgeProgress').textContent = next ? `${formatNumber(points)} pts · ${formatNumber(next.points - points)} to ${next.name}` : `${formatNumber(points)} lifetime points · top title`;
  $('badgeLadder').innerHTML = badgeTiers.map(tier => `<span class="badge-ladder-step ${points >= tier.points ? 'is-earned' : ''}"><b>${tier.icon} ${tier.name}</b><small>${formatNumber(tier.points)} pts</small></span>`).join('');
}
function setView(view) {
  if (app.view === 'game' && view !== 'game' && view !== 'result') pauseRankedRun();
  app.view = view;
  document.body.dataset.view = view;
  for (const id of ['home', 'bank', 'leaderboard', 'game', 'practice', 'live', 'result']) $(`${id}View`).hidden = id !== view;
  document.querySelectorAll('.nav-link').forEach(button => { const active = button.dataset.view === view; button.classList.toggle('is-active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  if (view === 'bank') renderBank();
  if (view === 'leaderboard') loadLeaderboard();
  if (view === 'home') { renderSavedRuns(); loadHomeLeaderboard(); }
  scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function renderHome() {
  const sources = new Set(app.questions.map(q => q.sourceFile).filter(Boolean));
  $('questionCount').textContent = formatNumber(app.questions.length);
  $('sourceCount').textContent = deckId === 'ccst-notebook' ? '1' : formatNumber(sources.size || 8);
  $('bankCountBadge').textContent = `${formatNumber(app.questions.length)} questions`;
  updateStats();
  renderPracticeCard();
  renderSavedRuns();
  const ticker = [...quotes, ...quotes].map(q => `<span><b>✳</b>${escapeHTML(q)}</span>`).join('');
  $('quoteTrack').innerHTML = ticker;
  renderLeaderboardModeTabs();
  loadHomeLeaderboard();
  const sourceSelect = $('bankSource');
  [...sources].sort((a, b) => { const an = +(a.match(/\d+/)?.[0] || 0), bn = +(b.match(/\d+/)?.[0] || 0); return an - bn; }).forEach(source => { const option = document.createElement('option'); option.value = source; option.textContent = source.replace(/\.html$/i, ''); sourceSelect.append(option); });
  if (!sources.size) sourceSelect.parentElement.hidden = true;
}

function renderDeckChrome() {
  document.body.dataset.deck = deckId;
  $('poolsDeckLink').setAttribute('aria-current', deckId === 'pools' ? 'page' : 'false');
  $('ccstDeckLink').setAttribute('aria-current', deckId === 'ccst-notebook' ? 'page' : 'false');
  if (deckId !== 'ccst-notebook') return;
  document.title = 'CCST Certification Review — Packet Party';
  $('deckSwitchNote').textContent = 'Midterm certification review';
  $('heroEyebrowText').textContent = 'CCST MIDTERM CERTIFICATION';
  $('heroLede').textContent = 'Study the checked CCST reviewer. Play solo or race friends.';
  $('sourceCountLabel').textContent = 'reviewer';
  $('bankSource').firstElementChild.textContent = 'All topics';
  const labels = ['IPv4/6', 'Security', 'Devices', 'Tools'];
  document.querySelectorAll('.stage-node strong').forEach((node, index) => { node.textContent = labels[index]; });
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
  $('bankShowAll').textContent = app.bankAll ? 'Show fewer' : `Show all ${app.questions.length} questions`;
  $('bankShowAll').setAttribute('aria-pressed', String(app.bankAll));
  $('bankMore').hidden = app.bankAll || visible.length >= matches.length;
  $('revealAllButton').textContent = app.bankRevealAll ? 'Hide answers' : 'Reveal answers';
  $('revealAllButton').setAttribute('aria-pressed', String(app.bankRevealAll));
  $('bankList').innerHTML = visible.length ? visible.map(q => {
    const revealed = app.bankRevealAll || app.bankRevealed.has(q.id);
    const options = q.type === 'short_answer_question' ? [] : q.options || [];
    return `<article class="bank-question" data-id="${q.id}"><div class="bank-q-top"><span class="bank-number">#${q.id}</span><span class="chip chip-source">${escapeHTML(sourceName(q))}</span><span class="chip">${escapeHTML(typeName(q))}</span><button type="button" class="star-button ${app.favorites.has(q.id) ? 'is-starred' : ''}" data-bank-action="star" aria-label="${app.favorites.has(q.id) ? 'Remove star from' : 'Star'} question ${q.id}" aria-pressed="${app.favorites.has(q.id)}">★</button></div><div class="bank-prompt">${safeQuestionHTML(q)}</div>${options.length ? `<div class="bank-choices">${options.map((option, index) => `<div class="bank-choice ${revealed && isCorrectOption(q, option) ? 'is-answer' : ''}"><i>${String.fromCharCode(65 + index)}</i><span>${escapeHTML(option)}</span></div>`).join('')}</div>` : ''}<div class="bank-actions"><button type="button" class="bank-reveal" data-bank-action="reveal">${revealed ? 'Hide answer' : 'Reveal answer'}</button>${revealed ? `<span class="bank-answer-note">✓ ${escapeHTML(answerText(q))}</span>` : ''}</div>${revealed ? `<p class="bank-explanation">${escapeHTML(explanationText(q))}</p>` : ''}</article>`;
  }).join('') : `<div class="bank-empty"><strong>No questions found</strong>Try a different search or filter.</div>`;
}

const practice = { index: 0, entries: {}, selected: new Set(), shuffleChoices: false, choiceOrder: {}, dragMappings: {}, dragItemOrders: {}, dragTargetOrders: {} };
function restorePractice() {
  const saved = readJSON(deckStorageKey('pp_practice_v1'), null);
  if (!saved || saved.version !== 1 || saved.count !== app.questions.length) return;
  practice.index = Number.isInteger(saved.index) ? Math.max(0, Math.min(app.questions.length - 1, saved.index)) : 0;
  practice.shuffleChoices = saved.shuffleChoices === true;
  if (saved.dragMappings && typeof saved.dragMappings === 'object') practice.dragMappings = saved.dragMappings;
  if (saved.dragItemOrders && typeof saved.dragItemOrders === 'object') practice.dragItemOrders = saved.dragItemOrders;
  if (saved.dragTargetOrders && typeof saved.dragTargetOrders === 'object') practice.dragTargetOrders = saved.dragTargetOrders;
  if (saved.choiceOrder && typeof saved.choiceOrder === 'object') {
    for (const q of app.questions) {
      const order = saved.choiceOrder[q.id];
      if (Array.isArray(order) && order.length === q.options.length && new Set(order).size === order.length && order.every(index => Number.isInteger(index) && index >= 0 && index < q.options.length)) practice.choiceOrder[q.id] = order;
    }
  }
  if (!saved.entries || typeof saved.entries !== 'object') return;
  const allowed = new Set(['correct', 'wrong', 'skipped', 'revealed']);
  for (const q of app.questions) {
    const entry = saved.entries[q.id];
    if (!entry || !allowed.has(entry.status)) continue;
    const response = Array.isArray(entry.response) ? entry.response.filter(item => typeof item === 'string').slice(0, 8) : typeof entry.response === 'string' ? entry.response.slice(0, 200) : '';
    practice.entries[q.id] = { status: entry.status, response };
  }
}
function savePractice() { writeJSON(deckStorageKey('pp_practice_v1'), { version: 1, count: app.questions.length, index: practice.index, entries: practice.entries, shuffleChoices: practice.shuffleChoices, choiceOrder: practice.choiceOrder, dragMappings: practice.dragMappings, dragItemOrders: practice.dragItemOrders, dragTargetOrders: practice.dragTargetOrders }); }
function renderPracticeCard() {
  const label = $('practiceCardProgress');
  if (label) label.textContent = practice.index || Object.keys(practice.entries).length ? `Continue at #${practice.index + 1}` : 'Start at #1';
}
function openPractice() {
  if (!app.questions.length) { toast('The question deck is still loading.'); return; }
  setView('practice'); renderPractice();
  announce(`Practice path. Question ${practice.index + 1} of ${app.questions.length}.`);
}
function practiceGoTo(index) {
  if (!Number.isInteger(index) || index < 0 || index >= app.questions.length) { toast(`Choose a number from 1 to ${app.questions.length}.`); return; }
  practice.index = index; practice.selected = new Set(); savePractice(); renderPractice(); renderPracticeCard();
  scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  announce(`Question ${index + 1} of ${app.questions.length}.`);
}
function resetPractice() {
  if (!confirm('Erase all Practice path answers and start again at question 1?')) return;
  practice.index = 0; practice.entries = {}; practice.selected = new Set(); practice.choiceOrder = {}; practice.dragMappings = {}; practice.dragItemOrders = {}; practice.dragTargetOrders = {};
  $('practiceJumpInput').value = '';
  savePractice(); renderPractice(); renderPracticeCard();
  scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  toast('Practice progress reset. Start fresh at question 1!');
}
function practiceRecord(q) { return practice.entries[q.id]; }
function practiceAnswered(record) { return record?.status === 'correct' || record?.status === 'wrong' || record?.status === 'revealed'; }
function practiceOptionsOrder(q) {
  const original = q.options.map((_, index) => index);
  if (!practice.shuffleChoices || original.length < 2) return original;
  if (!practice.choiceOrder[q.id]) {
    const order = shuffle(original);
    if (order.every((index, position) => index === position)) [order[0], order[1]] = [order[1], order[0]];
    practice.choiceOrder[q.id] = order;
    savePractice();
  }
  return practice.choiceOrder[q.id];
}
function practiceDragOrders(q, reroll = false) {
  const items = dragItems(q), targets = dragTargets(q);
  if (reroll || !validDisplayOrder(practice.dragItemOrders[q.id], items.length)) practice.dragItemOrders[q.id] = displayOrder(items.length, practice.dragItemOrders[q.id]);
  if (reroll || !validDisplayOrder(practice.dragTargetOrders[q.id], targets.length)) practice.dragTargetOrders[q.id] = displayOrder(targets.length, practice.dragTargetOrders[q.id]);
  return { items: practice.dragItemOrders[q.id], targets: practice.dragTargetOrders[q.id] };
}
function renderPractice() {
  const q = app.questions[practice.index]; if (!q) return;
  const record = practiceRecord(q), answered = practiceAnswered(record);
  const typed = q.type === 'short_answer_question' || !q.options.length;
  const drag = isDragMatch(q);
  const multi = !typed && q.correctAnswers.length > 1;
  const response = Array.isArray(record?.response) ? record.response : record?.response ? [record.response] : [];
  let answers;
  if (typed) answers = `<label class="sr-only" for="practiceAnswerInput">Type your answer</label><input id="practiceAnswerInput" class="answer-input" type="text" autocomplete="off" spellcheck="false" placeholder="Type your answer…" value="${escapeHTML(record?.response || '')}" ${answered ? 'disabled' : ''}><p class="input-helper">${q.type === 'short_answer_question' ? 'Follow the format in the question.' : 'Capitalization is ignored.'}</p>`;
  else if (drag) { const savedMap = Array.isArray(record?.mapping) ? record.mapping : practice.dragMappings[q.id]; const order = practiceDragOrders(q); answers = renderDragMatch(q, savedMap, answered, 'practice', order.items, order.targets); }
  else answers = `<div class="game-choices" role="group" aria-label="Answer choices${practice.shuffleChoices ? ' in shuffled order' : ' in original order'}">${practiceOptionsOrder(q).map((originalIndex, displayIndex) => { const option = q.options[originalIndex]; const picked = response.some(item => normalize(item) === normalize(option)); const correct = isCorrectOption(q, option); const cls = answered ? correct ? 'is-correct' : picked ? 'is-wrong' : '' : practice.selected.has(originalIndex) ? 'is-selected' : ''; return `<button type="button" class="choice-button ${cls}" data-practice-choice="${originalIndex}" aria-pressed="${picked || practice.selected.has(originalIndex)}" ${answered ? 'disabled' : ''}><span class="choice-key">${displayIndex + 1}</span><span>${escapeHTML(option)}</span></button>`; }).join('')}</div>`;
  const feedback = answered ? `<div class="feedback ${record.status === 'correct' ? 'is-correct' : 'is-wrong'}" role="status"><strong>${record.status === 'correct' ? 'You got it!' : record.status === 'revealed' ? 'Answer revealed' : 'Good one to review.'}</strong>${record.status === 'wrong' && response.length ? `<span class="practice-your-answer">Your answer: ${escapeHTML(response.join(' · '))}</span>` : ''}<span class="answer-line">Correct answer: ${escapeHTML(answerText(q))}</span><span class="feedback-explanation"><b>Why this answer works</b>${escapeHTML(explanationText(q))}</span><small class="recall-cue">Try explaining the idea in your own words before moving on.</small></div>` : record?.status === 'skipped' ? '<p class="practice-skipped-note">You skipped this one. Try it whenever you’re ready.</p>' : '';
  const action = answered ? '<button type="button" class="practice-retry" data-practice-action="retry">Try this question again</button>' : `<div class="practice-answer-actions">${typed || multi || drag ? `<button type="button" class="question-submit" data-practice-action="check" ${typed || drag ? 'disabled' : !practice.selected.size ? 'disabled' : ''}>Check answer</button>` : ''}<button type="button" class="practice-reveal" data-practice-action="reveal">Show answer</button></div>`;
  $('practiceContent').innerHTML = `<article class="question-card practice-question-card"><div class="question-card-head"><span class="question-tag">QUESTION ${practice.index + 1} · ${escapeHTML(sourceName(q).toUpperCase())}</span><span class="practice-type-tag">${escapeHTML(typeName(q))}</span></div><div class="question-prompt">${safeQuestionHTML(q)}</div>${answers}${feedback}${action}</article>`;
  if (drag) { const board = $('practiceContent').querySelector('[data-drag-board]'); attachDragInteraction(board, '#practiceContent'); const map = dragMappingFrom(board); const button = $('practiceContent').querySelector('[data-practice-action="check"]'); button.disabled = !isCompleteDrag(map); }
  const answeredCount = Object.values(practice.entries).filter(entry => entry.status === 'correct' || entry.status === 'wrong').length;
  const correctCount = Object.values(practice.entries).filter(entry => entry.status === 'correct').length;
  $('practiceProgressText').textContent = `${answeredCount} answered · ${correctCount} right`;
  $('practicePositionText').textContent = `Question ${practice.index + 1} of ${app.questions.length}`;
  $('practiceProgressFill').style.width = `${answeredCount / app.questions.length * 100}%`;
  $('practiceShuffleChoices').checked = practice.shuffleChoices;
  $('practiceJumpInput').max = String(app.questions.length);
  $('practicePrevious').disabled = practice.index === 0;
  $('practiceNext').disabled = practice.index === app.questions.length - 1;
  $('practiceSkip').disabled = practice.index === app.questions.length - 1;
  $('practiceNumberGrid').innerHTML = app.questions.map((item, index) => { const status = practice.entries[item.id]?.status || ''; return `<button type="button" data-practice-number="${index + 1}" class="${status ? `is-${status}` : ''} ${index === practice.index ? 'is-current' : ''}" aria-label="Question ${index + 1}${status ? `, ${status}` : ''}" ${index === practice.index ? 'aria-current="step"' : ''}>${index + 1}</button>`; }).join('');
}
function practiceSubmit(response) {
  const q = app.questions[practice.index]; if (!q || practiceAnswered(practiceRecord(q))) return;
  const picks = Array.isArray(response) ? response : String(response || '').trim();
  if (!Array.isArray(picks) && !picks) return;
  const mapping = isDragMatch(q) && Array.isArray(picks) ? picks.map(value => { const match = String(value).match(/ → (.*)$/); return match ? q.dragPairs.findIndex(pair => normalize(pair.target) === normalize(match[1])) : -1; }) : null;
  const correct = isDragMatch(q) ? gradeDrag(q, mapping) : Array.isArray(picks) ? (() => { const expected = new Set(q.correctAnswers.map(normalize)); return picks.length === expected.size && picks.every(option => expected.has(normalize(option))); })() : checkTypedAnswer(q, picks);
  practice.entries[q.id] = { status: correct ? 'correct' : 'wrong', response: picks, ...(mapping ? { mapping, itemOrder: practice.dragItemOrders[q.id], targetOrder: practice.dragTargetOrders[q.id] } : {}) };
  if (mapping) practice.dragMappings[q.id] = mapping;
  practice.selected = new Set(); savePractice(); renderPractice(); renderPracticeCard();
  playTone(correct ? 'good' : 'bad'); if (correct) burst();
  announce(correct ? 'Correct answer.' : `Try again later. Correct answer: ${answerText(q)}.`);
}

function openSetup(mode) {
  if (!app.questions.length) { toast('The question deck is still loading.'); return; }
  app.mode = mode; const info = modeInfo[mode];
  $('setupTitle').textContent = info.name; $('setupDescription').textContent = info.description;
  const count = mode === 'typing' ? Math.min(20, typingPool().length) : mode === 'matching' ? Math.min(12, matchingPool().length) : mode === 'adaptive' ? Math.min(20, app.questions.length) : mode === 'blitz' ? Math.min(15, app.questions.length) : mode === 'training' ? Math.min(Number($('trainingLengthSelect').value), app.questions.length) : app.questions.length;
  $('setupQuestionCount').textContent = `${count} questions`;
  $('trainingLengthField').hidden = mode !== 'training';
  $('heartLimitSelect').closest('.setup-field').hidden = mode === 'training';
  $('setupDialog').querySelector('.setup-more').hidden = mode === 'training';
  $('heartLimitSelect').value = String(readJSON(deckStorageKey('pp_heart_limit'), '3'));
  if (!['1', '3', '5', 'unlimited'].includes($('heartLimitSelect').value)) $('heartLimitSelect').value = '3';
  $('correctFirstToggle').checked = false;
  $('correctFirstToggle').closest('.switch-row').hidden = mode === 'typing' || mode === 'matching' || mode === 'training';
  const saved = readSavedRun(mode);
  $('setupResume').hidden = !saved;
  if (saved) {
    $('setupResumeTitle').textContent = `${info.name} is in progress`;
    $('setupResumeProgress').textContent = mode === 'training'
      ? saved.stage === 'training-review' ? `Pass ${saved.training.pass} complete · ${saved.training.misses.length} questions to retry. Starting new replaces this save.` : `Pass ${saved.training.pass} · Question ${Math.min(saved.completed + (saved.answered ? 0 : 1), saved.total)} of ${saved.total}. Starting new replaces this save.`
      : `Question ${Math.min(saved.completed + (saved.answered ? 0 : 1), saved.total)} of ${saved.total} · ${formatNumber(saved.score)} points. Starting new replaces this save.`;
  }
  $('setupStartButton').innerHTML = saved ? 'Start a new run <span aria-hidden="true">↗</span>' : 'Start playing <span aria-hidden="true">↗</span>';
  updateSetupRankNote();
  $('setupDialog').showModal();
}
function updateSetupRankNote() {
  const practice = !$('correctFirstToggle').closest('.switch-row').hidden && $('correctFirstToggle').checked;
  $('setupNote').textContent = app.mode === 'training' ? 'Unlimited hearts · every miss returns in the next pass.' : practice ? 'Practice only · this run is unranked.' : rankedModes.includes(app.mode) ? `${modeInfo[app.mode].name} runs can enter the public board.` : 'This mode is for practice; choose a ranked mode to enter the board.';
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
  const mode = app.mode;
  const heartLimit = mode === 'training' ? 'unlimited' : ['1', '3', '5', 'unlimited'].includes($('heartLimitSelect').value) ? $('heartLimitSelect').value : '3';
  if (mode !== 'training') writeJSON(deckStorageKey('pp_heart_limit'), heartLimit);
  const questions = app.questions;
  let order = mode === 'all' ? [...questions] : mode === 'shuffle' ? shuffle(questions) : mode === 'typing' ? shuffle(typingPool()).slice(0, 20) : mode === 'matching' ? matchingPool().slice(0, 12) : mode === 'blitz' ? shuffle(questions).slice(0, 15) : mode === 'training' ? shuffle(questions).slice(0, Math.min(Number($('trainingLengthSelect').value) || 99, questions.length)) : [];
  if (mode === 'matching' && order.length < 4) { toast('Not enough matching pairs in this deck.'); return; }
  if (mode === 'typing' && !order.length) { toast('No short answers are available.'); return; }
  if (rankedModes.includes(mode)) clearSavedRun(mode);
  if (mode === 'training') clearSavedRun(mode);
  const total = mode === 'adaptive' ? Math.min(20, questions.length) : order.length;
  let ghost = null;
  if (mode !== 'training' && $('ghostToggle').checked) {
    const candidate = app.importedGhost || readJSON(deckStorageKey(`pp_ghost_${mode}`), null);
    if (validGhost(candidate) && candidate.mode === mode) ghost = candidate;
    else toast('No ghost for this mode yet. Finish a run or import one.');
  }
  app.game = {
    mode, order, remaining: mode === 'adaptive' ? shuffle(questions) : [], total, completed: 0, current: null,
    score: 0, streak: 0, bestStreak: 0, correct: 0, attempts: 0, hearts: heartLimit === 'unlimited' ? Infinity : Number(heartLimit), heartLimit, missed: [], selected: new Set(),
    dragMapping: null, dragItemOrder: null, dragTargetOrder: null,
    answered: false, wager: 0, hiddenChoices: new Set(), hintStep: 0, coachOpen: false,
    used: { fifty: false, shield: false, freeze: false }, activeShield: false,
    startedAt: performance.now(), questionAt: performance.now(), timerLast: performance.now(), remainingTime: 0, freezeUntil: 0,
    events: [], history: [], ghost, firstCorrect: !['typing', 'matching', 'training'].includes(mode) && $('correctFirstToggle').checked, matchPairs: [], matchChoice: { left: null, right: null }, lastResult: null, pausedAt: null,
    training: mode === 'training' ? { originalTotal: order.length, pass: 1, misses: [] } : null
  };
  $('gameModeEyebrow').textContent = modeInfo[mode].eyebrow; $('gameModeName').textContent = modeInfo[mode].name;
  $('ghostBadge').hidden = !ghost;
  $('leaveGame').textContent = resumableModes.includes(mode) ? '← Save & leave' : '← Leave run';
  setView('game'); updateHUD();
  clearInterval(app.timer); app.timer = setInterval(tick, 100);
  if (mode === 'matching') renderMatchBoard(); else nextQuestion();
}
function resumeRankedRun(mode) {
  const saved = readSavedRun(mode); if (!saved || !app.questions.length) { toast('No saved run is available.'); return; }
  const byId = new Map(app.questions.map(q => [q.id, q]));
  const current = byId.get(saved.currentId);
  const valid = current && Array.isArray(saved.remaining) && Array.isArray(saved.missed) && Array.isArray(saved.selected) && Array.isArray(saved.hiddenChoices) &&
    saved.order.every(id => byId.has(id)) && saved.remaining.every(id => byId.has(id)) &&
    (mode === 'adaptive' || saved.order.length === saved.total) && Number.isFinite(saved.score) && saved.score >= 0 &&
    (saved.displayOptions == null || Array.isArray(saved.displayOptions) && saved.displayOptions.every(option => current.options.includes(option))) &&
    (!saved.answered || saved.lastResult && typeof saved.lastResult.correct === 'boolean') &&
    (mode !== 'training' || saved.training.misses.every(item => item && byId.has(item.questionId) && typeof item.response === 'string'));
  if (!valid) { clearSavedRun(mode); toast('This saved run no longer matches the question deck.'); return; }
  const now = performance.now();
  const heartLimit = ['1', '3', '5', 'unlimited'].includes(saved.heartLimit) ? saved.heartLimit : '3';
  const g = {
    mode, order: saved.order.map(id => byId.get(id)), remaining: (saved.remaining || []).map(id => byId.get(id)),
    total: saved.total, completed: saved.completed, current, score: saved.score,
    streak: Number(saved.streak) || 0, bestStreak: Number(saved.bestStreak) || 0,
    correct: Number(saved.correct) || 0, attempts: Number(saved.attempts) || 0,
    hearts: heartLimit === 'unlimited' ? Infinity : Math.max(0, Math.min(Number(heartLimit), Number(saved.hearts) || 0)), heartLimit,
    missed: (saved.missed || []).map(id => byId.get(id)).filter(Boolean), selected: new Set(saved.selected || []), dragMapping: Array.isArray(saved.dragMapping) ? saved.dragMapping : null,
    answered: Boolean(saved.answered), wager: Number(saved.wager) || 0,
    hiddenChoices: new Set(saved.hiddenChoices || []), displayOptions: saved.displayOptions || null,
    hintStep: Math.max(0, Math.min(2, Number(saved.hintStep) || 0)), coachOpen: Boolean(saved.coachOpen),
    used: { fifty: Boolean(saved.used?.fifty), shield: Boolean(saved.used?.shield), freeze: Boolean(saved.used?.freeze) },
    activeShield: Boolean(saved.activeShield), startedAt: now - Math.max(0, Number(saved.elapsedMs) || 0),
    questionAt: now - Math.max(0, Number(saved.questionElapsedMs) || 0), timerLast: now,
    remainingTime: Math.max(0, Number(saved.remainingTime) || 0), freezeUntil: now + Math.max(0, Number(saved.freezeRemainingMs) || 0),
    events: Array.isArray(saved.events) ? saved.events : [], history: Array.isArray(saved.history) ? saved.history.filter(item => item && byId.has(item.questionId) && Array.isArray(item.options) && Array.isArray(item.selected)) : [], ghost: validGhost(saved.ghost) ? saved.ghost : null,
    firstCorrect: Boolean(saved.firstCorrect), matchPairs: [], matchChoice: { left: null, right: null },
    dragItemOrder: validDisplayOrder(saved.dragItemOrder, isDragMatch(current) ? dragItems(current).length : 0) ? saved.dragItemOrder : isDragMatch(current) ? displayOrder(dragItems(current).length) : null,
    dragTargetOrder: validDisplayOrder(saved.dragTargetOrder, isDragMatch(current) ? dragTargets(current).length : 0) ? saved.dragTargetOrder : isDragMatch(current) ? displayOrder(dragTargets(current).length) : null,
    lastResult: saved.lastResult || null, pausedAt: null,
    training: mode === 'training' ? { originalTotal: saved.training.originalTotal, pass: saved.training.pass, misses: saved.training.misses.map(item => ({ question: byId.get(item.questionId), response: item.response })) } : null
  };
  clearInterval(app.timer); app.timer = null; app.mode = mode; app.game = g;
  $('gameModeEyebrow').textContent = modeInfo[mode].eyebrow; $('gameModeName').textContent = modeInfo[mode].name;
  $('ghostBadge').hidden = !g.ghost; $('leaveGame').textContent = '← Save & leave';
  setView('game');
  if (mode === 'training' && saved.stage === 'training-review') {
    finishTrainingPass();
    announce(`Training continued at the end of pass ${g.training.pass}.`);
    return;
  }
  if (saved.stage === 'wager' && !g.answered) renderWager();
  else {
    renderQuestion();
    const input = $('answerInput'); if (input) { input.value = saved.draftAnswer || ''; $('answerAction').disabled = !input.value.trim(); }
    document.querySelectorAll('.choice-button').forEach(button => {
      const selected = g.selected.has(Number(button.dataset.choiceIndex));
      button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    if (!input && g.current.correctAnswers.length > 1) $('answerAction').disabled = !g.selected.size;
    if (g.coachOpen) { const wasAnswered = g.answered; g.answered = false; showCoach(); g.answered = wasAnswered; }
    if (g.answered) renderAnswerFeedback(g);
  }
  g.questionAt = now - Math.max(0, Number(saved.questionElapsedMs) || 0);
  updateHUD(); unpauseRankedRun();
  announce(`Resumed ${modeInfo[mode].name}, question ${Math.min(g.completed + (g.answered ? 0 : 1), g.total)} of ${g.total}.`);
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
  if (g.completed >= g.total || g.hearts <= 0) { if (g.training) finishTrainingPass(); else finishGame(); return; }
  const preferHard = g.completed > 0 && g.completed % 5 === 0 && g.score >= 100;
  g.current = g.mode === 'adaptive' ? selectAdaptiveQuestion(g, preferHard) : g.order[g.completed];
  if (!g.current) { if (g.training) finishTrainingPass(); else finishGame(); return; }
  g.selected = new Set(); g.dragMapping = isDragMatch(g.current) ? g.current.dragPairs.map(() => -1) : null;
  g.dragItemOrder = isDragMatch(g.current) ? displayOrder(dragItems(g.current).length) : null;
  g.dragTargetOrder = isDragMatch(g.current) ? displayOrder(dragTargets(g.current).length) : null;
  g.answered = false; g.wager = 0; g.hiddenChoices = new Set(); g.displayOptions = null; g.hintStep = 0; g.coachOpen = false; g.used = { fifty: false, shield: false, freeze: false }; g.activeShield = false; g.lastResult = null;
  g.questionAt = performance.now();
  if (g.mode === 'blitz') { g.remainingTime = Math.max(5, 15 - Math.floor(g.completed * .7)); g.timerLast = performance.now(); }
  const wagerRound = g.completed > 0 && g.completed % 5 === 0 && g.score >= 100 && difficulty(g.current) >= .55 && !['typing', 'training'].includes(g.mode);
  if (wagerRound) renderWager(); else renderQuestion();
  updateHUD();
  saveRankedRun();
}
function renderWager() {
  const g = app.game;
  $('gameContent').innerHTML = `<div class="wager-card"><div class="wager-coin" aria-hidden="true">◉</div><span class="section-kicker" style="color:#686cbb">HIGH STAKES ROUND</span><h2>Wager points?</h2><p>Win bonus points or lose your stake.</p><span class="wager-balance">Score: ${formatNumber(g.score)}</span><div class="wager-options"><button type="button" data-wager="0">No wager</button><button type="button" data-wager="25">25%</button><button type="button" data-wager="50">50%</button></div></div>`;
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
    ['fifty', '½ 50/50', fiftyUsable],
    ['shield', '◇ Shield', true],
    ['freeze', '❄ Freeze', g.mode === 'blitz']
  ];
  return powers.map(([id, label, usable]) => {
    const affordable = g.score >= powerCosts[id];
    const title = !usable ? (id === 'freeze' ? 'Available in Boss blitz' : 'Available for four-choice questions') : g.used[id] ? 'Available again next question' : !affordable ? `Earn ${powerCosts[id]} points to use this` : id === 'shield' ? 'Protect your streak from a wrong answer' : id === 'freeze' ? 'Pause the clock for four seconds' : 'Cross out two wrong choices';
    return `<button type="button" class="power-button ${!usable || !affordable ? 'is-locked' : ''} ${g.used[id] ? 'is-active' : ''}" data-power="${id}" title="${title}" ${!usable || !affordable || g.used[id] ? 'disabled' : ''}>${label} · ${powerCosts[id]}</button>`;
  }).join('');
}
function renderQuestion() {
  const g = app.game, q = g.current;
  if (isDragMatch(q)) { renderDragQuestion(g, q); return; }
  g.displayOptions ||= optionOrder(q, g.firstCorrect);
  const isType = g.mode === 'typing' || q.type === 'short_answer_question' || !g.displayOptions.length;
  const isMulti = !isType && q.correctAnswers.length > 1;
  let answers;
  if (isType) answers = `<label class="sr-only" for="answerInput">Type your answer</label><input id="answerInput" class="answer-input" type="text" autocomplete="off" spellcheck="false" placeholder="Type your answer…"><p class="input-helper">${q.type === 'short_answer_question' ? 'Follow the format in the question.' : 'Use the same answer wording. Capitalization is ignored.'}</p>`;
  else answers = `<div class="game-choices" role="group" aria-label="Answer choices">${g.displayOptions.map((option, index) => `<button type="button" class="choice-button ${g.hiddenChoices.has(index) ? 'is-eliminated' : ''}" data-choice-index="${index}" aria-pressed="false" ${g.hiddenChoices.has(index) ? `disabled aria-label="Choice ${index + 1} eliminated"` : ''}><span class="choice-key">${index + 1}</span><span>${escapeHTML(option)}</span></button>`).join('')}</div>`;
  $('gameContent').innerHTML = `<article class="question-card"><div class="question-card-head"><span class="question-tag">${escapeHTML(typeName(q).toUpperCase())} · ${escapeHTML(sourceName(q).toUpperCase())}</span><span class="difficulty-tag">${difficulty(q) > .72 ? 'HARD' : difficulty(q) > .38 ? 'MEDIUM' : 'WARM-UP'} · ${100 + Math.round(difficulty(q) * 75)} PTS</span></div><div class="question-prompt" id="currentQuestion">${safeQuestionHTML(q)}</div>${answers}<div id="feedbackSlot"></div><div class="question-actions"><div class="question-actions-left">${powerMarkup(g, q)}<button type="button" class="hint-button" data-action="hint">💡 Hint bot</button></div><button type="button" id="answerAction" class="question-submit" data-action="${isType || isMulti ? 'submit' : 'skip'}" ${isType || isMulti ? 'disabled' : ''}>${isType || isMulti ? 'Check answer' : 'Skip question'}</button></div><div id="coachSlot"></div></article>`;
  if (isType) $('answerInput').focus();
  g.questionAt = performance.now();
  announce(`Question ${g.completed + 1} of ${g.total}. ${q.question}`);
}
function renderDragQuestion(g, q) {
  const mapping = Array.isArray(g.dragMapping) ? g.dragMapping : (g.dragMapping = q.dragPairs.map(() => -1));
  const board = renderDragMatch(q, mapping, g.answered, 'solo', g.dragItemOrder, g.dragTargetOrder);
  $('gameContent').innerHTML = `<article class="question-card"><div class="question-card-head"><span class="question-tag">DRAG & MATCH · ${escapeHTML(sourceName(q).toUpperCase())}</span><span class="difficulty-tag">${difficulty(q) > .72 ? 'HARD' : difficulty(q) > .38 ? 'MEDIUM' : 'WARM-UP'} · ${100 + Math.round(difficulty(q) * 75)} PTS</span></div><div class="question-prompt" id="currentQuestion">${safeQuestionHTML(q)}</div><p class="drag-match-instruction">Desktop: drag cards. On touch, tap an answer then its prompt, or use the slot menu.</p>${board}<div id="feedbackSlot"></div><div class="question-actions"><div class="question-actions-left">${powerMarkup(g, q)}<button type="button" class="hint-button" data-action="hint">💡 Hint bot</button></div><button type="button" id="answerAction" class="question-submit" data-action="submit" ${g.answered || !isCompleteDrag(mapping) ? 'disabled' : ''}>Check matches</button></div><div id="coachSlot"></div></article>`;
  const el = $('gameContent').querySelector('[data-drag-board]'); attachDragInteraction(el, '#gameContent', g.answered);
  if (!g.answered) el.addEventListener('change', () => { g.dragMapping = dragMappingFrom(el); $('answerAction').disabled = !isCompleteDrag(g.dragMapping); saveRankedRun(); });
  g.questionAt = performance.now(); announce(`Question ${g.completed + 1} of ${g.total}. Match each item to its description.`);
}
function showCoach() {
  const g = app.game; if (!g || g.answered) return;
  g.coachOpen = true;
  const hints = hintMessages(g.current);
  $('coachSlot').innerHTML = `<div class="coach-panel"><div class="coach-title">💡 STUDY HINT ${g.hintStep + 1} / ${hints.length}</div><p class="coach-chat">${escapeHTML(hints[g.hintStep])}</p><button type="button" data-action="more-hint" ${g.hintStep >= hints.length - 1 ? 'disabled' : ''}>${g.hintStep >= hints.length - 1 ? 'All hints shown' : 'Another hint'}</button></div>`;
}
function usePower(name) {
  const g = app.game, q = g?.current;
  if (!g || !q || g.answered || !['fifty', 'shield', 'freeze'].includes(name) || g.used[name] || g.score < powerCosts[name]) return;
  if (name === 'freeze' && g.mode !== 'blitz') return;
  if (name === 'fifty' && (q.correctAnswers.length !== 1 || (q.options || []).length < 4 || !g.displayOptions?.length)) return;
  if (name === 'fifty') {
    const wrong = g.displayOptions.map((option, index) => ({ option, index })).filter(item => !isCorrectOption(q, item.option));
    if (wrong.length < 2) return;
    shuffle(wrong).slice(0, 2).forEach(item => { g.hiddenChoices.add(item.index); g.selected.delete(item.index); const button = $('gameContent').querySelector(`[data-choice-index="${item.index}"]`); if (button) { button.disabled = true; button.classList.remove('is-selected'); button.classList.add('is-eliminated'); button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', `Choice ${item.index + 1} eliminated`); } });
    if (q.correctAnswers.length > 1) $('answerAction').disabled = !g.selected.size;
  } else if (name === 'shield') g.activeShield = true;
  else if (name === 'freeze') g.freezeUntil = performance.now() + 4000;
  g.score -= powerCosts[name]; g.used[name] = true; updateHUD(); playTone('click'); toast(name === 'fifty' ? 'Two wrong choices crossed out.' : name === 'shield' ? 'Shield ready for one missed answer.' : 'Clock frozen for 4 seconds.');
  document.querySelectorAll(`[data-power="${name}"]`).forEach(button => { button.disabled = true; button.classList.add('is-active'); });
  document.querySelectorAll('[data-power]').forEach(button => { if (!g.used[button.dataset.power] && g.score < powerCosts[button.dataset.power]) { button.disabled = true; button.classList.add('is-locked'); } });
  saveRankedRun();
}
function checkTypedAnswer(q, typed) {
  const exactCase = /lowercase only/i.test(q.question);
  return q.correctAnswers.some(answer => exactCase ? typed.trim() === answer.trim() : normalize(typed) === normalize(answer));
}
function checkAnswer() {
  const g = app.game, q = g?.current; if (!g || !q || g.answered) return;
  if (isDragMatch(q)) { const board = $('gameContent').querySelector('[data-drag-board]'); g.dragMapping = dragMappingFrom(board); if (!isCompleteDrag(g.dragMapping)) return; resolveAnswer(gradeDrag(q, g.dragMapping), dragPayload(q, g.dragMapping).join(' · ')); return; }
  const typed = g.mode === 'typing' || q.type === 'short_answer_question' || !g.displayOptions.length;
  let correct = false, response = '';
  if (isDragMatch(q)) { const board = $('practiceContent').querySelector('[data-drag-board]'); const mapping = dragMappingFrom(board); if (!isCompleteDrag(mapping)) return; practiceSubmit(dragPayload(q, mapping)); return; }
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
    playTone('good'); burst(); if (navigator.vibrate) navigator.vibrate(18);
  } else {
    g.hearts = Math.max(0, g.hearts - 1);
    if (g.activeShield) { g.activeShield = false; toast('Shield saved your streak!'); }
    else g.streak = 0;
    g.score = Math.max(0, g.score - g.wager);
    g.missed.push(q);
    if (g.training) g.training.misses.push({ question: q, response: response || 'Skipped' });
    playTone('bad'); if (navigator.vibrate) navigator.vibrate([25, 35, 25]);
  }
  g.completed++;
  g.history ||= [];
  g.history.push({ questionId: q.id, options: [...(g.displayOptions || [])], selected: [...g.selected], response, correct, points, pass: g.training?.pass || 1, ...(g.dragMapping ? { dragMapping: [...g.dragMapping] } : {}) });
  g.events.push({ t: Math.round(performance.now() - g.startedAt), score: g.score, completed: g.completed, correct, responseMs });
  updateHUD();
  const resultWord = correct ? ['Nice link!', 'You got it!', 'Great call!', 'That is the one!'][Math.floor(Math.random() * 4)] : 'Keep going — you are learning.';
  g.lastResult = { correct, response, points, resultWord };
  renderAnswerFeedback(g);
  saveRankedRun();
  announce(`${correct ? 'Correct' : 'Incorrect'}. ${correct ? points + ' points earned.' : 'Correct answer: ' + answerText(q)} ${heartsRemaining(g)} remain.`);

}
function renderAnswerFeedback(g) {
  const q = g.current, { correct, response, points, resultWord } = g.lastResult;
  const slot = $('feedbackSlot');
  slot.innerHTML = `<div class="feedback ${correct ? 'is-correct' : 'is-wrong'}"><strong>${resultWord}</strong>${correct ? `+${formatNumber(points)} points${g.wager ? ` · ${formatNumber(g.wager)} wager won` : ''}` : `${response ? 'Your answer: ' + escapeHTML(response) + '. ' : ''}${g.wager ? `${formatNumber(g.wager)} points lost. ` : ''}<span class="answer-line">Correct answer: ${escapeHTML(answerText(q))}</span>`}<span class="feedback-explanation"><b>Why this answer works</b>${escapeHTML(explanationText(q))}</span><small class="recall-cue">Try explaining the idea in your own words before moving on.</small></div>`;
  if (isDragMatch(q)) { const board = $('gameContent').querySelector('[data-drag-board]'); if (board) board.outerHTML = renderDragMatch(q, g.dragMapping, true, 'solo', g.dragItemOrder, g.dragTargetOrder); }
  document.querySelectorAll('.choice-button').forEach(button => {
    const index = +button.dataset.choiceIndex, option = g.displayOptions[index];
    button.disabled = true;
    if (isCorrectOption(q, option)) button.classList.add('is-correct');
    else if (g.selected.has(index)) button.classList.add('is-wrong');
  });
  const input = $('answerInput'); if (input) { input.disabled = true; input.classList.add(correct ? 'is-correct' : 'is-wrong'); }
  document.querySelectorAll('.power-button,.hint-button').forEach(button => { button.disabled = true; });
  $('answerAction').disabled = false; $('answerAction').dataset.action = 'next'; $('answerAction').textContent = g.hearts <= 0 || g.completed >= g.total ? 'See results ↗' : 'Next question ↗';
}
function tick() {
  const g = app.game; if (!g || app.view !== 'game' || g.pausedAt) return;
  const now = performance.now();
  if (g.mode === 'blitz' && !g.answered && g.current && !$('gameContent').querySelector('.wager-card')) {
    const delta = now - g.timerLast; if (now >= g.freezeUntil) g.remainingTime = Math.max(0, g.remainingTime - delta / 1000);
    g.timerLast = now;
    if (g.remainingTime <= 0) { resolveAnswer(false); toast('Time is up!'); }
    const savedSecond = Math.ceil(g.remainingTime);
    if (savedSecond !== g.lastAutosaveSecond) { g.lastAutosaveSecond = savedSecond; saveRankedRun(); }
  } else g.timerLast = now;
  updateHUD();
}
function elapsedTime(ms) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function heartsRemaining(g) { return g.heartLimit === 'unlimited' ? 'unlimited hearts' : `${g.hearts} heart${g.hearts === 1 ? '' : 's'}`; }
function updateHUD() {
  const g = app.game; if (!g) return;
  $('heartsDisplay').textContent = g.heartLimit === 'unlimited' ? '∞' : '♥ '.repeat(g.hearts) + '♡ '.repeat(Number(g.heartLimit) - g.hearts);
  $('heartsDisplay').setAttribute('aria-label', `${heartsRemaining(g)} remaining`);
  $('streakDisplay').textContent = `⚡ ${g.streak}`; $('scoreDisplay').textContent = formatNumber(g.score);
  $('timerDisplay').textContent = g.mode === 'blitz' ? (performance.now() < g.freezeUntil ? `❄ ${Math.ceil(g.remainingTime)}s` : `${Math.ceil(g.remainingTime)}s`) : elapsedTime(performance.now() - g.startedAt);
  $('timerDisplay').parentElement.classList.toggle('is-urgent', g.mode === 'blitz' && g.remainingTime <= 4 && !g.answered);
  const percent = g.total ? Math.min(100, Math.round((g.completed / g.total) * 100)) : 0;
  $('progressFill').style.width = `${percent}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', String(percent));
  const shown = g.mode === 'matching' ? g.completed + 1 : g.answered ? g.completed : g.completed + 1;
  $('questionPosition').textContent = `${g.training ? `Pass ${g.training.pass} · ` : ''}${g.mode === 'matching' ? 'Pair' : 'Question'} ${Math.min(shown, g.total)} of ${g.total}`;
  $('reviewPrevious').hidden = !g.history?.length;
  if (g.ghost) {
    const elapsed = performance.now() - g.startedAt;
    const past = g.ghost.events.filter(e => e.t <= elapsed); const ghostEvent = past[past.length - 1];
    $('ghostProgress').textContent = `👻 Ghost ${formatNumber(ghostEvent?.score || 0)} pts · ${ghostEvent?.completed || 0}/${g.ghost.total}`;
    $('raceTrack').hidden = false;
    $('playerRaceFill').style.width = `${percent}%`;
    $('ghostRaceFill').style.width = `${Math.min(100, Math.round(((ghostEvent?.completed || 0) / g.ghost.total) * 100))}%`;
  } else { $('ghostProgress').textContent = ''; $('raceTrack').hidden = true; }
}
let answerHistoryIndex = -1;
function renderAnswerHistory() {
  const g = app.game, item = g?.history?.[answerHistoryIndex]; if (!item) return;
  const q = app.questions.find(question => question.id === item.questionId); if (!q) return;
  const choices = (item.options || []).map((option, index) => {
    const chosen = (item.selected || []).includes(index), correct = isCorrectOption(q, option);
    return `<div class="history-choice ${correct ? 'is-correct' : chosen ? 'is-wrong' : ''}"><span>${index + 1}</span><b>${escapeHTML(option)}</b>${correct ? '<em>Correct</em>' : chosen ? '<em>Your pick</em>' : ''}</div>`;
  }).join('');
  $('answerHistoryContent').innerHTML = `<h2 id="answerHistoryTitle">Question ${answerHistoryIndex + 1} of ${g.history.length}${g.training ? ` · Pass ${item.pass || 1}` : ''}</h2><div class="answer-history-prompt">${safeQuestionHTML(q)}</div>${choices ? `<div class="history-choices">${choices}</div>` : ''}<div class="history-recap ${item.correct ? 'is-correct' : 'is-wrong'}"><strong>${item.correct ? '✓ Correct' : '↻ Worth another look'}</strong><span>Your answer: ${escapeHTML(item.response || 'Skipped')}</span><span>Correct answer: ${escapeHTML(answerText(q))}</span><p>${escapeHTML(explanationText(q))}</p></div><p class="history-readonly">Review only · your score and answers stay the same.</p>`;
  $('answerHistoryOlder').disabled = answerHistoryIndex <= 0;
  $('answerHistoryNewer').disabled = answerHistoryIndex >= g.history.length - 1;
}
function openAnswerHistory() {
  if (app.view !== 'game' || !app.game?.history?.length) return;
  answerHistoryIndex = app.game.history.length - 1;
  pauseRankedRun();
  renderAnswerHistory();
  if (!$('answerHistoryDialog').open) $('answerHistoryDialog').showModal();
}
function moveAnswerHistory(delta) {
  if (!$('answerHistoryDialog').open || !app.game?.history?.length) return;
  answerHistoryIndex = Math.max(0, Math.min(app.game.history.length - 1, answerHistoryIndex + delta));
  renderAnswerHistory();
}

function renderMatchBoard() {
  const g = app.game; if (!g) return;
  if (g.completed >= g.total || g.hearts <= 0) { finishGame(); return; }
  const group = g.order.slice(g.completed, g.completed + Math.min(4, g.total - g.completed));
  g.matchPairs = group.map(q => ({ q, matched: false })); g.matchChoice = { left: null, right: null };
  const answers = shuffle(group);
  $('gameContent').innerHTML = `<div class="match-card"><span class="question-tag">MATCH MAKER · ROUND ${Math.floor(g.completed / 4) + 1}</span><h2>Connect the dots.</h2><p>Tap a question, then its answer. Keyboard: 1–4 for a question, then 1–4 for an answer.</p><div class="match-grid"><div class="match-column"><h3>QUESTIONS</h3>${group.map((q, index) => `<button type="button" class="match-option" data-match-side="left" data-match-id="${q.id}"><span class="match-number">${index + 1}</span>${escapeHTML(q.question)}</button>`).join('')}</div><div class="match-column"><h3>ANSWERS</h3>${answers.map((q, index) => `<button type="button" class="match-option" data-match-side="right" data-match-id="${q.id}"><span class="match-number">${index + 1}</span>${escapeHTML(answerText(q))}</button>`).join('')}</div></div><div id="matchFeedback" class="match-feedback" role="status"></div></div>`;
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
  const selectedQuestion = g.matchPairs.find(pair => pair.q.id === g.matchChoice.left)?.q;
  if (g.matchChoice.left === g.matchChoice.right) {
    left.classList.remove('is-selected'); right.classList.remove('is-selected');
    left.classList.add('is-matched'); right.classList.add('is-matched'); left.disabled = true; right.disabled = true;
    g.attempts++; g.streak++; g.bestStreak = Math.max(g.bestStreak, g.streak); g.correct++; g.score += 70 + Math.min(90, g.streak * 10); g.completed++;
    g.events.push({ t: Math.round(performance.now() - g.startedAt), score: g.score, completed: g.completed, correct: true, responseMs: 0 });
    playTone('good'); burst(); announce(`Matched. ${g.streak} streak.`);
    if (selectedQuestion) $('matchFeedback').innerHTML = `<strong>Nice match!</strong><span>${escapeHTML(explanationText(selectedQuestion))}</span>`;
    if (g.matchPairs.every(pair => document.querySelector(`[data-match-side="left"][data-match-id="${pair.q.id}"]`)?.disabled)) setTimeout(() => { if (app.game === g) renderMatchBoard(); }, 2400);
  } else {
    g.attempts++; g.hearts = Math.max(0, g.hearts - 1); g.streak = 0; playTone('bad');
    g.events.push({ t: Math.round(performance.now() - g.startedAt), score: g.score, completed: g.completed, correct: false, responseMs: 0 });
    left.classList.add('is-error'); right.classList.add('is-error');
    toast('Not a match. Try another connection.'); announce(`Not a match. ${heartsRemaining(g)} remain.`);
    if (selectedQuestion) $('matchFeedback').innerHTML = `<strong>Correct pair: ${escapeHTML(answerText(selectedQuestion))}</strong><span>${escapeHTML(explanationText(selectedQuestion))}</span>`;
    setTimeout(() => { left?.classList.remove('is-error', 'is-selected'); right?.classList.remove('is-error', 'is-selected'); if (g.hearts <= 0 && app.game === g) finishGame(); }, 480);
  }
  g.matchChoice = { left: null, right: null }; updateHUD();
}
function validGhost(record) {
  return record && record.version === 1 && (record.deck || 'pools') === deckId && modeInfo[record.mode] && Number.isFinite(record.total) && record.total > 0 && Array.isArray(record.events) && record.events.length <= 1000 && record.events.every(e => Number.isFinite(e.t) && e.t >= 0 && Number.isFinite(e.score) && Number.isFinite(e.completed));
}
function finishTrainingPass() {
  const g = app.game; if (!g?.training) return;
  clearInterval(app.timer); app.timer = null;
  const { originalTotal, pass, misses } = g.training;
  if (!misses.length) {
    clearSavedRun('training');
    app.stats.runs++; app.stats.correct += g.correct; app.stats.bestStreak = Math.max(app.stats.bestStreak, g.bestStreak); app.stats.bestScore = Math.max(app.stats.bestScore, g.score); writeJSON(deckStorageKey('pp_stats'), app.stats); updateStats();
    const duration = Math.max(1, Math.round(performance.now() - g.startedAt));
    $('resultContent').innerHTML = `<div class="result-card"><div class="result-burst" aria-hidden="true">✳</div><span class="section-kicker">TRAINING COMPLETE</span><h1>Every question mastered!</h1><p>You mastered all ${originalTotal} questions, including every retry.</p><div class="result-metrics"><div><strong>${originalTotal}</strong><span>MASTERED</span></div><div><strong>${pass}</strong><span>PASSES</span></div><div><strong>${g.attempts}</strong><span>ANSWERS</span></div><div><strong>${elapsedTime(duration)}</strong><span>TIME</span></div></div><div class="result-actions"><button type="button" class="button button-primary" data-result="again">Train another set ↗</button><button type="button" class="button button-outline" data-result="home">Back to modes</button></div></div>`;
    setView('result'); announce(`Training complete. All ${originalTotal} questions mastered in ${pass} passes.`);
    return;
  }
  saveRankedRun('training-review');
  const mastered = originalTotal - misses.length;
  $('resultContent').innerHTML = `<div class="result-card training-result"><div class="result-burst" aria-hidden="true">↻</div><span class="section-kicker">PASS ${pass} COMPLETE</span><h1>${misses.length} to practice again</h1><p>${mastered} of ${originalTotal} mastered. Review your answers, then retry only the ones you missed.</p><div class="training-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${originalTotal}" aria-valuenow="${mastered}"><i style="width:${Math.round(mastered / originalTotal * 100)}%"></i></div><div class="result-actions"><button type="button" class="button button-primary" data-result="retry-training">Retry ${misses.length} missed ↗</button><button type="button" class="button button-outline" data-result="home">Back to modes</button></div><div class="review-list"><h2>Review before the next pass</h2>${misses.map(({ question, response }) => `<div class="review-item"><strong>#${question.id}</strong><div class="training-review-prompt">${safeQuestionHTML(question)}</div><span class="training-your-answer">You answered: ${escapeHTML(response)}</span><span>Correct: ${escapeHTML(answerText(question))}</span><p>${escapeHTML(explanationText(question))}</p></div>`).join('')}</div></div>`;
  setView('result'); announce(`Pass ${pass} complete. ${misses.length} questions to retry.`);
}
function retryTraining() {
  const g = app.game; if (!g?.training?.misses?.length) return;
  g.order = shuffle(g.training.misses.map(item => item.question));
  g.total = g.order.length; g.completed = 0; g.current = null; g.missed = [];
  g.training.misses = []; g.training.pass++;
  $('gameModeEyebrow').textContent = `MASTER EVERY QUESTION · PASS ${g.training.pass}`;
  setView('game'); app.timer = setInterval(tick, 100); nextQuestion();
}
function finishGame() {
  const g = app.game; if (!g || app.view === 'result') return;
  clearInterval(app.timer); app.timer = null;
  if (rankedModes.includes(g.mode)) clearSavedRun(g.mode);
  const duration = Math.max(1, Math.round(performance.now() - g.startedAt));
  const record = { version: 1, deck: deckId, mode: g.mode, total: g.total, completed: g.completed, score: g.score, duration, events: g.events };
  writeJSON(deckStorageKey(`pp_ghost_${g.mode}`), record);
  app.stats.runs++; app.stats.correct += g.correct; app.stats.bestStreak = Math.max(app.stats.bestStreak, g.bestStreak); app.stats.bestScore = Math.max(app.stats.bestScore, g.score);
  if (rankedModes.includes(g.mode) && !g.firstCorrect) app.stats.rankedPoints = Math.min(1_000_000_000, lifetimeRankedPoints() + Math.max(0, g.score));
  writeJSON(deckStorageKey('pp_stats'), app.stats); updateStats();
  g.record = record; g.scoreSubmitted = false;
  const won = g.completed === g.total && g.hearts > 0;
  const accuracy = g.attempts ? Math.round((g.correct / g.attempts) * 100) : 0;
  const savedName = readJSON('pp_leaderboard_name', readJSON('pp_live_name', ''));
  const scoreForm = !rankedModes.includes(g.mode)
    ? '<p class="rank-note">This mode is for practice. Try a ranked mode to post a score.</p>'
    : g.firstCorrect
    ? '<p class="rank-note">Practice run · correct answer first is unranked.</p>'
    : g.score <= 0
      ? '<p class="rank-note">Earn points to post a score.</p>'
      : `<form id="scoreSubmitForm" class="score-submit"><label for="scoreName">Post your ${escapeHTML(modeInfo[g.mode].name)} score</label><div><input id="scoreName" maxlength="24" minlength="2" value="${escapeHTML(savedName)}" placeholder="Your name" autocomplete="nickname" required><button type="submit" class="button button-primary">Post score ↗</button></div><small>${g.heartLimit === 'unlimited' ? 'Unlimited hearts' : `${g.heartLimit} heart${g.heartLimit === '1' ? '' : 's'}`} · Your name and score will be public.</small></form>`;
  const earnedBadge = rankedModes.includes(g.mode) && !g.firstCorrect ? badgeForPoints(lifetimeRankedPoints()) : null;
  $('resultContent').innerHTML = `<div class="result-card"><div class="result-burst" aria-hidden="true">✳</div><span class="section-kicker">RUN COMPLETE</span><h1>${won ? 'Deck cleared!' : 'Nice run.'}</h1>${earnedBadge ? `<div class="result-badge">${earnedBadge.icon} ${earnedBadge.name} <small>· ${formatNumber(lifetimeRankedPoints())} lifetime points</small></div>` : ''}<div class="result-metrics"><div><strong>${formatNumber(g.score)}</strong><span>POINTS</span></div><div><strong>${accuracy}%</strong><span>ACCURACY</span></div><div><strong>${g.bestStreak}</strong><span>BEST STREAK</span></div><div><strong>${elapsedTime(duration)}</strong><span>TIME</span></div></div>${scoreForm}<div class="result-actions"><button type="button" class="button button-primary" data-result="again">Play again ↗</button><button type="button" class="button button-outline" data-result="leaderboard">Leaderboards</button><button type="button" class="button button-outline" data-result="export">Export ghost ↓</button></div>${g.missed.length ? `<details class="review-details"><summary>Review missed questions (${g.missed.length})</summary><div class="review-list">${g.missed.slice(0, 8).map(q => `<div class="review-item"><strong>#${q.id} ${escapeHTML(q.question)}</strong><span>Answer: ${escapeHTML(answerText(q))}</span></div>`).join('')}</div></details>` : ''}</div>`;
  setView('result'); announce(`Run complete. ${g.score} points, ${accuracy} percent accuracy.`);
}
let leaderboardRequest = 0, homeLeaderboardRequest = 0, leaderboardMode = 'all', homeLeaderboardMode = 'all';
function heartsLabel(value) { return value === 'unlimited' ? 'Unlimited hearts' : `${value} heart${String(value) === '1' ? '' : 's'}`; }
function renderLeaderboardModeTabs() {
  for (const [container, selected] of [[$('homeLeadersModes'), homeLeaderboardMode], [$('leaderboardModes'), leaderboardMode]]) {
    container.innerHTML = rankedModes.map(mode => `<button type="button" data-board-mode="${mode}" aria-pressed="${mode === selected}">${escapeHTML(modeInfo[mode].name)}</button>`).join('');
  }
  $('homeLeadersModeLabel').textContent = modeInfo[homeLeaderboardMode].name.toUpperCase();
  $('leaderboardTitle').textContent = `${modeInfo[leaderboardMode].name} high scores`;
}
function leaderboardGraph(entries) {
  const leaders = entries.slice(0, 5), max = Math.max(1, ...leaders.map(e => Number(e.score) || 0));
  $('leaderboardGraph').innerHTML = `<div class="graph-heading"><strong>Top scores</strong><span>Points earned</span></div>${leaders.length ? leaders.map((entry, index) => `<div class="graph-row"><span class="graph-name">${index + 1}. ${escapeHTML(entry.name || 'Player')}</span><span class="graph-track"><i style="width:${Math.max(3, (Number(entry.score) || 0) / max * 100)}%"></i></span><b>${formatNumber(entry.score)}</b></div>`).join('') : `<p class="graph-empty">Finish a ${escapeHTML(modeInfo[leaderboardMode].name)} run to draw the first bar.</p>`}`;
}
function emptyHomeChart(message) { return `<div class="home-chart-empty"><div class="home-chart-ghost" aria-hidden="true"><i></i><i></i><i></i></div><p>${escapeHTML(message)}</p></div>`; }
async function loadHomeLeaderboard() {
  const mode = homeLeaderboardMode, request = ++homeLeaderboardRequest;
  $('homeLeadersList').textContent = 'Loading top scores…';
  $('homeLeadersChart').innerHTML = '';
  try {
    const response = await fetch(`/api/leaderboard?deck=${deckId}&mode=${encodeURIComponent(mode)}&hearts=all`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Scores unavailable');
    const data = await response.json(), entries = Array.isArray(data.entries) ? data.entries.slice(0, 3) : [];
    if (request !== homeLeaderboardRequest) return;
    $('homeLeadersList').innerHTML = entries.length ? entries.map((entry, index) => `<div class="home-leader"><span class="home-rank">${index + 1}</span><strong>${escapeHTML(entry.name || 'Player')}</strong><small>${leaderboardBadge(entry).icon} ${leaderboardBadge(entry).name} · ${heartsLabel(entry.hearts)}</small><b>${formatNumber(entry.score)} <em>pts</em></b></div>`).join('') + Array.from({ length: 3 - entries.length }, (_, index) => `<div class="home-leader is-open"><span class="home-rank">${entries.length + index + 1}</span><strong>Open spot</strong><small>Your name could go here</small><button type="button" data-home-play>Challenge ↗</button></div>`).join('') : `<div class="home-leaders-empty"><strong>First place is open.</strong><span>No ${escapeHTML(modeInfo[mode].name)} score yet.</span><button type="button" data-home-play>Play this mode ↗</button></div>`;
    const max = Math.max(1, ...entries.map(entry => Number(entry.score) || 0));
    $('homeLeadersChart').innerHTML = entries.length ? Array.from({ length: 3 }, (_, index) => entries[index] ? `<div class="home-chart-row"><span>${index + 1}</span><i style="width:${Math.max(3, (Number(entries[index].score) || 0) / max * 100)}%"></i><b>${formatNumber(entries[index].score)}</b></div>` : `<div class="home-chart-row is-open"><span>${index + 1}</span><i></i><b>Open</b></div>`).join('') : emptyHomeChart('First score starts the race.');
  } catch { if (request === homeLeaderboardRequest) { $('homeLeadersList').innerHTML = '<div class="home-leaders-empty"><strong>Scores are unavailable.</strong><span>You can still play this mode.</span><button type="button" data-home-play>Play this mode ↗</button></div>'; $('homeLeadersChart').innerHTML = emptyHomeChart('Scores will appear here when connected.'); } }
}
async function loadLeaderboard() {
  const hearts = $('leaderboardHearts').value, mode = leaderboardMode;
  const request = ++leaderboardRequest;
  $('leaderboardStatus').textContent = 'Loading scores…';
  $('leaderboardList').innerHTML = '';
  try {
    const response = await fetch(`/api/leaderboard?deck=${deckId}&mode=${encodeURIComponent(mode)}&hearts=${encodeURIComponent(hearts)}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load scores.');
    if (request !== leaderboardRequest) return;
    const entries = Array.isArray(data.entries) ? data.entries : [];
    $('leaderboardStatus').textContent = entries.length ? `${entries.length} ranked run${entries.length === 1 ? '' : 's'}` : 'No scores yet. Be the first!';
    leaderboardGraph(entries);
    $('leaderboardList').innerHTML = entries.map((entry, index) => `<li class="leaderboard-row"><span class="leaderboard-rank">${index + 1}</span><span class="leaderboard-player"><strong>${escapeHTML(entry.name || 'Player')}</strong><small class="leaderboard-badge">${leaderboardBadge(entry).icon} ${leaderboardBadge(entry).name}</small></span><span class="leaderboard-detail">${Number(entry.correct) || 0}/${Number(entry.total) || 0} right · ${heartsLabel(entry.hearts || hearts)} · ${elapsedTime(Number(entry.duration) || 0)}</span><b>${formatNumber(entry.score)}</b></li>`).join('');
  } catch (error) {
    if (request !== leaderboardRequest) return;
    $('leaderboardStatus').textContent = error.name === 'TimeoutError' ? 'Scores took too long to load. Try again.' : (error.message || 'Could not load scores.');
    $('leaderboardGraph').innerHTML = '';
  }
}
async function submitSoloScore() {
  const g = app.game, form = $('scoreSubmitForm');
  if (!g || !form || !rankedModes.includes(g.mode) || g.firstCorrect || g.scoreSubmitted || !g.record || g.score <= 0) return;
  const name = $('scoreName').value.trim().slice(0, 24);
  if (name.length < 2) { toast('Use a name with at least 2 characters.'); return; }
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const response = await fetch('/api/leaderboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name, deck: deckId, mode: g.mode, hearts: g.heartLimit, score: g.score, lifetimePoints: lifetimeRankedPoints(), correct: g.correct, total: g.total, duration: g.record.duration, firstCorrect: false }),
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not post your score.');
    g.scoreSubmitted = true; writeJSON('pp_leaderboard_name', name);
    form.outerHTML = '<div class="rank-saved">✓ Score posted to the leaderboard.</div>';
    toast('Score posted!');
  } catch (error) {
    toast(error.name === 'TimeoutError' ? 'Posting timed out. Try again.' : (error.message || 'Could not post your score.'));
    button.disabled = false;
  }
}
function exportGhost() {
  const record = app.game?.record; if (!record) return;
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `packet-party-${deckId}-${record.mode}-ghost.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Ghost run exported. Share the file with a friend.');
}

async function loadQuestions() {
  try {
    const response = await fetch(deckId === 'ccst-notebook' ? './ccst-questions.json' : './questions.json', { cache: 'no-cache' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json(); if (!Array.isArray(data.questions)) throw new Error('Missing questions');
    try { const notesResponse = await fetch(deckId === 'ccst-notebook' ? './ccst-explanations.json' : './explanations.json', { cache: 'no-cache' }); if (notesResponse.ok) app.explanations = await notesResponse.json(); } catch { /* Quiz still works if the notes are unavailable. */ }
    app.questions = data.questions.filter(q => q && q.question && Array.isArray(q.correctAnswers) && q.correctAnswers.length && Array.isArray(q.options)).map((q, index) => ({ ...q, id: Number(q.id) || index + 1 }));
    restorePractice(); prepareDifficulty(); renderHome(); renderBank();
  } catch (error) {
    $('questionCount').textContent = '0'; $('bankList').innerHTML = `<div class="bank-empty"><strong>The deck could not load</strong>Open this site through a web server or refresh the page. (${escapeHTML(error.message)})</div>`;
    toast('The question deck could not load.');
  }
}
function attachEvents() {
  document.addEventListener('click', event => {
    const img = event.target.closest?.('.question-html img'); if (!img) return;
    $('exhibitLarge').src = img.src; $('exhibitLarge').alt = img.alt;
    $('exhibitDialog').showModal();
  });
  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || !event.target.matches?.('.question-html img')) return;
    event.preventDefault(); event.target.click();
  });
  $('exhibitClose').addEventListener('click', () => $('exhibitDialog').close());
  $('exhibitDialog').addEventListener('click', event => { if (event.target === $('exhibitDialog')) $('exhibitDialog').close(); });
  $('brandButton').addEventListener('click', () => setView('home'));
  document.querySelectorAll('.nav-link').forEach(button => button.addEventListener('click', () => { if (app.game && app.view === 'game') clearInterval(app.timer); setView(button.dataset.view); }));
  $('heroStart').addEventListener('click', () => openSetup('shuffle'));
  $('savedRuns').addEventListener('click', event => { const mode = event.target.closest('[data-resume-mode]')?.dataset.resumeMode; if (mode) resumeRankedRun(mode); });
  document.querySelectorAll('.mode-card').forEach(button => button.addEventListener('click', () => button.dataset.mode === 'practice' ? openPractice() : openSetup(button.dataset.mode)));
  $('leavePractice').addEventListener('click', () => setView('home'));
  $('practiceShuffleChoices').addEventListener('change', event => { practice.shuffleChoices = event.target.checked; savePractice(); renderPractice(); });
  $('practicePrevious').addEventListener('click', () => practiceGoTo(practice.index - 1));
  $('practiceNext').addEventListener('click', () => practiceGoTo(practice.index + 1));
  $('practiceSkip').addEventListener('click', () => { const q = app.questions[practice.index]; if (!practiceAnswered(practiceRecord(q))) practice.entries[q.id] = { status: 'skipped', response: '' }; practiceGoTo(practice.index + 1); });
  $('practiceStartOver').addEventListener('click', () => practiceGoTo(0));
  $('practiceReset').addEventListener('click', resetPractice);
  $('practiceJumpForm').addEventListener('submit', event => { event.preventDefault(); const number = Number($('practiceJumpInput').value); practiceGoTo(number - 1); $('practiceJumpInput').value = ''; });
  $('practiceNumberGrid').addEventListener('click', event => { const number = Number(event.target.closest('[data-practice-number]')?.dataset.practiceNumber); if (number) practiceGoTo(number - 1); });
  $('practiceContent').addEventListener('change', event => {
    if (event.target.matches('[data-drag-select]')) { const q = app.questions[practice.index]; practice.dragMappings[q.id] = dragMappingFrom($('practiceContent').querySelector('[data-drag-board]')); const check = $('practiceContent').querySelector('[data-practice-action="check"]'); if (check) check.disabled = !isCompleteDrag(practice.dragMappings[q.id]); savePractice(); }
  });
  $('practiceContent').addEventListener('click', event => {
    const q = app.questions[practice.index], record = practiceRecord(q);
    const choice = event.target.closest('[data-practice-choice]');
    if (choice && !practiceAnswered(record)) {
      const index = Number(choice.dataset.practiceChoice);
      if (q.correctAnswers.length > 1) {
        if (practice.selected.has(index)) practice.selected.delete(index); else practice.selected.add(index);
        choice.classList.toggle('is-selected', practice.selected.has(index));
        choice.setAttribute('aria-pressed', String(practice.selected.has(index)));
        const check = $('practiceContent').querySelector('[data-practice-action="check"]'); if (check) check.disabled = !practice.selected.size;
      } else practiceSubmit([q.options[index]]);
      return;
    }
    const action = event.target.closest('[data-practice-action]')?.dataset.practiceAction;
    if (action === 'retry') { delete practice.entries[q.id]; delete practice.dragMappings[q.id]; if (isDragMatch(q)) practiceDragOrders(q, true); practice.selected = new Set(); savePractice(); renderPractice(); }
    else if (action === 'reveal') { practice.entries[q.id] = { status: 'revealed', response: '' }; practice.selected = new Set(); savePractice(); renderPractice(); }
    else if (action === 'check') {
      if (isDragMatch(q)) practiceSubmit(dragPayload(q, dragMappingFrom($('practiceContent').querySelector('[data-drag-board]'))));
      else if (q.type === 'short_answer_question' || !q.options.length) practiceSubmit($('practiceAnswerInput')?.value || '');
      else if (practice.selected.size) practiceSubmit([...practice.selected].map(index => q.options[index]));
    }
  });
  $('practiceContent').addEventListener('input', event => { if (event.target.id === 'practiceAnswerInput') { const check = $('practiceContent').querySelector('[data-practice-action="check"]'); if (check) check.disabled = !event.target.value.trim(); } });
  $('practiceContent').addEventListener('keydown', event => { if (event.target.id === 'practiceAnswerInput' && event.key === 'Enter') { event.preventDefault(); practiceSubmit(event.target.value); } });
  $('soundButton').addEventListener('click', () => { app.soundOn = !app.soundOn; writeJSON('pp_sound', app.soundOn); updateSoundButton(); if (app.soundOn) playTone('click'); });
  $('closeSetup').addEventListener('click', () => $('setupDialog').close());
  $('setupForm').addEventListener('submit', event => { event.preventDefault(); $('setupDialog').close(); startGame(); });
  $('setupResumeButton').addEventListener('click', () => { const mode = app.mode; $('setupDialog').close(); resumeRankedRun(mode); });
  $('trainingLengthSelect').addEventListener('change', () => { if (app.mode === 'training') $('setupQuestionCount').textContent = `${Math.min(Number($('trainingLengthSelect').value), app.questions.length)} questions`; });
  $('correctFirstToggle').addEventListener('change', updateSetupRankNote);
  $('leaderboardHearts').addEventListener('change', loadLeaderboard);
  $('homeLeadersModes').addEventListener('click', event => { const mode = event.target.closest('[data-board-mode]')?.dataset.boardMode; if (!rankedModes.includes(mode)) return; homeLeaderboardMode = mode; renderLeaderboardModeTabs(); loadHomeLeaderboard(); });
  $('homeLeadersList').addEventListener('click', event => { if (event.target.closest('[data-home-play]')) openSetup(homeLeaderboardMode); });
  $('leaderboardModes').addEventListener('click', event => { const mode = event.target.closest('[data-board-mode]')?.dataset.boardMode; if (!rankedModes.includes(mode)) return; leaderboardMode = mode; renderLeaderboardModeTabs(); loadLeaderboard(); });
  $('homeLeaderboardLink').addEventListener('click', () => { leaderboardMode = homeLeaderboardMode; renderLeaderboardModeTabs(); setView('leaderboard'); });
  $('ghostFile').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 1000000) { toast('That ghost file is too large.'); return; }
    try { const record = JSON.parse(await file.text()); if (!validGhost(record)) throw new Error('Invalid ghost file'); app.importedGhost = record; $('ghostFileName').textContent = `${file.name} · ${modeInfo[record.mode].name}`; $('ghostToggle').checked = true; toast('Ghost imported.'); }
    catch { app.importedGhost = null; $('ghostFileName').textContent = 'Could not read that ghost file'; toast('That file is not a Packet Party ghost.'); }
  });
  for (const id of ['bankSearch', 'bankSource', 'bankType']) $(id).addEventListener(id === 'bankSearch' ? 'input' : 'change', () => { app.bankLimit = 16; app.bankAll = false; renderBank(); });
  $('revealAllButton').addEventListener('click', () => { app.bankRevealAll = !app.bankRevealAll; renderBank(); });
  $('bankShowAll').addEventListener('click', () => {
    app.bankAll = !app.bankAll; app.bankLimit = 16;
    if (app.bankAll) { $('bankSearch').value = ''; $('bankSource').value = 'all'; $('bankType').value = 'all'; }
    renderBank();
    if (!app.bankAll) $('bankList').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  $('bankMore').addEventListener('click', () => { app.bankLimit += 16; renderBank(); });
  $('bankList').addEventListener('click', event => {
    const button = event.target.closest('[data-bank-action]'); if (!button) return;
    const id = +button.closest('[data-id]').dataset.id;
    if (button.dataset.bankAction === 'star') { if (app.favorites.has(id)) app.favorites.delete(id); else app.favorites.add(id); writeJSON(deckStorageKey('pp_favorites'), [...app.favorites]); }
    else { if (app.bankRevealed.has(id)) app.bankRevealed.delete(id); else app.bankRevealed.add(id); }
    renderBank();
  });
  $('leaveGame').addEventListener('click', () => { clearInterval(app.timer); app.timer = null; setView('home'); app.game = null; });
  $('reviewPrevious').addEventListener('click', openAnswerHistory);
  $('answerHistoryClose').addEventListener('click', () => $('answerHistoryDialog').close());
  $('answerHistoryReturn').addEventListener('click', () => $('answerHistoryDialog').close());
  $('answerHistoryOlder').addEventListener('click', () => moveAnswerHistory(-1));
  $('answerHistoryNewer').addEventListener('click', () => moveAnswerHistory(1));
  $('answerHistoryDialog').addEventListener('close', () => { answerHistoryIndex = -1; unpauseRankedRun(); });
  $('gameContent').addEventListener('click', event => {
    const wager = event.target.closest('[data-wager]'); if (wager) { const g = app.game; g.wager = Math.floor(g.score * (+wager.dataset.wager / 100)); playTone('click'); renderQuestion(); saveRankedRun(); return; }
    const match = event.target.closest('[data-match-side]'); if (match) { handleMatchClick(match); return; }
    const power = event.target.closest('[data-power]'); if (power) { usePower(power.dataset.power); return; }
    const choice = event.target.closest('[data-choice-index]');
    if (choice && app.game && !app.game.answered) {
      const index = +choice.dataset.choiceIndex, g = app.game, multi = g.current.correctAnswers.length > 1;
      if (multi) { if (g.selected.has(index)) g.selected.delete(index); else g.selected.add(index); choice.classList.toggle('is-selected', g.selected.has(index)); choice.setAttribute('aria-pressed', String(g.selected.has(index))); $('answerAction').disabled = !g.selected.size; saveRankedRun(); }
      else { g.selected = new Set([index]); checkAnswer(); }
      return;
    }
    const action = event.target.closest('[data-action]'); if (!action) return;
    if (action.dataset.action === 'hint') { showCoach(); saveRankedRun(); }
    else if (action.dataset.action === 'more-hint') { app.game.hintStep++; showCoach(); saveRankedRun(); }
    else if (action.dataset.action === 'submit') checkAnswer();
    else if (action.dataset.action === 'skip') resolveAnswer(false);
    else if (action.dataset.action === 'next') nextQuestion();
  });
  $('gameContent').addEventListener('input', event => { if (event.target.id === 'answerInput') { $('answerAction').disabled = !event.target.value.trim(); saveRankedRun(); } });
  $('gameContent').addEventListener('keydown', event => { if (event.target.id === 'answerInput' && event.key === 'Enter') { event.preventDefault(); checkAnswer(); } });
  $('resultContent').addEventListener('click', event => { const action = event.target.closest('[data-result]')?.dataset.result; if (action === 'again') openSetup(app.mode); else if (action === 'retry-training') retryTraining(); else if (action === 'home') setView('home'); else if (action === 'leaderboard') { leaderboardMode = rankedModes.includes(app.game?.mode) ? app.game.mode : 'all'; $('leaderboardHearts').value = 'all'; renderLeaderboardModeTabs(); setView('leaderboard'); } else if (action === 'export') exportGhost(); });
  $('resultContent').addEventListener('submit', event => { if (event.target.id === 'scoreSubmitForm') { event.preventDefault(); submitSoloScore(); } });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.closest('input, textarea, select, [contenteditable="true"]') || $('setupDialog').open) return;
    if (event.key === 'Backspace' && app.view === 'game') { event.preventDefault(); if ($('answerHistoryDialog').open) moveAnswerHistory(-1); else openAnswerHistory(); return; }
    if ($('answerHistoryDialog').open) return;
    if (app.view === 'game' && app.game?.answered && event.key === 'Enter') { $('answerAction')?.click(); return; }
    if (!/^[1-9]$/.test(event.key)) return;
    const index = Number(event.key) - 1;
    let choice;
    if (app.view === 'game' && app.game) {
      if (app.game.mode === 'matching') {
        const side = app.game.matchChoice?.left == null ? 'left' : 'right';
        choice = [...$('gameContent').querySelectorAll(`[data-match-side="${side}"]`)][index];
      } else choice = $('gameContent').querySelector(`[data-choice-index="${index}"]`);
    } else if (app.view === 'practice') choice = [...$('practiceContent').querySelectorAll('[data-practice-choice]')][index];
    else if (app.view === 'live' && live.room?.phase === 'question' && !live.submitted) choice = $('liveStage').querySelector(`[data-live-choice="${index}"]`);
    if (choice && !choice.disabled) { event.preventDefault(); choice.click(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseRankedRun(); else unpauseRankedRun(); });
  window.addEventListener('pagehide', pauseRankedRun);
}
const live = {
  code: null, token: null, playerId: null, room: null, name: '', serverOffset: 0,
  pollTimer: null, clockTimer: null, fetching: false, lastPollAt: 0, pendingActions: new Set(),
  requestSeq: 0, appliedSeq: 0, stageSignature: '', playersSignature: '', messagesSignature: '',
  roundKey: '', submitted: false, pendingAnswer: null, selected: new Set(), dragMapping: [], savedDragMapping: [], hintStep: 0, seenReactions: new Set(),
  sawReactions: false, revealKey: '', lastQuestion: null, effectSignature: '', scrambleSignature: ''
};

function liveInviteURL(code = live.code) {
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  if (deckId === 'ccst-notebook') url.searchParams.set('deck', 'ccst'); else url.searchParams.delete('deck');
  url.hash = '';
  return url.toString();
}
function liveShowConnection(state) {
  const element = $('liveConnection');
  element.classList.toggle('is-connected', state === 'connected');
  element.classList.toggle('is-offline', state === 'offline');
  element.textContent = state === 'connected' ? '● Live connection' : state === 'offline' ? '● Reconnecting…' : '● Connecting…';
}
async function liveAPI(path, { method = 'GET', body, auth = true } = {}) {
  const started = Date.now();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && live.token) headers.Authorization = `Bearer ${live.token}`;
  let response;
  try {
    response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(12000) });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('Connection timed out. Try again.');
    throw error;
  }
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    const error = new Error(data.error || `Room request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (Number.isFinite(data.serverTime)) live.serverOffset = data.serverTime - Math.round((started + Date.now()) / 2);
  return data;
}
function liveSaveSession() {
  writeJSON(deckStorageKey('pp_live_session'), { code: live.code, token: live.token, playerId: live.playerId, name: live.name });
}
function liveClearSession() {
  clearInterval(live.pollTimer); clearInterval(live.clockTimer);
  live.pollTimer = null; live.clockTimer = null;
  live.code = null; live.token = null; live.playerId = null; live.room = null;
  live.lastPollAt = 0;
  live.pendingActions = new Set();
  live.stageSignature = ''; live.playersSignature = ''; live.messagesSignature = '';
  live.roundKey = ''; live.submitted = false; live.pendingAnswer = null; live.selected.clear(); live.dragMapping = []; live.savedDragMapping = []; live.hintStep = 0;
  live.seenReactions.clear(); live.sawReactions = false; live.revealKey = ''; live.lastQuestion = null; live.effectSignature = ''; live.scrambleSignature = '';
  try { localStorage.removeItem(deckStorageKey('pp_live_session')); } catch { /* Storage is optional. */ }
  const url = new URL(location.href);
  if (url.searchParams.has('room')) { url.searchParams.delete('room'); history.replaceState(null, '', url); }
  $('liveEntry').hidden = false; $('liveRoom').hidden = true;
}
function liveApplyResponse(data, seq) {
  if (seq < live.appliedSeq || !live.code || !data.room) return;
  const previousRound = live.room && liveRoundKey(live.room);
  const oldQuestion = live.room?.currentQuestion;
  const nextQuestion = data.room.currentQuestion;
  if (previousRound && previousRound === liveRoundKey(data.room) && oldQuestion && nextQuestion && oldQuestion.id === nextQuestion.id) {
    if (oldQuestion.matching && nextQuestion.matching && (JSON.stringify(oldQuestion.dragItems) !== JSON.stringify(nextQuestion.dragItems) || JSON.stringify(oldQuestion.dragTargets) !== JSON.stringify(nextQuestion.dragTargets))) {
      const remap = mapping => nextQuestion.dragItems.map(item => {
        const oldItemIndex = oldQuestion.dragItems.findIndex(candidate => normalize(candidate) === normalize(item));
        const oldTargetIndex = mapping[oldItemIndex];
        if (oldTargetIndex == null || oldTargetIndex < 0) return -1;
        return nextQuestion.dragTargets.findIndex(target => normalize(target) === normalize(oldQuestion.dragTargets[oldTargetIndex]));
      });
      live.dragMapping = remap(live.dragMapping);
      live.savedDragMapping = remap(live.savedDragMapping);
    }
    if (oldQuestion.options && nextQuestion.options && JSON.stringify(oldQuestion.options) !== JSON.stringify(nextQuestion.options) && live.selected.size) {
      const selectedValues = [...live.selected].map(index => oldQuestion.options[index]).filter(value => value != null);
      live.selected = new Set(selectedValues.map(value => nextQuestion.options.findIndex(option => normalize(option) === normalize(value))).filter(index => index >= 0));
    }
  }
  const typedDraft = !live.submitted && live.room?.phase === 'question' ? $('liveAnswerInput')?.value : null;
  live.appliedSeq = seq;
  live.room = data.room;
  liveShowConnection('connected');
  liveRender();
  if (typedDraft != null && data.room.phase === 'question' && previousRound === liveRoundKey(data.room) && $('liveAnswerInput')) $('liveAnswerInput').value = typedDraft;
}
function liveEnter(data, name) {
  if (!data?.token || !data?.room?.code || !data.playerId) throw new Error('The room did not return a player session.');
  if ((data.room.deck || 'pools') !== deckId) throw new Error('This room uses a different study deck. Open its invite link.');
  live.code = String(data.room.code).toUpperCase(); live.token = data.token; live.playerId = data.playerId; live.name = name;
  live.lastPollAt = 0;
  live.pendingActions = new Set();
  live.appliedSeq = 0; live.requestSeq = 0; live.room = null;
  live.stageSignature = ''; live.playersSignature = ''; live.messagesSignature = '';
  live.effectSignature = ''; live.scrambleSignature = '';
  live.roundKey = ''; live.submitted = false; live.pendingAnswer = null; live.selected.clear(); live.dragMapping = []; live.savedDragMapping = []; live.hintStep = 0;
  live.seenReactions.clear(); live.sawReactions = false; live.revealKey = ''; live.lastQuestion = null;
  if (Number.isFinite(data.serverTime)) live.serverOffset = data.serverTime - Date.now();
  liveSaveSession();
  $('liveEntry').hidden = true; $('liveRoom').hidden = false;
  $('liveRoomCode').textContent = live.code;
  history.replaceState(null, '', liveInviteURL());
  setView('live');
  liveApplyResponse(data, 0);
  clearInterval(live.pollTimer); clearInterval(live.clockTimer);
  live.pollTimer = setInterval(livePoll, 900);
  live.clockTimer = setInterval(liveUpdateClock, 100);
  liveUpdateClock();
}
async function liveCreate() {
  const name = $('liveHostName').value.trim().slice(0, 24);
  const questionCount = +$('liveQuestionCount').value;
  if (!name) { toast('Add your name to create a room.'); return; }
  const button = $('liveCreateForm').querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const data = await liveAPI('/api/rooms', { method: 'POST', body: { name, questionCount, deck: deckId, mode: $('liveRoomMode').value, playful: $('livePlayful').checked }, auth: false });
    writeJSON('pp_live_name', name); liveEnter(data, name); toast('Room created. Share the code with a friend!');
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}
async function liveJoin() {
  const name = $('liveGuestName').value.trim().slice(0, 24);
  const code = $('liveJoinCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (!name || code.length !== 6) { toast('Enter your name and a 6-character room code.'); return; }
  const button = $('liveJoinForm').querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const data = await liveAPI(`/api/rooms/${encodeURIComponent(code)}/join`, { method: 'POST', body: { name, deck: deckId }, auth: false });
    writeJSON('pp_live_name', name); liveEnter(data, name); toast('You joined the room!');
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}
async function livePoll() {
  if (!live.code || document.hidden || live.fetching || live.pendingActions.size) return;
  const interval = live.room?.phase === 'finished' ? 10000 : live.room?.phase === 'lobby' ? 1600 : 900;
  if (Date.now() - live.lastPollAt < interval) return;
  live.lastPollAt = Date.now();
  live.fetching = true; const seq = ++live.requestSeq; const code = live.code;
  try {
    const data = await liveAPI(`/api/rooms/${encodeURIComponent(code)}`);
    if (live.code === code) liveApplyResponse(data, seq);
  } catch (error) {
    if (live.code !== code) return;
    if (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 410) {
      liveClearSession(); toast(error.message || 'This room is no longer available.');
    } else liveShowConnection('offline');
  } finally { live.fetching = false; }
}
async function liveAction(action, body = {}) {
  if (!live.code || !live.token || live.pendingActions.has(action)) return null;
  const pending = live.pendingActions; pending.add(action);
  const seq = ++live.requestSeq; const code = live.code;
  try {
    const data = await liveAPI(`/api/rooms/${encodeURIComponent(code)}/${action}`, { method: 'POST', body });
    if (live.code === code) liveApplyResponse(data, seq);
    return data;
  } catch (error) { toast(error.message); return null; }
  finally { pending.delete(action); }
}
async function liveLeaveRoom() {
  if (!live.code) return;
  const code = live.code;
  try { await liveAPI(`/api/rooms/${encodeURIComponent(code)}/leave`, { method: 'POST', body: {} }); }
  catch { /* Leaving the local room still works if the connection is unavailable. */ }
  liveClearSession(); setView('live'); toast('You left the room.');
}
function liveCurrentPlayer() { return live.room?.players?.find(player => player.id === live.playerId) || null; }
function liveRoundKey(room) { return `${room.code}:${room.questionIndex}:${room.currentQuestion?.id || ''}`; }
function liveRender() {
  const room = live.room; if (!room) return;
  const incoming = room.myEffect;
  const effectSignature = incoming ? `${room.questionIndex}:${incoming.type}:${incoming.until || 'active'}` : '';
  if (effectSignature && effectSignature !== live.effectSignature) livePowerFeedback(incoming.type, true, incoming.from);
  live.effectSignature = effectSignature;
  const scramble = room.currentQuestion?.scrambled ? `${room.questionIndex}:${room.currentQuestion.scrambledById || room.currentQuestion.scrambledBy || 'rival'}` : '';
  if (scramble && scramble !== live.scrambleSignature && room.currentQuestion.scrambledById !== live.playerId) livePowerFeedback('scramble', true, room.currentQuestion.scrambledBy || 'A rival');
  live.scrambleSignature = scramble;
  $('liveRoomCode').textContent = room.code || live.code;
  if (room.currentQuestion) live.lastQuestion = room.currentQuestion;
  const roundKey = liveRoundKey(room);
  if (room.phase === 'question' && roundKey !== live.roundKey) {
    live.roundKey = roundKey; live.selected.clear(); live.submitted = false; live.pendingAnswer = null; live.hintStep = 0;
    const cq = room.currentQuestion;
    if (cq?.matching && cq.dragItems && cq.dragTargets) {
      const answerPairs = Array.isArray(room.myAnswer) ? room.myAnswer : [];
      live.dragMapping = cq.dragItems.map(item => { const saved = answerPairs.find(answer => String(answer).startsWith(`${item} → `)); if (!saved) return -1; const target = String(saved).slice(`${item} → `.length); return cq.dragTargets.findIndex(candidate => normalize(candidate) === normalize(target)); });
      live.savedDragMapping = [...live.dragMapping];
    } else { live.dragMapping = []; live.savedDragMapping = []; }
    if (room.currentQuestion?.multiple && room.myAnswer != null) {
      const saved = Array.isArray(room.myAnswer) ? room.myAnswer : [room.myAnswer];
      room.currentQuestion.options.forEach((option, index) => { if (saved.some(item => normalize(item) === normalize(option))) live.selected.add(index); });
    }
  }
  const phaseKey = room.phase === 'lobby' ? `${room.phase}:${room.players?.map(p => `${p.id}:${p.ready}`).join(',')}`
    : `${room.phase}:${roundKey}:${live.submitted}:${live.hintStep}:${room.freezeUsed}:${room.mySpendablePoints}:${JSON.stringify(room.currentQuestion)}:${room.scrambleUsed}:${JSON.stringify(room.myPowers)}:${JSON.stringify(room.myEffect)}:${JSON.stringify(live.pendingAnswer)}:${JSON.stringify(room.myAnswer)}:${JSON.stringify(room.result?.players || [])}`;
  if (phaseKey !== live.stageSignature) { live.stageSignature = phaseKey; liveRenderStage(); }
  const playersKey = JSON.stringify((room.players || []).map(p => [p.id, p.name, p.score, p.streak, p.ready, p.answered]));
  if (playersKey !== live.playersSignature) { live.playersSignature = playersKey; liveRenderPlayers(); }
  const messagesKey = JSON.stringify((room.messages || []).map(m => m.id));
  if (messagesKey !== live.messagesSignature) { live.messagesSignature = messagesKey; liveRenderMessages(); }
  liveRenderReactions(); liveUpdateClock();
  if (room.phase === 'reveal' && live.revealKey !== roundKey) {
    live.revealKey = roundKey;
    const mine = room.result?.players?.find(p => p.id === live.playerId);
    if (mine?.correct) { playTone('good'); burst(); announce(room.mode === 'coop' ? 'Correct! You helped the team.' : `Correct! You earned ${mine.points || 0} points.`); }
    else { playTone('bad'); announce(`Round complete. ${room.result?.correctAnswers?.join(', ') || 'Answer revealed.'}`); }
  }
  if (room.phase === 'finished' && live.revealKey !== 'finished') { live.revealKey = 'finished'; playTone('good'); burst(); }
}
function livePowerMarkup(room, q, options) {
  const used = room.myPowers || {}, coop = room.mode === 'coop';
  const costs = { fifty: coop ? 0 : 70, shield:45, freeze:60, splat:40, zap:60, ward:35, scramble:45, lucky:25 };
  const button = (name,label,disabled=false) => '<button type="button" class="power-button" data-live-power="'+name+'" '+(disabled || used[name] || live.submitted || (room.mySpendablePoints || 0) < costs[name] ? 'disabled' : '')+'>'+label+' · '+costs[name]+'</button>';
  const fifty = button('fifty','½ 50/50',q.type==='short_answer_question'||q.multiple||options.length<4);
  const hint = '<button type="button" class="hint-button" data-live-hint '+(live.hintStep>=3?'disabled':'')+'>💡 Hint</button>';
  if(coop)return '<div class="live-power-row">'+fifty+hint+'</div>';
  const targets=(room.players||[]).filter(p=>p.id!==live.playerId&&!p.answered);
  return '<div class="live-power-balance">'+formatNumber(room.mySpendablePoints||0)+' spendable pts · scores settle at reveal'+(room.streakPerk?' · streak shield earned!':'')+'</div><div class="live-power-row">'+fifty+button('shield','◇ Streak shield')+button('freeze','❄ +4s for all',room.freezeUsed)+button('lucky','🍀 Lucky Byte · +35 if right')+hint+'</div>'+(room.playful!==false?'<details class="battle-tools"><summary>Playful items · one attack per question</summary><select id="battleTarget" class="battle-target" aria-label="Choose a player to target"><option value="">Choose a player to target</option>'+targets.map(p=>'<option value="'+escapeHTML(p.id)+'">'+escapeHTML(p.name)+'</option>').join('')+'</select><div class="live-power-row">'+button('splat','🎨 Splatter',used.attack||!targets.length)+button('zap','ϟ Zap up to 50 pts',used.attack||!targets.length)+button('scramble','🌀 Scramble everyone',used.attack||room.scrambleUsed||q.type==='short_answer_question')+button('ward','◈ Protective ward')+'</div><p class="live-lobby-note">Scramble rearranges everyone’s choices at once. Splatter lasts 8s; wipe it away anytime. Zap can remove up to 50 points. Ward blocks attacks aimed at you. One attack per player per question. Every 3 correct earns a streak shield; every 5 earns +25.</p></details>':'' );
}
const LIVE_POWER_FX = {
  fifty: ['✂️', '50/50'], shield: ['🛡️', 'Shield'], freeze: ['❄️', 'Freeze'], splat: ['🎨', 'Splatter'],
  zap: ['⚡', 'Zap'], ward: ['🔰', 'Ward'], 'ward-blocked': ['🛡️', 'Ward blocked it'], scramble: ['🌀', 'Packet Scramble'], lucky: ['🍀', 'Lucky Byte'], clear: ['🧽', 'Wipe clean']
};
function livePowerFeedback(name, incoming = false, targetName = '') {
  const [icon, label] = LIVE_POWER_FX[name] || ['✨', 'Power up'];
  playTone(name);
  const layer = $('liveReactionLayer');
  if (!layer) return;
  const item = document.createElement('div');
  item.className = `live-power-fx ${incoming ? 'is-incoming' : 'is-outgoing'} power-fx-${name}`;
  item.setAttribute('role', 'status');
  item.innerHTML = `<span>${icon}</span><strong>${incoming ? `${escapeHTML(targetName || 'A rival')} used ${label}` : `${label}!`}</strong>`;
  layer.append(item);
  setTimeout(() => item.remove(), 1850);
  if (!incoming) burst();
  announce(incoming ? `${targetName || 'A rival'} used ${label}.` : `${label} activated${targetName ? ` on ${targetName}` : ''}.`);
}
async function liveUsePower(name, targetId) {
  const target = live.room?.players?.find(player => player.id === targetId);
  const data = await liveAction('power', { name, targetId, questionIndex: live.room?.questionIndex });
  if (data) livePowerFeedback(name, false, target?.name || '');
}
function liveRenderStage() {
  const room = live.room; if (!room) return;
  const stage = $('liveStage');
  stage.classList.remove('is-splattered');
  $('liveRosterTitle').textContent = room.mode === 'coop' ? 'YOUR STUDY GROUP' : 'THE LEADERBOARD';
  if (room.phase === 'lobby') {
    const me = liveCurrentPlayer(); const host = room.hostId === live.playerId; const count = room.players?.length || 0;
    stage.innerHTML = `<span class="live-stage-kicker">${room.mode === 'coop' ? 'STUDY TOGETHER' : 'WAITING ROOM'} · ${room.total || 10} QUESTIONS</span><h2>${host ? 'Share this code.' : 'You joined!'}</h2><div class="live-code-display" aria-label="Room code ${escapeHTML(room.code)}">${escapeHTML(room.code)}</div><div class="live-wait-message">${count} / ${room.maxPlayers || 20} players in room${count < 2 ? ' · Waiting for a friend…' : count >= (room.maxPlayers || 20) ? ' · Room full' : ' · Ready to race'}</div><div class="live-lobby-bottom"><button type="button" class="button ${me?.ready ? 'button-outline' : 'button-live'}" data-live-action="ready">${me?.ready ? '✓ Ready' : 'Mark me ready'}</button>${host ? `<button type="button" class="button button-primary" data-live-action="start" ${count < 2 ? 'disabled' : ''}>${room.mode === 'coop' ? 'Start studying' : 'Start battle'} ↗</button>` : ''}<span class="live-lobby-note">${room.mode === 'coop' ? 'No timer. Discuss in chat; the host advances after feedback.' : 'Answers reveal when everyone answers · 25s max'}</span></div>`;
    return;
  }
  if (room.phase === 'finished' && room.mode === 'coop') {
    stage.innerHTML = '<span class="live-stage-kicker">BETTER TOGETHER</span><h2>Study session complete.</h2><div class="coop-progress"><strong>'+room.team.mastered+' / '+room.total+' questions solved together</strong><p>A question counts when at least one teammate answers correctly. Talk through the tricky ones and try another session.</p></div><button class="button button-primary" data-live-action="new">Study again ↗</button>'; return;
  }
  if (room.phase === 'finished') {
    const ranked = [...(room.players || [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const winner = ranked[0];
    stage.innerHTML = `<span class="live-stage-kicker">BATTLE COMPLETE · ${room.total || 0} QUESTIONS</span><h2>${winner ? `${escapeHTML(winner.name)} wins!` : 'Round complete!'}</h2><div class="live-podium">${ranked.slice(0, 3).map((p, i) => `<div class="live-podium-item"><span aria-hidden="true">${['👑', '🥈', '🥉'][i]}</span><strong>${escapeHTML(p.name)}</strong><small>${formatNumber(p.score)} pts</small></div>`).join('')}</div><button type="button" class="button button-live" data-live-action="new">Play again ↗</button>`;
    return;
  }
  const q = room.currentQuestion || live.lastQuestion;
  if (!q) { stage.innerHTML = '<span class="live-stage-kicker">ROUND STARTING</span><h2>Get ready…</h2>'; return; }
  const isReveal = room.phase === 'reveal';
  const answers = room.result?.correctAnswers || [];
  const mine = room.result?.players?.find(p => p.id === live.playerId);
  const options = Array.isArray(q.options) ? q.options : [];
  const typed = q.type === 'short_answer_question' || !options.length;
  const drag = q.matching && Array.isArray(q.dragItems) && q.dragItems.length > 1 && Array.isArray(q.dragTargets);
  const savedAnswer = room.myAnswer;
  const hasSavedAnswer = savedAnswer != null;
  const displayedAnswer = live.pendingAnswer ?? savedAnswer;
  const displayedValues = Array.isArray(displayedAnswer) ? displayedAnswer : [displayedAnswer];
  const savedValues = Array.isArray(savedAnswer) ? savedAnswer : [savedAnswer];
  const savedIndexes = options.map((option, index) => savedValues.some(value => value != null && normalize(value) === normalize(option)) ? index : -1).filter(index => index >= 0);
  const savedEliminated = savedIndexes.some(index => (room.myPowers?.fifty || []).includes(index));
  const draftChanged = drag ? JSON.stringify(live.dragMapping || []) !== JSON.stringify(live.savedDragMapping || []) : q.multiple && (live.selected.size !== savedIndexes.length || [...live.selected].some(index => !savedIndexes.includes(index)));
  const answerMarkup = drag
    ? `${!isReveal ? '<p class="drag-match-instruction">Desktop: drag items. On touch, tap an answer then its prompt, or use the slot menu.</p>' : ''}${renderDragMatch(q, live.dragMapping, isReveal || live.submitted, 'live', q.dragItems.map((_, index) => index), q.dragTargets.map((_, index) => index))}${!isReveal ? `<div class="live-answer-action"><button type="button" class="button button-primary" data-live-action="submit-drag" ${live.submitted || !isCompleteDrag(live.dragMapping || []) || !draftChanged ? 'disabled' : ''}>${hasSavedAnswer ? 'Update matches' : 'Lock in matches'} ↗</button></div>` : ''}`
    : typed
    ? isReveal ? '' : `<form id="liveAnswerForm" class="live-answer-form"><label class="sr-only" for="liveAnswerInput">Your answer</label><input id="liveAnswerInput" class="live-input" maxlength="200" placeholder="Type your answer…" value="${escapeHTML(typeof displayedAnswer === 'string' ? displayedAnswer : '')}" ${live.submitted ? 'disabled' : ''} required><button type="submit" class="button button-primary" ${live.submitted ? 'disabled' : ''}>${hasSavedAnswer ? 'Update answer' : 'Send'} ↗</button></form>`
    : `<div class="live-answer-grid">${options.map((option, index) => { const correct = answers.some(a => normalize(a) === normalize(option)); const chosen = isReveal || !q.multiple ? displayedValues.some(value => value != null && normalize(value) === normalize(option)) : live.selected.has(index); const eliminated = !isReveal && (room.myPowers?.fifty || []).includes(index); const cls = isReveal ? correct ? 'is-correct' : chosen ? 'is-wrong' : '' : eliminated ? 'is-eliminated' : chosen ? 'is-selected' : ''; return `<button type="button" class="live-answer-option ${cls}" data-live-choice="${index}" ${isReveal || live.submitted || eliminated ? 'disabled' : ''} aria-pressed="${chosen}"><i>${index + 1}</i><span>${escapeHTML(option)}</span></button>`; }).join('')}</div>${q.multiple && !isReveal ? `<div class="live-answer-action"><button type="button" class="button button-primary" data-live-action="submit-multi" ${live.submitted || !live.selected.size || !draftChanged ? 'disabled' : ''}>${hasSavedAnswer ? 'Update answer' : 'Lock in answers'} ↗</button></div>` : ''}`;
  const answerNote = isReveal ? '' : live.submitted ? 'Saving your answer…' : hasSavedAnswer && draftChanged ? `Your changes are not saved yet. Press ${drag ? 'Update matches' : 'Update answer'}.` : savedEliminated ? 'Your saved choice was eliminated. Pick another before the question closes.' : hasSavedAnswer ? '✓ Answer saved. You can change it until the question closes.' : q.multiple && live.selected.size ? 'Press Lock in answers to save your selection.' : '';
  const hint = !isReveal && live.hintStep ? `<div class="coach-panel live-hint-panel"><div class="coach-title">💡 STUDY HINT ${live.hintStep}/3</div><p class="coach-chat">${escapeHTML(hintMessages(q)[live.hintStep - 1])}</p></div>` : '';
  stage.classList.toggle('is-scrambled', Boolean(!isReveal && q.scrambled));
  stage.innerHTML = `<div class="live-quiz-meta"><span class="live-stage-kicker">${isReveal ? 'ANSWER REVEAL' : 'LIVE ROUND'} · QUESTION ${(room.questionIndex ?? 0) + 1} / ${room.total || 10}</span><span id="liveTimer" class="live-timer">◷ <span>—</span></span></div><div class="live-clock-track" aria-hidden="true"><div id="liveClockFill" class="live-clock-fill"></div></div><div class="live-question-text">${safeQuestionHTML(q)}</div>${!isReveal && q.scrambled ? '<div class="live-power-banner">🌀 Choices scrambled for the whole room!</div>' : ''}${answerMarkup}${answerNote ? `<div class="live-answer-note">${answerNote}</div>` : ''}${!isReveal ? livePowerMarkup(room, q, options) : ''}${hint}${isReveal ? `<div class="live-reveal ${mine?.correct ? '' : 'is-wrong'}"><strong>${mine?.correct ? room.mode === 'coop' ? 'You helped the team!' : `Nice hit! +${formatNumber(mine.points || 0)} points` : mine?.shielded ? 'Shield saved your streak' : 'Round complete'}</strong><span>Correct answer${answers.length > 1 ? 's' : ''}: ${escapeHTML(answers.join(' · '))}</span>${!mine?.correct && mine?.answer != null ? `<span>Your answer: ${escapeHTML(Array.isArray(mine.answer) ? mine.answer.join(' · ') : mine.answer)}</span>` : ''}<span class="feedback-explanation"><b>Why this answer works</b>${escapeHTML(explanationText(q))}</span><small class="recall-cue">Try explaining the idea in your own words before moving on.</small></div><p class="live-lobby-note">${room.mode === 'coop' ? 'Take a moment to discuss the explanation.' : `Items: −${room.myPowers?.spent || 0} pts${room.myPowers?.penalty ? ` · Zapped: −${room.myPowers.penalty} pts` : ''}${room.myPowers?.blocked ? ' · Ward blocked an attack' : ''}. Next question starts automatically.`}</p>` : ''}`;
  if (drag && !isReveal) {
    const board = stage.querySelector('[data-drag-board]'); attachDragInteraction(board, '#liveStage', live.submitted);
    board.addEventListener('change', () => { live.dragMapping = dragMappingFrom(board); const button = stage.querySelector('[data-live-action="submit-drag"]'); if (button) button.disabled = live.submitted || !isCompleteDrag(live.dragMapping) || JSON.stringify(live.dragMapping) === JSON.stringify(live.savedDragMapping); const note = stage.querySelector('.live-answer-note'); if (note) note.textContent = hasSavedAnswer ? 'Your changes are not saved yet. Press Update matches.' : 'Complete the pairs, then lock in your matches.'; });
  }
  if (room.mode === 'coop') {
    const team=document.createElement('div');team.className='coop-progress';team.innerHTML='<strong>Team progress · '+room.team.mastered+' / '+room.total+' solved</strong><progress value="'+room.team.mastered+'" max="'+room.total+'" aria-label="Questions solved together"></progress><small>Discuss in room chat. Everyone can keep changing their answer until reveal.</small>';stage.prepend(team);
    const note=stage.querySelector('.live-lobby-note');if(note)note.textContent='Take a moment to explain the answer to each other.';
    stage.querySelector('.live-clock-track')?.remove();stage.querySelector('#liveTimer')?.remove();
    const next=document.createElement('div');next.className='live-lobby-bottom';next.innerHTML=room.hostId===live.playerId?'<button class="button button-primary" data-live-action="advance">'+(isReveal?'Next question →':'Reveal for everyone')+'</button>':'<p class="live-lobby-note">The host will move everyone forward when you’re ready.</p>';stage.append(next);
  }
  if (!isReveal && room.myEffect?.type === 'splat' && (!room.myEffect.until || room.myEffect.until > Date.now() + live.serverOffset)) {
    stage.classList.add('is-splattered');const notice=document.createElement('div');notice.className='splat-notice';notice.innerHTML='<button class="button-outline" data-live-power="clear">Wipe clean</button><strong>🎨 Splattered by '+escapeHTML(room.myEffect.from||'a rival')+'!</strong><p>Your choices are blurred for 8 seconds. Wipe them clean anytime.</p>';stage.prepend(notice);
  } else if (!isReveal && room.myEffect?.type === 'scramble') {
    const notice=document.createElement('div');notice.className='live-power-banner is-scrambled';notice.textContent=`🌀 ${room.myEffect.from} shuffled your choices · still the same answers`;stage.prepend(notice);
  } else if (!isReveal && room.myEffect?.type === 'ward-blocked') {
    const notice=document.createElement('div');notice.className='live-power-banner';notice.textContent=`🛡️ Your ward blocked ${room.myEffect.from}’s attack`;stage.prepend(notice);
  } else if (!isReveal && room.myEffect?.type === 'zap') {
    const notice=document.createElement('div');notice.className='live-power-banner is-zapped';notice.textContent=`⚡ Zapped by ${room.myEffect.from} · up to 50 points at reveal`;stage.prepend(notice);
  }
  liveUpdateClock();
}
function liveRenderPlayers() {
  const room = live.room; if (!room) return;
  const players = [...(room.players || [])].sort((a, b) => (room.phase === 'lobby' || room.mode === 'coop' ? 0 : b.score - a.score) || a.name.localeCompare(b.name));
  $('livePlayerCount').textContent = `${players.length} / ${room.maxPlayers || 20} players`;
  $('livePlayers').innerHTML = players.map((p, index) => `<div class="live-player ${p.id === live.playerId ? 'is-you' : ''}"><span class="live-player-rank">${room.phase === 'lobby' || room.mode === 'coop' ? '◈' : index + 1}</span><span class="live-player-name">${escapeHTML(p.name)}${p.id === live.playerId ? ' · you' : ''}${p.id === room.hostId ? ' 👑' : ''}<small>${room.phase === 'lobby' ? p.ready ? '✓ ready' : 'waiting' : room.phase === 'question' ? p.answered ? '✓ answered' : 'thinking…' : room.mode === 'coop' ? 'learning together' : `${p.streak || 0} streak`}</small></span><span class="live-player-score">${room.mode === 'coop' ? '🤝' : formatNumber(p.score || 0)}<small>${room.mode === 'coop' ? 'TEAM' : 'PTS'}</small></span></div>`).join('');
}
function liveRenderMessages() {
  const feed = $('liveMessages'); const nearBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 25;
  const messages = (live.room?.messages || []).slice(-35);
  feed.innerHTML = messages.length ? messages.map(m => `<div class="live-message ${m.playerId === live.playerId ? 'is-self' : ''}"><strong>${escapeHTML(m.name || 'Player')}</strong><span>${escapeHTML(m.text || '')}</span></div>`).join('') : '<div class="live-message-empty">First one here? Say hello. 👋</div>';
  if (nearBottom) feed.scrollTop = feed.scrollHeight;
}
function liveRenderReactions() {
  const reactions = live.room?.reactions || [];
  if (!live.sawReactions) { reactions.forEach(r => live.seenReactions.add(r.id)); live.sawReactions = true; return; }
  reactions.forEach(reaction => {
    if (live.seenReactions.has(reaction.id)) return;
    live.seenReactions.add(reaction.id);
    const dot = document.createElement('span'); dot.className = 'live-floating-reaction'; dot.textContent = reaction.emoji || '✳';
    dot.style.right = `${25 + Math.random() * 120}px`; dot.style.setProperty('--reaction-x', `${-50 + Math.random() * 100}px`);
    $('liveReactionLayer').append(dot); setTimeout(() => dot.remove(), 2000);
  });
  if (live.seenReactions.size > 250) live.seenReactions = new Set(reactions.map(r => r.id));
}
function liveUpdateClock() {
  const room = live.room; if (!room) return;
  if (!room.myEffect || room.myEffect.until <= Date.now() + live.serverOffset) { $('liveStage').classList.remove('is-splattered'); $('liveStage').querySelector('.splat-notice')?.remove(); }
  if (!room.endsAt) return;
  const remaining = Math.max(0, room.endsAt - (Date.now() + live.serverOffset));
  const timer = $('liveTimer'); const fill = $('liveClockFill');
  if (!timer || !fill) return;
  timer.querySelector('span').textContent = `${(remaining / 1000).toFixed(1)}s`;
  const duration = room.phase === 'question' ? room.freezeUsed ? 29000 : 25000 : 5000;
  fill.style.width = `${Math.min(100, remaining / duration * 100)}%`;
  const urgent = room.phase === 'question' && remaining <= 6000;
  timer.classList.toggle('is-urgent', urgent); fill.classList.toggle('is-urgent', urgent);
}
async function liveSubmitAnswer(answer) {
  if (!live.room || live.room.phase !== 'question' || live.submitted) return;
  live.submitted = true; live.pendingAnswer = answer; liveRenderStage();
  const result = await liveAction('answer', { answer, questionIndex: live.room.questionIndex });
  live.submitted = false; live.pendingAnswer = null;
  live.stageSignature = '';
  liveRender();
  if (!result) { live.lastPollAt = 0; livePoll(); }
}
async function liveResume() {
  const inviteCode = new URL(location.href).searchParams.get('room')?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || '';
  const savedName = readJSON('pp_live_name', '');
  $('liveHostName').value = savedName; $('liveGuestName').value = savedName;
  if (inviteCode) { $('liveJoinCode').value = inviteCode; setView('live'); }
  const session = readJSON(deckStorageKey('pp_live_session'), null);
  if (!session?.code || !session?.token || !session?.playerId || (inviteCode && inviteCode !== session.code)) return;
  live.code = session.code; live.token = session.token; live.playerId = session.playerId; live.name = session.name || savedName;
  liveShowConnection('connecting');
  try {
    const data = await liveAPI(`/api/rooms/${encodeURIComponent(live.code)}`);
    liveEnter({ ...data, token: live.token, playerId: live.playerId }, live.name);
  } catch {
    liveClearSession();
    if (inviteCode) { $('liveJoinCode').value = inviteCode; setView('live'); }
  }
}
function attachLiveEvents() {
  $('heroLive').addEventListener('click', () => setView('live'));
  $('liveRoomMode').addEventListener('change', () => { $('livePlayful').disabled = $('liveRoomMode').value === 'coop'; });
  $('liveCreateForm').addEventListener('submit', event => { event.preventDefault(); liveCreate(); });
  $('liveJoinForm').addEventListener('submit', event => { event.preventDefault(); liveJoin(); });
  $('liveJoinCode').addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
  $('liveLeave').addEventListener('click', liveLeaveRoom);
  $('liveCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(liveInviteURL()); toast('Invite link copied. Send it to a friend!'); } catch { toast(`Share this room code: ${live.code}`); } });
  $('liveStage').addEventListener('click', event => {
    const power = event.target.closest('[data-live-power]');
    if (power && live.room?.phase === 'question' && !power.disabled) { const name = power.dataset.livePower; const targetId = $('battleTarget')?.value; if (['splat','zap'].includes(name) && !targetId) { toast('Choose a player first.'); return; } if(name==='clear') { $('liveStage').classList.remove('is-splattered'); $('liveStage').querySelector('.splat-notice')?.remove(); liveAction('power', { name, questionIndex: live.room.questionIndex }).then(data => { if (data) livePowerFeedback(name); }); } else liveUsePower(name,targetId); return; }
    if (event.target.closest('[data-live-hint]') && live.room?.phase === 'question' && live.hintStep < 3) {
      const draft = $('liveAnswerInput')?.value;
      live.hintStep++; live.stageSignature = ''; liveRender();
      if (draft != null && $('liveAnswerInput')) $('liveAnswerInput').value = draft;
      return;
    }
    const choice = event.target.closest('[data-live-choice]');
    if (choice && live.room?.phase === 'question' && !live.submitted) {
      const index = +choice.dataset.liveChoice, q = live.room.currentQuestion;
      if (!q || !q.options?.[index]) return;
      if (q.multiple) {
        if (live.selected.has(index)) live.selected.delete(index); else live.selected.add(index);
        liveRenderStage();
      } else liveSubmitAnswer(q.options[index]);
      return;
    }
    const action = event.target.closest('[data-live-action]')?.dataset.liveAction;
    if (action === 'ready') liveAction('ready', { ready: !liveCurrentPlayer()?.ready });
    else if (action === 'start') liveAction('start');
    else if (action === 'advance') liveAction('advance', { questionIndex: live.room.questionIndex, phase: live.room.phase });
    else if (action === 'submit-multi') {
      const q = live.room?.currentQuestion;
      if (q && live.selected.size) liveSubmitAnswer([...live.selected].map(index => q.options[index]));
    } else if (action === 'submit-drag') {
      const q = live.room?.currentQuestion; if (q?.matching && isCompleteDrag(live.dragMapping)) liveSubmitAnswer(dragPayload(q, live.dragMapping));
    } else if (action === 'new') liveLeaveRoom();
  });
  $('liveStage').addEventListener('change', event => {
    if (event.target.matches('[data-drag-select]') && live.room?.phase === 'question' && !live.submitted) { const board = $('liveStage').querySelector('[data-drag-board]'); live.dragMapping = dragMappingFrom(board); const button = $('liveStage').querySelector('[data-live-action="submit-drag"]'); if (button) button.disabled = !isCompleteDrag(live.dragMapping) || JSON.stringify(live.dragMapping) === JSON.stringify(live.savedDragMapping); }
  });
  $('liveStage').addEventListener('submit', event => {
    if (event.target.id !== 'liveAnswerForm') return;
    event.preventDefault(); const answer = $('liveAnswerInput')?.value.trim(); if (answer) liveSubmitAnswer(answer);
  });
  $('liveStage').addEventListener('input', event => {
    if (event.target.id !== 'liveAnswerInput' || live.room?.myAnswer == null) return;
    const note = $('liveStage').querySelector('.live-answer-note');
    if (note) note.textContent = event.target.value.trim() === String(live.room.myAnswer).trim()
      ? '✓ Answer saved. You can change it until the question closes.'
      : 'Your changes are not saved yet. Press Update answer.';
  });
  $('liveChatForm').addEventListener('submit', async event => {
    event.preventDefault(); const input = $('liveChatInput'); const text = input.value.trim();
    if (!text || !live.code) return;
    input.value = ''; const result = await liveAction('chat', { text });
    if (!result && !input.value) input.value = text;
  });
  $('liveRoom').addEventListener('click', event => {
    const emoji = event.target.closest('[data-live-emoji]')?.dataset.liveEmoji;
    if (emoji) { playTone('click'); liveAction('react', { emoji }); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && live.code) livePoll(); });
}

let deferredInstall = null;
function setupInstall() {
  const button = $('installButton');
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredInstall = event; button.hidden = false;
  });
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) button.hidden = false;
  button.addEventListener('click', async () => {
    if (deferredInstall) {
      const prompt = deferredInstall; deferredInstall = null;
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result?.outcome === 'accepted') button.hidden = true;
    } else toast('On iPhone: tap Share, then Add to Home Screen.');
  });
  window.addEventListener('appinstalled', () => { button.hidden = true; deferredInstall = null; toast('Packet Party is installed!'); });
}

renderDeckChrome(); updateSoundButton(); updateStats(); renderLeaderboardModeTabs(); attachEvents(); attachLiveEvents(); setupInstall(); loadQuestions(); liveResume();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
