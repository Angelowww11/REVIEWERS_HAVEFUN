(() => {
  if (globalThis.__packetPartyPocket) return;
  let controller;
  globalThis.__packetPartyPocket = () => {
    if (!controller) controller = mount();
    controller.toggle();
  };
  // Single-key shortcuts need a page listener: Chromium commands require modifiers.
  document.addEventListener('keydown', event => {
    if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.key !== '`' && !(event.code === 'Backquote' && event.key === 'Dead')) return;
    const editing = event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || node.matches('textarea,select,input,[role="textbox"],[role="combobox"]')));
    if (editing) return;
    event.preventDefault(); event.stopImmediatePropagation();
    globalThis.__packetPartyPocket();
  }, true);

  function mount() {
  const host = document.createElement('div');
  host.setAttribute('data-packet-party-pocket', '');
  host.style.cssText = 'all:initial!important;position:fixed!important;right:20px!important;bottom:20px!important;z-index:2147483647!important;display:none!important;color-scheme:dark!important;';
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `<style>
    :host{font:14px/1.4 system-ui,sans-serif}*{box-sizing:border-box}
    button{font:inherit;cursor:pointer;border:0}button:focus-visible{outline:3px solid #a7f2ed;outline-offset:3px}
    .shell{font:14px/1.4 system-ui,sans-serif;width:min(360px,calc(100vw - 32px));height:min(440px,calc(100dvh - 48px));display:flex;flex-direction:column;background:#222c45;border-radius:18px;box-shadow:0 18px 70px #0006;overflow:hidden;border:1px solid #ffffff25}
    .handle{display:flex;align-items:center;gap:8px;min-height:40px;padding:3px 7px 3px 12px;color:#f4f4ff;touch-action:none;cursor:grab;user-select:none}
    .handle:active{cursor:grabbing}.handle strong{flex:1;font-size:13px;letter-spacing:.2px}.handle span{color:#a7f2ed}
    .handle button{width:34px;height:34px;background:transparent;border-radius:11px;color:inherit;font-size:20px}.handle button:hover{background:#ffffff16}
    iframe{flex:1;width:100%;min-height:0;border:0;background:#1d263b;color-scheme:dark}
    .launcher{width:52px;height:52px;display:grid;place-items:center;border-radius:17px;background:#ffb45c;color:#202b44;box-shadow:0 8px 28px #0005;transition:transform .2s}
    .launcher:hover{transform:translateY(-3px)}.launcher svg{width:32px;height:32px}.launcher:before{content:'';position:absolute;inset:-5px;border:1px solid #ffb45c55;border-radius:22px;pointer-events:none}
    [hidden]{display:none!important}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
  </style><section class="shell" aria-label="Packet Party floating question box"><div class="handle"><span aria-hidden="true">✦</span><strong>Packet Party <small style="font-size:10px;opacity:.65">· &#96; to toggle</small></strong><button class="minimize" aria-label="Minimize to floating square" title="Minimize">−</button><button class="close" aria-label="Hide question box" title="Hide · backtick to reopen">×</button></div><iframe title="Packet Party question input and answers"></iframe></section><button class="launcher" aria-label="Open Packet Party search" title="Packet Party search · backtick to toggle" hidden><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="m11 21 17-11M12 24l15 7" stroke="currentColor" stroke-width="3"/><circle cx="9" cy="23" r="6" fill="currentColor"/><circle cx="30" cy="9" r="6" fill="currentColor"/><circle cx="30" cy="32" r="6" fill="currentColor"/></svg></button>`;
  const shell = root.querySelector('.shell'), launcher = root.querySelector('.launcher');
  const iframe = root.querySelector('iframe'), handle = root.querySelector('.handle');
  iframe.src = chrome.runtime.getURL('panel.html');
  (document.body || document.documentElement).append(host);
  let expanded = true, visible = false, drag = null;
  iframe.addEventListener('load', () => {
    if (visible && expanded) iframe.contentWindow.postMessage({type:'pp-pocket-focus'}, new URL(iframe.src).origin);
  });
  function place(left, top) {
    const rect = host.getBoundingClientRect();
    host.style.setProperty('right', 'auto', 'important');
    host.style.setProperty('bottom', 'auto', 'important');
    host.style.setProperty('left', `${Math.max(8, Math.min(left, innerWidth - rect.width - 8))}px`, 'important');
    host.style.setProperty('top', `${Math.max(8, Math.min(top, innerHeight - rect.height - 8))}px`, 'important');
  }
  function show(open) {
    host.style.setProperty('display', 'block', 'important'); visible = true;
    const rect = host.getBoundingClientRect(); expanded = open;
    shell.hidden = !open; launcher.hidden = open;
    // Keep the square near the panel's lower-right corner when minimizing.
    place(open ? rect.right - host.offsetWidth : rect.right - 52, open ? rect.bottom - host.offsetHeight : rect.bottom - 52);
    if (open) iframe.contentWindow.postMessage({type: 'pp-pocket-focus'}, new URL(iframe.src).origin);
  }
  root.querySelector('.minimize').onclick = () => show(false);
  launcher.onclick = () => { if (!launcher.dataset.dragged) show(true); delete launcher.dataset.dragged; };
  function hide() {
    visible = false;
    iframe.blur();
    host.style.setProperty('display', 'none', 'important');
  }
  root.querySelector('.close').onclick = hide;
  function resize() { if (!visible) return; const r = host.getBoundingClientRect(); place(r.left, r.top); }
  window.addEventListener('resize', resize);
  function message(event) {
    if (event.source !== iframe.contentWindow || event.origin !== new URL(iframe.src).origin) return;
    if (event.data?.type === 'pp-pocket-minimize') show(false);
    if (event.data?.type === 'pp-pocket-toggle') toggle();
  }
  window.addEventListener('message', message);
  function start(event) {
    if (event.button !== 0 || event.target.closest('button') && event.currentTarget !== launcher) return;
    const r = host.getBoundingClientRect();
    drag = {x:event.clientX,y:event.clientY,left:r.left,top:r.top,moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) < 5 && !drag.moved) return;
    drag.moved = true; iframe.style.pointerEvents = 'none';
    place(drag.left + dx, drag.top + dy);
  }
  function end() {
    if (drag?.moved && !expanded) launcher.dataset.dragged = '1';
    iframe.style.pointerEvents = ''; drag = null;
  }
  for (const target of [handle, launcher]) {
    target.style.touchAction = 'none';
    target.addEventListener('pointerdown', start); target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
  }
  function toggle() { if (visible && expanded) hide(); else show(true); }
  return {toggle};
  }
})();
