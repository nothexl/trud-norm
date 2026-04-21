function loadScript(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const parsed = parseSchemaFromScript(e.target.result);
    if (parsed === null) { alert('Не удалось найти или разобрать константу Schema в файле.\nУбедитесь, что файл содержит "Private Schema::Schema = Array(..."'); return; }
    if (parsed.length === 0) { alert('Схема найдена, но не содержит типов.'); return; }
    schema = parsed;
    coefTables = parseCoefTablesFromScript(e.target.result);
    // Обрезаем лишние пробелы в строковых значениях ячеек (защита от внешних скриптов)
    coefTables.forEach(tbl => {
      tbl.rows.forEach(row => {
        row.forEach((cell, ci) => {
          if (typeof cell === 'string') row[ci] = cell.trim();
        });
      });
    });
    sel = { kind:'type', ti: 0 };
    expandedTypes = new Set([0]);
    renderAll(true);
  };
  reader.readAsText(file, 'windows-1251');
  event.target.value = '';
}

function parseCoefTablesFromScript(text) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const joined = text.replace(/[ \t]*_\n[ \t]*/g, ' ');
  const noComments = joined.split('\n').filter(line => !/^\s*'/.test(line)).join('\n');
  const m = noComments.match(/CoefTables\s*=\s*(Array\s*\()/i);
  if (!m) return [];
  const startPos = m.index + m[0].length - m[1].length;
  try {
    const parsed = vbParse(noComments.slice(startPos));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(tblArr => {
      if (!Array.isArray(tblArr)) return null;
      return {
        name: String(tblArr[0] || ''),
        code: String(tblArr[1] || ''),
        defaultVal: (() => { const f = parseFloat(tblArr[2]); return isNaN(f) ? 1 : f; })(),
        keys: Array.isArray(tblArr[3]) ? tblArr[3].map(String) : [],
        rows: Array.isArray(tblArr[4]) ? tblArr[4].map(row => Array.isArray(row) ? row.map(String) : []) : []
      };
    }).filter(Boolean);
  } catch (e) {
    console.error('CoefTables parse error:', e);
    return [];
  }
}

function parseSchemaFromScript(text) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const joined = text.replace(/[ \t]*_\n[ \t]*/g, ' ');
  const noComments = joined.split('\n')
    .filter(line => !/^\s*'/.test(line))
    .join('\n');
  const m = noComments.match(/Schema\s*=\s*(Array\s*\()/i);
  if (!m) return null;
  const startPos = m.index + m[0].length - m[1].length;
  const src = noComments.slice(startPos);
  try {
    const parsed = vbParse(src);
    if (!Array.isArray(parsed)) return null;
    return parsedToSchema(parsed);
  } catch (e) {
    console.error('Parse error:', e);
    return null;
  }
}

function vbParse(src) {
  let pos = 0;

  function ws() { while (pos < src.length && ' \t\n\r'.includes(src[pos])) pos++; }

  function val() {
    ws();
    if (src.startsWith('Array', pos) && src[pos + 5] === '(') return arr();
    if (src[pos] === '"') return str();
    if (src.startsWith('True', pos) && !/\w/.test(src[pos + 4] || '')) { pos += 4; return true; }
    if (src.startsWith('False', pos) && !/\w/.test(src[pos + 5] || '')) { pos += 5; return false; }
    return num();
  }

  function arr() {
    pos += 6; // skip 'Array('
    ws();
    if (src[pos] === ')') { pos++; return []; }
    const items = [];
    while (pos < src.length) {
      items.push(val());
      ws();
      if (src[pos] === ',') { pos++; continue; }
      if (src[pos] === ')') { pos++; break; }
      break;
    }
    return items;
  }

  function str() {
    pos++; let s = '';
    while (pos < src.length) {
      if (src[pos] === '"') {
        if (src[pos + 1] === '"') { s += '"'; pos += 2; }
        else { pos++; break; }
      } else { s += src[pos++]; }
    }
    return s;
  }

  function num() {
    let s = '';
    if (src[pos] === '-') s += src[pos++];
    while (pos < src.length && /[0-9.]/.test(src[pos])) s += src[pos++];
    return parseFloat(s) || 0;
  }

  return val();
}

function parsedToSchema(arr) {
  return arr.map(typeArr => {
    if (!Array.isArray(typeArr)) return null;
    const rawSets = Array.isArray(typeArr[1]) ? typeArr[1] : [];
    // New format: each element is [setName, paramsArray]; old format: each element is a param array [name, code, type, default]
    const isNewFormat = rawSets.length === 0 ||
      (Array.isArray(rawSets[0]) && rawSets[0].length === 2 && Array.isArray(rawSets[0][1]));
    const paramSets = isNewFormat
      ? rawSets.map(s => ({ name: String(s[0] || ''), params: (Array.isArray(s[1]) ? s[1] : []).map(p => parseParam(p)) }))
      : [{ name: '', params: rawSets.map(p => parseParam(p)) }];
    return {
      name: String(typeArr[0] || ''),
      paramSets,
      operations: (Array.isArray(typeArr[2]) ? typeArr[2] : []).map(opArr => ({
        name: String(opArr[0] || ''),
        shts: Array.isArray(opArr[1]) ? '' : String(opArr[1] || ''),
        shtsBranches: Array.isArray(opArr[1]) ? opArr[1].map(b => { if (!Array.isArray(b)) return { conditionGroups: [], value: '' }; const parsed = parseConditionStr(String(b[0] || '')); return { conditionGroups: parsed !== null ? parsed : [], value: String(b[1] || '') }; }) : undefined,
        prof: Array.isArray(opArr[2]) ? '' : String(opArr[2] || ''),
        profBranches: Array.isArray(opArr[2]) ? opArr[2].map(b => { if (!Array.isArray(b)) return { conditionGroups: [], value: '' }; const parsed = parseConditionStr(String(b[0] || '')); return { conditionGroups: parsed !== null ? parsed : [], value: String(b[1] || '') }; }) : undefined,
        code: String(opArr[3] || ''),
        params: (Array.isArray(opArr[4]) ? opArr[4] : []).map(p => parseParam(p)),
        formula: Array.isArray(opArr[5]) ? '' : String(opArr[5] || ''),
        formulaBranches: Array.isArray(opArr[5])
          ? opArr[5].map(b => {
              if (!Array.isArray(b)) return { conditionGroups: [], formula: '' };
              const parsed = parseConditionStr(String(b[0] || ''));
              return { conditionGroups: parsed !== null ? parsed : [], formula: String(b[1] || '') };
            })
          : undefined,
        protocol: (() => { const r = Array.isArray(opArr[6]) ? opArr[6] : []; return (r.length > 0 && Array.isArray(r[0])) ? [] : r.map(s => String(s || '')); })(),
        protocolBranches: (() => { const r = Array.isArray(opArr[6]) ? opArr[6] : []; if (r.length === 0 || !Array.isArray(r[0])) return undefined; return r.map(b => { if (!Array.isArray(b)) return { conditionGroups: [], protocol: [] }; const parsed = parseConditionStr(String(b[0] || '')); return { conditionGroups: parsed !== null ? parsed : [], protocol: (Array.isArray(b[1]) ? b[1] : []).map(s => String(s || '')) }; }); })(),
        normTables: (Array.isArray(opArr[7]) ? opArr[7] : []).map(s => String(s || '')).filter(Boolean),
        documents: (Array.isArray(opArr[8]) ? opArr[8] : []).map(s => String(s || '')).filter(Boolean),
        techKit: String(opArr[9] || '')
      }))
    };
  }).filter(Boolean);
}

function parseConditionStr(str) {
  if (!str) return [];
  const opMap = { '=': '=', '<>': '≠', '<': '<', '>': '>', '<=': '≤', '>=': '≥' };
  const parseOne = s => {
    const m = s.trim().match(/^\{p\.([^}]+)\}\s*(=|<>|<=|>=|<|>)\s*(?:"((?:[^"]|"")*)"|(-?[\d.]+))$/);
    if (!m) return null;
    const value = m[3] !== undefined ? m[3].replace(/""/g, '"') : (m[4] || '');
    return { code: m[1], op: opMap[m[2]] || '=', value };
  };
  const orParts = str.split(/\s+Or\s+/i).map(s => s.trim().replace(/^\(|\)$/g, ''));
  const groups = [];
  for (const orPart of orParts) {
    const andParts = orPart.split(/\s+And\s+/i);
    const group = [];
    for (const part of andParts) {
      const c = parseOne(part);
      if (!c) return null;
      group.push(c);
    }
    groups.push(group);
  }
  return groups;
}

function parseParam(p) {
  if (!Array.isArray(p)) return { name:'', code:'', type:'String', defaultVal:'' };
  const type = String(p[2] || 'String');
  if (type === 'CoefList') {
    const rawItems = Array.isArray(p[3]) ? p[3] : [];
    const items = rawItems.map(it => Array.isArray(it)
      ? { label: String(it[0] || ''), value: parseFloat(it[1]) || 1 }
      : { label: '', value: 1 }
    );
    return { name: String(p[0] || ''), code: String(p[1] || ''), type, items, maxSelect: parseInt(p[4]) || 1 };
  }
  const raw = p[3];
  let defaultVal = '';
  if (typeof raw === 'boolean') defaultVal = raw ? 'True' : 'False';
  else if (type === 'Integer') defaultVal = String(parseInt(raw) || 0);
  else if (type === 'Float') { const f = parseFloat(raw); defaultVal = isNaN(f) ? '0.0' : (Number.isInteger(f) ? f + '.0' : String(f)); }
  else defaultVal = String(raw || '');
  return { name: String(p[0] || ''), code: String(p[1] || ''), type, defaultVal };
}
