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

const DEFAULT_TEXT_COLOR = '#000000';

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

function walkAndHighlight(regex, bgColor, textColor, className, groupName) {
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
      span.style.backgroundColor = bgColor;
      if (textColor) {
        span.style.color = textColor;
      }
      span.textContent = match;
      if (groupName) {
        span.title = groupName;
      }
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

function walkAndHighlightNames(regexLast, lastMap, group) {
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
    const textLower = text.toLowerCase();
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    regexLast.lastIndex = 0;
    let match;
    while ((match = regexLast.exec(text)) !== null) {
      const start = match.index;
      const end = regexLast.lastIndex;
      const lastLower = match[0].toLowerCase();
      const variants = lastMap.get(lastLower) || new Set();
      let highlighted = false;
      for (const variant of variants) {
        const searchStart = Math.max(0, start - (variant.length - (end - start)));
        const idx = textLower.indexOf(variant, searchStart);
        if (idx !== -1 && idx <= start && idx + variant.length >= end) {
          const before = text.slice(lastIndex, idx);
          if (before) frag.appendChild(document.createTextNode(before));
          const span = document.createElement('span');
          span.className = HIGHLIGHT_CLASSES.full;
          span.style.backgroundColor = group.colorFull || DEFAULT_COLORS.full;
          span.style.color = group.textColorFull || DEFAULT_TEXT_COLOR;
          span.textContent = text.slice(idx, idx + variant.length);
          span.title = group.name;
          frag.appendChild(span);
          lastIndex = idx + variant.length;
          regexLast.lastIndex = idx + variant.length;
          highlighted = true;
          break;
        }
      }
      if (!highlighted) {
        const before = text.slice(lastIndex, start);
        if (before) frag.appendChild(document.createTextNode(before));
        const span = document.createElement('span');
        span.className = HIGHLIGHT_CLASSES.last;
        span.style.backgroundColor = group.colorLast || DEFAULT_COLORS.last;
        span.style.color = group.textColorLast || DEFAULT_TEXT_COLOR;
        span.textContent = match[0];
        span.title = group.name;
        frag.appendChild(span);
        lastIndex = end;
      }
    }
    if (lastIndex) {
      const after = text.slice(lastIndex);
      if (after) frag.appendChild(document.createTextNode(after));
      parent.replaceChild(frag, node);
    }
  });
}

function refreshHighlights() {
  chrome.storage.local.get({ nameGroups: [], keywordGroups: [] }, data => {
    clearHighlights();

    data.nameGroups.forEach(group => {
      const lastSet = new Set();
      const lastMap = new Map();
      group.names.forEach(n => {
        const l = n.last.trim();
        const f = n.first.trim();
        if (!l) return;
        const lLower = l.toLowerCase();
        lastSet.add(lLower);
        if (!lastMap.has(lLower)) lastMap.set(lLower, new Set());
        if (f) {
          generateFullVariants(f, l).forEach(v => lastMap.get(lLower).add(v.toLowerCase()));
        }
      });
      const regexLast = buildRegex(lastSet);
      if (regexLast) {
        walkAndHighlightNames(regexLast, lastMap, group);
      }
    });

    data.keywordGroups.forEach(group => {
      const keywordSet = new Set();
      group.keywords.forEach(k => keywordSet.add(k.toLowerCase()));
      const regexKeyword = buildRegex(keywordSet);
      if (regexKeyword) {
        walkAndHighlight(
          regexKeyword,
          group.color || DEFAULT_COLORS.keyword,
          group.textColor || DEFAULT_TEXT_COLOR,
          HIGHLIGHT_CLASSES.keyword,
          group.name
        );
      }
    });
  });
}

refreshHighlights();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.nameGroups || changes.keywordGroups)) {
    refreshHighlights();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'refresh') {
    refreshHighlights();
  }
});
