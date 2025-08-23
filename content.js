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

const DEFAULT_VARIANT_TEMPLATES = [
  '{first} {last}',
  '{f} {last}',
  '{f}. {last}',
  '{last}, {first}',
  '{last}, {f}'
];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wildcardToRegex(str) {
  return str
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
    .replace(/\*/g, '[^\\s]*')
    .replace(/\?/g, '[^\\s]');
}

function generateFullVariants(first, last, templates) {
  const variants = new Set();
  const f = first.trim();
  const l = last.trim();
  if (!f || !l) return [];
  const fi = f[0];
  templates.forEach(t => {
    const variant = t
      .replace(/\{first\}/gi, f)
      .replace(/\{last\}/gi, l)
      .replace(/\{f\}/gi, fi);
    variants.add(variant);
  });
  return Array.from(variants);
}

function buildRegex(set, allowWildcard = false) {
  const arr = Array.from(set)
    .map(s => (allowWildcard ? wildcardToRegex(s) : escapeRegExp(s)))
    .sort((a, b) => b.length - a.length);
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
    if (!current.nodeValue) continue;
    // Skip nodes inside forbidden ancestors or existing highlights
    if (isInSkippedAncestor(current)) continue;
    nodes.push(current);
  }
  return nodes;
}

function walkAndHighlight(regex, bgColor, textColor, className, groupName) {
  if (!regex) return;
  const nodes = collectTextNodes(document.body);
  if (nodes.length === 0) return;

  // Build a mapping from character offsets to text nodes
  const positions = [];
  let fullText = '';
  nodes.forEach(node => {
    positions.push({ node, start: fullText.length });
    fullText += node.nodeValue;
  });
  positions.forEach(p => (p.end = p.start + p.node.nodeValue.length));

  // Find all matches in the combined text
  const ranges = [];
  let match;
  while ((match = regex.exec(fullText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    let startNode, endNode, startOffset, endOffset;
    for (const pos of positions) {
      if (!startNode && start >= pos.start && start < pos.end) {
        startNode = pos.node;
        startOffset = start - pos.start;
      }
      if (startNode && !endNode && end > pos.start && end <= pos.end) {
        endNode = pos.node;
        endOffset = end - pos.start;
        break;
      }
    }
    if (!startNode || !endNode) continue;

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    ranges.push(range);
  }

  // Apply highlights from last to first to preserve offsets
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];
    const span = document.createElement('span');
    span.className = className;
    span.style.backgroundColor = bgColor;
    if (textColor) span.style.color = textColor;
    if (groupName) span.title = groupName;
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }
}

function refreshHighlights() {
  chrome.storage.local.get({ nameGroups: [], keywordGroups: [], variantTemplates: DEFAULT_VARIANT_TEMPLATES }, data => {
    clearHighlights();

    data.nameGroups.forEach(group => {
      const lastSet = new Set();
      const fullSet = new Set();

      group.names.forEach(n => {
        const l = (n.last || '').trim();
        const f = (n.first || '').trim();
        if (!l) return;
        lastSet.add(l.toLowerCase());
        if (f) {
          generateFullVariants(f, l, data.variantTemplates).forEach(v => fullSet.add(v.toLowerCase()));
        }
      });

      const regexFull = buildRegex(fullSet, true);
      if (regexFull) {
        walkAndHighlight(
          regexFull,
          group.colorFull || DEFAULT_COLORS.full,
          group.textColorFull || DEFAULT_TEXT_COLOR,
          HIGHLIGHT_CLASSES.full,
          group.name
        );
      }

      const regexLast = buildRegex(lastSet, true);
      if (regexLast) {
        walkAndHighlight(
          regexLast,
          group.colorLast || DEFAULT_COLORS.last,
          group.textColorLast || DEFAULT_TEXT_COLOR,
          HIGHLIGHT_CLASSES.last,
          group.name
        );
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
