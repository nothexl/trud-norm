function selectType(ti) {
  sel = { kind:'type', ti };
  expandedTypes.add(ti); // auto-expand on navigate, never collapse on click
  renderSidebar(); renderSidebarTables(); renderEditor();
}

function toggleTypeExpand(ti, e) {
  e.stopPropagation();
  if (expandedTypes.has(ti)) { expandedTypes.delete(ti); } else { expandedTypes.add(ti); }
  renderSidebar();
}
function selectOp(ti, oi) { sel = { kind:'op', ti, oi }; expandedTypes.add(ti); renderSidebar(); renderSidebarTables(); renderEditor(); refreshEditorErrors(); }

function addType() {
  schema.push({ name: 'Новый тип', paramSets: [], operations: [] });
  const ti = schema.length - 1;
  sel = { kind:'type', ti };
  expandedTypes.add(ti);
  renderAll(true);
}
function duplicateType(ti) {
  const copy = JSON.parse(JSON.stringify(schema[ti]));
  schema.splice(ti + 1, 0, copy);
  const newExp = new Set();
  expandedTypes.forEach(i => newExp.add(i <= ti ? i : i + 1));
  newExp.add(ti + 1);
  expandedTypes = newExp;
  sel = { kind: 'type', ti: ti + 1 };
  renderAll(true);
}
function deleteType(ti) {
  if (!confirm(`Удалить тип «${schema[ti].name}»?`)) return;
  schema.splice(ti, 1);
  sel = null;
  const newExp = new Set();
  expandedTypes.forEach(idx => { if (idx < ti) newExp.add(idx); else if (idx > ti) newExp.add(idx - 1); });
  expandedTypes = newExp;
  renderAll(true);
}

function addOp(ti) {
  const ops = schema[ti].operations;
  let prefix = 'O';
  for (const op of ops) {
    const m = /^(.+)_\d+$/.exec(op.code);
    if (m) { prefix = m[1]; break; }
  }
  const usedCodes = new Set(ops.map(op => op.code));
  let n = ops.length + 1;
  while (usedCodes.has(`${prefix}_${n}`)) n++;
  ops.push({ name: 'Новая операция', shts: '', prof: '', code: `${prefix}_${n}`, params: [], formula: '', protocol: [], normTables: [] });
  sel = { kind:'op', ti, oi: ops.length - 1 };
  expandedTypes.add(ti);
  renderAll(true);
}
function deleteOp(ti, oi) {
  if (!confirm(`Удалить операцию «${schema[ti].operations[oi].name}»?`)) return;
  schema[ti].operations.splice(oi, 1);
  sel = { kind:'type', ti };
  renderAll(true);
}

function duplicateOp(ti, oi) {
  const src = schema[ti].operations[oi];
  const usedCodes = new Set(schema[ti].operations.map(op => op.code));
  let newCode = src.code;
  let n = 2;
  while (usedCodes.has(newCode)) { newCode = src.code.replace(/_\d+$/, '') + '_' + n++; }
  const copy = JSON.parse(JSON.stringify(src));
  copy.code = newCode;
  schema[ti].operations.splice(oi + 1, 0, copy);
  sel = { kind:'op', ti, oi: oi + 1 };
  expandedTypes.add(ti);
  renderAll(true);
}

function addParamSet(ti) {
  if (schema[ti].paramSets.length >= 5) return;
  const usedNames = new Set(schema[ti].paramSets.map(ps => ps.name));
  let n = 1;
  while (usedNames.has(`Новый набор (${n})`)) n++;
  schema[ti].paramSets.push({ name: `Новый набор (${n})`, params: [] });
  const si = schema[ti].paramSets.length - 1;
  sel = { kind: 'type', ti, si };
  renderAll(true);
}
function deleteParamSet(ti, si) {
  if (!confirm('Удалить набор параметров?')) return;
  schema[ti].paramSets.splice(si, 1);
  sel = { kind: 'type', ti };
  renderEditor(); scheduleGen(true);
}
function duplicateParamSet(ti, si) {
  if (schema[ti].paramSets.length >= 5) return;
  const src = schema[ti].paramSets[si];
  schema[ti].paramSets.splice(si + 1, 0, {
    name: src.name ? src.name + ' (копия)' : '',
    params: src.params.map(p => ({ ...p }))
  });
  renderEditor(); scheduleGen(true);
}
function updateParamSetName(ti, si, val) {
  schema[ti].paramSets[si].name = val;
  const dupNames = getDupSetNames(schema[ti].paramSets);
  const inp = document.getElementById('fld-set-name');
  if (inp) inp.classList.toggle('err', !val || dupNames.has(val));
  renderValidationBanner();
  scheduleGen(false);
}
function openParamSet(ti, si) {
  sel = { kind: 'type', ti, si };
  renderEditor();
}
function backToSets(ti) {
  sel = { kind: 'type', ti };
  renderEditor();
}

function addParam(scope, ti, oi) {
  const params = getParams(scope, ti, oi);
  const used = new Set(params.map(p => p.code));
  let n = 1;
  while (used.has('OP_' + n)) n++;
  params.push({ name: '', code: 'OP_' + n, type: 'Integer', defaultVal: '0' });
  renderEditor(); scheduleGen(true);
}
function deleteParam(scope, ti, oi, pi) {
  getParams(scope, ti, oi).splice(pi, 1);
  renderEditor(); scheduleGen(true);
}

function updateParamType(scope, ti, oi, pi, val) {
  const p = getParams(scope, ti, oi)[pi];
  p.type = val;
  const defs = { List:'', String:'', Integer:'0', Float:'0.0', Date:'', Boolean:'False' };
  p.defaultVal = defs[val] || '';
  renderEditor(); scheduleGen(true);
}

function updateTypeName(ti, val) {
  schema[ti].name = val;
  renderSidebar();
  scheduleGen(false);
}

function updateOpFormula(ti, oi, val) {
  schema[ti].operations[oi].formula = val;
  scheduleGen(false);
}

function insertFnAtActive(fn) {
  const el = document.getElementById('fld-formula');
  if (!el) return;
  const s = el.selectionStart, e = el.selectionEnd;
  const selected = el.value.slice(s, e);
  let insert, cursor;
  if (fn === 'Round') {
    if (selected) {
      insert = 'Round(' + selected + ', 4)';
      cursor = s + insert.length;
    } else {
      insert = 'Round(, 4)';
      cursor = s + 6; // cursor inside: Round(|, 4)
    }
  } else {
    insert = fn + '(' + selected + ')';
    cursor = selected ? s + insert.length : s + fn.length + 1; // cursor inside if empty
  }
  el.value = el.value.slice(0, s) + insert + el.value.slice(e);
  el.selectionStart = el.selectionEnd = cursor;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertAtActive(text) {
  const el = document.activeElement;
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
  const s = el.selectionStart, e = el.selectionEnd;
  el.value = el.value.slice(0, s) + text + el.value.slice(e);
  el.selectionStart = el.selectionEnd = s + text.length;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

// ---- Formula test modal ----
let _ftCtx = null;

function makeParamInput(id, pType, defVal) {
  if (pType === 'List') {
    const opts = (defVal || '').split(';').filter(Boolean);
    return `<select id="${id}" class="ft-input">${opts.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
  }
  if (pType === 'Boolean') return `<select id="${id}" class="ft-input"><option value="-1">True</option><option value="0">False</option></select>`;
  if (pType === 'Integer') return `<input type="number" step="1" id="${id}" class="ft-input" value="${parseInt(defVal) || 0}">`;
  const fv = parseFloat(defVal);
  return `<input type="number" step="0.01" id="${id}" class="ft-input" value="${isNaN(fv) ? 0 : fv}">`;
}

function evalSubFormula(formula, idPrefix) {
  const values = {};
  const errors = [];
  [...formula.matchAll(/\{([^}]+)\}/g)].forEach(m => {
    const ph = m[1];
    if (values[ph] !== undefined) return;
    const safeId = idPrefix + ph.replace(/[^a-zA-Z0-9]/g, '_');
    if (ph.startsWith('p.')) {
      // Always read from top-level shared param input (not sub-prefixed)
      const el = document.getElementById('ft_' + ph.replace(/[^a-zA-Z0-9]/g, '_'));
      values[ph] = el ? el.value : '0';
      return;
    }
    if (ph.startsWith('K.')) {
      const tableCode = ph.slice(2);
      const tbl = coefTables.find(t => t.code === tableCode);
      if (!tbl || tbl.keys.length === 0) {
        const el = document.getElementById(safeId);
        values[ph] = el ? el.value : '0';
      } else {
        const keyValues = tbl.keys.map((key, ki) => {
          const paramEl = document.getElementById('ft_p_' + key.replace(/[^a-zA-Z0-9]/g, '_'));
          if (paramEl) return paramEl.value;
          const kEl = document.getElementById(`${safeId}_k${ki}`);
          return kEl ? kEl.value : '0';
        });
        const found = lookupCoefTable(tableCode, keyValues);
        if (found === null || found === undefined || found === '') {
          errors.push(`{${ph}}: значение не найдено в таблице «${esc(tbl.name || tbl.code)}»`);
          values[ph] = '0';
        } else {
          values[ph] = found;
        }
      }
      return;
    }
    const el = document.getElementById(safeId);
    values[ph] = el ? el.value : '0';
  });
  if (errors.length > 0) return { value: null, error: errors.join('; ') };
  let display = formula;
  for (const [ph, val] of Object.entries(values)) {
    display = display.replace(new RegExp('\\{' + ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'g'), val);
  }
  try {
    const expr = display
      .replace(/\^/g, '**').replace(/\bMod\b/g, '%')
      .replace(/\bAbs\b/g, 'Math.abs').replace(/\bInt\b/g, 'Math.floor')
      .replace(/\bFix\b/g, 'Math.trunc').replace(/\bSqr\b/g, 'Math.sqrt')
      .replace(/\bExp\b/g, 'Math.exp').replace(/\bLog\b/g, 'Math.log')
      .replace(/\bSin\b/g, 'Math.sin').replace(/\bCos\b/g, 'Math.cos')
      .replace(/\bTan\b/g, 'Math.tan').replace(/\bRound\b/g, 'VbsRound')
      .replace(/\\/g, '/');
    const result = new Function('return ' + expr)();
    if (typeof result !== 'number' || !isFinite(result)) throw new Error('Результат не является числом');
    return { value: result };
  } catch(e) {
    return { value: null, error: e.message };
  }
}

function VbsRound(x, n) {
  const f = Math.pow(10, n === undefined ? 0 : n);
  return Math.round(x * f) / f;
}

function openFormulaTest(ti, oi) {
  const type = schema[ti];
  const op = type.operations[oi];
  const formula = op.formula.trim();
  if (!formula) { alert('Формула пуста'); return; }
  const fe = _fieldErrors[`${ti}:${oi}`];
  if (fe && fe.formula) { alert('Исправьте ошибки в формуле перед проверкой.'); return; }
  _ftCtx = { ti, oi };

  const paramTypes = new Map(), paramDefaults = new Map();
  type.paramSets.forEach(ps => ps.params.forEach(p => {
    if (p.code) { paramTypes.set(p.code, p.type); paramDefaults.set(p.code, p.defaultVal || '0'); }
  }));
  op.params.forEach(p => {
    if (p.code) { paramTypes.set(p.code, p.type); paramDefaults.set(p.code, p.defaultVal || '0'); }
  });
  // Merge params from all sub-ops referenced in this formula
  [...formula.matchAll(/\{op\.([^}]+)\}/g)].forEach(m => {
    const refOp = type.operations.find(o => o.code === m[1]);
    if (refOp) refOp.params.forEach(p => { if (p.code && !paramTypes.has(p.code)) { paramTypes.set(p.code, p.type); paramDefaults.set(p.code, p.defaultVal || '0'); } });
  });

  const seen = new Set();
  const phs = [];
  [...formula.matchAll(/\{([^}]+)\}/g)].forEach(m => { if (!seen.has(m[1])) { seen.add(m[1]); phs.push(m[1]); } });

  // Collect ALL {p.} codes from main formula + all referenced sub-op formulas (deduplicated, main-first)
  const allParamSeen = new Set(), allParamCodes = [];
  phs.forEach(ph => { if (ph.startsWith('p.') && !allParamSeen.has(ph.slice(2))) { allParamSeen.add(ph.slice(2)); allParamCodes.push(ph.slice(2)); } });
  phs.filter(ph => ph.startsWith('op.')).forEach(ph => {
    const refOp = type.operations.find(o => o.code === ph.slice(3));
    if (refOp && refOp.formula.trim())
      [...refOp.formula.matchAll(/\{p\.([^}]+)\}/g)].forEach(m => { if (!allParamSeen.has(m[1])) { allParamSeen.add(m[1]); allParamCodes.push(m[1]); } });
  });

  // Shared param rows (shown once at top)
  const paramRows = allParamCodes.map(code => {
    const sid = 'ft_p_' + code.replace(/[^a-zA-Z0-9]/g, '_');
    return `<div class="ft-row"><label class="ft-label">{p.${esc(code)}}</label>${makeParamInput(sid, paramTypes.get(code) || 'Float', paramDefaults.get(code) || '0')}</div>`;
  }).join('');

  const makeKeyInput = (tbl, safeId) => tbl.keys.map((key, ki) => {
    if (allParamSeen.has(key))
      return `<div class="ft-key-row"><span class="ft-key-name">${esc(key)}</span><span class="ft-key-ref">← {p.${esc(key)}}</span></div>`;
    return `<div class="ft-key-row"><span class="ft-key-name">${esc(key)}</span>${makeParamInput(`${safeId}_k${ki}`, paramTypes.get(key) || 'Float', paramDefaults.get(key) || '0')}</div>`;
  }).join('');

  // Non-param rows (K. and op.) — sub-op sections skip {p.} since they're shown above
  const otherRows = phs.filter(ph => !ph.startsWith('p.')).map(ph => {
    const safeId = 'ft_' + ph.replace(/[^a-zA-Z0-9]/g, '_');
    if (ph.startsWith('K.')) {
      const tbl = coefTables.find(t => t.code === ph.slice(2));
      if (!tbl || tbl.keys.length === 0) {
        return `<div class="ft-row"><label class="ft-label">{${esc(ph)}}</label><input type="number" step="any" id="${safeId}" class="ft-input" value="1"></div>`;
      }
      const keyInputs = makeKeyInput(tbl, safeId);
      return `<div class="ft-row ft-row-table">
        <label class="ft-label">{${esc(ph)}}</label>
        <div class="ft-table-inputs">
          <div class="ft-table-title">${esc(tbl.name || tbl.code)}</div>
          ${keyInputs}
        </div>
      </div>`;
    }
    if (ph.startsWith('op.')) {
      const opCode = ph.slice(3);
      const refOp = type.operations.find(o => o.code === opCode);
      if (!refOp || !refOp.formula.trim()) {
        return `<div class="ft-row"><label class="ft-label">{${esc(ph)}}</label><input type="number" step="any" id="${safeId}" class="ft-input" value="1" placeholder="результат операции"></div>`;
      }
      const subSeen = new Set(), subPhs = [];
      [...refOp.formula.matchAll(/\{([^}]+)\}/g)].forEach(m => { if (!subSeen.has(m[1])) { subSeen.add(m[1]); subPhs.push(m[1]); } });
      // Only K. items — {p.} are already shown above
      const subInputs = subPhs.filter(sp => !sp.startsWith('p.')).map(subPh => {
        const subId = `${safeId}_${subPh.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (subPh.startsWith('K.')) {
          const subTbl = coefTables.find(t => t.code === subPh.slice(2));
          if (!subTbl || subTbl.keys.length === 0) {
            return `<div class="ft-key-row"><span class="ft-key-name">{${esc(subPh)}}</span><input type="number" step="any" id="${subId}" class="ft-input" value="1"></div>`;
          }
          const kInputs = makeKeyInput(subTbl, subId);
          return `<div class="ft-key-row ft-key-row-nested"><span class="ft-key-name">{${esc(subPh)}}</span><div class="ft-table-inputs">${kInputs}</div></div>`;
        }
        return '';
      }).filter(Boolean).join('');
      return `<div class="ft-row ft-row-table">
        <label class="ft-label">{${esc(ph)}}</label>
        <div class="ft-table-inputs">
          <div class="ft-table-title">${esc(refOp.name || opCode)}</div>
          ${subInputs || '<span class="ft-table-title">Нет параметров</span>'}
        </div>
      </div>`;
    }
    return '';
  }).filter(Boolean).join('');

  const rows = paramRows + otherRows;

  const overlay = document.createElement('div');
  overlay.id = 'ft-overlay';
  overlay.className = 'ft-overlay';
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) closeFormulaTest(); });
  overlay.innerHTML = `
    <div class="ft-modal">
      <div class="ft-header">
        <span class="ft-title">Проверка формулы</span>
        <button class="ft-close-btn" onclick="closeFormulaTest()">✕</button>
      </div>
      <div class="ft-formula-box">${esc(formula)}</div>
      <div class="ft-fields">${rows || '<div class="ft-empty">Нет параметров в формуле</div>'}</div>
      <div class="ft-actions"><button class="btn-primary" onclick="runFormulaTest()">Рассчитать</button></div>
      <div id="ft-result"></div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeFormulaTest(); });
  overlay.setAttribute('tabindex', '-1');
  overlay.focus();
}

function closeFormulaTest() {
  const el = document.getElementById('ft-overlay');
  if (el) el.remove();
  _ftCtx = null;
}

function matchCoefKey(pattern, value) {
  const p = (pattern || '').trim();
  if (p === '*') return true;
  const num = parseFloat(value);
  const ltM = /^<([\d.]+)$/.exec(p);   if (ltM)  return num < parseFloat(ltM[1]);
  const lteM = /^<=([\d.]+)$/.exec(p); if (lteM) return num <= parseFloat(lteM[1]);
  const gtM = /^>([\d.]+)$/.exec(p);   if (gtM)  return num > parseFloat(gtM[1]);
  const gteM = /^>=([\d.]+)$/.exec(p); if (gteM) return num >= parseFloat(gteM[1]);
  const rangeM = /^([\d.]+)\.\.([\d.]+)$/.exec(p); if (rangeM) return num >= parseFloat(rangeM[1]) && num <= parseFloat(rangeM[2]);
  return p === String(value).trim();
}

function lookupCoefTable(tableCode, keyValues) {
  const tbl = coefTables.find(t => t.code === tableCode);
  if (!tbl) return null;
  for (const row of tbl.rows) {
    let match = true;
    for (let ki = 0; ki < tbl.keys.length; ki++) {
      if (!matchCoefKey(row[ki], keyValues[ki])) { match = false; break; }
    }
    if (match) return row[tbl.keys.length] !== undefined ? row[tbl.keys.length] : null;
  }
  return null;
}

function runFormulaTest() {
  if (!_ftCtx) return;
  const formula = schema[_ftCtx.ti].operations[_ftCtx.oi].formula;

  const values = {};
  const errors = [];
  [...formula.matchAll(/\{([^}]+)\}/g)].forEach(m => {
    const ph = m[1];
    if (values[ph] !== undefined) return;
    const safeId = 'ft_' + ph.replace(/[^a-zA-Z0-9]/g, '_');
    if (ph.startsWith('K.')) {
      const tableCode = ph.slice(2);
      const tbl = coefTables.find(t => t.code === tableCode);
      if (!tbl || tbl.keys.length === 0) {
        const el = document.getElementById(safeId);
        values[ph] = el ? el.value : '0';
      } else {
        const keyValues = tbl.keys.map((key, ki) => {
          const paramEl = document.getElementById('ft_p_' + key.replace(/[^a-zA-Z0-9]/g, '_'));
          if (paramEl) return paramEl.value;
          const kid = document.getElementById(`${safeId}_k${ki}`);
          return kid ? kid.value : '0';
        });
        const found = lookupCoefTable(tableCode, keyValues);
        if (found === null || found === undefined || found === '') {
          errors.push(`{${ph}}: значение не найдено в таблице «${esc(tbl.name || tbl.code)}» для заданных ключей`);
          values[ph] = '0';
        } else {
          values[ph] = found;
        }
      }
      return;
    }
    if (ph.startsWith('op.')) {
      const opCode = ph.slice(3);
      const refOp = schema[_ftCtx.ti].operations.find(o => o.code === opCode);
      if (refOp && refOp.formula.trim()) {
        const subResult = evalSubFormula(refOp.formula, `${safeId}_`);
        if (subResult.value === null) {
          errors.push(`{${ph}} (операция «${esc(refOp.name || opCode)}»): ${subResult.error}`);
          values[ph] = '0';
        } else {
          values[ph] = String(subResult.value);
        }
        return;
      }
    }
    const el = document.getElementById(safeId);
    values[ph] = el ? el.value : '0';
  });

  if (errors.length > 0) {
    document.getElementById('ft-result').innerHTML =
      `<div class="ft-error">${errors.map(e => esc(e)).join('<br>')}</div>`;
    return;
  }

  let display = formula;
  for (const [ph, val] of Object.entries(values)) {
    display = display.replace(new RegExp('\\{' + ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'g'), val);
  }

  let result;
  try {
    const expr = display
      .replace(/\^/g, '**')
      .replace(/\bMod\b/g, '%')
      .replace(/\bAbs\b/g, 'Math.abs')
      .replace(/\bInt\b/g, 'Math.floor')
      .replace(/\bFix\b/g, 'Math.trunc')
      .replace(/\bSqr\b/g, 'Math.sqrt')
      .replace(/\bExp\b/g, 'Math.exp')
      .replace(/\bLog\b/g, 'Math.log')
      .replace(/\bSin\b/g, 'Math.sin')
      .replace(/\bCos\b/g, 'Math.cos')
      .replace(/\bTan\b/g, 'Math.tan')
      .replace(/\bRound\b/g, 'VbsRound')
      .replace(/\\/g, '/');
    result = new Function('return ' + expr)();
    if (typeof result !== 'number' || !isFinite(result)) throw new Error('Результат не является числом');
  } catch (e) {
    document.getElementById('ft-result').innerHTML =
      `<div class="ft-error">Ошибка вычисления: ${esc(e.message)}</div>`;
    return;
  }

  const rounded = Math.round(result * 1e10) / 1e10;
  document.getElementById('ft-result').innerHTML = `
    <div class="ft-result-box">
      <div class="ft-result-expr">${esc(display)}</div>
      <div class="ft-result-val">= ${rounded}</div>
    </div>`;
}

function applyProtocolTemplate(ti, oi) {
  schema[ti].operations[oi].protocol = [
    'Операция «{NAME}»',
    'Расчёт по нормативу ',
    'Применяемая формула: T =',
    'Расчёт: Т =',
    'Код профессии {PROF}, разряд {SHTS}',
    ''
  ];
  renderEditor(); scheduleGen(true);
}

function addProtocolLine(ti, oi) {
  schema[ti].operations[oi].protocol.push('');
  renderEditor(); scheduleGen(true);
}

function deleteProtocolLine(ti, oi, li) {
  schema[ti].operations[oi].protocol.splice(li, 1);
  renderEditor(); scheduleGen(true);
}

function updateProtocolLine(ti, oi, li, val) {
  schema[ti].operations[oi].protocol[li] = val;
  scheduleGen(false);
}

function updateOp(ti, oi, field, val) {
  if (field === 'code') {
    val = filterCode(val);
    const inp = document.getElementById('fld-op-code');
    if (inp && inp.value !== val) inp.value = val;
  }
  schema[ti].operations[oi][field] = val;
  if (field === 'name' || field === 'code') renderSidebar();
  if (field === 'code') {
    const dupOps = getGlobalDupOpCodes();
    const inp = document.getElementById('fld-op-code');
    if (inp) inp.classList.toggle('err', !val || dupOps.has(val));
  }
  scheduleGen(false);
}

function updateParam(scope, ti, oi, pi, field, val) {
  if (field === 'code') {
    val = filterCode(val).slice(0, 10);
    const inp = document.getElementById(`fld-p-${pi}`);
    if (inp && inp.value !== val) inp.value = val;
  }
  getParams(scope, ti, oi)[pi][field] = val;
  if (field === 'code') {
    const params = getParams(scope, ti, oi);
    const dups = getDupCodes(params);
    params.forEach((p, idx) => {
      const i = document.getElementById(`fld-p-${idx}`);
      if (i) i.classList.toggle('err', !p.code || dups.has(p.code));
    });
    if (scope === 'op') refreshFormulaChips(ti, oi);
  }
  scheduleGen(false);
}

// ============================================================
// COEFFICIENT TABLES
// ============================================================
function selectTable(idx) {
  sel = { kind: 'table', idx };
  renderSidebarTables();
  renderEditor();
}

function addCoefTable() {
  const usedCodes = new Set(coefTables.map(t => t.code));
  let n = 1;
  while (usedCodes.has('K_NEW_' + n)) n++;
  coefTables.push({ name: '', code: 'K_NEW_' + n, defaultVal: 1, keys: [], rows: [] });
  sel = { kind: 'table', idx: coefTables.length - 1 };
  renderSidebarTables();
  renderEditor();
  scheduleGen(true);
}

function duplicateCoefTable(idx) {
  const src = coefTables[idx];
  const usedCodes = new Set(coefTables.map(t => t.code));
  let newCode = src.code;
  let n = 2;
  while (usedCodes.has(newCode)) { newCode = src.code.replace(/_\d+$/, '') + '_' + n++; }
  const copy = JSON.parse(JSON.stringify(src));
  copy.code = newCode;
  coefTables.splice(idx + 1, 0, copy);
  sel = { kind: 'table', idx: idx + 1 };
  renderSidebarTables();
  renderEditor();
  scheduleGen(true);
}

function deleteCoefTable(idx) {
  if (!confirm(`Удалить таблицу «${coefTables[idx].code || coefTables[idx].name}»?`)) return;
  coefTables.splice(idx, 1);
  if (sel && sel.kind === 'table') {
    sel = coefTables.length > 0 ? { kind: 'table', idx: Math.min(idx, coefTables.length - 1) } : null;
  }
  renderSidebarTables();
  renderEditor();
  scheduleGen(true);
}

function updateCoefTableMeta(idx, field, val) {
  coefTables[idx][field] = val;
  renderSidebarTables();
  scheduleGen(false);
}

function updateCoefTableCode(idx, val) {
  val = filterCode(val);
  const inp = document.getElementById(`tbl-code-${idx}`);
  if (inp && inp.value !== val) inp.value = val;
  coefTables[idx].code = val;
  refreshTableCodeDup(idx);
  renderValidationBanner();
  scheduleGen(false);
}

function addTableKey(idx) {
  const tbl = coefTables[idx];
  tbl.keys.push('');
  // Add empty cell to each existing row (before the value cell)
  tbl.rows.forEach(row => row.splice(tbl.keys.length - 1, 0, ''));
  renderEditor();
  scheduleGen(true);
}

function removeTableKey(idx, ki) {
  const tbl = coefTables[idx];
  tbl.keys.splice(ki, 1);
  tbl.rows.forEach(row => row.splice(ki, 1));
  renderEditor();
  scheduleGen(true);
}

function updateTableKey(idx, ki, val) {
  val = filterCode(val);
  const inp = document.getElementById(`tbl-key-${idx}-${ki}`);
  if (inp && inp.value !== val) inp.value = val;
  coefTables[idx].keys[ki] = val;
  // Update column header
  const ths = document.querySelectorAll('.coef-table thead th');
  if (ths[ki]) ths[ki].textContent = val || '?';
  // Re-render cells in this column (type may have changed, e.g. List ↔ text)
  refreshTableColumn(idx, ki);
  refreshKeyDups(idx);
  renderValidationBanner();
  scheduleGen(false);
}

function refreshTableColumn(idx, ki) {
  const tbl = coefTables[idx];
  const tbody = document.getElementById(`coef-tbody-${idx}`);
  if (!tbody) return;
  const allParamMap = getAllParamMap();
  const keyCode = tbl.keys[ki];
  const isList = allParamMap.get(keyCode) === 'List';
  const listVals = isList ? getListValuesForCode(keyCode) : [];
  tbody.querySelectorAll('tr').forEach((tr, ri) => {
    const td = tr.cells[ki];
    if (!td) return;
    const cur = tbl.rows[ri][ki] || '';
    if (isList) {
      const options = `<option value="">—</option>` +
        listVals.map(v => `<option value="${v}"${cur === v ? ' selected' : ''}>${v}</option>`).join('');
      td.innerHTML = `<select onchange="updateTableCell(${idx},${ri},${ki},this.value)">${options}</select>`;
    } else {
      td.innerHTML = `<input type="text" value="${cur}" oninput="updateTableCell(${idx},${ri},${ki},this.value)" placeholder="${keyCode}">`;
    }
  });
}

function addTableRow(idx) {
  const tbl = coefTables[idx];
  // keys.length key cells + 1 value cell
  tbl.rows.push(Array(tbl.keys.length + 1).fill(''));
  renderEditor();
  scheduleGen(true);
}

function removeTableRow(idx, ri) {
  coefTables[idx].rows.splice(ri, 1);
  renderEditor();
  scheduleGen(true);
}

function updateTableCell(idx, ri, ci, val) {
  coefTables[idx].rows[ri][ci] = val;
  refreshTableDups(idx);     // immediate row highlighting
  renderValidationBanner();  // immediate banner update
  scheduleGen(false);        // debounced code generation
}

function togglePanel() {
  panelVisible = !panelVisible;
  applyLayout();
  document.getElementById('btnTogglePanel').textContent = panelVisible ? 'Скрыть код' : 'Показать код';
  document.getElementById('btnTogglePanel').classList.toggle('active', panelVisible);
}

function setPanelPos(pos) {
  panelPos = pos;
  if (!panelVisible) {
    panelVisible = true;
    document.getElementById('btnTogglePanel').textContent = 'Скрыть код';
    document.getElementById('btnTogglePanel').classList.add('active');
  }
  applyLayout();
  document.getElementById('cpBtnBottom').classList.toggle('active-pos', pos === 'bottom');
  document.getElementById('cpBtnRight').classList.toggle('active-pos', pos === 'right');
}

function applyLayout() {
  const wa = document.getElementById('workArea');
  const panel = document.getElementById('codePanel');
  if (!panelVisible) {
    wa.className = 'work-area layout-hidden';
    return;
  }
  wa.className = 'work-area layout-' + panelPos;
  if (panelPos === 'bottom') {
    panel.style.height = panelSize + 'px';
    panel.style.width = '';
  } else {
    panel.style.width = panelSize + 'px';
    panel.style.height = '';
  }
}

function loadExample() {
  schema = [
    {
      name: "Труба",
      paramSets: [
        {
          name: "Базовые",
          params: [
            { name: "Кол-во резов, шт.", code: "C_CUTS", type: "Integer", defaultVal: "0" },
            { name: "Материал", code: "MATERIAL", type: "List", defaultVal: "Коррозионно-стойкая сталь;Легированная сталь;Медь МЗр;Углеродистая сталь" },
            { name: "Диаметр трубы, мм", code: "DN_DY", type: "Float", defaultVal: "0.0" },
            { name: "Толщина, мм", code: "THICK", type: "Integer", defaultVal: "0" },
            { name: "Длина, м", code: "L_PIPE", type: "Float", defaultVal: "0.0" }
          ]
        }
      ],
      operations: [
        { name: "Запуск труб в производство, ознакомление с РКД", shts: "А17-3р", prof: "19240", code: "T_1", params: [],
          formula: "{p.DN_DY} * 0.0053 * {p.C_CUTS}",
          protocol: ["Расчёт по нормативу ГКЛИ.3520-109-2018 Карта 1", "Расчёт: {p.DN_DY} * 0.0053 * {p.C_CUTS} = {VALUE}"] },
        { name: "Изготовление шаблонов и снятие размеров с места", shts: "А16-4р", prof: "19240", code: "T_2", params: [
          { name: "Место выполнения", code: "PLACE_JOB", type: "List", defaultVal: "На судне;По плазовой разметке" },
          { name: "Коэффициент неудобства", code: "DISCOMF", type: "List", defaultVal: "-;на плоской поверхности;в потолочном положении;для неудобных условий" }
        ], formula: "", protocol: [] },
        { name: "Резка на станке", shts: "А17-3р", prof: "17928", code: "T_3", params: [
          { name: "Кол-во резов, шт.", code: "C_CUTS", type: "Integer", defaultVal: "0" }
        ], formula: "{p.C_CUTS} * 0.12", protocol: ["Расчёт резов: {p.C_CUTS} * 0.12 = {VALUE}"] },
        { name: "Гидроиспытание труб", shts: "А17-3р", prof: "12597", code: "T_4", params: [
          { name: "Тип заглушки", code: "T_ZAGL", type: "List", defaultVal: "Быстросъемные;Резьбовые;Фланцевые" },
          { name: "Кол-во заглушек, шт", code: "C_PLUGS", type: "Integer", defaultVal: "0" },
          { name: "Давление, МПа", code: "C_PRESSURE", type: "Integer", defaultVal: "0" }
        ], formula: "{p.C_PLUGS} * {p.C_PRESSURE} * 0.05", protocol: [] }
      ]
    }
  ];
  coefTables = [
    {
      name: 'Коэффициент по материалу и диаметру',
      code: 'K_MAT_DN',
      defaultVal: 1,
      keys: ['MATERIAL', 'DN_DY'],
      rows: [
        ['Коррозионно-стойкая сталь', '<50',  '1.2'],
        ['Коррозионно-стойкая сталь', '>=50', '1.5'],
        ['Легированная сталь',        '<50',  '1.0'],
        ['Легированная сталь',        '>=50', '1.3'],
        ['Медь МЗр',                  '*',    '1.8'],
        ['Углеродистая сталь',        '*',    '0.9'],
      ]
    }
  ];
  sel = { kind:'type', ti: 0 };
  expandedTypes = new Set([0]);
  renderAll(true);
}

// ---- Panel resizer ----
(function initResizer() {
  const resizer = document.getElementById('codeResizer');
  let dragging = false, startCoord = 0, startSize = 0;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    startCoord = panelPos === 'bottom' ? e.clientY : e.clientX;
    startSize = panelSize;
    resizer.classList.add('dragging');
    document.body.style.cursor = panelPos === 'bottom' ? 'ns-resize' : 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta = panelPos === 'bottom' ? startCoord - e.clientY : startCoord - e.clientX;
    const wa = document.getElementById('workArea');
    const maxSize = (panelPos === 'bottom' ? wa.offsetHeight : wa.offsetWidth) * 0.85;
    panelSize = Math.max(80, Math.min(startSize + delta, maxSize));
    applyLayout();
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

window.addEventListener('beforeunload', e => {
  if (schema.length > 0 || coefTables.length > 0) { e.preventDefault(); e.returnValue = ''; }
});

renderSidebar();
renderSidebarTables();
renderEditor();

// ---- Validation tooltip hover (fixed positioning so it's never clipped) ----
(function() {
  const indicator = document.getElementById('validIndicator');
  const tooltip   = document.getElementById('validTooltip');
  if (!indicator || !tooltip) return;
  let hideTimer;
  const show = () => {
    clearTimeout(hideTimer);
    const r = indicator.getBoundingClientRect();
    tooltip.style.top  = (r.bottom + 6) + 'px';
    tooltip.style.left = '8px';
    tooltip.classList.add('active');
    const w = tooltip.offsetWidth;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    tooltip.style.left = left + 'px';
  };
  const schedHide = () => { hideTimer = setTimeout(() => tooltip.classList.remove('active'), 120); };
  indicator.addEventListener('mouseenter', show);
  indicator.addEventListener('mouseleave', schedHide);
  tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  tooltip.addEventListener('mouseleave', schedHide);
})();
