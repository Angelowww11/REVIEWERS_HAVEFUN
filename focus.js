(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('focusDialog'), mainCanvas = $('focusCanvas'), dockCanvas = $('focusMiniCanvas');
  if (!dialog || !mainCanvas || !dockCanvas) return;
  const fruitTypes = ['🍊', '🍓', '🍋', '🍇', '🍎', '🍐', '🍒', '🥝', '🍉', '🫐', '🍍'];
  const key = new URLSearchParams(location.search).get('deck') === 'ccst' ? 'pp_ccst_notebook_focus_v1' : 'pp_focus_v1';
  const defaults = { minutes: 25, remaining: 1500, phase: 'focus', running: false, focusedSeconds: 0, totalSeconds: 0, fruit: [] };
  let state = { ...defaults, ...load() }, bodies = [], raf = 0, previousFrame = 0, previousTick = Date.now();
  let resumeWhenVisible = state.running === true;
  let tiltEnabled = false, gravityX = 0, gravityY = .76;
  state.running = resumeWhenVisible && !document.hidden; state.fruit = Array.isArray(state.fruit) ? state.fruit.slice(-60) : [];
  if (state.remaining <= 0) { state.running = false; resumeWhenVisible = false; }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      if (saved.durationMs || saved.remainingMs !== undefined || saved.fruits) {
        const minutes = [15, 25, 45].reduce((closest, value) => Math.abs(value - Math.round((Number(saved.durationMs) || 25 * 60_000) / 60_000)) < Math.abs(closest - Math.round((Number(saved.durationMs) || 25 * 60_000) / 60_000)) ? value : closest, 25);
        const oldRemaining = Number(saved.phase === 'break' ? saved.breakRemainingMs : saved.remainingMs);
        return { minutes, remaining: Number.isFinite(oldRemaining) ? Math.max(0, Math.round(oldRemaining / 1000)) : minutes * 60, phase: saved.phase === 'break' ? 'break' : 'focus', focusedSeconds: Math.max(0, (Number(saved.elapsedMs) || 0) / 1000), totalSeconds: Math.max(0, (Number(saved.totalMs) || 0) / 1000), fruit: Array.isArray(saved.fruits) ? saved.fruits : [] };
      }
      return saved;
    } catch { return {}; }
  }
  function save() { try { localStorage.setItem(key, JSON.stringify({ ...state, running: state.running || resumeWhenVisible })); } catch { /* Storage may be unavailable. */ } }
  function clock(seconds) { seconds = Math.max(0, Math.ceil(seconds)); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
  function updateUI() {
    const value = clock(state.remaining);
    if ($('focusClock')) $('focusClock').textContent = value;
    if ($('focusDockClock')) $('focusDockClock').textContent = value;
    if ($('focusLengthSelect') && !$('focusLengthSelect').matches(':focus')) $('focusLengthSelect').value = String(state.minutes);
    if ($('focusFruitCount')) $('focusFruitCount').textContent = String(state.fruit.length);
    if ($('focusDockFruitCount')) $('focusDockFruitCount').textContent = `${state.fruit.length} ${state.fruit.length === 1 ? 'fruit' : 'fruits'}`;
    if ($('focusDockFruitCount')?.nextElementSibling) $('focusDockFruitCount').nextElementSibling.textContent = state.fruit.length ? 'Tap to bounce' : 'Fruit at 5 min';
    if ($('focusTotalText')) $('focusTotalText').textContent = `${Math.floor(state.totalSeconds / 60)} focused minutes`;
    if ($('focusToggle')) $('focusToggle').textContent = state.running ? 'Pause focus' : state.remaining <= 0 ? 'Start another session ↗' : 'Start focusing ↗';
    if ($('focusBreakButton')) $('focusBreakButton').disabled = state.running && state.phase === 'break';
    if ($('focusResetButton')) $('focusResetButton').disabled = state.focusedSeconds === 0 && state.remaining === state.minutes * 60;
    if ($('focusPhaseLabel')) $('focusPhaseLabel').textContent = state.phase === 'break' ? 'GENTLE BREAK' : state.running ? 'FOCUSING' : 'READY WHEN YOU ARE';
    if ($('focusStatus') && !tiltEnabled) $('focusStatus').textContent = state.running ? state.phase === 'break' ? 'Rest a little. The garden is still yours.' : 'You’re here. Your garden is growing.' : state.remaining <= 0 ? 'Session complete. Lovely work!' : 'Stay on this page while you focus.';
    if ($('focusRewardHint')) $('focusRewardHint').textContent = state.fruit.length ? 'Tap fruit or tilt your device to bounce your garden.' : 'Every 5 focused minutes grows a surprise fruit.';
    $('focusButton')?.classList.toggle('is-focusing', state.running && state.phase === 'focus');
  }
  function prepareCanvas(canvas) {
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return null;
    const ratio = Math.min(2, devicePixelRatio || 1), width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    return { ctx, width: rect.width, height: rect.height };
  }
  function jar(ctx, width, height) {
    const left = width * .13, right = width * .87, neckLeft = width * .36, neckRight = width * .64;
    const neckY = height * .14, shoulderY = height * .27, bottom = height * .91;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(neckLeft, neckY); ctx.lineTo(neckRight, neckY);
    ctx.bezierCurveTo(width * .69, neckY, width * .82, height * .16, width * .84, height * .23);
    ctx.bezierCurveTo(width * .865, height * .26, right, height * .28, right, height * .34);
    ctx.lineTo(right - width * .055, height * .82);
    ctx.bezierCurveTo(right - width * .055, height * .88, right - width * .075, bottom, right - width * .085, bottom);
    ctx.lineTo(left + width * .085, bottom);
    ctx.bezierCurveTo(left + width * .075, bottom, left + width * .055, height * .88, left + width * .055, height * .82);
    ctx.lineTo(left, height * .34);
    ctx.bezierCurveTo(left, height * .28, width * .135, height * .26, width * .16, height * .23);
    ctx.bezierCurveTo(width * .18, height * .16, width * .31, neckY, neckLeft, neckY);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, neckY, 0, bottom);
    fill.addColorStop(0, 'rgba(167,242,237,.13)'); fill.addColorStop(.54, 'rgba(255,255,255,.025)'); fill.addColorStop(1, 'rgba(173,167,255,.11)');
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a7f2ed';
    ctx.globalAlpha = .56; ctx.lineWidth = Math.max(1.5, width * .007); ctx.stroke(); ctx.globalAlpha = 1;
    const lidX = width * .30, lidY = height * .105, lidWidth = width * .40, lidHeight = height * .047;
    ctx.beginPath(); ctx.roundRect(lidX, lidY, lidWidth, lidHeight, lidHeight * .38);
    ctx.fillStyle = 'rgba(209,225,255,.17)'; ctx.fill(); ctx.strokeStyle = 'rgba(226,237,255,.5)'; ctx.lineWidth = Math.max(1, width * .007); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lidX + width * .035, lidY + lidHeight * .28); ctx.lineTo(lidX + lidWidth - width * .035, lidY + lidHeight * .28);
    ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.lineWidth = Math.max(1, width * .004); ctx.stroke();
    ctx.restore();
    return { left: left + width * .06, right: right - width * .06, top: height * .22, bottom: bottom - height * .025 };
  }
  const radiusN = .085;
  function syncBodies() {
    const count = Math.min(state.fruit.length, 12);
    while (bodies.length < count) { const i = bodies.length; bodies.push({ fruit: state.fruit[i] || fruitTypes[i % fruitTypes.length], x: .2 + Math.random() * .6, y: .83, vx: (Math.random() - .5) * .6, vy: -Math.random() * .4, spin: Math.random() * Math.PI * 2 }); }
    bodies.length = count;
    bodies.forEach((body, i) => { body.fruit = state.fruit[i] || body.fruit; });
  }
  function physics(dt) {
    dt = Math.min(.035, Math.max(0, dt)); const damping = .7;
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]; a.vx += gravityX * dt; a.vy += gravityY * dt; a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.x < radiusN) { a.x = radiusN; a.vx = Math.abs(a.vx) * damping; }
      if (a.x > 1 - radiusN) { a.x = 1 - radiusN; a.vx = -Math.abs(a.vx) * damping; }
      if (a.y < .05 + radiusN) { a.y = .05 + radiusN; a.vy = Math.abs(a.vy) * damping; }
      if (a.y > .94 - radiusN) { a.y = .94 - radiusN; a.vy = -Math.abs(a.vy) * damping; a.vx *= .985; }
      for (let j = 0; j < i; j++) {
        const b = bodies[j], dx = (a.x - b.x) * .82, dy = a.y - b.y, d = Math.hypot(dx, dy) || .001, min = radiusN * 2;
        if (d < min) { const nx = dx / d, ny = dy / d, overlap = (min - d) * .5; a.x += nx * overlap / .82; a.y += ny * overlap; b.x -= nx * overlap / .82; b.y -= ny * overlap;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (rel < 0) { const impulse = -rel * .45; a.vx += impulse * nx; a.vy += impulse * ny; b.vx -= impulse * nx; b.vy -= impulse * ny; } }
      }
      a.spin += dt * 2;
    }
  }
  function draw(canvas) {
    const surface = prepareCanvas(canvas); if (!surface) return false;
    const { ctx, width, height } = surface, bounds = jar(ctx, width, height); syncBodies();
    const jarWidth = bounds.right - bounds.left, jarHeight = bounds.bottom - bounds.top, radius = Math.min(17, Math.max(7, jarWidth * radiusN));
    if (!bodies.length) {
      const glow = ctx.createRadialGradient(bounds.left + jarWidth * .5, bounds.top + jarHeight * .77, 1, bounds.left + jarWidth * .5, bounds.top + jarHeight * .77, jarWidth * .31);
      glow.addColorStop(0, 'rgba(117,223,176,.16)'); glow.addColorStop(1, 'rgba(117,223,176,0)');
      ctx.fillStyle = glow; ctx.fillRect(bounds.left + jarWidth * .17, bounds.top + jarHeight * .45, jarWidth * .66, jarHeight * .48);
      ctx.save(); ctx.font = `${Math.max(22, Math.min(42, jarWidth * .32))}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🌱', bounds.left + jarWidth * .5, bounds.top + jarHeight * .79); ctx.restore();
    }
    for (const body of bodies) {
      const x = bounds.left + body.x * jarWidth, y = bounds.top + body.y * jarHeight;
      ctx.save(); ctx.translate(x, y + Math.sin(body.spin) * radius * .035); ctx.rotate(Math.max(-.5, Math.min(.5, body.vx * .8)));
      ctx.font = `${radius * 1.9}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(body.fruit, 0, 0); ctx.restore();
    }
    return bodies.some(b => Math.abs(b.vx) > .008 || Math.abs(b.vy) > .008);
  }
  function frame(time = 0) {
    raf = 0; const dt = previousFrame ? (time - previousFrame) / 1000 : 0; previousFrame = time; syncBodies(); physics(dt);
    const mainMoving = draw(mainCanvas), dockMoving = draw(dockCanvas), moving = mainMoving || dockMoving;
    if (dialog.open || state.running || moving) raf = requestAnimationFrame(frame); else previousFrame = 0;
  }
  function render() { if (!raf) raf = requestAnimationFrame(frame); }
  function addFruit() {
    const fruit = fruitTypes[Math.floor(Math.random() * fruitTypes.length)]; state.fruit.push(fruit); state.fruit = state.fruit.slice(-60); syncBodies();
    const body = bodies[bodies.length - 1]; if (body) { body.x = .5 + (Math.random() - .5) * .12; body.y = .84; body.vx = (Math.random() - .5) * 1.1; body.vy = -1.7 - Math.random() * .6; }
    save(); updateUI(); render();
  }
  function tick() {
    const now = Date.now(), elapsed = Math.max(0, Math.min(2, (now - previousTick) / 1000)); previousTick = now; if (!state.running) return;
    state.remaining = Math.max(0, state.remaining - elapsed);
    if (state.phase === 'focus') { const old = Math.floor(state.focusedSeconds / 300); state.focusedSeconds += elapsed; state.totalSeconds += elapsed; for (let i = old; i < Math.floor(state.focusedSeconds / 300); i++) addFruit(); }
    if (!state.remaining) { state.running = false; resumeWhenVisible = false; if (state.phase === 'break') { state.phase = 'focus'; state.remaining = state.minutes * 60; } }
    save(); updateUI(); render();
  }
  function orientation(event) { if (!tiltEnabled) return; if (Number.isFinite(event.gamma)) gravityX = Math.max(-2.4, Math.min(2.4, event.gamma / 28)); if (Number.isFinite(event.beta)) gravityY = Math.max(.6, Math.min(4.6, .76 + (event.beta - 45) / 90)); render(); }
  function setTilt(enabled) { tiltEnabled = enabled; $('focusTiltButton')?.setAttribute('aria-pressed', String(enabled)); if ($('focusTiltButton')) $('focusTiltButton').textContent = enabled ? 'Tilt enabled ✓' : 'Enable tilt'; if (!enabled) { window.removeEventListener('deviceorientation', orientation); gravityX = 0; gravityY = .76; } }
  async function toggleTilt() {
    if (tiltEnabled) { setTilt(false); return; }
    try { const sensor = window.DeviceOrientationEvent; if (!sensor) throw new Error('unavailable'); if (typeof sensor.requestPermission === 'function' && await sensor.requestPermission() !== 'granted') throw new Error('denied');
      window.addEventListener('deviceorientation', orientation, { passive: true }); setTilt(true); if ($('focusStatus')) $('focusStatus').textContent = 'Tilt your device, or tap a fruit to bounce it.';
    } catch { setTilt(false); if ($('focusStatus')) $('focusStatus').textContent = 'Tilt isn’t available here. Tap the fruit to bounce it instead.'; render(); }
  }
  function bounce(event) {
    const canvas = event.currentTarget, rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    const bounds = { left: rect.width * .19, right: rect.width * .81, top: rect.height * .22, bottom: rect.height * .885 };
    const nx = Math.max(0, Math.min(1, (x - bounds.left) / (bounds.right - bounds.left))), ny = Math.max(0, Math.min(1, (y - bounds.top) / (bounds.bottom - bounds.top)));
    let closest = null, score = Infinity;
    for (const body of bodies) { const d = Math.hypot((body.x - nx) * .82, body.y - ny); if (d < score) { closest = body; score = d; } }
    if (closest && score < radiusN * 3.4) { const dx = closest.x - nx, dy = closest.y - ny, d = Math.hypot(dx, dy) || 1; closest.vx += dx / d * .85 + (Math.random() - .5) * .35; closest.vy = -Math.max(1.3, Math.abs(closest.vy) * .35) - .7; }
    else bodies.forEach((body, i) => { body.vy -= 1.8 + i * .04; body.vx += (i % 2 ? 1 : -1) * .22; });
    render();
  }
  $('focusButton')?.addEventListener('click', () => { if (!dialog.open) dialog.showModal(); render(); });
  $('focusDockOpen')?.addEventListener('click', () => { if (!dialog.open) dialog.showModal(); render(); });
  $('focusClose')?.addEventListener('click', () => dialog.close()); dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  $('focusToggle')?.addEventListener('click', () => { if (state.remaining <= 0) { state.phase = 'focus'; state.remaining = state.minutes * 60; } state.running = !state.running; resumeWhenVisible = state.running; previousTick = Date.now(); save(); updateUI(); render(); });
  $('focusBreakButton')?.addEventListener('click', () => { state.phase = 'break'; state.remaining = 300; state.running = true; resumeWhenVisible = true; previousTick = Date.now(); save(); updateUI(); render(); });
  $('focusResetButton')?.addEventListener('click', () => { state.running = false; resumeWhenVisible = false; state.phase = 'focus'; state.focusedSeconds = 0; state.remaining = state.minutes * 60; save(); updateUI(); render(); });
  $('focusLengthSelect')?.addEventListener('change', e => { const minutes = Number(e.target.value); state.minutes = [15, 25, 45].includes(minutes) ? minutes : 25; if (state.phase === 'focus' && !state.running) state.remaining = state.minutes * 60; save(); updateUI(); render(); });
  $('focusTiltButton')?.addEventListener('click', toggleTilt);
  [mainCanvas, dockCanvas].forEach(canvas => canvas.addEventListener('pointerdown', bounce, { passive: true }));
  window.addEventListener('resize', render, { passive: true });
  function pauseForAway() { if (state.running) { state.running = false; resumeWhenVisible = true; save(); updateUI(); } }
  function resumeOnReturn() { if (document.hidden) return; previousTick = Date.now(); if (resumeWhenVisible && state.remaining > 0) { state.running = true; resumeWhenVisible = false; save(); updateUI(); render(); } }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForAway(); else resumeOnReturn(); });
  window.addEventListener('blur', pauseForAway);
  window.addEventListener('focus', resumeOnReturn);
  window.addEventListener('pagehide', () => { if (state.running) { state.running = false; resumeWhenVisible = true; save(); } });
  window.addEventListener('pageshow', resumeOnReturn);
  window.setInterval(tick, 250); updateUI(); render();
})();
