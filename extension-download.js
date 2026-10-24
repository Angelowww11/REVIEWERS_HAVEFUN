(() => {
  const browsers = {
    chrome:{name:'Chrome',address:'chrome://extensions',help:'https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked'},
    edge:{name:'Edge',address:'edge://extensions',help:'https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading'},
    brave:{name:'Brave',address:'brave://extensions',help:'https://support.brave.com/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave'}
  };
  let current='chrome', manuallyPicked=false, statusTimer;
  const $=id=>document.getElementById(id);
  function announce(message){const status=$('pageStatus');if(!status)return;clearTimeout(statusTimer);status.textContent=message;status.hidden=false;statusTimer=setTimeout(()=>{status.hidden=true;},6500);}
  function choose(browser){current=browser;const info=browsers[browser];document.querySelectorAll('[data-browser]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.browser===browser)));if($('extensionsAddress'))$('extensionsAddress').textContent=info.address;if($('browserIntro'))$('browserIntro').textContent=`Installing on ${info.name}. You can switch browsers above.`;if($('browserHelp')){$('browserHelp').href=info.help;$('browserHelp').textContent=`Official ${info.name} guide ↗`;}}
  async function copy(value,success){try{await navigator.clipboard.writeText(value);announce(success);}catch{announce(`Copy is unavailable. Copy this text manually: ${value}`);const address=$('extensionsAddress');if(address?.textContent===value){const range=document.createRange();range.selectNodeContents(address);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}}}
  document.querySelectorAll('[data-browser]').forEach(button=>button.addEventListener('click',()=>{manuallyPicked=true;choose(button.dataset.browser);}));
  $('copyAddress')?.addEventListener('click',()=>copy(browsers[current].address,'Address copied. Paste it into a new tab’s address bar.'));
  $('shareButton')?.addEventListener('click',()=>copy(`${location.origin}/get-extension`,'Public download-page link copied.'));
  document.querySelectorAll('#downloadButton,[data-download]').forEach(link=>link.addEventListener('click',()=>announce('Download requested. Next: extract the ZIP, then follow the three setup steps.')));
  $('openWindow')?.addEventListener('click',()=>{const popup=window.open('/pocket?window=1','packet-party-pocket-online','popup,width=400,height=570');if(popup)popup.focus();else announce('Your browser blocked the window. You can keep using the question box below.');});
  if(/Mac|iPhone|iPad/.test(navigator.platform)&&$('extractHelp'))$('extractHelp').textContent='On Mac, double-click the ZIP to extract it.';
  if($('browserIntro')){const requested=new URLSearchParams(location.search).get('browser');if(browsers[requested]){manuallyPicked=true;choose(requested);}else{choose(/Edg\//.test(navigator.userAgent)?'edge':'chrome');navigator.brave?.isBrave().then(isBrave=>{if(isBrave&&!manuallyPicked)choose('brave');}).catch(()=>{});}}
  if(new URLSearchParams(location.search).has('window')&&$('pocketHeader')){$('pocketHeader').hidden=true;document.body.classList.add('compact-web-window');}
})();
