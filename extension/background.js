// The page listener supports backtick; toolbar/command also work on demand.
chrome.action.onClicked.addListener(async tab => {
  if (!Number.isInteger(tab.id)) return;
  try {
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['floating.js']});
    await chrome.scripting.executeScript({target: {tabId: tab.id}, func: () => globalThis.__packetPartyPocket?.()});
  } catch {
    // Browser settings, store pages and some built-in viewers reject injection.
    await chrome.windows.create({url: chrome.runtime.getURL('panel.html?standalone=1'), type: 'popup', width: 400, height: 500});
  }
});
