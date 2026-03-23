// ---- Type DnD ----
let _typeDrag = null;
function typeDragStart(e, ti) {
  _typeDrag = ti; e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
}
function typeDragOver(e, ti) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget; el.classList.remove('drag-over-top','drag-over-bottom');
  el._tdPos = e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 ? 'before' : 'after';
  el.classList.add(el._tdPos === 'before' ? 'drag-over-top' : 'drag-over-bottom');
}
function typeDragLeave(e) { e.currentTarget.classList.remove('drag-over-top','drag-over-bottom'); }
function typeDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.type-header.drag-over-top,.type-header.drag-over-bottom').forEach(el => el.classList.remove('drag-over-top','drag-over-bottom'));
  _typeDrag = null;
}
function typeDrop(e, toTi) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over-top','drag-over-bottom');
  if (_typeDrag === null) return;
  const fromTi = _typeDrag;
  const insertAt = e.currentTarget._tdPos === 'after' ? toTi + 1 : toTi;
  if (fromTi === insertAt || fromTi + 1 === insertAt) return;
  const [moved] = schema.splice(fromTi, 1);
  const finalAt = insertAt > fromTi ? insertAt - 1 : insertAt;
  schema.splice(finalAt, 0, moved);
  if (sel) sel.ti = adjustIdx(sel.ti, fromTi, finalAt);
  const newExp = new Set(); expandedTypes.forEach(i => newExp.add(adjustIdx(i, fromTi, finalAt))); expandedTypes = newExp;
  renderAll(true);
}

// ---- Op DnD ----
let _opDrag = null;
function opDragStart(e, ti, oi) {
  _opDrag = { ti, oi }; e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
}
function opDragOver(e, ti, oi) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget; el.classList.remove('drag-over-top','drag-over-bottom');
  el._odPos = e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 ? 'before' : 'after';
  el.classList.add(el._odPos === 'before' ? 'drag-over-top' : 'drag-over-bottom');
}
function opDragLeave(e) { e.currentTarget.classList.remove('drag-over-top','drag-over-bottom'); }
function opDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.op-item.drag-over-top,.op-item.drag-over-bottom').forEach(el => el.classList.remove('drag-over-top','drag-over-bottom'));
  _opDrag = null;
}
function opDrop(e, ti, toOi) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over-top','drag-over-bottom');
  if (!_opDrag || _opDrag.ti !== ti) return;
  const fromOi = _opDrag.oi;
  const insertAt = e.currentTarget._odPos === 'after' ? toOi + 1 : toOi;
  if (fromOi === insertAt || fromOi + 1 === insertAt) return;
  const ops = schema[ti].operations;
  const [moved] = ops.splice(fromOi, 1);
  const finalAt = insertAt > fromOi ? insertAt - 1 : insertAt;
  ops.splice(finalAt, 0, moved);
  if (sel && sel.kind === 'op' && sel.ti === ti) sel.oi = adjustIdx(sel.oi, fromOi, finalAt);
  renderAll(true);
}

// ---- Param DnD ----
let _paramDrag = null;
let _paramGripDown = false;
document.addEventListener('mouseup', () => { _paramGripDown = false; });

function paramGripMouseDown() { _paramGripDown = true; }

// ---- Protocol Line DnD ----
let _protoDrag = null;
let _protoGripDown = false;
document.addEventListener('mouseup', () => { _protoGripDown = false; });

function protoGripMouseDown() { _protoGripDown = true; }

function protoDragStart(e, ti, oi, li) {
  if (!_protoGripDown) { e.preventDefault(); return; }
  _protoGripDown = false;
  _protoDrag = { ti, oi, li };
  e.dataTransfer.effectAllowed = 'move';
  const el = e.currentTarget;
  setTimeout(() => el.classList.add('param-dragging'), 0);
}
function protoDragOver(e, li) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget;
  el.classList.remove('param-drag-top', 'param-drag-bottom');
  el._prPos = e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 ? 'before' : 'after';
  el.classList.add(el._prPos === 'before' ? 'param-drag-top' : 'param-drag-bottom');
}
function protoDragLeave(e) { e.currentTarget.classList.remove('param-drag-top', 'param-drag-bottom'); }
function protoDragEnd(e) {
  const el = e.currentTarget;
  if (el) el.classList.remove('param-dragging');
  document.querySelectorAll('.proto-line-row.param-drag-top,.proto-line-row.param-drag-bottom').forEach(el => el.classList.remove('param-drag-top', 'param-drag-bottom'));
  _protoDrag = null;
}
function protoDrop(e, ti, oi, toLi) {
  e.preventDefault();
  const el = e.currentTarget;
  el.classList.remove('param-drag-top', 'param-drag-bottom');
  if (!_protoDrag) return;
  const fromLi = _protoDrag.li;
  const insertAt = el._prPos === 'after' ? toLi + 1 : toLi;
  if (fromLi === insertAt || fromLi + 1 === insertAt) return;
  const lines = schema[ti].operations[oi].protocol;
  const [moved] = lines.splice(fromLi, 1);
  lines.splice(insertAt > fromLi ? insertAt - 1 : insertAt, 0, moved);
  renderEditor(); scheduleGen(true);
}

function paramDragStart(e, scope, ti, oi, pi) {
  if (!_paramGripDown) { e.preventDefault(); return; }
  _paramGripDown = false;
  _paramDrag = { scope, ti, oi, pi };
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.currentTarget.classList.add('param-dragging'), 0);
}
function paramDragOver(e, pi) {
  if (_listDrag) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const tr = e.currentTarget;
  tr.classList.remove('param-drag-top', 'param-drag-bottom');
  const rect = tr.getBoundingClientRect();
  tr._pdPos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  tr.classList.add(tr._pdPos === 'before' ? 'param-drag-top' : 'param-drag-bottom');
}
function paramDragLeave(e) { e.currentTarget.classList.remove('param-drag-top', 'param-drag-bottom'); }
function paramDragEnd(e) {
  e.currentTarget.classList.remove('param-dragging');
  document.querySelectorAll('.param-drag-top,.param-drag-bottom').forEach(el => el.classList.remove('param-drag-top','param-drag-bottom'));
  _paramDrag = null;
}
function paramDrop(e, scope, ti, oi, toPi) {
  e.preventDefault();
  const tr = e.currentTarget;
  tr.classList.remove('param-drag-top', 'param-drag-bottom');
  if (!_paramDrag) return;
  const fromPi = _paramDrag.pi;
  const insertAt = tr._pdPos === 'after' ? toPi + 1 : toPi;
  if (fromPi === insertAt || fromPi + 1 === insertAt) return;
  const arr = getParams(scope, ti, oi);
  const [moved] = arr.splice(fromPi, 1);
  arr.splice(insertAt > fromPi ? insertAt - 1 : insertAt, 0, moved);
  renderEditor(); scheduleGen(true);
}

// ---- Coef Table DnD (sidebar) ----
let _tableDrag = null;
function tableDragStart(e, idx) {
  _tableDrag = idx; e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
}
function tableDragOver(e, idx) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget; el.classList.remove('drag-over-top','drag-over-bottom');
  el._tdtPos = e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 ? 'before' : 'after';
  el.classList.add(el._tdtPos === 'before' ? 'drag-over-top' : 'drag-over-bottom');
}
function tableDragLeave(e) { e.currentTarget.classList.remove('drag-over-top','drag-over-bottom'); }
function tableDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.table-item.drag-over-top,.table-item.drag-over-bottom').forEach(el => el.classList.remove('drag-over-top','drag-over-bottom'));
  _tableDrag = null;
}
function tableDrop(e, toIdx) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over-top','drag-over-bottom');
  if (_tableDrag === null) return;
  const fromIdx = _tableDrag;
  const insertAt = e.currentTarget._tdtPos === 'after' ? toIdx + 1 : toIdx;
  if (fromIdx === insertAt || fromIdx + 1 === insertAt) return;
  const [moved] = coefTables.splice(fromIdx, 1);
  const finalAt = insertAt > fromIdx ? insertAt - 1 : insertAt;
  coefTables.splice(finalAt, 0, moved);
  if (sel && sel.kind === 'table') sel.idx = adjustIdx(sel.idx, fromIdx, finalAt);
  renderSidebarTables();
  scheduleGen(true);
}

// ---- Coef Table Key DnD ----
let _keyDrag = null;
let _keyGripDown = false;
document.addEventListener('mouseup', () => { _keyGripDown = false; });

function keyGripMouseDown() { _keyGripDown = true; }

function keyDragStart(e, idx, ki) {
  if (!_keyGripDown) { e.preventDefault(); return; }
  _keyGripDown = false;
  _keyDrag = { idx, ki };
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
}
function keyDragOver(e, ki) {
  e.preventDefault();
  const el = e.currentTarget;
  el.classList.remove('drag-over-top', 'drag-over-bottom');
  el._kdPos = e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 ? 'before' : 'after';
  el.classList.add(el._kdPos === 'before' ? 'drag-over-top' : 'drag-over-bottom');
}
function keyDragLeave(e) { e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom'); }
function keyDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.key-row.drag-over-top,.key-row.drag-over-bottom').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
  _keyDrag = null;
}
function keyDrop(e, idx, toKi) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
  if (!_keyDrag) return;
  const fromKi = _keyDrag.ki;
  const insertAt = e.currentTarget._kdPos === 'after' ? toKi + 1 : toKi;
  if (fromKi === insertAt || fromKi + 1 === insertAt) return;
  const tbl = coefTables[idx];
  const [movedKey] = tbl.keys.splice(fromKi, 1);
  const finalAt = insertAt > fromKi ? insertAt - 1 : insertAt;
  tbl.keys.splice(finalAt, 0, movedKey);
  // Reorder corresponding cell in every row
  tbl.rows.forEach(row => {
    const [movedCell] = row.splice(fromKi, 1);
    row.splice(finalAt, 0, movedCell);
  });
  renderEditor();
  scheduleGen(true);
}

// ---- Coef Table Row DnD ----
let _rowDrag = null;
let _rowGripDown = false;
document.addEventListener('mouseup', () => { _rowGripDown = false; });

function rowGripMouseDown() { _rowGripDown = true; }

function rowDragStart(e, idx, ri) {
  if (!_rowGripDown) { e.preventDefault(); return; }
  _rowGripDown = false;
  _rowDrag = { idx, ri };
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.currentTarget.classList.add('param-dragging'), 0);
}
function rowDragOver(e, ri) {
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget;
  el.classList.remove('param-drag-top', 'param-drag-bottom');
  el._rdPos = e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 ? 'before' : 'after';
  el.classList.add(el._rdPos === 'before' ? 'param-drag-top' : 'param-drag-bottom');
}
function rowDragLeave(e) { e.currentTarget.classList.remove('param-drag-top', 'param-drag-bottom'); }
function rowDragEnd(e) {
  e.currentTarget.classList.remove('param-dragging');
  document.querySelectorAll('tr.param-drag-top,tr.param-drag-bottom').forEach(el => el.classList.remove('param-drag-top', 'param-drag-bottom'));
  _rowDrag = null;
}
function rowDrop(e, idx, toRi) {
  e.preventDefault();
  const el = e.currentTarget;
  el.classList.remove('param-drag-top', 'param-drag-bottom');
  if (!_rowDrag || _rowDrag.idx !== idx) return;
  const fromRi = _rowDrag.ri;
  const insertAt = el._rdPos === 'after' ? toRi + 1 : toRi;
  if (fromRi === insertAt || fromRi + 1 === insertAt) return;
  const rows = coefTables[idx].rows;
  const [moved] = rows.splice(fromRi, 1);
  rows.splice(insertAt > fromRi ? insertAt - 1 : insertAt, 0, moved);
  renderEditor();
  scheduleGen(true);
}

// ---- List DnD ----
let _listDrag = null;
function listDragStart(e, scope, ti, oi, pi, idx) {
  e.stopPropagation();
  _listDrag = { scope, ti, oi, pi, idx };
  e.dataTransfer.setData('text', '');
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.target.classList.add('dragging'), 0);
}
function listDragOver(e) { e.stopPropagation(); e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drag-over'); }
function listDragLeave(e) { e.stopPropagation(); e.currentTarget.classList.remove('drag-over'); }
function listDragEnd(e, scope, ti, oi, pi) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.list-tag.drag-over').forEach(el => el.classList.remove('drag-over'));
  _listDrag = null;
}
function listDrop(e, scope, ti, oi, pi, toIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_listDrag || _listDrag.idx === toIdx) return;
  const p = getParams(scope, ti, oi)[pi];
  const items = (p.defaultVal || '').split(';').filter(Boolean);
  const [moved] = items.splice(_listDrag.idx, 1);
  items.splice(toIdx, 0, moved);
  p.defaultVal = items.join(';');
  refreshListDOM(scope, ti, oi, pi);
  scheduleGen(false);
}

// ---- NormTable chip DnD ----
let _ntDrag = null;
function ntDragStart(e, ti, oi, idx) {
  _ntDrag = { ti, oi, idx };
  e.dataTransfer.setData('text', '');
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.target.classList.add('dragging'), 0);
}
function ntDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drag-over'); }
function ntDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function ntDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.list-tag.drag-over').forEach(el => el.classList.remove('drag-over'));
  _ntDrag = null;
}
function ntDrop(e, ti, oi, toIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_ntDrag || _ntDrag.ti !== ti || _ntDrag.oi !== oi || _ntDrag.idx === toIdx) return;
  const items = schema[ti].operations[oi].normTables;
  const [moved] = items.splice(_ntDrag.idx, 1);
  items.splice(toIdx, 0, moved);
  refreshNormTablesDOM(ti, oi);
  scheduleGen(false);
}
