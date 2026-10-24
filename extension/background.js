const VERSION=chrome.runtime.getManifest().version;
const repairs=new Map();
const normalPage=url=>/^https?:\/\//i.test(url||'');

async function ensureTop(tabId) {
  if(repairs.has(tabId))return repairs.get(tabId);
  const repair=(async()=>{
    try {
      const answer=await chrome.tabs.sendMessage(tabId,{type:'pp-pocket-health'},{frameId:0});
      if(answer?.ok&&answer.version===VERSION)return true;
    }catch{}
    try {
      await chrome.scripting.executeScript({target:{tabId,allFrames:true},files:['hotkey.js','floating.js']});
      return true;
    }catch{return false;}
  })();
  repairs.set(tabId,repair);
  try{return await repair;}finally{repairs.delete(tabId);}
}
async function repairTab(tabId) {
  try{const tab=await chrome.tabs.get(tabId);if(normalPage(tab.url))await ensureTop(tabId);}catch{}
}
async function toggleTab(tabId) {
  if(!await ensureTop(tabId))return false;
  try{return Boolean((await chrome.tabs.sendMessage(tabId,{type:'pp-pocket-show-hide'},{frameId:0}))?.ok);}catch{return false;}
}

chrome.action.onClicked.addListener(async tab=>{
  if(!Number.isInteger(tab.id))return;
  if(!await toggleTab(tab.id)) {
    // Restricted browser pages still use a compact extension window.
    await chrome.windows.create({url:chrome.runtime.getURL('panel.html?standalone=1'),type:'popup',width:400,height:500});
  }
});
// An activated/sleep-restored/pre-existing tab may not have a live listener yet.
chrome.tabs.onActivated.addListener(({tabId})=>{void repairTab(tabId);});
chrome.tabs.onUpdated.addListener((tabId,change,tab)=>{
  if((change.status==='complete'||change.discarded===false)&&normalPage(tab.url))void repairTab(tabId);
});
async function repairExisting() {
  try{const tabs=await chrome.tabs.query({url:['http://*/*','https://*/*']});await Promise.allSettled(tabs.filter(tab=>!tab.discarded).map(tab=>ensureTop(tab.id)));}catch{}
}
chrome.runtime.onInstalled.addListener(()=>{void repairExisting();});
chrome.runtime.onStartup.addListener(()=>{void repairExisting();});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id)return;
  if(message?.type==='pp-pocket-context') {
    respond({tabId:sender.tab?.id??null,version:VERSION});return;
  }
  if(message?.type==='pp-pocket-toggle-top'&&Number.isInteger(sender.tab?.id)) {
    toggleTab(sender.tab.id).then(ok=>respond({ok}),()=>respond({ok:false}));return true;
  }
  if(message?.type==='pp-pocket-copy'&&Number.isInteger(sender.tab?.id)&&typeof message.text==='string') {
    const tabId=sender.tab.id,text=message.text.trim().slice(0,10000);
    (async()=>{
      if(!text||(await chrome.storage.local.get('pocketAutoCopy')).pocketAutoCopy===false||!await ensureTop(tabId))return false;
      return Boolean((await chrome.tabs.sendMessage(tabId,{type:'pp-pocket-import',text},{frameId:0}))?.ok);
    })().then(ok=>respond({ok}),()=>respond({ok:false}));return true;
  }
});
chrome.tabs.onRemoved.addListener(tabId=>{
  // Session drafts live only as long as their browser tab.
  chrome.storage.session?.remove(`pocketTab:${tabId}`).catch(()=>{});
});
