let currentNameGroups = [];
let currentKeywordGroups = [];

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
    const colorLast = g.colorLast || '#fff59d';
    const textColorLast = g.textColorLast || '#000000';
    const colorFull = g.colorFull || '#90caf9';
    const textColorFull = g.textColorFull || '#000000';
    div.innerHTML = `
      <div class="group-header">
        <input class="group-name" value="${g.name}">
        <input type="color" class="nm-color-last" value="${colorLast}" title="Last name highlight">
        <input type="color" class="nm-text-color-last" value="${textColorLast}" title="Last name text color">
        <input type="color" class="nm-color-full" value="${colorFull}" title="Full name highlight">
        <input type="color" class="nm-text-color-full" value="${textColorFull}" title="Full name text color">
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
      const firstInput = tr.querySelector('.first');
      const lastInput = tr.querySelector('.last');
      firstInput.addEventListener('input', e => {
        g.names[idx].first = e.target.value;
      });
      lastInput.addEventListener('input', e => {
        g.names[idx].last = e.target.value;
      });
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
    div.querySelector('.group-name').addEventListener('input', e => {
      g.name = e.target.value;
    });
    div.querySelector('.nm-color-last').addEventListener('input', e => {
      g.colorLast = e.target.value;
    });
    div.querySelector('.nm-text-color-last').addEventListener('input', e => {
      g.textColorLast = e.target.value;
    });
    div.querySelector('.nm-color-full').addEventListener('input', e => {
      g.colorFull = e.target.value;
    });
    div.querySelector('.nm-text-color-full').addEventListener('input', e => {
      g.textColorFull = e.target.value;
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
  currentNameGroups.push({
    name: '',
    names: [],
    colorLast: '#fff59d',
    textColorLast: '#000000',
    colorFull: '#90caf9',
    textColorFull: '#000000'
  });
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
      const colorLast = div.querySelector('.nm-color-last').value;
      const textColorLast = div.querySelector('.nm-text-color-last').value;
      const colorFull = div.querySelector('.nm-color-full').value;
      const textColorFull = div.querySelector('.nm-text-color-full').value;
      groups.push({ name, names: dedupeNames(names), colorLast, textColorLast, colorFull, textColorFull });
    }
  });
  currentNameGroups = groups;
  chrome.storage.local.set({ nameGroups: currentNameGroups });
  renderGroups();
}

function renderKeywordGroups() {
  const container = document.getElementById('keywordGroups');
  container.innerHTML = '';
  currentKeywordGroups.forEach((g, gIdx) => {
    const div = document.createElement('div');
    div.className = 'group';
    div.innerHTML = `
      <div class="group-header">
        <input class="group-name" value="${g.name}">
        <input type="color" class="kw-color" value="${g.color || '#ffcc80'}" title="Highlight color">
        <input type="color" class="kw-text-color" value="${g.textColor || '#000000'}" title="Text color">
        <button class="delete-group">x</button>
      </div>
      <ul class="kw-list"></ul>
      <button class="add-keyword">Add Keyword</button>
    `;
    const ul = div.querySelector('.kw-list');
    g.keywords.forEach((word, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<input class="kw" value="${word}"> <button class="delete">x</button>`;
      const input = li.querySelector('.kw');
      input.addEventListener('input', e => {
        g.keywords[idx] = e.target.value;
      });
      li.querySelector('.delete').addEventListener('click', () => {
        g.keywords.splice(idx, 1);
        renderKeywordGroups();
      });
      ul.appendChild(li);
    });
    div.querySelector('.add-keyword').addEventListener('click', () => {
      g.keywords.push('');
      renderKeywordGroups();
    });
    div.querySelector('.group-name').addEventListener('input', e => {
      g.name = e.target.value;
    });
    div.querySelector('.kw-color').addEventListener('input', e => {
      g.color = e.target.value;
    });
    div.querySelector('.kw-text-color').addEventListener('input', e => {
      g.textColor = e.target.value;
    });
    div.querySelector('.delete-group').addEventListener('click', () => {
      currentKeywordGroups.splice(gIdx, 1);
      renderKeywordGroups();
    });
    container.appendChild(div);
  });
}

function addKeywordGroup() {
  currentKeywordGroups.push({ name: '', keywords: [], color: '#ffcc80', textColor: '#000000' });
  renderKeywordGroups();
}

function saveKeywordGroups() {
  const groups = [];
  document.querySelectorAll('#keywordGroups .group').forEach(div => {
    const name = div.querySelector('.group-name').value.trim();
    const color = div.querySelector('.kw-color').value;
    const textColor = div.querySelector('.kw-text-color').value;
    const keywords = [];
    div.querySelectorAll('.kw-list input.kw').forEach(input => {
      const w = input.value.trim();
      if (w && !keywords.some(k => k.toLowerCase() === w.toLowerCase())) {
        keywords.push(w);
      }
    });
    if (name) {
      groups.push({ name, keywords, color, textColor });
    }
  });
  currentKeywordGroups = groups;
  chrome.storage.local.set({ keywordGroups: currentKeywordGroups });
  renderKeywordGroups();
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ nameGroups: [], keywordGroups: [] }, data => {
    currentNameGroups = data.nameGroups.map(g => ({
      name: g.name || '',
      names: g.names || [],
      colorLast: g.colorLast || '#fff59d',
      textColorLast: g.textColorLast || '#000000',
      colorFull: g.colorFull || '#90caf9',
      textColorFull: g.textColorFull || '#000000'
    }));
    currentKeywordGroups = data.keywordGroups.map(g => ({
      name: g.name || '',
      keywords: g.keywords || [],
      color: g.color || '#ffcc80',
      textColor: g.textColor || '#000000'
    }));
    renderGroups();
    renderKeywordGroups();
  });

  document.getElementById('addGroup').addEventListener('click', addGroup);
  document.getElementById('saveGroups').addEventListener('click', saveGroups);
  document.getElementById('addKeywordGroup').addEventListener('click', addKeywordGroup);
  document.getElementById('saveKeywordGroups').addEventListener('click', saveKeywordGroups);
});
