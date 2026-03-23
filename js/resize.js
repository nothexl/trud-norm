let _colResize = null;
const _COL_ORDER = ['name', 'code', 'type', 'def'];
const _COL_IDX   = { name: 1, code: 2, type: 3, def: 4 }; // colgroup indices (0=grip, 5=del)

function colResizeStart(e, key) {
  // Snapshot actual rendered widths from DOM if not yet measured (auto-layout table)
  const table = document.querySelector('.params-table');
  if (table && !paramColWidths.name) {
    const ths = table.querySelectorAll('thead th');
    _COL_ORDER.forEach((k, i) => {
      paramColWidths[k] = Math.round(ths[i + 1].getBoundingClientRect().width);
    });
    const cols = table.querySelectorAll('colgroup col');
    _COL_ORDER.forEach(k => { cols[_COL_IDX[k]].style.width = paramColWidths[k] + 'px'; });
    table.classList.remove('params-table-auto');
  }

  const keyPos = _COL_ORDER.indexOf(key);
  const rightCols = _COL_ORDER.slice(keyPos + 1);
  const startRightW = {};
  for (const col of rightCols) startRightW[col] = paramColWidths[col] || 50;
  _colResize = { key, startX: e.clientX, startW: paramColWidths[key] || 100, startRightW };
  e.target.classList.add('active');
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  document.addEventListener('mousemove', colResizeMove);
  document.addEventListener('mouseup', colResizeEnd);
  e.preventDefault(); e.stopPropagation();
}

function colResizeMove(e) {
  if (!_colResize) return;
  const delta = e.clientX - _colResize.startX;
  const cw = paramColWidths;
  const table = document.querySelector('.params-table');
  if (!table) return;
  const cols = table.querySelectorAll('colgroup col');

  const keyPos = _COL_ORDER.indexOf(_colResize.key);
  const rightCols = _COL_ORDER.slice(keyPos + 1);

  // Max key can grow: sum of (rightCol - 50) for all right cols
  const maxGrow = rightCols.reduce((s, col) => s + Math.max(0, _colResize.startRightW[col] - 50), 0);
  const maxShrink = _colResize.startW - 50;
  const d = Math.max(-maxShrink, Math.min(maxGrow, delta));

  cw[_colResize.key] = _colResize.startW + d;
  cols[_COL_IDX[_colResize.key]].style.width = cw[_colResize.key] + 'px';

  if (d > 0) {
    // Cascade: shrink right cols one by one from left to right
    let toShrink = d;
    for (const col of rightCols) {
      const shrinkBy = Math.min(toShrink, Math.max(0, _colResize.startRightW[col] - 50));
      cw[col] = _colResize.startRightW[col] - shrinkBy;
      cols[_COL_IDX[col]].style.width = cw[col] + 'px';
      toShrink -= shrinkBy;
      if (toShrink <= 0) break;
    }
  } else {
    // Key shrinks: restore all right cols to start, then grow first right col by |d|
    // This keeps total table width constant
    for (const col of rightCols) {
      cw[col] = _colResize.startRightW[col];
      cols[_COL_IDX[col]].style.width = cw[col] + 'px';
    }
    if (rightCols.length > 0 && d < 0) {
      cw[rightCols[0]] = _colResize.startRightW[rightCols[0]] + (-d);
      cols[_COL_IDX[rightCols[0]]].style.width = cw[rightCols[0]] + 'px';
    }
  }
}

function colResizeEnd() {
  document.querySelectorAll('.col-resizer.active').forEach(el => el.classList.remove('active'));
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  _colResize = null;
  document.removeEventListener('mousemove', colResizeMove);
  document.removeEventListener('mouseup', colResizeEnd);
}
