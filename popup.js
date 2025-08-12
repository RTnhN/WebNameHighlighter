let currentNames = [];
let currentKeywords = [];

function dedupeNames(arr) {
  const map = new Map();
  arr.forEach(n => {
    const key = `${n.first.trim().toLowerCase()}|${n.last.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, { first: n.first.trim(), last: n.last.trim() });
    }
  });
  return Array.from(map.values());
}

function renderNames(names) {
  const tbody = document.querySelector('#names tbody');
  tbody.innerHTML = '';
  names.forEach((n, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="first" value="${n.first}"></td>` +
                   `<td><input class="last" value="${n.last}"></td>` +
                   `<td><button class="delete">x</button></td>`;
    tr.querySelector('.delete').addEventListener('click', () => {
      currentNames.splice(idx, 1);
      renderNames(currentNames);
      saveNamesToStorage();
    });
    tbody.appendChild(tr);
  });
}

function renderKeywords(list) {
  const ul = document.getElementById('keywordList');
  ul.innerHTML = '';
  list.forEach((word, index) => {
    const li = document.createElement('li');
    li.textContent = word;
    const btn = document.createElement('button');
    btn.textContent = 'x';
    btn.addEventListener('click', () => {
      currentKeywords.splice(index, 1);
      saveKeywordsToStorage();
      renderKeywords(currentKeywords);
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function saveNamesToStorage() {
  chrome.storage.local.set({ names: currentNames });
}

function saveKeywordsToStorage() {
  chrome.storage.local.set({ keywords: currentKeywords });
}

function handleCSV(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    const parsed = [];
    lines.forEach(line => {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const first = parts[0].trim();
        const last = parts[1].trim();
        if (first || last) parsed.push({ first, last });
      }
    });
    const unique = dedupeNames(parsed);
    if (mode === 'replace') {
      currentNames = unique;
    } else {
      currentNames = dedupeNames(currentNames.concat(unique));
    }
    renderNames(currentNames);
    saveNamesToStorage();
    evt.target.value = '';
  };
  reader.readAsText(file);
}

function addKeyword() {
  const input = document.getElementById('keyword');
  const word = input.value.trim();
  if (word && !currentKeywords.some(k => k.toLowerCase() === word.toLowerCase())) {
    currentKeywords.push(word);
    renderKeywords(currentKeywords);
    saveKeywordsToStorage();
  }
  input.value = '';
}

function addName() {
  currentNames.push({ first: '', last: '' });
  renderNames(currentNames);
}

function saveNames() {
  const rows = document.querySelectorAll('#names tbody tr');
  const updated = [];
  rows.forEach(row => {
    const first = row.querySelector('.first').value.trim();
    const last = row.querySelector('.last').value.trim();
    if (first || last) updated.push({ first, last });
  });
  currentNames = dedupeNames(updated);
  renderNames(currentNames);
  saveNamesToStorage();
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ names: [], keywords: [] }, data => {
    currentNames = data.names;
    currentKeywords = data.keywords;
    renderNames(currentNames);
    renderKeywords(currentKeywords);
  });

  document.getElementById('upload').addEventListener('change', handleCSV);
  document.getElementById('addKeyword').addEventListener('click', addKeyword);
  document.getElementById('addName').addEventListener('click', addName);
  document.getElementById('saveNames').addEventListener('click', saveNames);
});
