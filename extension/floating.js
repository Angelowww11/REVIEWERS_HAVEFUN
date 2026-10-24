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
  cleanups.push(PocketShortcut.install({toggle,enabled:alive}));
  let autoCopy=true;
  chrome.storage.local.get('pocketAutoCopy').then(saved=>{autoCopy=saved.pocketAutoCopy!==false;}).catch(()=>{});
  const storageChanged=(changes,area)=>{if(area==='local'&&changes.pocketAutoCopy)autoCopy=changes.pocketAutoCopy.newValue!==false;};
  chrome.storage.onChanged.addListener(storageChanged);
  cleanups.push(()=>{try{chrome.storage.onChanged.removeListener(storageChanged);}catch{}});
  listen(window,'copy',event=>{
    if(!autoCopy||!alive()||!event.isTrusted)return;
    if(event.composedPath().some(node=>node instanceof HTMLElement&&node.hasAttribute('data-packet-party-pocket')))return;
    const input=event.composedPath().find(node=>node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement);
    if(input?.type==='password')return;
    let selected='';
    try{selected=input&&Number.isInteger(input.selectionStart)?input.value.slice(input.selectionStart,input.selectionEnd):window.getSelection()?.toString()||'';}catch{}
    queueMicrotask(()=>{
      if(!autoCopy||!alive())return;
      let text=selected;
      try{text=event.clipboardData?.getData('text/plain')||text;}catch{}
      text=text.trim().slice(0,10000);
      if(text)runtime.sendMessage({type:'pp-pocket-copy',text}).catch(()=>{});
    });
  },true);
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
    if (message?.type === 'pp-pocket-import' && typeof message.text==='string') {
      if(!controller)controller=mount();
      respond({ok:controller.importText(message.text)===true});
    }
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
      .sizebar{display:flex;align-items:center;gap:6px;padding:3px 6px;background:#fafafa;border-top:1px solid #ddd;flex:none;font:10px/1.4 Arial,sans-serif}.sizebar label{display:flex;gap:3px;align-items:center}.sizebar input{width:48px;height:22px;padding:2px;border:1px solid #aaa;font:11px Arial,sans-serif;background:#fff;color:#222}.sizebar button{font-size:10px;padding:2px 5px;height:22px}.sizebar .resize-grip{margin-left:auto;width:24px;height:24px;cursor:nwse-resize;touch-action:none;font-size:18px;padding:0}.sizebar input:focus-visible{outline:2px solid #333;outline-offset:1px}
      [hidden]{display:none!important}
    </style><section class="shell" aria-label="Packet Party floating question box"><div class="handle"><strong>Pocket Search <small style="font-size:10px;opacity:.65">· &#96; show/hide</small></strong><button class="minimize" aria-label="Minimize to floating square" title="Minimize">−</button><button class="close" aria-label="Hide question box" title="Hide · backtick to show again">×</button></div><iframe title="Packet Party question input and answers"></iframe></section><button class="launcher" aria-label="Show Packet Party search" title="Show question box" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></button>`;
    const shell = root.querySelector('.shell'), launcher = root.querySelector('.launcher');
    shell.insertAdjacentHTML('beforeend','<div class="sizebar"><label title="Width in pixels">W <input class="panel-width" type="number" min="260" max="2000" step="20" aria-label="Box width in pixels"></label><label title="Height in pixels">H <input class="panel-height" type="number" min="280" max="2000" step="20" aria-label="Box height in pixels"></label><button class="reset-size" type="button">Reset</button><button class="resize-grip" type="button" aria-label="Resize question box" title="Drag to resize. Arrow keys adjust size; Home resets.">↘</button></div>');
    const iframe = root.querySelector('iframe'), handle = root.querySelector('.handle');
    const frameURL = runtime.getURL('panel.html'), frameOrigin = new URL(frameURL).origin;
    let expanded = true, visible = false, drag = null, healthTimer = null;
    let nonce = 0, lastReload = 0, focusOnLoad = false, lastProbe = 0;
    let preferredSize={width:360,height:440},sizeEdited=false,pendingText=null,importSequence=0;
    const widthInput=root.querySelector('.panel-width'),heightInput=root.querySelector('.panel-height'),grip=root.querySelector('.resize-grip');
    const focusSink=document.createElement('div');
    focusSink.tabIndex=-1;focusSink.setAttribute('role','group');focusSink.setAttribute('aria-label','Pocket Search hidden. Press backtick to show the question box.');
    focusSink.style.cssText='all:initial!important;position:fixed!important;left:0!important;top:0!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;outline:none!important;';
    const mountCleanups = [];
    const on = (target,name,callback,options) => {
      target.addEventListener(name,callback,options);
      mountCleanups.push(() => target.removeEventListener(name,callback,options));
    };
    const attach = () => { if (!host.isConnected) document.documentElement.append(host); };
    const send = message => { try { iframe.contentWindow?.postMessage(message,frameOrigin); } catch {} };
    function applySize(save=false) {
      const maxW=Math.max(120,innerWidth-16),maxH=Math.max(160,innerHeight-16);
      const width=Math.min(maxW,Math.max(Math.min(260,maxW),preferredSize.width));
      const height=Math.min(maxH,Math.max(Math.min(280,maxH),preferredSize.height));
      shell.style.width=`${width}px`;shell.style.height=`${height}px`;
      widthInput.value=Math.round(width);heightInput.value=Math.round(height);
      if(save){sizeEdited=true;chrome.storage.local.set({pocketPanelSize:preferredSize}).catch(()=>{});}
    }
    chrome.storage.local.get('pocketPanelSize').then(saved=>{
      const size=saved.pocketPanelSize;
      if(!sizeEdited&&Number.isFinite(size?.width)&&Number.isFinite(size?.height))preferredSize={width:Math.max(260,Math.min(2000,size.width)),height:Math.max(280,Math.min(2000,size.height))};
      applySize();clamp();
    }).catch(()=>{});
    function isShowing(){return visible&&expanded&&host.isConnected&&!document.hidden;}
    function deliverText(){if(pendingText)send({type:'pp-pocket-import',...pendingText,focus:isShowing()});}
    function place(left,top) {
      const r = host.getBoundingClientRect();
      host.style.setProperty('right','auto','important'); host.style.setProperty('bottom','auto','important');
      host.style.setProperty('left',`${Math.max(8,Math.min(left,innerWidth-r.width-8))}px`,'important');
      host.style.setProperty('top',`${Math.max(8,Math.min(top,innerHeight-r.height-8))}px`,'important');
    }
    function clamp() { applySize();if (visible) { const r=host.getBoundingClientRect();place(r.left,r.top); } }
    function stopDrag() {
      drag=null;iframe.style.pointerEvents='';
      for (const element of [handle,launcher,grip]) {
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
    function focusInput() {
      if(!visible||!expanded||document.hidden)return;
      iframe.focus({preventScroll:true});send({type:'pp-pocket-focus'});
    }
    function show(open=true) {
      attach();host.style.setProperty('display','block','important');visible=true;
      const r=host.getBoundingClientRect();expanded=open;
      shell.hidden=!open;launcher.hidden=open;applySize();
      place(r.right-host.offsetWidth,r.bottom-host.offsetHeight);
      stopDrag();
      if(open){focusOnLoad=true;focusInput();deliverText();probe();}else {send({type:'pp-pocket-hidden'});suspend();}
    }
    function hide() {
      visible=false;focusOnLoad=false;send({type:'pp-pocket-hidden'});suspend();iframe.blur();
      host.style.setProperty('display','none','important');
      if(!focusSink.isConnected)document.documentElement.append(focusSink);
      focusSink.focus({preventScroll:true});
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
      if(event.data?.type==='pp-pocket-imported'&&pendingText?.requestId===event.data.requestId)pendingText=null;
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
      drag.moved=true;iframe.style.pointerEvents='none';
      if(drag.kind==='resize'){
        preferredSize={width:Math.max(260,Math.min(2000,drag.width+dx)),height:Math.max(280,Math.min(2000,drag.height+dy))};
        sizeEdited=true;applySize();place(drag.left,drag.top);
      }else place(drag.left+dx,drag.top+dy);
    }
    function end() {
      if(drag?.kind==='resize'&&drag.moved)applySize(true);
      if(drag?.moved && !expanded) {
        launcher.dataset.dragged='1';
        setTimeout(()=>delete launcher.dataset.dragged,0);
      }
      stopDrag();
    }
    on(iframe,'load',() => {
      clearTimeout(healthTimer);healthTimer=null;lastProbe=0;
      if(visible&&expanded&&focusOnLoad&&!document.hidden){focusInput();focusOnLoad=false;}
      deliverText();
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
    on(grip,'pointerdown',event=>{
      if(event.button!==0)return;event.preventDefault();
      const r=host.getBoundingClientRect();drag={kind:'resize',x:event.clientX,y:event.clientY,left:r.left,top:r.top,width:r.width,height:r.height,moved:false};
      pointerId=event.pointerId;grip.setPointerCapture(pointerId);
    });
    on(grip,'pointermove',move);on(grip,'pointerup',end);on(grip,'pointercancel',stopDrag);on(grip,'lostpointercapture',stopDrag);
    on(grip,'keydown',event=>{
      const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];
      if(!delta&&event.key!=='Home')return;event.preventDefault();
      preferredSize=delta?{width:Math.max(260,Math.min(2000,preferredSize.width+delta[0])),height:Math.max(280,Math.min(2000,preferredSize.height+delta[1]))}:{width:360,height:440};
      applySize(true);clamp();
    });
    for(const input of [widthInput,heightInput])on(input,'change',()=>{
      const width=Number(widthInput.value),height=Number(heightInput.value);
      if(Number.isFinite(width)&&Number.isFinite(height))preferredSize={width:Math.max(260,Math.min(2000,width)),height:Math.max(280,Math.min(2000,height))};
      applySize(true);clamp();
    });
    root.querySelector('.reset-size').onclick=()=>{preferredSize={width:360,height:440};applySize(true);clamp();};
    iframe.src=frameURL;attach();applySize();
    return {connected:()=>host.isConnected,isShowing,show:()=>show(),toggle:()=>{if(visible&&expanded)hide();else show();},importText(text){pendingText={text:text.trim().slice(0,10000),requestId:++importSequence};deliverText();return true;},recover:recoverPanel,suspend,destroy(){suspend();mountCleanups.splice(0).forEach(cleanup=>cleanup());host.remove();focusSink.remove();}};
  }
})();
