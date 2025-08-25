function updateIcon(enabled) {
  const path = enabled
    ? {
        16: 'icons/icon-16.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png'
      }
    : {
        16: 'icons/icon-disabled-16.png',
        48: 'icons/icon-disabled-48.png',
        128: 'icons/icon-disabled-128.png'
      };
  chrome.action.setIcon({ path });
}

function init() {
  chrome.storage.local.get({ enabled: true }, data => {
    updateIcon(data.enabled);
  });
}

init();

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) {
    updateIcon(changes.enabled.newValue);
  }
});