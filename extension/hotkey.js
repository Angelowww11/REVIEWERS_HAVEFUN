(() => {
  if(globalThis.PocketShortcut)return;
  // Finish the keystroke before moving focus between the page and the iframe.
  // Otherwise Edge can deliver its text/keyup phase to a different input.
  globalThis.PocketShortcut = {install({toggle,enabled=()=>true}) {
    let pressed=false,guardUntil=0;
    const listeners=[];
    const listen=(name,handler)=>{window.addEventListener(name,handler,true);listeners.push(()=>window.removeEventListener(name,handler,true));};
    const key=event=>!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&(event.key==='`'||event.code==='Backquote');
    const consume=event=>{if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();};
    listen('keydown',event=>{
      if(!enabled()||event.isComposing||!key(event))return;
      consume(event);guardUntil=Date.now()+400;
      if(!event.repeat)pressed=true;
    });
    listen('keypress',event=>{if(enabled()&&key(event)&&(pressed||Date.now()<guardUntil))consume(event);});
    listen('keyup',event=>{
      if(!enabled()||!key(event))return;
      consume(event);const act=pressed;pressed=false;guardUntil=Date.now()+400;
      if(act)toggle();
    });
    const text=event=>{if(enabled()&&(pressed||Date.now()<guardUntil)&&['`','\u0300'].includes(event.data))consume(event);};
    listen('beforeinput',text);listen('textInput',text);
    listen('blur',()=>{pressed=false;guardUntil=Date.now()+400;});
    return ()=>listeners.splice(0).forEach(remove=>remove());
  }};
})();
