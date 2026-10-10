(() => {
  const byId = id => document.getElementById(id);
  const storageKey = new URL(location.href).searchParams.get('deck') === 'ccst' ? 'pp_ccst_notebook_focus_v1' : 'pp_focus_v1';
  const fruitTypes = ['🍊', '🍓', '🍋', '🍇', '🍐', '🍒', '🥝', '🍑', '🍎', '🫐'];
  const rewardStep = 5 * 60 * 1000;
  const defaultMinutes = 25;
  const read = () => { try { return JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { return {}; } };
  const saved = read();
  const state = {
    phase: ['focus', 'break', 'complete'].includes(saved.phase) ? saved.phase : 'idle',
    active: false,
    durationMs: Number(saved.durationMs) || defaultMinutes * 60 * 1000,
    remainingMs: Number.isFinite(saved.remainingMs) ? Math.max(0, saved.remainingMs) : defaultMinutes * 60 * 1000,
    breakRemainingMs: Number.isFinite(saved.breakRemainingMs) ? Math.max(0, saved.breakRemainingMs) : 5 * 60 * 1000,
    elapsedMs: Math.max(0, Number(saved.elapsedMs) || 0),
    totalMs: Math.max(0, Number(saved.totalMs) || 0),
    fruits: Array.isArray(saved.fruits) ? saved.fruits.filter(item => fruitTypes.includes(item)).slice(-60) : [],
    lastSavedSecond: -1
  };
  if (state.phase === 'focus' && state.remainingMs <= 0) state.phase = 'complete';
  if (state.phase === 'break' && state.breakRemainingMs <= 0) { state.phase = 'focus'; state.active = false; }
  let canvas, ctx, width = 0, height = 0, animation = 0, lastFrame = 0, lastTick = Date.now(), hasDrawn = false;
  let bodies = [];

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ phase: state.phase, durationMs: state.durationMs, remainingMs: state.remainingMs, breakRemainingMs: state.breakRemainingMs, elapsedMs: state.elapsedMs, totalMs: state.totalMs, fruits: state.fruits }));
    } catch { /* The timer still works when browser storage is unavailable. */ }
  }
  function formatTime(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function render() {
    const minutes = Math.max(5, Math.min(90, Number(byId('focusLengthSelect').value) || defaultMinutes));
    if (state.phase === 'idle' || state.phase === 'complete') {
      if (state.phase === 'idle' && !state.elapsedMs) state.durationMs = minutes * 60 * 1000;
      byId('focusClock').textContent = formatTime(state.phase === 'complete' ? 0 : state.remainingMs || state.durationMs);
    } else byId('focusClock').textContent = formatTime(state.phase === 'break' ? state.breakRemainingMs : state.remainingMs);
    const label = byId('focusPhaseLabel');
    const status = byId('focusStatus');
    const toggle = byId('focusToggle');
    const breakButton = byId('focusBreakButton');
    const length = byId('focusLengthSelect');
    length.value = String(Math.round(state.durationMs / 60000));
    length.disabled = state.active || state.phase === 'focus' || state.phase === 'break';
    if (state.phase === 'break') {
      label.textContent = state.active ? 'TAKE A BREATHER' : 'BREAK PAUSED';
      status.textContent = state.active ? 'Your focus time is safely paused.' : 'Rest a little, then jump back in.';
      toggle.textContent = state.active ? 'Pause break' : 'Resume break ↗';
      breakButton.textContent = 'Back to focus ↗';
      breakButton.disabled = false;
    } else if (state.phase === 'complete') {
      label.textContent = 'SESSION COMPLETE'; status.textContent = 'Nice work. Your garden grew while you focused.';
      toggle.textContent = 'Start another session ↗'; breakButton.textContent = 'Take a 5 min break'; breakButton.disabled = true;
    } else if (state.phase === 'focus' && state.active) {
      label.textContent = 'IN THE ZONE'; status.textContent = 'Keep Packet Party open to grow your next fruit.';
      toggle.textContent = 'Pause focus'; breakButton.textContent = 'Take a 5 min break'; breakButton.disabled = false;
    } else if (state.phase === 'focus') {
      label.textContent = 'FOCUS PAUSED'; status.textContent = 'Ready when you are. Your progress is saved.';
      toggle.textContent = 'Continue focusing ↗'; breakButton.textContent = 'Take a 5 min break'; breakButton.disabled = false;
    } else {
      label.textContent = 'READY WHEN YOU ARE'; status.textContent = 'Stay on this page while you focus.';
      toggle.textContent = 'Start focusing ↗'; breakButton.textContent = 'Take a 5 min break'; breakButton.disabled = true;
    }
    byId('focusResetButton').disabled = state.active;
    byId('focusTotalText').textContent = `${Math.floor(state.totalMs / 60000)} focused minute${Math.floor(state.totalMs / 60000) === 1 ? '' : 's'}`;
    byId('focusFruitCount').textContent = state.fruits.length;
    const progressed = state.elapsedMs % rewardStep;
    const minutesToFruit = Math.ceil((rewardStep - progressed) / 60000);
    byId('focusRewardHint').textContent = state.phase === 'complete' ? 'Session complete — every fruit is earned focus time.' : `${minutesToFruit} focused minute${minutesToFruit === 1 ? '' : 's'} to your next surprise fruit.`;
    byId('focusButton').classList.toggle('is-focusing', state.active && state.phase === 'focus');
    byId('focusButton').setAttribute('aria-label', state.active ? 'Focus timer is running; open focus garden' : 'Open focus timer and fruit garden');
    persist();
    if (byId('focusDialog').open) drawJar(true);
  }
  function pause(reason = '') {
    if (!state.active) return;
    state.active = false;
    lastTick = Date.now();
    persist(); render();
    if (reason) byId('focusStatus').textContent = reason;
  }
  function beginFocus() {
    if (state.phase === 'complete' || state.phase === 'idle') {
      state.durationMs = (Number(byId('focusLengthSelect').value) || defaultMinutes) * 60000;
      state.remainingMs = state.durationMs; state.elapsedMs = 0; state.phase = 'focus';
    }
    if (state.phase !== 'focus' || document.hidden || !document.hasFocus()) return;
    state.active = true; lastTick = Date.now(); render();
  }
  function takeBreak() {
    if (state.phase === 'break') {
      state.phase = 'focus'; state.breakRemainingMs = 5 * 60000; state.active = false;
    } else if (state.phase === 'focus' && state.remainingMs > 0) {
      state.phase = 'break'; state.breakRemainingMs = 5 * 60000;
      state.active = !document.hidden && document.hasFocus();
      lastTick = Date.now();
    }
    render();
  }
  function addFruit() {
    state.fruits.push(fruitTypes[Math.floor(Math.random() * fruitTypes.length)]);
    if (state.fruits.length > 60) state.fruits.shift();
    if (bodies.length < 18) bodies.push(makeBody(true));
    if (byId('focusDialog').open) drawJar(true);
    byId('focusRewardHint').textContent = 'Fruit earned! Keep going to grow another.';
    persist();
  }
  function makeBody(drop = false, index = 0) {
    const radius = 13 + Math.random() * 5;
    return { emoji: state.fruits[(index + state.fruits.length - 1) % state.fruits.length] || fruitTypes[Math.floor(Math.random() * fruitTypes.length)], r: radius, x: 24 + Math.random() * Math.max(1, width - 48), y: drop ? -24 : Math.max(radius + 8, height - 35 - Math.random() * Math.min(height - 60, (index + 1) * 20)), vx: (Math.random() - .5) * 100, vy: drop ? 20 : (Math.random() - .5) * 40 };
  }
  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    bodies = state.fruits.slice(-18).map((_, index) => makeBody(false, index));
    hasDrawn = false; drawJar(true);
  }
  function drawJar(force = false) {
    if (!ctx || (!force && !byId('focusDialog').open)) return;
    ctx.clearRect(0, 0, width, height);
    const left = width * .13, right = width * .87, top = 17, bottom = height - 12;
    const visibleFruitCount = Math.min(18, state.fruits.length);
    if (!bodies.length && visibleFruitCount) bodies = state.fruits.slice(-18).map((_, index) => makeBody(false, index));
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, 'rgba(255,255,255,.12)'); grad.addColorStop(1, 'rgba(255,255,255,.025)');
    ctx.beginPath(); ctx.moveTo(width * .38, top); ctx.lineTo(width * .62, top); ctx.lineTo(width * .66, top + 18); ctx.quadraticCurveTo(right, top + 32, right - 7, bottom - 20); ctx.quadraticCurveTo(width / 2, bottom + 10, left + 7, bottom - 20); ctx.quadraticCurveTo(left, top + 32, width * .34, top + 18); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    const border = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ffbd83';
    ctx.strokeStyle = border; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(width * .35, top + 3); ctx.lineTo(width * .65, top + 3); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
    if (!state.fruits.length) {
      ctx.font = '600 13px system-ui'; ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#bfccdf'; ctx.textAlign = 'center'; ctx.fillText('Your first fruit is 5 focused minutes away', width / 2, height * .61);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    bodies.forEach(body => { ctx.font = `${body.r * 1.8}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; ctx.fillText(body.emoji, body.x, body.y); });
    if (state.fruits.length > 18) {
      ctx.font = '800 11px system-ui'; ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff'; ctx.fillText(`+${state.fruits.length - 18} in your harvest`, width / 2, bottom - 4);
    }
    hasDrawn = true;
  }
  function animate(time) {
    if (!byId('focusDialog').open) { animation = 0; return; }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'calm') {
      const dt = Math.min(.035, Math.max(0, (time - (lastFrame || time)) / 1000)); lastFrame = time;
      const floor = height - 28, minX = width * .16 + 12, maxX = width * .84 - 12;
      bodies.forEach(body => {
        body.vy += 720 * dt; body.x += body.vx * dt; body.y += body.vy * dt;
        if (body.x < minX + body.r) { body.x = minX + body.r; body.vx = Math.abs(body.vx) * .76; }
        if (body.x > maxX - body.r) { body.x = maxX - body.r; body.vx = -Math.abs(body.vx) * .76; }
        if (body.y > floor - body.r) { body.y = floor - body.r; body.vy = -Math.abs(body.vy) * .58; body.vx *= .985; if (Math.abs(body.vy) < 30) body.vy = 0; }
      });
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1, min = (a.r + b.r) * .84;
        if (distance < min) { const push = (min - distance) * .5, nx = dx / distance, ny = dy / distance; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; const bounce = (b.vy - a.vy) * .12; a.vy += bounce; b.vy -= bounce; }
      }
    }
    drawJar(); animation = requestAnimationFrame(animate);
  }
  function syncTick() {
    const now = Date.now();
    if (state.active && (document.hidden || !document.hasFocus())) { pause('Timer paused while you were away.'); return; }
    if (!state.active) { lastTick = now; return; }
    const elapsed = Math.max(0, Math.min(now - lastTick, 1800)); lastTick = now;
    if (state.phase === 'break') {
      state.breakRemainingMs = Math.max(0, state.breakRemainingMs - elapsed);
      if (!state.breakRemainingMs) { state.phase = 'focus'; state.active = false; }
    } else if (state.phase === 'focus') {
      state.remainingMs = Math.max(0, state.remainingMs - elapsed); state.elapsedMs += elapsed; state.totalMs += elapsed;
      while (state.elapsedMs >= rewardStep * (state.fruitsEarnedThisSession + 1)) { state.fruitsEarnedThisSession++; addFruit(); }
      if (!state.remainingMs) { state.phase = 'complete'; state.active = false; }
    }
    const second = Math.floor(state.phase === 'break' ? state.breakRemainingMs : state.remainingMs);
    if (second !== state.lastSavedSecond || !state.active) { state.lastSavedSecond = second; render(); }
  }
  function setup() {
    canvas = byId('focusCanvas'); ctx = canvas.getContext('2d');
    state.fruitsEarnedThisSession = Math.floor(state.elapsedMs / rewardStep);
    byId('focusLengthSelect').value = String(Math.round(state.durationMs / 60000));
    byId('focusButton').addEventListener('click', () => { byId('focusDialog').showModal(); resizeCanvas(); render(); if (!animation) animation = requestAnimationFrame(animate); });
    byId('focusClose').addEventListener('click', () => byId('focusDialog').close());
    byId('focusDialog').addEventListener('click', event => { if (event.target === byId('focusDialog')) byId('focusDialog').close(); });
    byId('focusDialog').addEventListener('close', () => { if (animation) cancelAnimationFrame(animation); animation = 0; });
    byId('focusToggle').addEventListener('click', () => {
      if (state.active) pause();
      else if (state.phase === 'break') { state.active = !document.hidden && document.hasFocus(); lastTick = Date.now(); render(); }
      else beginFocus();
    });
    byId('focusBreakButton').addEventListener('click', takeBreak);
    byId('focusResetButton').addEventListener('click', () => {
      state.active = false; state.phase = 'idle'; state.durationMs = (Number(byId('focusLengthSelect').value) || defaultMinutes) * 60000; state.remainingMs = state.durationMs; state.elapsedMs = 0; state.breakRemainingMs = 5 * 60000; state.fruitsEarnedThisSession = 0; render();
    });
    byId('focusLengthSelect').addEventListener('change', () => {
      state.durationMs = (Number(byId('focusLengthSelect').value) || defaultMinutes) * 60000; state.remainingMs = state.durationMs; state.elapsedMs = 0; state.phase = 'idle'; state.fruitsEarnedThisSession = 0; render();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause('Timer paused while you were away.'); });
    window.addEventListener('blur', () => pause('Timer paused while this page was out of focus.'));
    window.addEventListener('focus', () => { lastTick = Date.now(); });
    window.addEventListener('pagehide', () => { pause(); persist(); });
    window.addEventListener('resize', () => { if (byId('focusDialog').open) resizeCanvas(); });
    window.addEventListener('packet:motion', () => drawJar(true));
    window.addEventListener('packet:theme', () => drawJar(true));
    render(); setInterval(syncTick, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true }); else setup();
})();
