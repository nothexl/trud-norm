function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function vb(s) { return (s||'').replace(/"/g,'""'); }
function filterCode(val) { return (val || '').replace(/[^A-Za-z0-9_]/g, ''); }

function adjustIdx(idx, from, to) {
  if (idx === from) return to;
  if (from < to && idx > from && idx <= to) return idx - 1;
  if (from > to && idx >= to && idx < from) return idx + 1;
  return idx;
}

function getParams(scope, ti, oi) {
  if (scope === 'set') return schema[ti].paramSets[oi].params;
  return schema[ti].operations[oi].params;
}

function buildListChips(scope, ti, oi, pi, items) {
  const a = `'${scope}',${ti},${oi},${pi}`;
  return items.map((item, idx) =>
    `<span class="list-tag" draggable="true"` +
    ` ondragstart="listDragStart(event,${a},${idx})"` +
    ` ondragover="listDragOver(event)"` +
    ` ondragleave="listDragLeave(event)"` +
    ` ondrop="listDrop(event,${a},${idx})"` +
    ` ondragend="listDragEnd(event,${a})"` +
    `>${esc(item)}<button class="list-tag-del" onclick="removeListItem(${a},${idx})" title="Удалить">×</button></span>`
  ).join('');
}

function refreshListDOM(scope, ti, oi, pi) {
  const tagsDiv = document.getElementById(`lt-${scope}-${ti}-${oi}-${pi}`);
  if (!tagsDiv) return;
  const items = (getParams(scope, ti, oi)[pi].defaultVal || '').split(';').filter(Boolean);
  tagsDiv.innerHTML = buildListChips(scope, ti, oi, pi, items);
}

function addListItem(scope, ti, oi, pi, inputEl) {
  const val = inputEl.value.trim();
  if (!val) return;
  const p = getParams(scope, ti, oi)[pi];
  const items = (p.defaultVal || '').split(';').filter(Boolean);
  items.push(val);
  p.defaultVal = items.join(';');
  inputEl.value = '';
  refreshListDOM(scope, ti, oi, pi);
  scheduleGen(false);
}

function buildNormTableChips(ti, oi, items) {
  return items.map((item, idx) =>
    `<span class="list-tag" draggable="true"` +
    ` ondragstart="ntDragStart(event,${ti},${oi},${idx})"` +
    ` ondragover="ntDragOver(event)"` +
    ` ondragleave="ntDragLeave(event)"` +
    ` ondrop="ntDrop(event,${ti},${oi},${idx})"` +
    ` ondragend="ntDragEnd(event,${ti},${oi})"` +
    `>${esc(item)}<button class="list-tag-del" onclick="removeNormTable(${ti},${oi},${idx})" title="Удалить">×</button></span>`
  ).join('');
}

function refreshNormTablesDOM(ti, oi) {
  const el = document.getElementById(`nt-${ti}-${oi}`);
  if (!el) return;
  const items = schema[ti].operations[oi].normTables || [];
  el.innerHTML = buildNormTableChips(ti, oi, items);
  const tag = document.getElementById(`nt-tag-${ti}-${oi}`);
  if (tag) tag.textContent = items.length;
}

function addNormTable(ti, oi, inputEl) {
  const val = inputEl.value.trim();
  if (!val) return;
  const op = schema[ti].operations[oi];
  if (!op.normTables) op.normTables = [];
  op.normTables.push(val);
  inputEl.value = '';
  refreshNormTablesDOM(ti, oi);
  scheduleGen(false);
}

function removeNormTable(ti, oi, idx) {
  const op = schema[ti].operations[oi];
  if (!op.normTables) return;
  op.normTables.splice(idx, 1);
  refreshNormTablesDOM(ti, oi);
  scheduleGen(false);
}

function buildDocumentChips(ti, oi, items) {
  return items.map((item, idx) =>
    `<span class="list-tag" draggable="true"` +
    ` ondragstart="docDragStart(event,${ti},${oi},${idx})"` +
    ` ondragover="docDragOver(event)"` +
    ` ondragleave="docDragLeave(event)"` +
    ` ondrop="docDrop(event,${ti},${oi},${idx})"` +
    ` ondragend="docDragEnd(event,${ti},${oi})"` +
    `>${esc(item)}<button class="list-tag-del" onclick="removeDocument(${ti},${oi},${idx})" title="Удалить">×</button></span>`
  ).join('');
}

function refreshDocumentsDOM(ti, oi) {
  const el = document.getElementById(`doc-${ti}-${oi}`);
  if (!el) return;
  const items = schema[ti].operations[oi].documents || [];
  el.innerHTML = buildDocumentChips(ti, oi, items);
  const tag = document.getElementById(`doc-tag-${ti}-${oi}`);
  if (tag) tag.textContent = items.length;
}

function addDocument(ti, oi, inputEl) {
  const val = inputEl.value.trim();
  if (!val) return;
  const op = schema[ti].operations[oi];
  if (!op.documents) op.documents = [];
  op.documents.push(val);
  inputEl.value = '';
  refreshDocumentsDOM(ti, oi);
  scheduleGen(false);
}

function removeDocument(ti, oi, idx) {
  const op = schema[ti].operations[oi];
  if (!op.documents) return;
  op.documents.splice(idx, 1);
  refreshDocumentsDOM(ti, oi);
  scheduleGen(false);
}

function getListValuesForCode(code) {
  const values = new Set();
  schema.forEach(type => {
    type.paramSets.forEach(ps => ps.params.forEach(p => {
      if (p.code === code && p.type === 'List')
        (p.defaultVal || '').split(';').filter(Boolean).forEach(v => values.add(v));
    }));
    type.operations.forEach(op => op.params.forEach(p => {
      if (p.code === code && p.type === 'List')
        (p.defaultVal || '').split(';').filter(Boolean).forEach(v => values.add(v));
    }));
  });
  return [...values];
}

function getAllParamMap() {
  const map = new Map(); // code → type
  schema.forEach(type => {
    type.paramSets.forEach(ps => ps.params.forEach(p => { if (p.code) map.set(p.code, p.type); }));
    type.operations.forEach(op => op.params.forEach(p => { if (p.code) map.set(p.code, p.type); }));
  });
  return map;
}

function removeListItem(scope, ti, oi, pi, idx) {
  const p = getParams(scope, ti, oi)[pi];
  const items = (p.defaultVal || '').split(';').filter(Boolean);
  items.splice(idx, 1);
  p.defaultVal = items.join(';');
  refreshListDOM(scope, ti, oi, pi);
  scheduleGen(false);
}
