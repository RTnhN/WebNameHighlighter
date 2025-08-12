const HIGHLIGHT_CLASS = 'web-name-highlight';

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateVariants(first, last) {
  const variants = new Set();
  const f = first.trim();
  const l = last.trim();
  if (!l) return [];
  const fi = f ? f[0] : '';
  variants.add(l);
  if (f) {
    variants.add(`${f} ${l}`);
    variants.add(`${fi} ${l}`);
    variants.add(`${fi}. ${l}`);
    variants.add(`${l}, ${f}`);
    variants.add(`${l}, ${fi}`);
    variants.add(`${l}, ${fi}.`);
  }
  return Array.from(variants);
}

function buildRegex(set) {
  const arr = Array.from(set).map(escapeRegExp).sort((a, b) => b.length - a.length);
  if (arr.length === 0) return null;
  return new RegExp(`\\b(${arr.join('|')})\\b`, 'gi');
}

function clearHighlights() {
  document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(span => {
    const parent = span.parentNode;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });
}

function walkAndHighlight(regex) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  nodes.forEach(node => {
    const parent = node.parentNode;
    if (parent && parent.classList && parent.classList.contains(HIGHLIGHT_CLASS)) return;
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    text.replace(regex, (match, _p1, offset) => {
      const before = text.slice(lastIndex, offset);
      if (before) frag.appendChild(document.createTextNode(before));
      const span = document.createElement('span');
      span.className = HIGHLIGHT_CLASS;
      span.style.backgroundColor = 'yellow';
      span.textContent = match;
      frag.appendChild(span);
      lastIndex = offset + match.length;
    });
    if (lastIndex) {
      const after = text.slice(lastIndex);
      if (after) frag.appendChild(document.createTextNode(after));
      parent.replaceChild(frag, node);
    }
  });
}

function refreshHighlights() {
  chrome.storage.local.get({ names: [], keywords: [] }, data => {
    const termSet = new Set();
    data.names.forEach(n => {
      generateVariants(n.first, n.last).forEach(v => termSet.add(v.toLowerCase()));
    });
    data.keywords.forEach(k => termSet.add(k.toLowerCase()));
    clearHighlights();
    const regex = buildRegex(termSet);
    if (regex) {
      walkAndHighlight(regex);
    }
  });
}

refreshHighlights();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.names || changes.keywords)) {
    refreshHighlights();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'refresh') {
    refreshHighlights();
  }
});
