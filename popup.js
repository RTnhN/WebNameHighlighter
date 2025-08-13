let currentNameGroups = [];
let currentKeywords = [];
let currentColors = { last: '#fff59d', full: '#90caf9', keyword: '#ffcc80' };

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

function handleGroupCSVUpload(gIdx, input, mode) {
  const file = input.files[0];
  if (!file) return;

  // capture unsaved edits before importing
  saveGroups();

  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
    const imported = [];
    lines.forEach(line => {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const first = parts[0].trim();
        const last = parts[1].trim();
        if (first || last) {
          imported.push({ first, last });
        }
      }
    });
    const unique = dedupeNames(imported);
    if (mode === 'replace') {
      currentNameGroups[gIdx].names = unique;
    } else {
      currentNameGroups[gIdx].names = dedupeNames(currentNameGroups[gIdx].names.concat(unique));
    }
    chrome.storage.local.set({ nameGroups: currentNameGroups });
    renderGroups();
    input.value = '';
  };
  reader.readAsText(file);
}

function renderGroups() {
  const container = document.getElementById('groups');
  container.innerHTML = '';
  currentNameGroups.forEach((g, gIdx) => {
    const div = document.createElement('div');
    div.className = 'group';
    div.innerHTML = `
      <div class="group-header">
        <input class="group-name" value="${g.name}">
        <button class="delete-group">x</button>
      </div>
      <div class="csv-controls">
        <input type="file" class="csv-upload" accept=".csv" />
        <select class="csv-mode">
          <option value="append">Append</option>
          <option value="replace">Replace</option>
        </select>
      </div>
      <table class="names">
        <thead><tr><th>First</th><th>Last</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
      <button class="add-name">Add Name</button>
    `;
    const tbody = div.querySelector('tbody');
    g.names.forEach((n, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input class="first" value="${n.first}"></td>` +
                     `<td><input class="last" value="${n.last}"></td>` +
                     `<td><button class="delete">x</button></td>`;
      tr.querySelector('.delete').addEventListener('click', () => {
        g.names.splice(idx, 1);
        renderGroups();
      });
      tbody.appendChild(tr);
    });
    div.querySelector('.add-name').addEventListener('click', () => {
      g.names.push({ first: '', last: '' });
      renderGroups();
    });
    div.querySelector('.delete-group').addEventListener('click', () => {
      currentNameGroups.splice(gIdx, 1);
      renderGroups();
    });
    div.querySelector('.csv-upload').addEventListener('change', e => {
      const mode = div.querySelector('.csv-mode').value;
      handleGroupCSVUpload(gIdx, e.target, mode);
    });
    container.appendChild(div);
  });
}

function addGroup() {
  currentNameGroups.push({ name: '', names: [] });
  renderGroups();
}

function saveGroups() {
  const groups = [];
  document.querySelectorAll('#groups .group').forEach(div => {
    const name = div.querySelector('.group-name').value.trim();
    const names = [];
    div.querySelectorAll('tbody tr').forEach(row => {
      const first = row.querySelector('.first').value.trim();
      const last = row.querySelector('.last').value.trim();
      if (first || last) names.push({ first, last });
    });
    if (name) {
      groups.push({ name, names: dedupeNames(names) });
    }
  });
  currentNameGroups = groups;
  chrome.storage.local.set({ nameGroups: currentNameGroups });
  renderGroups();
}

function renderKeywords() {
  const ul = document.getElementById('keywordList');
  ul.innerHTML = '';
  currentKeywords.forEach((word, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<input class="kw" value="${word}"> <button class="delete">x</button>`;
    li.querySelector('.delete').addEventListener('click', () => {
      currentKeywords.splice(idx, 1);
      renderKeywords();
    });
    ul.appendChild(li);
  });
}

function addKeyword() {
  currentKeywords.push('');
  renderKeywords();
}

function saveKeywords() {
  const keywords = [];
  document.querySelectorAll('#keywordList input.kw').forEach(input => {
    const w = input.value.trim();
    if (w && !keywords.some(k => k.toLowerCase() === w.toLowerCase())) {
      keywords.push(w);
    }
  });
  currentKeywords = keywords;
  chrome.storage.local.set({ keywords: currentKeywords });
  renderKeywords();
}

function saveColorsToStorage() {
  chrome.storage.local.set({ colors: currentColors });
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ nameGroups: [], keywords: [], colors: currentColors }, data => {
    currentNameGroups = data.nameGroups;
    currentKeywords = data.keywords;
    currentColors = data.colors;
    renderGroups();
    renderKeywords();
    document.getElementById('colorLast').value = currentColors.last;
    document.getElementById('colorFull').value = currentColors.full;
    document.getElementById('colorKeyword').value = currentColors.keyword;
  });

  document.getElementById('addGroup').addEventListener('click', addGroup);
  document.getElementById('saveGroups').addEventListener('click', saveGroups);
  document.getElementById('addKeyword').addEventListener('click', addKeyword);
  document.getElementById('saveKeywords').addEventListener('click', saveKeywords);
  document.getElementById('colorLast').addEventListener('input', e => {
    currentColors.last = e.target.value;
    saveColorsToStorage();
  });
  document.getElementById('colorFull').addEventListener('input', e => {
    currentColors.full = e.target.value;
    saveColorsToStorage();
  });
  document.getElementById('colorKeyword').addEventListener('input', e => {
    currentColors.keyword = e.target.value;
    saveColorsToStorage();
  });
});
