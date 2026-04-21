function renderAll(immediate) {
  renderSidebar();
  renderSidebarTables();
  renderEditor();
  scheduleGen(immediate);
}

function renderSidebar() {
  const body = document.getElementById('sidebarBody');
  body.innerHTML = '';
  if (schema.length === 0) {
    body.innerHTML = '<div style="padding:20px;text-align:center;color:#ccc;font-size:12px">Добавьте тип номенклатуры</div>';
    return;
  }
  const globalDupOpCodes = getGlobalDupOpCodes();
  const dupTypeNames = getDupTypeNames();
  schema.forEach((type, ti) => {
    const typeHasOpErr = type.operations.some(op => op.code && globalDupOpCodes.has(op.code));
    const hasErr = typeHasOpErr ||
      dupTypeNames.has(type.name) ||
      type.paramSets.some(ps => getDupCodes(ps.params).size > 0) ||
      type.operations.some(op => getDupCodes(op.params).size > 0);
    const isTypeSel = sel && sel.kind === 'type' && sel.ti === ti;
    const expanded = expandedTypes.has(ti);

    const wrap = document.createElement('div');
    wrap.className = 'type-item';
    const hdr = document.createElement('div');
    hdr.className = 'type-header' + (isTypeSel ? ' active' : '') + (hasErr ? ' has-err' : '');
    hdr.innerHTML =
      `<span class="type-arrow" onclick="toggleTypeExpand(${ti},event)">${expanded ? '▼' : '▶'}</span>` +
      `<span class="type-name">${esc(type.name) || '<i style="color:#ccc">без названия</i>'}</span>` +
      `<span class="type-actions">` +
        `<button class="iact-btn" onclick="event.stopPropagation();duplicateType(${ti})" title="Дублировать">⧉</button>` +
        `<button class="iact-btn del" onclick="event.stopPropagation();deleteType(${ti})">✕</button>` +
      `</span>`;
    hdr.draggable = true;
    hdr.ondragstart = e => typeDragStart(e, ti);
    hdr.ondragover  = e => typeDragOver(e, ti);
    hdr.ondragleave = e => typeDragLeave(e);
    hdr.ondrop      = e => typeDrop(e, ti);
    hdr.ondragend   = e => typeDragEnd(e);
    hdr.onclick = () => selectType(ti);
    wrap.appendChild(hdr);

    if (expanded) {
      const opsWrap = document.createElement('div');
      opsWrap.className = 'ops-list';
      type.operations.forEach((op, oi) => {
        const isDup = globalDupOpCodes.has(op.code);
        const fe = _fieldErrors[`${ti}:${oi}`];
        const invalidCode = /[^A-Za-z0-9_]/;
        const hasOpErr = isDup || !op.code || invalidCode.test(op.code) ||
          getDupCodes(op.params).size > 0 ||
          op.params.some(p => !p.code || p.code.length > 10 || invalidCode.test(p.code)) ||
          !!(fe && (fe.formula || fe.protocol.size > 0));
        const isOpSel = sel && sel.kind === 'op' && sel.ti === ti && sel.oi === oi;
        const row = document.createElement('div');
        row.className = 'op-item' + (isOpSel ? ' active' : '') + (hasOpErr ? ' has-err' : '');
        row.innerHTML =
          `<span class="op-code${isDup ? ' dup' : ''}">${esc(op.code) || '?'}</span>` +
          `<span class="op-name">${esc(op.name) || '<i style="color:#ccc">без названия</i>'}</span>` +
          `<span class="op-actions">` +
            `<button class="iact-btn" onclick="event.stopPropagation();duplicateOp(${ti},${oi})" title="Дублировать">⧉</button>` +
            `<button class="iact-btn del" onclick="event.stopPropagation();deleteOp(${ti},${oi})">✕</button>` +
          `</span>`;
        row.draggable = true;
        row.ondragstart = e => opDragStart(e, ti, oi);
        row.ondragover  = e => opDragOver(e, ti, oi);
        row.ondragleave = e => opDragLeave(e);
        row.ondrop      = e => opDrop(e, ti, oi);
        row.ondragend   = e => opDragEnd(e);
        row.onclick = () => selectOp(ti, oi);
        opsWrap.appendChild(row);
      });
      const addRow = document.createElement('div');
      addRow.className = 'add-op-row';
      addRow.textContent = '+ Добавить операцию';
      addRow.onclick = () => addOp(ti);
      opsWrap.appendChild(addRow);
      wrap.appendChild(opsWrap);
    }
    body.appendChild(wrap);
  });
}

function renderSidebarTables() {
  const body = document.getElementById('sidebarTables');
  if (!body) return;
  body.innerHTML = '';
  if (coefTables.length === 0) {
    body.innerHTML = '<div style="padding:12px 10px;text-align:center;color:#ccc;font-size:11px">Нет таблиц</div>';
    return;
  }
  coefTables.forEach((tbl, idx) => {
    const isActive = sel && sel.kind === 'table' && sel.idx === idx;
    const item = document.createElement('div');
    item.className = 'table-item' + (isActive ? ' active' : '');
    const isDupCode = coefTables.filter(t => t.code && t.code === tbl.code).length > 1;
    item.innerHTML =
      `<span class="table-item-name${isDupCode ? ' dup' : ''}">${esc(tbl.name) || '<i style="color:#ccc">без названия</i>'}</span>` +
      `<span class="table-item-type${isDupCode ? ' dup' : ''}">${esc(tbl.code) || '?'}</span>` +
      `<span class="table-item-actions">` +
        `<button class="iact-btn" onclick="event.stopPropagation();duplicateCoefTable(${idx})" title="Дублировать">⧉</button>` +
        `<button class="iact-btn del" onclick="event.stopPropagation();deleteCoefTable(${idx})">✕</button>` +
      `</span>`;
    item.draggable = true;
    item.ondragstart = e => tableDragStart(e, idx);
    item.ondragover  = e => tableDragOver(e, idx);
    item.ondragleave = e => tableDragLeave(e);
    item.ondrop      = e => tableDrop(e, idx);
    item.ondragend   = e => tableDragEnd(e);
    item.onclick = () => selectTable(idx);
    body.appendChild(item);
  });
}

function renderEditor() {
  cleanupTableVirt(); // снять scroll-listener перед любым перерендером
  const editor = document.getElementById('editor');
  if (!sel) {
    editor.innerHTML = '<div class="empty-state"><div class="icon">📄</div><p style="color:#aaa">Выберите тип или операцию</p></div>';
    return;
  }
  if (sel.kind === 'table') { renderTableEditor(sel.idx); return; }
  sel.kind === 'type' ? renderTypeEditor(sel.ti) : renderOpEditor(sel.ti, sel.oi);
}

// ---------- Строка CoefTable: одиночный HTML-билдер ----------
function buildOneTableRow(idx, ri, li, tbl, allParamMap, dupRowIdxs) {
  const row = tbl.rows[ri];
  const isDupRow = dupRowIdxs.has(ri);
  const grip = `<td class="col-ctl"><span class="param-grip" title="Перетащить" onmousedown="rowGripMouseDown()">⠿</span></td>`;
  const cells = tbl.keys.map((k, ci) => {
    if (allParamMap.get(k) === 'List') {
      const opts = getListValuesForCode(k);
      const cur = row[ci] || '';
      const opts2 = `<option value="">—</option>` + opts.map(v => `<option value="${esc(v)}"${cur===v?' selected':''}>${esc(v)}</option>`).join('');
      return `<td><select onchange="updateTableCell(${idx},${ri},${ci},this.value)">${opts2}</select></td>`;
    }
    return `<td><input type="text" value="${esc(row[ci]||'')}" oninput="updateTableCell(${idx},${ri},${ci},this.value)" placeholder="${esc(k)}"></td>`;
  }).join('');
  const val  = `<td class="value-cell"><input type="number" step="any" value="${esc(row[tbl.keys.length]||'')}" oninput="updateTableCell(${idx},${ri},${tbl.keys.length},this.value)" placeholder="0"></td>`;
  const del  = `<td><button class="tbl-btn del-btn" onclick="removeTableRow(${idx},${ri})" title="Удалить строку">✕</button></td>`;
  const rt   = row.map(c=>(c||'').toLowerCase()).join(' ');
  return `<tr class="${isDupRow?'dup-row':''}" data-ri="${ri}" data-li="${li}" data-row-text="${esc(rt)}" draggable="true"
    ondragstart="rowDragStart(event,${idx},${ri})" ondragover="rowDragOver(event,${ri})"
    ondragleave="rowDragLeave(event)" ondrop="rowDrop(event,${idx},${ri})" ondragend="rowDragEnd(event)"
    >${grip}${cells}${val}${del}</tr>`;
}

// Вычислить Set дублей строк для таблицы
function calcDupRowIdxs(tbl) {
  const seen = new Map(), dups = new Set();
  tbl.rows.forEach((row, ri) => {
    const combo = row.slice(0, tbl.keys.length).join('\x00');
    if (combo.trim().replace(/\x00/g,'') === '') return;
    if (seen.has(combo)) { dups.add(ri); dups.add(seen.get(combo)); } else seen.set(combo, ri);
  });
  return dups;
}

function renderTypeEditor(ti) {
  if (sel.si !== undefined) { renderParamSetEditor(ti, sel.si); return; }
  const type = schema[ti];
  const dupOps = getGlobalDupOpCodes();
  const setsTag = `<span class="tag" id="tag-sets">${type.paramSets.length}</span>`;
  const opsTag = `<span class="tag">${type.operations.length}</span>`;
  const canAddSet = type.paramSets.length < 5;
  const dupSetNames = getDupSetNames(type.paramSets);

  document.getElementById('editor').innerHTML =
    `<div class="section">
      <div class="section-title"><span class="stitle">Тип номенклатуры</span></div>
      <div class="section-body">
        <div class="field-row">
          <span class="field-label">Название</span>
          <input id="fld-type-name" class="field-input" type="text" value="${esc(type.name)}" oninput="updateTypeName(${ti},this.value)" placeholder="Например: Труба">
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">
        <span class="stitle">Наборы параметров ${setsTag}</span>
        ${canAddSet ? `<button class="btn-primary btn-sm" onclick="addParamSet(${ti})">+ Набор</button>` : ''}
      </div>
      <div class="section-body">
        ${type.paramSets.length === 0
          ? '<div style="color:#bbb;font-size:12px">Нет наборов параметров</div>'
          : `<div class="paramsets-grid">
              ${type.paramSets.map((ps, si) => {
                const dupErr = getDupCodes(ps.params).size > 0;
                const nameErr = !ps.name || dupSetNames.has(ps.name);
                const canDup = type.paramSets.length < 5;
                return `<div class="paramset-card${(dupErr || nameErr) ? ' has-err' : ''}" draggable="true" ondragstart="psDragStart(event,${ti},${si})" ondragover="psDragOver(event)" ondragleave="psDragLeave(event)" ondrop="psDrop(event,${ti},${si})" ondragend="psDragEnd(event)" onclick="openParamSet(${ti},${si})">
                  <div class="psc-body">
                    <div class="psc-name">${ps.name ? esc(ps.name) : '<span style="color:#bbb;font-style:italic">без названия</span>'}</div>
                    <div class="psc-meta">${ps.params.length} пар.</div>
                  </div>
                  <div class="psc-actions">
                    ${canDup ? `<button class="iact-btn" onclick="event.stopPropagation();duplicateParamSet(${ti},${si})" title="Дублировать">⧉</button>` : ''}
                    <button class="iact-btn del" onclick="event.stopPropagation();deleteParamSet(${ti},${si})" title="Удалить">✕</button>
                  </div>
                </div>`;
              }).join('')}
            </div>`}
      </div>
    </div>
    <div class="section">
      <div class="section-title">
        <span class="stitle">Операции ${opsTag}</span>
        <button class="btn-primary btn-sm" onclick="addOp(${ti})">+ Операция</button>
      </div>
      <div class="section-body">
        ${type.operations.length === 0
          ? '<div style="color:#bbb;font-size:12px">Нет операций</div>'
          : `<div class="ops-summary">
              ${type.operations.map((op, oi) => {
                const isDup = dupOps.has(op.code);
                const hasParamErr = getDupCodes(op.params).size > 0;
                return `<div class="ops-summary-item" onclick="selectOp(${ti},${oi})">
                  <span class="s-code${isDup ? ' dup' : ''}">${esc(op.code)}</span>
                  <span class="s-name">${esc(op.name) || '(без названия)'}</span>
                  <span class="s-pcount">${hasParamErr ? '⚠' : (op.params.length > 0 ? op.params.length + 'п' : '')}</span>
                </div>`;
              }).join('')}
            </div>`}
      </div>
    </div>`;
}

function renderParamSetEditor(ti, si) {
  const type = schema[ti];
  const ps = type.paramSets[si];
  const dupParams = getDupCodes(ps.params);
  const dupNames = getDupSetNames(type.paramSets);
  const nameErr = !ps.name || dupNames.has(ps.name);
  const paramTag = `<span class="tag${dupParams.size > 0 ? ' err' : ''}" id="tag-params">${ps.params.length}</span>`;

  document.getElementById('editor').innerHTML =
    `<div class="section">
      <div class="breadcrumb" style="display:flex;align-items:center;gap:8px">
        <button class="btn-back" onclick="backToSets(${ti})">← Тип</button>
        <span>Тип: <strong>${esc(type.name)}</strong></span>
      </div>
      <div class="section-body">
        <div class="field-row">
          <span class="field-label">Название набора</span>
          <input id="fld-set-name" class="field-input${nameErr ? ' err' : ''}" type="text" value="${esc(ps.name)}" oninput="updateParamSetName(${ti},${si},this.value)" placeholder="Например: Базовые">
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">
        <span class="stitle">Параметры ${paramTag}</span>
        <button class="btn-primary btn-sm" onclick="addParam('set',${ti},${si})">+ Параметр</button>
      </div>
      <div class="section-body">
        ${ps.params.length === 0
          ? '<div style="color:#bbb;font-size:12px">Нет параметров</div>'
          : renderParamsTable('set', ti, si, ps.params, dupParams)}
      </div>
    </div>`;
}

function renderOpEditor(ti, oi) {
  const type = schema[ti];
  const op = type.operations[oi];
  const dupOps = getGlobalDupOpCodes();
  const dupParams = getDupCodes(op.params);
  const codeErr = op.code && dupOps.has(op.code);
  const paramTag = `<span class="tag${dupParams.size > 0 ? ' err' : ''}" id="tag-params">${op.params.length}</span>`;

  document.getElementById('editor').innerHTML =
    `<div class="section">
      <div class="breadcrumb" style="display:flex;align-items:center;gap:8px">
        <button class="btn-back" onclick="selectType(${ti})">← Тип</button>
        <span>Тип: <strong>${esc(type.name)}</strong></span>
      </div>
      <div class="section-body op-grid">
        <div class="field-row">
          <span class="field-label">Название операции</span>
          <input id="fld-op-name" class="field-input" type="text" value="${esc(op.name)}" oninput="updateOp(${ti},${oi},'name',this.value)" placeholder="Название">
        </div>
        <div class="field-row">
          <span class="field-label">Код формулы</span>
          <input class="field-input${codeErr ? ' err' : ''}" id="fld-op-code" type="text" value="${esc(op.code)}" oninput="updateOp(${ti},${oi},'code',this.value)" placeholder="T_1">
        </div>
      </div>
    </div>
    ${renderOpFieldSection(ti, oi, 'shts', 'ШТС', 'Разряд')}
    ${renderOpFieldSection(ti, oi, 'prof', 'Профессия (код)', 'Код профессии')}
    ${renderNormTablesSection(ti, oi)}
    ${renderDocumentsSection(ti, oi)}
    ${renderTechKitSection(ti, oi)}
    <div class="section">
      <div class="section-title">
        <span class="stitle">Уникальные параметры операции ${paramTag}</span>
        <button class="btn-primary btn-sm" onclick="addParam('op',${ti},${oi})">+ Параметр</button>
      </div>
      <div class="section-body">
        ${op.params.length === 0
          ? '<div style="color:#bbb;font-size:12px">Нет уникальных параметров</div>'
          : renderParamsTable('op', ti, oi, op.params, dupParams)}
      </div>
    </div>
    ${renderPlaceholderHints(ti, oi)}
    ${renderFormulaSection(ti, oi)}
    ${renderOpProtocolSection(ti, oi)}`;
}

// Состояние свёрнутости групп чипсов (сохраняется на сессию)
// Proxy: неизвестный ключ → true (свёрнуто по умолчанию)
const _chipGroupCollapsed = new Proxy({}, { get: (o, k) => k in o ? o[k] : true });

function buildPlaceholderChipsHTML(ti, oi) {
  const type = schema[ti];
  const op = type.operations[oi];
  const paramCodes = new Set();
  const excludedTypes = new Set(['String', 'Date']);
  type.paramSets.forEach(ps => ps.params.forEach(p => { if (p.code && !excludedTypes.has(p.type)) paramCodes.add(p.code); }));
  op.params.forEach(p => { if (p.code && !excludedTypes.has(p.type)) paramCodes.add(p.code); });
  const otherOps = type.operations.filter((o, i) => i !== oi && o.code);
  // searchText — отдельный текст для поиска (если отличается от label)
  const chip = (text, cls, label, searchText) =>
    `<button class="formula-chip${cls ? ' ' + cls : ''}" onmousedown="event.preventDefault()" onclick="insertAtActive('${text}')" data-chip-text="${esc((searchText || label).toLowerCase())}">${label}</button>`;

  const paramChips   = [...paramCodes].map(c => chip(`{p.${c}}`, '', c)).join('');
  const opChips      = otherOps.map(o => chip(`{op.${esc(o.code)}}`, 'op-ref', esc(o.code))).join('');
  const tableChips   = coefTables.filter(t => t.code).map(t => chip(`{K.${esc(t.code)}}`, 'coef-ref', esc(t.code))).join('');
  const protoChips   = chip('{NAME}','special','NAME') + chip('{SHTS}','special','SHTS') + chip('{PROF}','special','PROF') + chip('{VALUE}','special','VALUE');

  // Подгруппы «Параметры других операций»: по одной подгруппе на операцию
  const popGroupsHtml = otherOps.map(o => {
    const popParams = o.params.filter(p => p.code && !excludedTypes.has(p.type));
    if (!popParams.length) return '';
    const popChips = popParams.map(p =>
      chip(`{pop.${esc(o.code)}.${esc(p.code)}}`, 'pop-ref', esc(p.code), `${o.code} ${p.code}`)
    ).join('');
    const subId = `pop_${o.code}`;
    const subCollapsed = _chipGroupCollapsed[subId];
    return `<div class="chip-group chip-subgroup" id="chipgrp-${subId}">
      <button class="chip-group-toggle" onmousedown="event.preventDefault()" onclick="toggleChipGroup('${subId}')">
        <span class="chip-group-arrow">${subCollapsed ? '▶' : '▼'}</span>
        <span>[${esc(o.code)}]${o.name ? ` ${esc(o.name)}` : ''}</span><span class="chip-group-count">${popParams.length}</span>
      </button>
      <div class="chip-group-body${subCollapsed ? ' chip-group-hidden' : ''}">${popChips}</div>
    </div>`;
  }).join('');
  const popTotalCount = otherOps.reduce(
    (sum, o) => sum + o.params.filter(p => p.code && !excludedTypes.has(p.type)).length, 0
  );

  const makeGroup = (id, label, chips, count, hasSubgroups = false) => {
    if (!count) return '';
    const collapsed = _chipGroupCollapsed[id];
    return `<div class="chip-group" id="chipgrp-${id}">
      <button class="chip-group-toggle" onmousedown="event.preventDefault()" onclick="toggleChipGroup('${id}')">
        <span class="chip-group-arrow">${collapsed ? '▶' : '▼'}</span>
        <span>${label}</span><span class="chip-group-count">${count}</span>
      </button>
      <div class="chip-group-body${collapsed ? ' chip-group-hidden' : ''}${hasSubgroups ? ' chip-group-subgroups' : ''}">${chips}</div>
    </div>`;
  };

  const searchBar = `<div class="chip-search-bar">
    <div class="chip-search-wrap">
      <span class="chip-search-icon">🔍</span>
      <input class="chip-search-input" type="text" placeholder="Поиск"
        oninput="filterChips(this.value)" onmousedown="event.stopPropagation()">
    </div>
  </div>`;

  return `<div class="chip-groups-wrap" id="chip-groups-root">
    ${searchBar}
    ${makeGroup('params',  'Параметры этой операции',         paramChips,    paramCodes.size)}
    ${makeGroup('pop',     'Параметры других операций',       popGroupsHtml, popTotalCount, true)}
    ${makeGroup('ops',     'Результат других операций',       opChips,       otherOps.length)}
    ${makeGroup('tables',  'Таблицы коэффициентов',           tableChips,    coefTables.filter(t=>t.code).length)}
    ${makeGroup('proto',   'Значения для протокола',          protoChips,    4)}
  </div>`;
}

function refreshFormulaChips(ti, oi) {
  const el = document.getElementById('fld-ph-chips');
  if (el) el.innerHTML = buildPlaceholderChipsHTML(ti, oi);
}

function renderFormulaSection(ti, oi) {
  const op = schema[ti].operations[oi];
  const fn = (name, title) =>
    `<button class="formula-chip fn-chip" onmousedown="event.preventDefault()" onclick="insertFnAtActive('${name}')" title="${title}">${name}</button>`;
  const chips = `<div class="formula-chips" style="margin-top:7px">
    <span class="chip-label">Функции:</span>
    ${fn('Abs','Abs(x) — модуль')}${fn('Int','Int(x) — целая часть (вниз)')}${fn('Fix','Fix(x) — целая часть (отсечение)')}${fn('Round','Round(x, n) — округление')}${fn('Sqr','Sqr(x) — квадратный корень')}${fn('Exp','Exp(x) — e^x')}${fn('Log','Log(x) — натуральный логарифм')}${fn('Sin','Sin(x) — синус')}${fn('Cos','Cos(x) — косинус')}${fn('Tan','Tan(x) — тангенс')}
    <span class="chip-sep"></span>
    <button class="formula-chip fn-chip" onmousedown="event.preventDefault()" onclick="insertAtActive('^')" title="Возведение в степень: x ^ n">^</button>
    <button class="formula-chip fn-chip" onmousedown="event.preventDefault()" onclick="insertAtActive('\\x5C')" title="Целочисленное деление: x \\ n">\\</button>
    <button class="formula-chip fn-chip" onmousedown="event.preventDefault()" onclick="insertAtActive('Mod')" title="Остаток от деления: x Mod n">Mod</button>
  </div>`;

  if (op.formulaBranches) {
    const allParams = getAllOpParams(ti, oi);
    const buildCondRow = (c, bi, gi, ci) => {
      const param = allParams.find(p => p.code === c.code);
      const pType = param ? param.type : 'String';
      const numTypes = ['Integer', 'Float'];
      const ops = numTypes.includes(pType) ? ['=','≠','<','>','≤','≥'] : ['=','≠'];
      const opOpts = ops.map(o => `<option value="${o}"${c.op===o?' selected':''}>${o}</option>`).join('');
      const paramOpts = allParams.map(p => `<option value="${esc(p.code)}"${p.code===c.code?' selected':''}>${esc(p.name||p.code)}</option>`).join('');
      let valInput;
      const valId = `fld-cv-${bi}-${gi}-${ci}`;
      if (pType === 'List') {
        const vals = (param.defaultVal||'').split(';').filter(Boolean);
        valInput = `<select id="${valId}" class="fb-val-inp" onchange="updateBranchCondField(${ti},${oi},${bi},${gi},${ci},'value',this.value)">${vals.map(v=>`<option value="${esc(v)}"${c.value===v?' selected':''}>${esc(v)}</option>`).join('')}</select>`;
      } else if (pType === 'Boolean') {
        valInput = `<select id="${valId}" class="fb-val-inp" onchange="updateBranchCondField(${ti},${oi},${bi},${gi},${ci},'value',this.value)"><option value="True"${c.value==='True'?' selected':''}>True</option><option value="False"${c.value==='False'?' selected':''}>False</option></select>`;
      } else if (numTypes.includes(pType)) {
        valInput = `<input id="${valId}" type="number" class="fb-val-inp" value="${esc(c.value)}" oninput="updateBranchCondField(${ti},${oi},${bi},${gi},${ci},'value',this.value)">`;
      } else {
        valInput = `<input id="${valId}" type="text" class="fb-val-inp" value="${esc(c.value)}" placeholder="Значение" oninput="updateBranchCondField(${ti},${oi},${bi},${gi},${ci},'value',this.value)">`;
      }
      return `<div class="fb-cond-row">
        <select class="fb-param-sel" onchange="updateBranchCondField(${ti},${oi},${bi},${gi},${ci},'code',this.value)">${paramOpts}</select>
        <select class="fb-op-sel" onchange="updateBranchCondField(${ti},${oi},${bi},${gi},${ci},'op',this.value)">${opOpts}</select>
        ${valInput}
        <button class="tbl-btn del-btn" onclick="removeBranchCondition(${ti},${oi},${bi},${gi},${ci})">✕</button>
      </div>`;
    };
    const cards = op.formulaBranches.map((b, bi) => {
      const isDefault = bi === op.formulaBranches.length - 1;
      let condHtml = '';
      if (!isDefault) {
        const groups = b.conditionGroups || [];
        const groupsHtml = groups.map((group, gi) => {
          const rows = group.map((c, ci) => buildCondRow(c, bi, gi, ci)).join('');
          const orSep = gi > 0 ? `<div class="fb-or-sep"><span>Или</span></div>` : '';
          return `${orSep}<div class="fb-group">
            ${rows}
            <button class="tbl-btn fb-add-cond-btn" onclick="addBranchCondition(${ti},${oi},${bi},${gi})">+ И</button>
          </div>`;
        }).join('');
        condHtml = `<div class="fb-cond-section">
          ${groupsHtml || `<span class="fb-no-cond">Нет условий</span>`}
          <button class="tbl-btn fb-add-or-btn" onclick="addBranchOrGroup(${ti},${oi},${bi})">+ Или</button>
        </div>`;
      }
      return `<div class="fb-card${isDefault?' fb-card-default':''}">
        <div class="fb-card-header">
          <span class="fb-card-title">${isDefault ? 'По умолчанию' : `Вариант ${bi+1}`}</span>
          ${isDefault ? '' : `<button class="tbl-btn del-btn" onclick="removeFormulaBranch(${ti},${oi},${bi})">✕</button>`}
        </div>
        ${condHtml}
        <div class="fb-formula-wrap">
          <textarea id="fld-fbf-${bi}" class="formula-ta fb-formula-ta" rows="2"
            oninput="updateBranchFormula(${ti},${oi},${bi},this.value)"
            placeholder="Формула">${esc(b.formula)}</textarea>
        </div>
      </div>`;
    }).join('');
    return `<div class="section">
      <div class="section-title">
        <span class="stitle">Варианты формулы</span>
        <button class="btn-secondary btn-sm" onclick="openFormulaTest(${ti},${oi})">Проверка</button>
        <button class="btn-secondary btn-sm" onclick="addFormulaBranch(${ti},${oi})">+ Вариант</button>
        <button class="btn-secondary btn-sm" onclick="convertToSimpleFormula(${ti},${oi})">↩ Убрать варианты</button>
      </div>
      <div class="section-body">
        <div class="fb-cards">${cards}</div>
        ${chips}
      </div>
    </div>`;
  }

  return `<div class="section">
    <div class="section-title">
      <span class="stitle">Формула</span>
      <button class="btn-secondary btn-sm" onclick="openFormulaTest(${ti},${oi})">Проверка</button>
      <button class="btn-secondary btn-sm" onclick="addFormulaBranch(${ti},${oi})">+ Условие</button>
    </div>
    <div class="section-body">
      <textarea id="fld-formula" class="formula-ta" rows="2"
        oninput="updateOpFormula(${ti},${oi},this.value)"
        placeholder="Формула">${esc(op.formula)}</textarea>
      ${chips}
    </div>
  </div>`;
}

function renderPlaceholderHints(ti, oi) {
  return `<div class="section">
    <div class="section-title"><span class="stitle">Вставка значений</span></div>
    <div class="section-body">
      <div class="formula-chips" id="fld-ph-chips">
        ${buildPlaceholderChipsHTML(ti, oi)}
      </div>
      <div class="ph-hint">
        <div class="ph-grid">
          <code>{p.КОД}</code><span>значение параметра с указанным кодом</span>
          <code>{K.КОД}</code><span>значение из таблицы коэффициентов</span>
          <code>{op.КОД}</code><span>результат другой операции этого типа</span>
          <div class="ph-grid-sep"></div>
          <code>{NAME}</code><span>название операции <em class="ph-note-tag">(только в протоколе)</em></span>
          <code>{SHTS}</code><span>ШТС <em class="ph-note-tag">(только в протоколе)</em></span>
          <code>{PROF}</code><span>код профессии <em class="ph-note-tag">(только в протоколе)</em></span>
          <code>{VALUE}</code><span>результат формулы <em class="ph-note-tag">(только в протоколе)</em></span>
        </div>
      </div>
    </div>
  </div>`;
}

function renderNormTablesSection(ti, oi) {
  const items = schema[ti].operations[oi].normTables || [];
  const chips = buildNormTableChips(ti, oi, items);
  return `<div class="section">
    <div class="section-title">
      <span class="stitle">Нормировочные таблицы <span class="tag" id="nt-tag-${ti}-${oi}">${items.length}</span></span>
    </div>
    <div class="section-body">
      <div class="list-editor">
        <div id="nt-${ti}-${oi}" class="list-tags">${chips}</div>
        <input class="list-add-input" type="text" placeholder="Обозначение таблицы + Enter"
          onkeydown="if(event.key==='Enter'){addNormTable(${ti},${oi},this);event.preventDefault()}">
      </div>
    </div>
  </div>`;
}

function renderTechKitSection(ti, oi) {
  const val = schema[ti].operations[oi].techKit || '';
  return `<div class="section">
    <div class="section-title">
      <span class="stitle">Тех. комплект</span>
    </div>
    <div class="section-body">
      <div class="list-editor">
        <input class="list-add-input" type="text" value="${esc(val)}"
          placeholder="Обозначение тех. комплекта"
          oninput="setTechKit(${ti},${oi},this.value)">
      </div>
    </div>
  </div>`;
}

function renderDocumentsSection(ti, oi) {
  const items = schema[ti].operations[oi].documents || [];
  const chips = buildDocumentChips(ti, oi, items);
  return `<div class="section">
    <div class="section-title">
      <span class="stitle">Документы <span class="tag" id="doc-tag-${ti}-${oi}">${items.length}</span></span>
    </div>
    <div class="section-body">
      <div class="list-editor">
        <div id="doc-${ti}-${oi}" class="list-tags">${chips}</div>
        <input class="list-add-input" type="text" placeholder="Обозначение документа + Enter"
          onkeydown="if(event.key==='Enter'){addDocument(${ti},${oi},this);event.preventDefault()}">
      </div>
    </div>
  </div>`;
}

function renderOpFieldSection(ti, oi, field, label, placeholder) {
  const op = schema[ti].operations[oi];
  const branchKey = field + 'Branches';
  if (op[branchKey]) {
    const allParams = getAllOpParams(ti, oi);
    const buildCondRow = (c, bi, gi, ci) => {
      const param = allParams.find(p => p.code === c.code);
      const pType = param ? param.type : 'String';
      const numTypes = ['Integer', 'Float'];
      const ops = numTypes.includes(pType) ? ['=','≠','<','>','≤','≥'] : ['=','≠'];
      const opOpts = ops.map(o => `<option value="${o}"${c.op===o?' selected':''}>${o}</option>`).join('');
      const paramOpts = allParams.map(p => `<option value="${esc(p.code)}"${p.code===c.code?' selected':''}>${esc(p.name||p.code)}</option>`).join('');
      const valId = `fld-fc-${field}-${bi}-${gi}-${ci}`;
      let valInput;
      if (pType === 'List') {
        const vals = (param.defaultVal||'').split(';').filter(Boolean);
        valInput = `<select id="${valId}" class="fb-val-inp" onchange="updateFieldBranchCond(${ti},${oi},'${field}',${bi},${gi},${ci},'value',this.value)">${vals.map(v=>`<option value="${esc(v)}"${c.value===v?' selected':''}>${esc(v)}</option>`).join('')}</select>`;
      } else if (pType === 'Boolean') {
        valInput = `<select id="${valId}" class="fb-val-inp" onchange="updateFieldBranchCond(${ti},${oi},'${field}',${bi},${gi},${ci},'value',this.value)"><option value="True"${c.value==='True'?' selected':''}>True</option><option value="False"${c.value==='False'?' selected':''}>False</option></select>`;
      } else if (numTypes.includes(pType)) {
        valInput = `<input id="${valId}" type="number" class="fb-val-inp" value="${esc(c.value)}" oninput="updateFieldBranchCond(${ti},${oi},'${field}',${bi},${gi},${ci},'value',this.value)">`;
      } else {
        valInput = `<input id="${valId}" type="text" class="fb-val-inp" value="${esc(c.value)}" placeholder="Значение" oninput="updateFieldBranchCond(${ti},${oi},'${field}',${bi},${gi},${ci},'value',this.value)">`;
      }
      return `<div class="fb-cond-row">
        <select class="fb-param-sel" onchange="updateFieldBranchCond(${ti},${oi},'${field}',${bi},${gi},${ci},'code',this.value)">${paramOpts}</select>
        <select class="fb-op-sel" onchange="updateFieldBranchCond(${ti},${oi},'${field}',${bi},${gi},${ci},'op',this.value)">${opOpts}</select>
        ${valInput}
        <button class="tbl-btn del-btn" onclick="removeFieldBranchCond(${ti},${oi},'${field}',${bi},${gi},${ci})">✕</button>
      </div>`;
    };
    const cards = op[branchKey].map((b, bi) => {
      const isDefault = bi === op[branchKey].length - 1;
      let condHtml = '';
      if (!isDefault) {
        const groups = b.conditionGroups || [];
        const groupsHtml = groups.map((group, gi) => {
          const rows = group.map((c, ci) => buildCondRow(c, bi, gi, ci)).join('');
          const orSep = gi > 0 ? `<div class="fb-or-sep"><span>Или</span></div>` : '';
          return `${orSep}<div class="fb-group">
            ${rows}
            <button class="tbl-btn fb-add-cond-btn" onclick="addFieldBranchCond(${ti},${oi},'${field}',${bi},${gi})">+ И</button>
          </div>`;
        }).join('');
        condHtml = `<div class="fb-cond-section">
          ${groupsHtml || `<span class="fb-no-cond">Нет условий</span>`}
          <button class="tbl-btn fb-add-or-btn" onclick="addFieldBranchOrGroup(${ti},${oi},'${field}',${bi})">+ Или</button>
        </div>`;
      }
      return `<div class="fb-card${isDefault?' fb-card-default':''}">
        <div class="fb-card-header">
          <span class="fb-card-title">${isDefault ? 'По умолчанию' : `Вариант ${bi+1}`}</span>
          ${isDefault ? '' : `<button class="tbl-btn del-btn" onclick="removeFieldBranch(${ti},${oi},'${field}',${bi})">✕</button>`}
        </div>
        ${condHtml}
        <div class="fb-formula-wrap">
          <input id="fld-fv-${field}-${bi}" type="text" class="field-input" value="${esc(b.value)}"
            oninput="updateFieldBranchValue(${ti},${oi},'${field}',${bi},this.value)"
            placeholder="${esc(placeholder)}">
        </div>
      </div>`;
    }).join('');
    return `<div class="section">
      <div class="section-title">
        <span class="stitle">${esc(label)}</span>
        <button class="btn-secondary btn-sm" onclick="addFieldBranch(${ti},${oi},'${field}')">+ Вариант</button>
        <button class="btn-secondary btn-sm" onclick="convertToSimpleField(${ti},${oi},'${field}')">↩ Убрать варианты</button>
      </div>
      <div class="section-body"><div class="fb-cards">${cards}</div></div>
    </div>`;
  }
  return `<div class="section">
    <div class="section-title">
      <span class="stitle">${esc(label)}</span>
      <button class="btn-secondary btn-sm" onclick="addFieldBranch(${ti},${oi},'${field}')">+ Условие</button>
    </div>
    <div class="section-body">
      <input id="fld-op-${field}" type="text" class="field-input" value="${esc(op[field])}"
        oninput="updateOp(${ti},${oi},'${field}',this.value)"
        placeholder="${esc(placeholder)}">
    </div>
  </div>`;
}

function renderOpProtocolSection(ti, oi) {
  const op = schema[ti].operations[oi];

  if (op.protocolBranches) {
    const allParams = getAllOpParams(ti, oi);
    const buildCondRow = (c, bi, gi, ci) => {
      const param = allParams.find(p => p.code === c.code);
      const pType = param ? param.type : 'String';
      const numTypes = ['Integer', 'Float'];
      const ops = numTypes.includes(pType) ? ['=','≠','<','>','≤','≥'] : ['=','≠'];
      const opOpts = ops.map(o => `<option value="${o}"${c.op===o?' selected':''}>${o}</option>`).join('');
      const paramOpts = allParams.map(p => `<option value="${esc(p.code)}"${p.code===c.code?' selected':''}>${esc(p.name||p.code)}</option>`).join('');
      const valId = `fld-pbc-${bi}-${gi}-${ci}`;
      let valInput;
      if (pType === 'List') {
        const vals = (param.defaultVal||'').split(';').filter(Boolean);
        valInput = `<select id="${valId}" class="fb-val-inp" onchange="updateProtoBranchCondField(${ti},${oi},${bi},${gi},${ci},'value',this.value)">${vals.map(v=>`<option value="${esc(v)}"${c.value===v?' selected':''}>${esc(v)}</option>`).join('')}</select>`;
      } else if (pType === 'Boolean') {
        valInput = `<select id="${valId}" class="fb-val-inp" onchange="updateProtoBranchCondField(${ti},${oi},${bi},${gi},${ci},'value',this.value)"><option value="True"${c.value==='True'?' selected':''}>True</option><option value="False"${c.value==='False'?' selected':''}>False</option></select>`;
      } else if (numTypes.includes(pType)) {
        valInput = `<input id="${valId}" type="number" class="fb-val-inp" value="${esc(c.value)}" oninput="updateProtoBranchCondField(${ti},${oi},${bi},${gi},${ci},'value',this.value)">`;
      } else {
        valInput = `<input id="${valId}" type="text" class="fb-val-inp" value="${esc(c.value)}" placeholder="Значение" oninput="updateProtoBranchCondField(${ti},${oi},${bi},${gi},${ci},'value',this.value)">`;
      }
      return `<div class="fb-cond-row">
        <select class="fb-param-sel" onchange="updateProtoBranchCondField(${ti},${oi},${bi},${gi},${ci},'code',this.value)">${paramOpts}</select>
        <select class="fb-op-sel" onchange="updateProtoBranchCondField(${ti},${oi},${bi},${gi},${ci},'op',this.value)">${opOpts}</select>
        ${valInput}
        <button class="tbl-btn del-btn" onclick="removeProtoBranchCondition(${ti},${oi},${bi},${gi},${ci})">✕</button>
      </div>`;
    };
    const cards = op.protocolBranches.map((b, bi) => {
      const isDefault = bi === op.protocolBranches.length - 1;
      let condHtml = '';
      if (!isDefault) {
        const groups = b.conditionGroups || [];
        const groupsHtml = groups.map((group, gi) => {
          const rows = group.map((c, ci) => buildCondRow(c, bi, gi, ci)).join('');
          const orSep = gi > 0 ? `<div class="fb-or-sep"><span>Или</span></div>` : '';
          return `${orSep}<div class="fb-group">
            ${rows}
            <button class="tbl-btn fb-add-cond-btn" onclick="addProtoBranchCondition(${ti},${oi},${bi},${gi})">+ И</button>
          </div>`;
        }).join('');
        condHtml = `<div class="fb-cond-section">
          ${groupsHtml || `<span class="fb-no-cond">Нет условий</span>`}
          <button class="tbl-btn fb-add-or-btn" onclick="addProtoBranchOrGroup(${ti},${oi},${bi})">+ Или</button>
        </div>`;
      }
      const protoLines = renderProtoBranchLines(ti, oi, bi, b.protocol);
      return `<div class="fb-card${isDefault?' fb-card-default':''}">
        <div class="fb-card-header">
          <span class="fb-card-title">${isDefault ? 'По умолчанию' : `Вариант ${bi+1}`}</span>
          ${isDefault ? '' : `<button class="tbl-btn del-btn" onclick="removeProtocolBranch(${ti},${oi},${bi})">✕</button>`}
        </div>
        ${condHtml}
        <div class="fb-proto-wrap">
          ${protoLines}
          <div class="fb-proto-actions">
            <button class="tbl-btn" onclick="addProtoBranchLine(${ti},${oi},${bi})">+ Строка</button>
            <button class="btn-secondary btn-sm" onclick="applyProtoBranchTemplate(${ti},${oi},${bi})">Шаблон</button>
          </div>
        </div>
      </div>`;
    }).join('');
    return `<div class="section">
      <div class="section-title">
        <span class="stitle">Варианты протокола</span>
        <button class="btn-secondary btn-sm" onclick="addProtocolBranch(${ti},${oi})">+ Вариант</button>
        <button class="btn-secondary btn-sm" onclick="convertToSimpleProtocol(${ti},${oi})">↩ Убрать варианты</button>
      </div>
      <div class="section-body">
        <div class="fb-cards">${cards}</div>
      </div>
    </div>`;
  }

  return `<div class="section">
    <div class="section-title">
      <span class="stitle">Протокол <span class="tag">${op.protocol.length}</span></span>
      <button class="btn-secondary btn-sm" onclick="applyProtocolTemplate(${ti},${oi})">Шаблон</button>
      <button class="btn-secondary btn-sm" onclick="addProtocolBranch(${ti},${oi})">+ Условие</button>
      <button class="btn-primary btn-sm" onclick="addProtocolLine(${ti},${oi})">+ Строка</button>
    </div>
    <div class="section-body">
      ${renderProtocolLines(ti, oi, op.protocol)}
    </div>
  </div>`;
}

function renderProtoBranchLines(ti, oi, bi, lines) {
  if (lines.length === 0) return '<div style="color:#bbb;font-size:12px;margin-bottom:4px">Нет строк</div>';
  return `<div class="proto-lines">${lines.map((line, li) =>
    `<div class="proto-line-row" draggable="true"
      ondragstart="protoBranchDragStart(event,${ti},${oi},${bi},${li})"
      ondragover="protoBranchDragOver(event,${li})"
      ondragleave="protoBranchDragLeave(event)"
      ondrop="protoBranchDrop(event,${ti},${oi},${bi},${li})"
      ondragend="protoBranchDragEnd(event)">
      <span class="param-grip" onmousedown="protoBranchGripMouseDown()">⠿</span>
      <input type="text" id="fld-pbp-${bi}-${li}" value="${esc(line)}"
        ondragstart="event.stopPropagation()"
        oninput="updateProtoBranchLine(${ti},${oi},${bi},${li},this.value)"
        placeholder="Пустая строка">
      <button class="tbl-btn del-btn" onclick="deleteProtoBranchLine(${ti},${oi},${bi},${li})">✕</button>
    </div>`
  ).join('')}</div>`;
}

function renderProtocolLines(ti, oi, lines) {
  if (lines.length === 0) return '<div style="color:#bbb;font-size:12px;margin-bottom:6px">Нет строк протокола</div>';
  return `<div class="proto-lines">${lines.map((line, li) =>
    `<div class="proto-line-row" draggable="true"
      ondragstart="protoDragStart(event,${ti},${oi},${li})"
      ondragover="protoDragOver(event,${li})"
      ondragleave="protoDragLeave(event)"
      ondrop="protoDrop(event,${ti},${oi},${li})"
      ondragend="protoDragEnd(event)">
      <span class="param-grip" onmousedown="protoGripMouseDown()">⠿</span>
      <input type="text" id="fld-proto-${li}" value="${esc(line)}"
        ondragstart="event.stopPropagation()"
        oninput="updateProtocolLine(${ti},${oi},${li},this.value)"
        placeholder="Пустая строка">
      <button class="tbl-btn del-btn" onclick="deleteProtocolLine(${ti},${oi},${li})">✕</button>
    </div>`
  ).join('')}</div>`;
}

function renderParamsTable(scope, ti, oi, params, dupCodes) {
  const rows = params.map((p, pi) => {
    const isErr = p.code && dupCodes.has(p.code);
    return `<tr draggable="true"
      ondragstart="paramDragStart(event,'${scope}',${ti},${oi},${pi})"
      ondragover="paramDragOver(event,${pi})"
      ondragleave="paramDragLeave(event)"
      ondrop="paramDrop(event,'${scope}',${ti},${oi},${pi})"
      ondragend="paramDragEnd(event)">
      <td class="col-ctl"><span class="param-grip" title="Перетащить" onmousedown="paramGripMouseDown()">⠿</span></td>
      <td><input id="fld-pn-${pi}" type="text" value="${esc(p.name)}" oninput="updateParam('${scope}',${ti},${oi},${pi},'name',this.value)" placeholder="Название"></td>
      <td><input id="fld-p-${pi}" type="text" maxlength="10" value="${esc(p.code)}" oninput="updateParam('${scope}',${ti},${oi},${pi},'code',this.value)" placeholder="Код" class="${isErr ? 'err' : ''}"></td>
      <td>
        <select onchange="updateParamType('${scope}',${ti},${oi},${pi},this.value)">
          ${['List','CoefList','String','Integer','Float','Date','Boolean'].map(t =>
            `<option value="${t}"${p.type===t?' selected':''}>${t}</option>`
          ).join('')}
        </select>
      </td>
      <td>${renderDefaultCell(scope, ti, oi, pi, p)}</td>
      <td class="col-del"><button class="tbl-btn del-btn" onclick="deleteParam('${scope}',${ti},${oi},${pi})">✕</button></td>
    </tr>`;
  }).join('');

  return `<table class="params-table">
    <colgroup><col style="width:22px"><col style="width:45%"><col style="width:115px"><col style="width:95px"><col><col style="width:26px"></colgroup>
    <thead><tr>
      <th class="col-ctl"></th>
      <th>Название</th>
      <th>Код</th>
      <th>Тип</th>
      <th>Значение по умолчанию</th>
      <th class="col-del"></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTableEditor(idx) {
  const tbl = coefTables[idx];
  const editor = document.getElementById('editor');

  // Collect all param codes and types from schema
  const allParamMap = getAllParamMap(); // Map<code, type>
  const allCodes = new Set(allParamMap.keys());
  const datalistId = `dl-params-${idx}`;
  const datalistHtml = `<datalist id="${datalistId}">${[...allCodes].map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;

  // Duplicate key detection
  const seenKeys = new Set(), dupKeys = new Set();
  tbl.keys.forEach(k => { if (k) { seenKeys.has(k) ? dupKeys.add(k) : seenKeys.add(k); } });

  // Keys editor
  const keysHtml = tbl.keys.length === 0
    ? '<div style="color:#bbb;font-size:12px">Нет ключей — добавьте хотя бы один</div>'
    : `<div class="key-rows">${tbl.keys.map((k, ki) => {
        const isDup = k && dupKeys.has(k);
        const isUnknown = k && !allCodes.has(k);
        return `<div class="key-row" draggable="true"
          ondragstart="keyDragStart(event,${idx},${ki})"
          ondragover="keyDragOver(event,${ki})"
          ondragleave="keyDragLeave(event)"
          ondrop="keyDrop(event,${idx},${ki})"
          ondragend="keyDragEnd(event)">
          <span class="param-grip" onmousedown="keyGripMouseDown()">⠿</span>
          <input id="tbl-key-${idx}-${ki}" type="text" value="${esc(k)}" list="${datalistId}"
            class="${(isDup || isUnknown) ? 'err' : ''}"
            oninput="updateTableKey(${idx},${ki},this.value)"
            placeholder="Код параметра">
          <button class="tbl-btn del-btn" onclick="removeTableKey(${idx},${ki})" title="Удалить ключ">✕</button>
        </div>`;
      }).join('')}
      <div id="tbl-key-dup-${idx}">${dupKeys.size > 0 ? `<div style="color:#e53e3e;font-size:11px;margin-top:4px">⚠ Дублирующиеся ключи: ${[...dupKeys].map(k => `<b>${esc(k)}</b>`).join(', ')}</div>` : ''}</div>
      </div>`;

  // Дубли строк
  const dupRowIdxs = calcDupRowIdxs(tbl);

  // Values table
  const hasKeys = tbl.keys.length > 0;
  let tableHtml = '';
  if (hasKeys) {
    const colCount = tbl.keys.length + 3; // col-ctl + keys + value + del

    const headCells =
      `<th class="col-ctl"></th>` +
      tbl.keys.map((k, ci) =>
        `<th><div class="col-hdr-wrap">` +
          `<span class="col-hdr-name">${esc(k)||'?'}</span>` +
          `<button class="col-filter-btn" id="col-filter-btn-${idx}-${ci}" onclick="openCoefFilter(${idx},${ci},this)" title="Фильтр">▾</button>` +
        `</div></th>`
      ).join('') +
      `<th class="value-col"><div class="col-hdr-wrap">` +
        `<span class="col-hdr-name">Значение</span>` +
        `<button class="col-filter-btn" id="col-filter-btn-${idx}-${tbl.keys.length}" onclick="openCoefFilter(${idx},${tbl.keys.length},this)" title="Фильтр">▾</button>` +
      `</div></th>` +
      `<th></th>`;

    const rowCount = tbl.rows.length;
    const useVirt = rowCount > VIRT_THRESHOLD;

    // Строим начальное тело: при виртуальном режиме — первые VIRT_WINDOW строк + спейсеры
    let bodyRows;
    if (useVirt) {
      const initEnd = Math.min(rowCount - 1, VIRT_WINDOW - 1);
      let rows = '';
      for (let ri = 0; ri <= initEnd; ri++) rows += buildOneTableRow(idx, ri, ri, tbl, allParamMap, dupRowIdxs);
      const botH = Math.max(0, rowCount - VIRT_WINDOW) * VIRT_ROW_H;
      bodyRows =
        `<tr id="vsp-top-${idx}" class="virt-spacer" data-end="0"><td colspan="${colCount}" style="height:0;padding:0;border:none"></td></tr>` +
        rows +
        `<tr id="vsp-bot-${idx}" class="virt-spacer" data-start="${initEnd}"><td colspan="${colCount}" style="height:${botH}px;padding:0;border:none"></td></tr>`;
    } else {
      bodyRows = tbl.rows.map((_, ri) => buildOneTableRow(idx, ri, ri, tbl, allParamMap, dupRowIdxs)).join('');
    }

    const dupWarning = dupRowIdxs.size > 0
      ? `<div class="dup-rows-warn">⚠ Строки с одинаковыми ключами: ${[...dupRowIdxs].sort((a,b)=>a-b).map(i=>i+1).join(', ')}. При поиске вернётся первая совпавшая.</div>`
      : '';
    tableHtml = `<div id="coef-dup-${idx}">${dupWarning}</div><div id="coef-scroll-${idx}" class="coef-table-scroll"><div class="coef-table-wrap"><table class="coef-table">
      <thead><tr>${headCells}</tr></thead>
      <tbody id="coef-tbody-${idx}">${bodyRows}</tbody>
    </table></div></div>`;
  }

  const dupCode = tbl.code && coefTables.filter(t => t.code === tbl.code).length > 1;

  editor.innerHTML = `
    ${datalistHtml}
    <div class="section">
      <div class="section-title"><span class="stitle">Таблица коэффициентов</span></div>
      <div class="section-body">
        <div class="field-row">
          <span class="field-label">Название</span>
          <input class="field-input" type="text" value="${esc(tbl.name)}"
            oninput="updateCoefTableMeta(${idx},'name',this.value)" placeholder="Название">
        </div>
        <div class="field-row">
          <span class="field-label">Код</span>
          <input id="tbl-code-${idx}" class="field-input${(dupCode || !tbl.code) ? ' err' : ''}" type="text" value="${esc(tbl.code)}"
            oninput="updateCoefTableCode(${idx},this.value)" placeholder="Код">
        </div>
        <div class="field-row">
          <span class="field-label">Значение по умолчанию</span>
          <input class="field-input" type="number" step="0.01" value="${tbl.defaultVal ?? 1}"
            oninput="updateCoefTableMeta(${idx},'defaultVal',parseFloat(this.value)||0)">
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">
        <span class="stitle">Ключи (параметры) <span class="tag">${tbl.keys.length}</span></span>
        <button class="btn-primary btn-sm" onclick="addTableKey(${idx})">+ Ключ</button>
      </div>
      <div class="section-body">${keysHtml}</div>
    </div>
    <div class="section">
      <div class="section-title">
        <span class="stitle">Значения <span class="tag" id="coef-count-${idx}">${tbl.rows.length}</span></span>
        <button id="coef-clear-${idx}" class="btn-ghost btn-sm" onclick="clearCoefFilter(${idx})" style="display:none">✕ Сбросить фильтры</button>
        ${hasKeys ? `<button class="btn-primary btn-sm" onclick="addTableRow(${idx})">+ Строка</button>` : ''}
      </div>
      <div class="section-body">
        ${hasKeys ? `<div class="range-hint">
          <div class="rh-title">Как заполнять ячейки ключей:</div>
          <div class="rh-grid">
            <code>Сталь</code><span>точное совпадение со значением</span>
            <code>&lt;45</code><span>меньше числа (также <code>&lt;=</code> <code>&gt;</code> <code>&gt;=</code>)</span>
            <code>10..45</code><span>число в диапазоне от 10 до 45 включительно</span>
            <code>*</code><span>любое значение — используйте последней строкой как «иначе»</span>
          </div>
          <div class="rh-note">Строки проверяются сверху вниз — побеждает первая, где совпали <em>все</em> ключи.</div>
        </div>${tableHtml}` : '<div style="color:#bbb;font-size:12px">Сначала добавьте ключи</div>'}
      </div>
    </div>`;

  // Запускаем виртуальный скролл если нужно
  const rowCount2 = tbl.rows.length;
  if (hasKeys && rowCount2 > VIRT_THRESHOLD) {
    setupTableVirt(idx);
  }
}

function renderDefaultCell(scope, ti, oi, pi, p) {
  const upd = `updateParam('${scope}',${ti},${oi},${pi},'defaultVal',`;
  switch (p.type) {
    case 'List': {
      const key = `${scope}-${ti}-${oi}-${pi}`;
      const items = (p.defaultVal || '').split(';').filter(s => s.length > 0);
      return `<div class="list-editor"><div id="lt-${key}" class="list-tags">${buildListChips(scope,ti,oi,pi,items)}</div><input class="list-add-input" type="text" placeholder="Новый вариант + Enter" onkeydown="if(event.key==='Enter'){addListItem('${scope}',${ti},${oi},${pi},this);event.preventDefault()}"></div>`;
    }
    case 'CoefList': {
      const key = `${scope}-${ti}-${oi}-${pi}`;
      const items = p.items || [];
      const rows = items.map((it, ii) =>
        `<div class="coef-item-row" draggable="true"
           ondragstart="coefItemDragStart(event,'${scope}',${ti},${oi},${pi},${ii})"
           ondragover="coefItemDragOver(event,${ii})"
           ondragleave="coefItemDragLeave(event)"
           ondragend="coefItemDragEnd(event)"
           ondrop="coefItemDrop(event,'${scope}',${ti},${oi},${pi},${ii})">
          <span class="param-grip" onmousedown="coefItemGripMouseDown()">⠿</span>
          <input type="text" class="coef-label-inp" value="${esc(it.label)}" placeholder="Описание"
            ondragstart="event.stopPropagation()"
            oninput="updateCoefItem('${scope}',${ti},${oi},${pi},${ii},'label',this.value)">
          <input type="number" step="0.1" class="coef-val-inp" value="${it.value}"
            ondragstart="event.stopPropagation()"
            oninput="updateCoefItem('${scope}',${ti},${oi},${pi},${ii},'value',parseFloat(this.value)||1)">
          <button class="tbl-btn del-btn" onclick="deleteCoefItem('${scope}',${ti},${oi},${pi},${ii})">✕</button>
        </div>`
      ).join('');
      return `<div class="coef-list-editor">
        <div class="coef-max-row">
          <span>Макс. выборов:</span>
          <input type="number" step="1" min="1" max="${items.length || 1}" value="${p.maxSelect || 1}"
            oninput="updateCoefMaxSelect('${scope}',${ti},${oi},${pi},parseInt(this.value)||1)">
        </div>
        <div id="cl-${key}" class="coef-items">${rows}</div>
        <button class="tbl-btn" style="margin-top:4px" onclick="addCoefItem('${scope}',${ti},${oi},${pi})">+ Добавить</button>
      </div>`;
    }
    case 'String':  return `<input type="text" value="${esc(p.defaultVal)}" oninput="${upd}this.value)">`;
    case 'Integer': return `<input type="number" step="1" value="${esc(p.defaultVal)||0}" oninput="${upd}this.value)">`;
    case 'Float':   return `<input type="number" step="any" value="${esc(p.defaultVal)||0}" oninput="${upd}this.value)">`;
    case 'Date':    return `<input type="date" value="${esc(p.defaultVal)}" onchange="${upd}this.value)">`;
    case 'Boolean': return `<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" ${p.defaultVal==='True'?'checked':''} onchange="${upd}this.checked?'True':'False')"> True</label>`;
    default:        return `<input type="text" value="${esc(p.defaultVal)}" oninput="${upd}this.value)">`;
  }
}

// Targeted refresh of duplicate table CODE highlighting
function refreshTableCodeDup(idx) {
  const tbl = coefTables[idx];
  if (!tbl) return;
  const isDup = tbl.code && coefTables.filter(t => t.code === tbl.code).length > 1;
  const inp = document.getElementById('tbl-code-' + idx);
  if (inp) inp.classList.toggle('err', !tbl.code || isDup);
  renderSidebarTables();
}

// Targeted refresh of duplicate KEY NAME highlighting (called from updateTableKey)
function refreshKeyDups(idx) {
  const tbl = coefTables[idx];
  if (!tbl) return;

  const seen = new Set(), dups = new Set();
  tbl.keys.forEach(k => { if (k) { seen.has(k) ? dups.add(k) : seen.add(k); } });

  const allParamCodes = new Set(getAllParamMap().keys());
  tbl.keys.forEach((k, ki) => {
    const inp = document.getElementById('tbl-key-' + idx + '-' + ki);
    if (inp) inp.classList.toggle('err', !!(k && (dups.has(k) || !allParamCodes.has(k))));
  });

  const warnEl = document.getElementById('tbl-key-dup-' + idx);
  if (warnEl) {
    warnEl.innerHTML = dups.size > 0
      ? '<div style="color:#e53e3e;font-size:11px;margin-top:4px">⚠ Дублирующиеся ключи: ' + [...dups].map(k => '<b>' + esc(k) + '</b>').join(', ') + '</div>'
      : '';
  }
}

// Targeted refresh of duplicate row highlighting in coefficient table (no full re-render)
function refreshTableDups(idx) {
  const tbl = coefTables[idx];
  if (!tbl) return;

  const seenRowKeys = new Map();
  const dupRowIdxs = new Set();
  tbl.rows.forEach((row, ri) => {
    const combo = row.slice(0, tbl.keys.length).join('\x00');
    if (combo.trim().replace(/\x00/g, '') === '') return;
    if (seenRowKeys.has(combo)) { dupRowIdxs.add(ri); dupRowIdxs.add(seenRowKeys.get(combo)); }
    else seenRowKeys.set(combo, ri);
  });

  const tbody = document.getElementById('coef-tbody-' + idx);
  if (tbody) {
    tbody.querySelectorAll('tr').forEach((tr, ri) => tr.classList.toggle('dup-row', dupRowIdxs.has(ri)));
  }

  const warnEl = document.getElementById('coef-dup-' + idx);
  if (warnEl) {
    warnEl.innerHTML = dupRowIdxs.size > 0
      ? '<div class="dup-rows-warn">⚠ Есть строки с одинаковыми ключами (строки ' + [...dupRowIdxs].sort((a,b)=>a-b).map(i=>i+1).join(', ') + '). При поиске вернётся первая совпавшая.</div>'
      : '';
  }
}

