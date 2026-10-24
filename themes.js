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
    dialog.innerHTML='<form method="dialog"><button class="dialog-close" aria-label="Close settings">×</button></form><span class="section-kicker">MAKE IT YOURS</span><h2 id="appearanceTitle">Settings</h2><p>Study preferences and appearance.</p><fieldset class="study-settings"><legend>Studying</legend><label class="settings-switch"><input id="hideAnswersGlobal" type="checkbox"><span><strong>Hide answers by default</strong><small>Keep question-bank answers hidden across all decks and searches. Reveal them manually when ready.</small></span></label><label class="settings-switch"><input id="hideExplanationsGlobal" type="checkbox"><span><strong>Hide explanations by default</strong><small>Keep feedback compact; open an explanation whenever you need it.</small></span></label><label class="settings-switch"><input id="showKeyIdeaGlobal" type="checkbox"><span><strong>Show key idea</strong><small>Expand the key idea separately from the rest of the explanation.</small></span></label></fieldset><h3 class="settings-section-title">Theme</h3><div class="theme-picker">'+names.map(n=>`<button type="button" data-theme-choice="${n}" aria-pressed="${document.documentElement.dataset.theme===n}"><i class="swatch swatch-${n}" aria-hidden="true"></i>${n[0].toUpperCase()+n.slice(1)}</button>`).join('')+'</div><label class="motion-setting"><input id="calmMotion" type="checkbox"> Calm mode <small>Pause decorative motion and particles.</small></label>';
    document.body.append(dialog);
    const hideAnswers=dialog.querySelector('#hideAnswersGlobal'),hideExplanations=dialog.querySelector('#hideExplanationsGlobal'),showKeyIdea=dialog.querySelector('#showKeyIdeaGlobal');
    hideAnswers.checked=read('pp_hide_answers',false)===true; hideExplanations.checked=read('pp_explanations_visible',true)===false; showKeyIdea.checked=read('pp_key_idea_visible',true)!==false;
    const saveStudy=()=>{try{localStorage.setItem('pp_hide_answers',JSON.stringify(hideAnswers.checked));localStorage.setItem('pp_explanations_visible',JSON.stringify(!hideExplanations.checked));localStorage.setItem('pp_key_idea_visible',JSON.stringify(showKeyIdea.checked));}catch{} window.dispatchEvent(new CustomEvent('packet:study-settings',{detail:{hideAnswers:hideAnswers.checked,explanationsVisible:!hideExplanations.checked,keyIdeaVisible:showKeyIdea.checked}}));};
    hideAnswers.addEventListener('change',saveStudy);hideExplanations.addEventListener('change',saveStudy);showKeyIdea.addEventListener('change',saveStudy);
    window.addEventListener('packet:key-idea',event=>{showKeyIdea.checked=event.detail.visible;});
    window.addEventListener('packet:explanations',event=>{hideExplanations.checked=!event.detail.visible;});
    dialog.querySelector('#calmMotion').checked=document.documentElement.dataset.motion==='calm';
    const motionButton=document.createElement('button');motionButton.type='button';motionButton.className='menu-motion-button';
    const syncMenuMotion=()=>{const playing=document.documentElement.dataset.motion!=='calm';motionButton.textContent=playing?'✦ Menu animation on':'▷ Turn on menu animation';motionButton.setAttribute('aria-pressed',String(playing));};
    motionButton.addEventListener('click',()=>setMotion(document.documentElement.dataset.motion==='calm'?'full':'calm'));
    document.querySelector('.hero-copy')?.append(motionButton);
    window.addEventListener('packet:motion',()=>{syncMenuMotion();dialog.querySelector('#calmMotion').checked=document.documentElement.dataset.motion==='calm';});
    // The user requested restoring decorative motion; keep the OS accessibility preference.
    if(!read('pp_menu_restored_v44',false)&&!matchMedia('(prefers-reduced-motion: reduce)').matches){setMotion('full');try{localStorage.setItem('pp_menu_restored_v44','true');}catch{}}
    syncMenuMotion();
    const settingsButton=document.getElementById('themeButton');settingsButton.textContent='⚙';settingsButton.setAttribute('aria-label','Open settings');settingsButton.title='Settings';settingsButton.onclick=()=>dialog.showModal();
    dialog.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(b)apply(b.dataset.themeChoice);});
    dialog.querySelector('#calmMotion').onchange=e=>setMotion(e.target.checked?'calm':'full');
  });
})();
