(() => {
  const runtime = chrome.runtime;
  let version;
  try { version = runtime.getManifest().version; } catch { return; }
  const previous = globalThis.__ppPocketBridge;
  if (previous?.version === version) { previous.recover(); return; }
  previous?.destroy();
  const topFrame = window === window.top;
  let controller = null;
  const cleanups = [];
  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    cleanups.push(() => target.removeEventListener(name, callback, options));
  };
  function alive() { try { return Boolean(runtime.id); } catch { return false; } }
  function toggle() {
    if (!alive()) return false;
    if (!topFrame) {
      runtime.sendMessage({type:'pp-pocket-toggle-top'}).catch(() => {});
      return true;
    }
    if (!controller) controller = mount();
    const detached = !controller.connected();
    controller.recover();
    if (detached) controller.show(); else controller.toggle();
    return true;
  }
  function recover() { controller?.recover(); }
  function keydown(event) {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.key !== '`' && event.code !== 'Backquote') return;
    if (!alive()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!event.repeat) toggle();
  }
  // Window capture also reaches focused inputs, before page keyboard handlers.
  listen(window, 'keydown', keydown, true);
  listen(window, 'pageshow', recover);
  listen(window, 'focus', recover);
  listen(document, 'resume', recover);
  listen(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') recover();
    else controller?.suspend();
  });
  const onMessage = (message, sender, respond) => {
    if (!alive() || sender.id !== runtime.id || !topFrame) return;
    if (message?.type === 'pp-pocket-health') { recover(); respond({ok:true,version}); }
    if (message?.type === 'pp-pocket-show-hide') respond({ok:toggle(),version});
  };
  runtime.onMessage.addListener(onMessage);
  cleanups.push(() => { try { runtime.onMessage.removeListener(onMessage); } catch {} });
  const bridge = {version,toggle,recover,destroy() {
    cleanups.splice(0).forEach(cleanup => cleanup()); controller?.destroy();
    if (globalThis.__ppPocketBridge === bridge) {
      delete globalThis.__ppPocketBridge; delete globalThis.__packetPartyPocket;
    }
  }};
  globalThis.__ppPocketBridge = bridge;
  globalThis.__packetPartyPocket = toggle;

  function mount() {
    const host = document.createElement('div');
    host.setAttribute('data-packet-party-pocket','');
    host.style.cssText = 'all:initial!important;position:fixed!important;right:20px!important;bottom:20px!important;z-index:2147483647!important;display:none!important;color-scheme:light!important;';
    const root = host.attachShadow({mode:'open'});
    root.innerHTML = `<style>
      :host{font:14px/1.4 Arial,Helvetica,sans-serif}*{box-sizing:border-box}
      button{font:inherit;cursor:pointer;color:#222;background:#fff;border:1px solid #aaa;border-radius:3px}button:focus-visible{outline:2px solid #333;outline-offset:2px}
      .shell{font:14px/1.4 Arial,Helvetica,sans-serif;width:min(360px,calc(100vw - 32px));height:min(440px,calc(100dvh - 48px));display:flex;flex-direction:column;background:#fff;border-radius:4px;overflow:hidden;border:1px solid #aaa}
      .handle{display:flex;align-items:center;gap:8px;min-height:40px;padding:3px 7px 3px 12px;color:#222;background:#f7f7f7;border-bottom:1px solid #ddd;touch-action:none;cursor:grab;user-select:none}
      .handle:active{cursor:grabbing}.handle strong{flex:1;font-size:13px;font-weight:600}.handle button{width:30px;height:30px;padding:0;font-size:20px}.handle button:hover{background:#eee}
      iframe{flex:1;width:100%;min-height:0;border:0;background:#fff;color-scheme:light}
      .launcher{width:46px;height:46px;display:grid;place-items:center;background:#fff;color:#222;touch-action:none}.launcher:hover{background:#eee}.launcher svg{width:24px;height:24px}
      [hidden]{display:none!important}
    </style><section class="shell" aria-label="Packet Party floating question box"><div class="handle"><strong>Pocket Search <small style="font-size:10px;opacity:.65">· &#96; show/hide</small></strong><button class="minimize" aria-label="Minimize to floating square" title="Minimize">−</button><button class="close" aria-label="Hide question box" title="Hide · backtick to show again">×</button></div><iframe title="Packet Party question input and answers"></iframe></section><button class="launcher" aria-label="Show Packet Party search" title="Show question box" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></button>`;
    const shell = root.querySelector('.shell'), launcher = root.querySelector('.launcher');
    const iframe = root.querySelector('iframe'), handle = root.querySelector('.handle');
    const frameURL = runtime.getURL('panel.html'), frameOrigin = new URL(frameURL).origin;
    let expanded = true, visible = false, drag = null, healthTimer = null;
    let nonce = 0, lastReload = 0, focusOnLoad = false, lastProbe = 0;
    const mountCleanups = [];
    const on = (target,name,callback,options) => {
      target.addEventListener(name,callback,options);
      mountCleanups.push(() => target.removeEventListener(name,callback,options));
    };
    const attach = () => { if (!host.isConnected) document.documentElement.append(host); };
    const send = message => { try { iframe.contentWindow?.postMessage(message,frameOrigin); } catch {} };
    function place(left,top) {
      const r = host.getBoundingClientRect();
      host.style.setProperty('right','auto','important'); host.style.setProperty('bottom','auto','important');
      host.style.setProperty('left',`${Math.max(8,Math.min(left,innerWidth-r.width-8))}px`,'important');
      host.style.setProperty('top',`${Math.max(8,Math.min(top,innerHeight-r.height-8))}px`,'important');
    }
    function clamp() { if (visible) { const r=host.getBoundingClientRect();place(r.left,r.top); } }
    function stopDrag() {
      drag=null;iframe.style.pointerEvents='';
      for (const element of [handle,launcher]) {
        try { if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId); } catch {}
      }
    }
    let pointerId = -1;
    function suspend() { clearTimeout(healthTimer);healthTimer=null;stopDrag(); }
    function probe() {
      if (!visible || !expanded || document.hidden || !alive()) return;
      if (healthTimer || Date.now()-lastProbe<500) return;
      lastProbe=Date.now();const token=++nonce;
      send({type:'pp-pocket-ping',nonce:token});
      healthTimer=setTimeout(() => {
        healthTimer=null;
        if (!visible || document.hidden || !alive() || Date.now()-lastReload<10000) return;
        lastReload=Date.now();
        // Edge may restore an unloaded child frame after suspending a tab.
        // Reload only the extension frame, never the user's webpage.
        iframe.src=frameURL;
      },1800);
    }
    function focusInput() { send({type:'pp-pocket-focus'}); }
    function show(open=true) {
      attach();host.style.setProperty('display','block','important');visible=true;
      const r=host.getBoundingClientRect();expanded=open;
      shell.hidden=!open;launcher.hidden=open;
      place(r.right-host.offsetWidth,r.bottom-host.offsetHeight);
      stopDrag();
      if(open){focusOnLoad=true;focusInput();probe();}else {send({type:'pp-pocket-hidden'});suspend();}
    }
    function hide() {
      visible=false;focusOnLoad=false;send({type:'pp-pocket-hidden'});suspend();iframe.blur();
      host.style.setProperty('display','none','important');
    }
    function recoverPanel() {
      const reattached=!host.isConnected;attach();
      if(reattached)stopDrag();else if(!drag)iframe.style.pointerEvents='';
      clamp();
      if(iframe.parentNode!==shell)shell.append(iframe);
      if (reattached) lastProbe=0;
      if (!document.hidden) probe();
    }
    function message(event) {
      if(event.source!==iframe.contentWindow || event.origin!==frameOrigin)return;
      if(event.data?.type==='pp-pocket-toggle') { if(visible&&expanded)hide();else show(); }
      if(event.data?.type==='pp-pocket-minimize')show(false);
      if(event.data?.type==='pp-pocket-pong' && event.data.nonce===nonce) {
        clearTimeout(healthTimer);healthTimer=null;
      }
    }
    function start(event) {
      if(event.button!==0 || event.target.closest('button') && event.currentTarget!==launcher)return;
      const r=host.getBoundingClientRect();
      drag={x:event.clientX,y:event.clientY,left:r.left,top:r.top,moved:false};
      pointerId=event.pointerId;event.currentTarget.setPointerCapture(pointerId);
    }
    function move(event) {
      if(!drag)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.abs(dx)+Math.abs(dy)<5 && !drag.moved)return;
      drag.moved=true;iframe.style.pointerEvents='none';place(drag.left+dx,drag.top+dy);
    }
    function end() {
      if(drag?.moved && !expanded) {
        launcher.dataset.dragged='1';
        setTimeout(()=>delete launcher.dataset.dragged,0);
      }
      stopDrag();
    }
    on(iframe,'load',() => {
      clearTimeout(healthTimer);healthTimer=null;lastProbe=0;
      if(visible&&expanded&&focusOnLoad&&!document.hidden){focusInput();focusOnLoad=false;}
      probe();
    });
    on(window,'message',message);on(window,'resize',clamp);on(window,'blur',suspend);
    root.querySelector('.minimize').onclick=()=>show(false);
    root.querySelector('.close').onclick=hide;
    launcher.onclick=()=>{if(!launcher.dataset.dragged)show();delete launcher.dataset.dragged;};
    for(const target of [handle,launcher]) {
      on(target,'pointerdown',start);on(target,'pointermove',move);
      on(target,'pointerup',end);on(target,'pointercancel',stopDrag);on(target,'lostpointercapture',stopDrag);
    }
    iframe.src=frameURL;attach();
    return {connected:()=>host.isConnected,show:()=>show(),toggle:()=>{if(visible&&expanded)hide();else show();},recover:recoverPanel,suspend,destroy(){suspend();mountCleanups.splice(0).forEach(cleanup=>cleanup());host.remove();}};
  }
})();
