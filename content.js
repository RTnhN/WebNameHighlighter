const HIGHLIGHT_CLASSES = {
  full: 'web-name-highlight-full',
  last: 'web-name-highlight-last',
  keyword: 'web-name-highlight-keyword'
};

const DEFAULT_COLORS = {
  full: '#90caf9',
  last: '#fff59d',
  keyword: '#ffcc80'
};

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateFullVariants(first, last) {
  const variants = new Set();
  const f = first.trim();
  const l = last.trim();
  if (!f || !l) return [];
  const fi = f[0];
  variants.add(`${f} ${l}`);
  variants.add(`${fi} ${l}`);
  variants.add(`${fi}. ${l}`);
  variants.add(`${l}, ${f}`);
  variants.add(`${l}, ${fi}`);
  variants.add(`${l}, ${fi}.`);
  return Array.from(variants);
}

function buildRegex(set) {
  const arr = Array.from(set).map(escapeRegExp).sort((a, b) => b.length - a.length);
  if (arr.length === 0) return null;
  return new RegExp(`\\b(${arr.join('|')})\\b`, 'gi');
}

function clearHighlights() {
  const selector = Object.values(HIGHLIGHT_CLASSES).map(c => `.${c}`).join(',');
  document.querySelectorAll(selector).forEach(span => {
    const parent = span.parentNode;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });
}

function walkAndHighlight(regex, color, className) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  nodes.forEach(node => {
    const parent = node.parentNode;
    if (parent && parent.classList) {
      for (const cls of Object.values(HIGHLIGHT_CLASSES)) {
        if (parent.classList.contains(cls)) return;
      }
    }
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    text.replace(regex, (match, _p1, offset) => {
      const before = text.slice(lastIndex, offset);
      if (before) frag.appendChild(document.createTextNode(before));
      const span = document.createElement('span');
      span.className = className;
      span.style.backgroundColor = color;
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
  chrome.storage.local.get({ names: [], keywords: [], colors: DEFAULT_COLORS }, data => {
    const lastSet = new Set();
    const fullSet = new Set();
    data.names.forEach(n => {
      const l = n.last.trim();
      const f = n.first.trim();
      if (l) lastSet.add(l.toLowerCase());
      if (f && l) {
        generateFullVariants(f, l).forEach(v => fullSet.add(v.toLowerCase()));
      }
    });
    const keywordSet = new Set();
    data.keywords.forEach(k => keywordSet.add(k.toLowerCase()));
    clearHighlights();
    const regexFull = buildRegex(fullSet);
    const regexLast = buildRegex(lastSet);
    const regexKeyword = buildRegex(keywordSet);
    if (regexFull) {
      walkAndHighlight(regexFull, data.colors.full || DEFAULT_COLORS.full, HIGHLIGHT_CLASSES.full);
    }
    if (regexLast) {
      walkAndHighlight(regexLast, data.colors.last || DEFAULT_COLORS.last, HIGHLIGHT_CLASSES.last);
    }
    if (regexKeyword) {
      walkAndHighlight(regexKeyword, data.colors.keyword || DEFAULT_COLORS.keyword, HIGHLIGHT_CLASSES.keyword);
    }
  });
}

refreshHighlights();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.names || changes.keywords || changes.colors)) {
    refreshHighlights();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'refresh') {
    refreshHighlights();
  }
});
