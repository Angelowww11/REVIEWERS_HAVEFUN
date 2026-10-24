(() => {
  const $ = id => document.getElementById(id);
  const labels = {pools:'Original pools',ccst:'CCST certification',summative3:'Summative 3'};
  const stop = new Set('a an the of to is are was were in on at for with and or which what following group answer choices choose question refer exhibit'.split(' '));
  const normalize = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const escape = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let bank = [], matches = [], limit = 20, timer, saveTimer;
  let draftKey = null, pendingSave = null, edited = false;
  let prefs = {query:'',deck:'all',answers:true,explanations:false};
  const revealed = new Map();
  const extension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  if (extension && parent === window) $('query').focus({preventScroll:true});
  const asset = file => extension ? chrome.runtime.getURL(file) : file;
  function flushSave() {
    clearTimeout(saveTimer);
    if(!pendingSave)return;
    const snapshot=pendingSave;pendingSave=null;
    if(extension) {
      try {
        chrome.storage.local.set({pocketPreferences:snapshot}).catch(()=>{});
        if(draftKey&&chrome.storage.session)chrome.storage.session.set({[draftKey]:snapshot}).catch(()=>{});
      }catch{}
    } else {try{localStorage.setItem('pp_pocket_preview',JSON.stringify(snapshot));}catch{}}
  }
  function persist() {
    prefs = {query:$('query').value,deck:$('deck').value,answers:$('answers').checked,explanations:$('explanations').checked};
    pendingSave={...prefs};
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave,200);
  }
  function saveBeforeLeaving(){if(edited)persist();flushSave();}
  window.addEventListener('pagehide',saveBeforeLeaving);
  window.addEventListener('blur',saveBeforeLeaving);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveBeforeLeaving();});
  const highlight = escape;
  function search(save = true) {
    clearTimeout(timer); if(save!==false)persist(); limit = 20; revealed.clear();
    const raw = $('query').value.trim(), query = normalize(raw);
    if (!query) {
      matches = []; $('status').textContent = `${bank.length} questions · ready`;
      $('results').innerHTML = '<div class="empty"><strong>Your answer goes here.</strong>Paste a question above. Matching questions and their correct answers appear here.</div>';
      $('more').hidden = true; return;
    }
    const tokens = [...new Set(query.split(' ').filter(t=>!stop.has(t)))];
    const meaningful = tokens.length ? tokens : query.split(' ');
    matches = bank.filter(q=>$('deck').value === 'all' || q.deck === $('deck').value).map(q => {
      const stemHits = meaningful.filter(t=>q._stemTokens.has(t)).length;
      const allHits = meaningful.filter(t=>q._tokens.has(t)).length;
      const stemRatio = stemHits / meaningful.length;
      let score = stemRatio * 70 + allHits / meaningful.length * 25;
      if (q._stem === query) score += 150;
      else if (query.length > 5 && q._stem.includes(query)) score += 95;
      else if (q._stem.length > 20 && query.includes(q._stem)) score += 105;
      if (meaningful.length === 1 && stemHits) score += 20;
      const qualifies = meaningful.length <= 2 ? allHits === meaningful.length : allHits / meaningful.length >= .35 && stemHits >= Math.min(2,meaningful.length);
      return {q,score,qualifies};
    }).filter(r=>r.qualifies).sort((a,b)=>b.score-a.score || a.q.id-b.q.id).map(r=>r.q);
    $('status').textContent = matches.length ? `${matches.length} matching question${matches.length===1?'':'s'} · closest wording first` : 'No matching question in the selected bank.';
    $('resultScroll').scrollTop = 0;
    render();
  }
  function render() {
    $('results').innerHTML = matches.length ? matches.slice(0,limit).map(card).join('') : '<div class="empty"><strong>Try a shorter phrase.</strong>Use distinctive words from the question, check the selected bank, or remove the pasted answer choices. This searches saved questions; it does not invent answers.</div>';
    $('more').hidden = matches.length <= limit;
  }
  function card(q) {
    const key = `${q.deck}:${q.id}`, show = revealed.has(key) ? revealed.get(key) : $('answers').checked;
    const group = q.type === 'true_false_group', matching = q.pairs.length > 0;
    const type = group ? 'True / false statements' : matching ? 'Matching' : q.answers.length > 1 ? 'Multiple answers' : 'Multiple choice';
    const images = q.images.map(path=>`<img class="exhibit" src="${escape(asset(path))}" alt="Question ${q.id} exhibit" loading="lazy">`).join('');
    let choices = '';
    if (group) choices = q.statements.map((statement,i)=>`<div class="group-row">${highlight(statement)}${show ? `<span class="verdict">✓ ${escape(q.answers[i])}</span>` : ''}</div>`).join('');
    else if (matching) choices = `<div class="choices">${q.pairs.map(pair=>`<div class="group-row"><b>${highlight(pair.item)}</b>${show ? `<span class="verdict">→ ${escape(pair.target)}</span>` : ''}</div>`).join('')}</div>`;
    else choices = `<ol class="choices">${q.options.map((choice,i)=>{
      const correct = show && q.answers.includes(choice);
      return `<li class="choice ${correct?'correct':''}"><b>${String.fromCharCode(65+i)}</b><span>${highlight(choice)}${correct?'<small class="correct-tag">✓ CORRECT ANSWER</small>':''}</span></li>`;
    }).join('')}</ol>`;
    const answer = show && !group && !matching ? `<div class="answer-summary"><strong>✓ CORRECT ANSWER${q.answers.length>1?'S':''}</strong>${q.answers.map(a=>`<p>${escape(a)}</p>`).join('')}</div>` : '';
    const explanation = show && q.explanation ? `<details class="explanation" ${$('explanations').checked?'open':''}><summary>Explanation & memory cues</summary>${q.explanation.split(/\n\s*\n/).map(p=>`<p>${escape(p)}</p>`).join('')}${q.statementNotes.map((note,i)=>`<p><b>Statement ${i+1}:</b> ${escape(note)}</p>`).join('')}</details>` : '';
    const choiceDetails = !group && !matching && q.options.length ? `<details class="choice-details"><summary>See choices (${q.options.length})</summary>${choices}</details>` : choices;
    return `<article class="result"><div class="meta"><span>${escape(labels[q.deck])} · #${q.id}</span><span>${type}</span></div><div class="prompt">${highlight(q.question)}</div>${images}${answer}${choiceDetails}<button type="button" class="reveal" data-reveal="${key}">${show?'Hide answer':'Show answer'}</button>${explanation}</article>`;
  }
  $('searchForm').addEventListener('submit',event=>{event.preventDefault();search();});
  $('query').addEventListener('input',()=>{edited=true;persist();clearTimeout(timer);timer=setTimeout(search,180);});
  $('query').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();search();}});
  $('clear').onclick = ()=>{edited=true;$('query').value='';search();$('query').focus();};
  $('deck').onchange = ()=>{edited=true;search();};
  for (const id of ['answers','explanations']) $(id).onchange = ()=>{edited=true;persist();revealed.clear();if($('query').value.trim())render();else search();};
  $('more').onclick = ()=>{limit+=20;render();};
  $('results').addEventListener('click',event=>{
    const button=event.target.closest('[data-reveal]');if(!button)return;
    const key=button.dataset.reveal;revealed.set(key,!(revealed.has(key)?revealed.get(key):$('answers').checked));
    const position=$('resultScroll').scrollTop;render();$('resultScroll').scrollTop=position;
  });
  document.addEventListener('keydown',event=>{
    if(!event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && (event.key==='`' || event.code==='Backquote') && extension) {
      event.preventDefault();event.stopImmediatePropagation();
      if(event.repeat)return;
      saveBeforeLeaving();
      if(parent!==window)parent.postMessage({type:'pp-pocket-toggle'},'*');
      else if(new URLSearchParams(location.search).has('standalone'))window.close();
    }
    if(event.key==='Escape'&&extension&&parent!==window) {saveBeforeLeaving();parent.postMessage({type:'pp-pocket-minimize'},'*');}
  },true);
  window.addEventListener('message',event=>{
    if(event.source!==parent)return;
    if(event.data?.type==='pp-pocket-focus') $('query').focus({preventScroll:true});
    if(event.data?.type==='pp-pocket-hidden')saveBeforeLeaving();
    if(event.data?.type==='pp-pocket-ping' && extension && parent!==window)parent.postMessage({type:'pp-pocket-pong',nonce:event.data.nonce},'*');
  });
  (async()=>{
    try {
      if(extension) {
        prefs={...prefs,...(await chrome.storage.local.get('pocketPreferences')).pocketPreferences};
        try {
          const context=await chrome.runtime.sendMessage({type:'pp-pocket-context'});
          if(Number.isInteger(context?.tabId)&&chrome.storage.session){
            draftKey=`pocketTab:${context.tabId}`;
            prefs={...prefs,...(await chrome.storage.session.get(draftKey))[draftKey]};
          }
        }catch{}
      }
      else {try{prefs={...prefs,...JSON.parse(localStorage.getItem('pp_pocket_preview')||'{}')};}catch{}}
      if(!edited) {
        $('query').value=typeof prefs.query==='string'?prefs.query:'';
        $('deck').value=['all','pools','ccst','summative3'].includes(prefs.deck)?prefs.deck:'all';
        $('answers').checked=prefs.answers!==false;$('explanations').checked=prefs.explanations===true;
      }
      const response=await fetch(asset('bank-data.json'));if(!response.ok)throw Error('bank');
      const bundled=await response.json();
      bank=bundled.questions.map(q=>({...q,_stem:normalize(q.question),_stemTokens:new Set(normalize(q.question+' '+q.statements.join(' ')+' '+q.pairs.map(p=>p.target).join(' ')).split(' ')),_tokens:new Set(normalize([q.question,...q.options,...q.statements,...q.answers,...q.pairs.map(p=>p.target)].join(' ')).split(' '))}));
      $('bankCount').textContent=`${bank.length} questions · ${extension?'offline v'+chrome.runtime.getManifest().version:'web search'}`;
      search(edited);
    }catch{
      $('status').textContent=extension?'Could not load the bundled bank. Reload the extension from your browser’s Extensions page.':'Could not load the question bank. Check your connection and refresh this page.';
    }
  })();
})();
