async function updateIcon(enabled) {
  if (enabled) {
    chrome.action.setIcon({
      path: {
        16: 'icons/icon-16.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png'
      }
    });
    return;
  }

  const sizes = [16, 48, 128];
  const imageData = {};
  for (const size of sizes) {
    const url = chrome.runtime.getURL(`icons/icon-${size}.png`);
    const res = await fetch(url);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, size, size);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = size / 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, size);
    ctx.moveTo(size, 0);
    ctx.lineTo(0, size);
    ctx.stroke();
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  chrome.action.setIcon({ imageData });
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
