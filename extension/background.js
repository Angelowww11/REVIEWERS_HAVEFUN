// Only the toolbar gesture grants page access. No persistent access to every site.
chrome.action.onClicked.addListener(async tab => {
  if (!Number.isInteger(tab.id)) return;
  try {
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['floating.js']});
  } catch {
    // Browser settings, store pages and some built-in viewers reject injection.
    await chrome.tabs.create({url: chrome.runtime.getURL('panel.html?standalone=1')});
  }
});
