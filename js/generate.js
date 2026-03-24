function scheduleGen(immediate) {
  if (genTimer) { clearTimeout(genTimer); genTimer = null; }
  immediate ? doGenerate() : (genTimer = setTimeout(doGenerate, 400));
}

function doGenerate() {
  generateCode();
  renderValidationBanner();
  refreshEditorErrors();
  renderSidebar(); // refresh ⚠ badges
}

function generateCode() {
  if (schema.length === 0 && coefTables.length === 0) { document.getElementById('codeOutput').value = ''; return; }
  const out = [];

  // Coefficient tables
  if (coefTables.length > 0) {
    out.push("Public CoefTables::CoefTables = Array( _");
    coefTables.forEach((tbl, ti) => {
      const last = ti === coefTables.length - 1;
      const keysVb = tbl.keys.map(k => `"${vb(k)}"`).join(', ');
      const defF = parseFloat(tbl.defaultVal); const defV = isNaN(defF) ? 1 : defF;
      const defStr = Number.isInteger(defV) ? `${defV}.0` : String(defV);
      out.push(`  Array("${vb(tbl.name)}", "${vb(tbl.code)}", ${defStr}, _`);
      out.push(`    Array(${keysVb}), _`);
      if (tbl.rows.length === 0) {
        out.push(`    Array() _`);
      } else {
        out.push(`    Array( _`);
        tbl.rows.forEach((row, ri) => {
          const rowVb = row.map(c => `"${vb(c)}"`).join(', ');
          out.push(`      Array(${rowVb})${ri < tbl.rows.length - 1 ? ', _' : ' _'}`);
        });
        out.push(`    ) _`);
      }
      out.push(`  )${last ? ' _' : ', _'}`);
    });
    out.push(')');
    out.push('');
  }

  if (schema.length === 0) { document.getElementById('codeOutput').value = out.join('\n'); return; }
  out.push("Public Schema::Schema = Array( _");
  schema.forEach((type, ti) => {
    const lastType = ti === schema.length - 1;
    out.push(`  Array("${vb(type.name)}", _`);
    if (type.paramSets.length === 0) {
      out.push(`    Array(), _`);
    } else {
      out.push(`    Array( _`);
      type.paramSets.forEach((ps, si) => {
        const lastPs = si === type.paramSets.length - 1;
        if (ps.params.length === 0) {
          out.push(`      Array("${vb(ps.name)}", Array())${lastPs ? ' _' : ', _'}`);
        } else {
          out.push(`      Array("${vb(ps.name)}", _`);
          out.push(`        Array( _`);
          ps.params.forEach((p, pi) => {
            out.push(`          ${paramVB(p)}${pi < ps.params.length - 1 ? ', _' : ' _'}`);
          });
          out.push(`        ) _`);
          out.push(`      )${lastPs ? ' _' : ', _'}`);
        }
      });
      out.push(`    ), _`);
    }
    if (type.operations.length === 0) {
      out.push(`    Array() _`);
    } else {
      out.push(`    Array( _`);
      type.operations.forEach((op, oi) => {
        const lastOp = oi === type.operations.length - 1;
        const sep = lastOp ? ' _' : ', _';
        out.push(`      Array("${vb(op.name)}", "${vb(op.shts)}", "${vb(op.prof)}", "${vb(op.code)}", _`);
        if (op.params.length === 0) {
          out.push(`        Array(), _`);
        } else {
          out.push(`        Array( _`);
          op.params.forEach((p, pi) => {
            out.push(`          ${paramVB(p)}${pi < op.params.length - 1 ? ', _' : ' _'}`);
          });
          out.push(`        ), _`);
        }
        out.push(`        "${vb(op.formula || '')}", _`);
        if (op.protocol.length === 0) {
          out.push(`        Array(), _`);
        } else {
          out.push(`        Array( _`);
          op.protocol.forEach((line, li) => {
            out.push(`          "${vb(line)}"${li < op.protocol.length - 1 ? ', _' : ' _'}`);
          });
          out.push(`        ), _`);
        }
        const nt = op.normTables || [];
        if (nt.length === 0) {
          out.push(`        Array() _`);
        } else {
          out.push(`        Array( _`);
          nt.forEach((t, ni) => {
            out.push(`          "${vb(t)}"${ni < nt.length - 1 ? ', _' : ' _'}`);
          });
          out.push(`        ) _`);
        }
        out.push(`      )${sep}`);
      });
      out.push(`    ) _`);
    }
    out.push(`  )${lastType ? ' _' : ', _'}`);
  });
  out.push(')');
  document.getElementById('codeOutput').value = out.join('\n');
}

function paramVB(p) { return `Array("${vb(p.name)}", "${vb(p.code)}", "${p.type}", ${defaultVB(p)})`; }
function defaultVB(p) {
  switch (p.type) {
    case 'List': case 'String': case 'Date': return `"${vb(p.defaultVal)}"`;
    case 'Integer': return `${parseInt(p.defaultVal) || 0}`;
    case 'Float': { const f = parseFloat(p.defaultVal); const v = isNaN(f) ? 0 : f; return Number.isInteger(v) ? `${v}.0` : String(v); }
    case 'Boolean': return p.defaultVal === 'True' ? 'True' : 'False';
    default: return `"${vb(p.defaultVal)}"`;
  }
}

function copyCode(btn) {
  const ta = document.getElementById('codeOutput');
  if (!ta.value) return;
  function flash() { const old = btn.textContent; btn.textContent = '✓ Скопировано'; setTimeout(() => btn.textContent = old, 1600); }
  navigator.clipboard.writeText(ta.value).then(flash).catch(() => { ta.select(); document.execCommand('copy'); flash(); });
}

function toWin1251(str) {
  // Windows-1251 table for bytes 0x80–0xBF
  const hi = [
    0x0402,0x0403,0x201A,0x0453,0x201E,0x2026,0x2020,0x2021,
    0x20AC,0x2030,0x0409,0x2039,0x040A,0x040C,0x040B,0x040F,
    0x0452,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,
    0x0098,0x2122,0x0459,0x203A,0x045A,0x045C,0x045B,0x045F,
    0x00A0,0x040E,0x045E,0x0408,0x00A4,0x0490,0x00A6,0x00A7,
    0x0401,0x00A9,0x0404,0x00AB,0x00AC,0x00AD,0x00AE,0x0407,
    0x00B0,0x00B1,0x0406,0x0456,0x0491,0x00B5,0x00B6,0x00B7,
    0x0451,0x2116,0x0454,0x00BB,0x0458,0x0405,0x0455,0x0457
  ];
  const map = new Map();
  for (let i = 0; i < hi.length; i++) map.set(hi[i], 0x80 + i);
  for (let i = 0; i < 64; i++) map.set(0x0410 + i, 0xC0 + i); // А–я
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    out[i] = c < 0x80 ? c : (map.get(c) ?? 0x3F);
  }
  return out;
}

function saveScript() {
  const code = document.getElementById('codeOutput').value;
  if (!code) { alert('Нет данных для сохранения'); return; }
  if (document.getElementById('validIndicator').style.display !== 'none') {
    alert('Нельзя сохранить: исправьте ошибки (показаны в индикаторе ⚠ рядом с заголовком).');
    return;
  }
  const blob = new Blob([toWin1251(code + '\n')], { type: 'text/plain;charset=windows-1251' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'TrudNorm_Schema.tcScript';
  a.click();
}
