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
  return Array.from(variants);
}

function buildRegex(set) {
  const arr = Array.from(set).map(escapeRegExp).sort((a, b) => b.length - a.length);
  if (arr.length === 0) return null;
  return new RegExp(`\\b(${arr.join('|')})\\b`, 'gi');
}

function elementIsHighlightContainer(el) {
  if (!el || !el.classList) return false;
  for (const cls of Object.values(HIGHLIGHT_CLASSES)) {
    if (el.classList.contains(cls)) return true;
  }
  return false;
}

function isInSkippedAncestor(node) {
  // Skip if the node is inside tags we must never mutate (script/speculationrules, style, code blocks, etc.)
  // Also skip contentEditable areas to avoid user-typed text modifications.
  const SKIP_SELECTOR = 'script, style, noscript, code, pre, textarea, svg, math, input, select, option';
  let el = node.parentElement;
  while (el) {
    if (el.matches && el.matches(SKIP_SELECTOR)) return true;
    if (el.isContentEditable) return true;
    // Avoid reprocessing our own highlights
    if (elementIsHighlightContainer(el)) return true;
    el = el.parentElement;
  }
  return false;
}

function clearHighlights() {
  const selector = Object.values(HIGHLIGHT_CLASSES).map(c => `.${c}`).join(',');
  document.querySelectorAll(selector).forEach(span => {
    const parent = span.parentNode;
    if (!parent) return;
    try {
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    } catch (_) {
      // noop
    }
  });
}

function collectTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let current;
  while ((current = walker.nextNode())) {
    // Ignore empty/whitespace-only nodes early for perf
    if (!current.nodeValue || !/\S/.test(current.nodeValue)) continue;
    nodes.push(current);
  }
  return nodes;
}

function safeReplace(parent, oldNode, frag) {
  try {
    parent.replaceChild(frag, oldNode);
  } catch (_) {
    // Some hosts may block mutations; fail silently
  }
}

function walkAndHighlight(regex, bgColor, textColor, className, groupName) {
  if (!regex) return;
  const nodes = collectTextNodes(document.body);
  nodes.forEach(node => {
    const parent = node.parentNode;
    if (!parent) return;
    if (isInSkippedAncestor(node)) return;

    const text = node.nodeValue;
    let lastIndex = 0;
    const frag = document.createDocumentFragment();

    text.replace(regex, (match, _p1, offset) => {
      const before = text.slice(lastIndex, offset);
      if (before) frag.appendChild(document.createTextNode(before));
      const span = document.createElement('span');
      span.className = className;
      span.style.backgroundColor = bgColor;
      if (textColor) span.style.color = textColor;
      span.textContent = match;
      if (groupName) span.title = groupName;
      frag.appendChild(span);
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex) {
      const after = text.slice(lastIndex);
      if (after) frag.appendChild(document.createTextNode(after));
      safeReplace(parent, node, frag);
    }
  });
}

function walkAndHighlightNames(regexLast, lastMap, group) {
  if (!regexLast) return;
  const nodes = collectTextNodes(document.body);
  nodes.forEach(node => {
    const parent = node.parentNode;
    if (!parent) return;
    if (isInSkippedAncestor(node)) return;

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
        const variantLen = variant.length;
        const searchStart = Math.max(0, start - (variantLen - (end - start)));
        const idx = textLower.indexOf(variant, searchStart);

        if (idx !== -1 && idx <= start && idx + variantLen >= end) {
          const before = text.slice(lastIndex, idx);
          if (before) frag.appendChild(document.createTextNode(before));

          const span = document.createElement('span');
          span.className = HIGHLIGHT_CLASSES.full;
          span.style.backgroundColor = group.colorFull || DEFAULT_COLORS.full;
          span.style.color = group.textColorFull || DEFAULT_TEXT_COLOR;
          span.textContent = text.slice(idx, idx + variantLen);
          span.title = group.name;
          frag.appendChild(span);

          lastIndex = idx + variantLen;
          regexLast.lastIndex = idx + variantLen;
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
      safeReplace(parent, node, frag);
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
        const l = (n.last || '').trim();
        const f = (n.first || '').trim();
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
      (group.keywords || []).forEach(k => {
        if (k && typeof k === 'string') keywordSet.add(k.toLowerCase());
      });
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

chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg && msg.type === 'refresh') {
    refreshHighlights();
  }
});
