(() => {
  const names = ['dark','light','pink','green','blue','purple'];
  const read = (k,d) => {try{return JSON.parse(localStorage.getItem(k)) ?? d;}catch{return d;}};
  function apply(name) {
    if(!names.includes(name)) name='dark';
    document.documentElement.dataset.theme=name;
    try{localStorage.setItem('pp_theme',JSON.stringify(name));}catch{}
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--page').trim());
    document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===name)));
    window.packetAccountProgressChanged?.('pp_theme');
    window.dispatchEvent(new Event('packet:theme'));
  }
  function setMotion(value) {
    document.documentElement.dataset.motion=value==='calm'?'calm':'full';
    try{localStorage.setItem('pp_motion',JSON.stringify(document.documentElement.dataset.motion));}catch{}
    window.packetAccountProgressChanged?.('pp_motion'); window.dispatchEvent(new Event('packet:motion'));
  }
  window.packetTheme={apply,setMotion};
  apply(read('pp_theme','dark'));setMotion(read('pp_motion',matchMedia('(prefers-reduced-motion: reduce)').matches?'calm':'full'));
  document.addEventListener('DOMContentLoaded',()=>{
    const dialog=document.createElement('dialog');dialog.className='appearance-dialog';dialog.setAttribute('aria-labelledby','appearanceTitle');
    dialog.innerHTML='<form method="dialog"><button class="dialog-close" aria-label="Close appearance">×</button></form><span class="section-kicker">MAKE IT YOURS</span><h2 id="appearanceTitle">Your study space.</h2><p>One familiar layout. Six different moods.</p><div class="theme-picker">'+names.map(n=>`<button type="button" data-theme-choice="${n}" aria-pressed="${document.documentElement.dataset.theme===n}"><i class="swatch swatch-${n}" aria-hidden="true"></i>${n[0].toUpperCase()+n.slice(1)}</button>`).join('')+'</div><label class="motion-setting"><input id="calmMotion" type="checkbox"> Calm mode <small>Pause decorative motion and particles.</small></label>';
    document.body.append(dialog);dialog.querySelector('#calmMotion').checked=document.documentElement.dataset.motion==='calm';
    document.getElementById('themeButton').onclick=()=>dialog.showModal();
    dialog.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(b)apply(b.dataset.themeChoice);});
    dialog.querySelector('#calmMotion').onchange=e=>setMotion(e.target.checked?'calm':'full');
  });
})();
