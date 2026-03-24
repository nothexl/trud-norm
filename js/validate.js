let _fieldErrors = {};

function getGlobalDupOpCodes() {
  const seen = new Set(), dups = new Set();
  schema.forEach(type => {
    type.operations.forEach(op => {
      if (op.code) { seen.has(op.code) ? dups.add(op.code) : seen.add(op.code); }
    });
  });
  return dups;
}

function getDupCodes(params) {
  const seen = new Set(), dups = new Set();
  params.forEach(p => {
    if (p.code) { seen.has(p.code) ? dups.add(p.code) : seen.add(p.code); }
  });
  return dups;
}

function getDupTypeNames() {
  const seen = new Set(), dups = new Set();
  schema.forEach(t => { if (t.name) { seen.has(t.name) ? dups.add(t.name) : seen.add(t.name); } });
  return dups;
}

function getDupSetNames(paramSets) {
  const seen = new Set(), dups = new Set();
  paramSets.forEach(ps => {
    if (ps.name) { seen.has(ps.name) ? dups.add(ps.name) : seen.add(ps.name); }
  });
  return dups;
}

function renderValidationBanner() {
  _fieldErrors = {};
  const errors = [];
  const dupTypeNames = getDupTypeNames();
  const reportedDupTypeNames = new Set();
  dupTypeNames.forEach(n => { reportedDupTypeNames.add(n); errors.push(`Дублирующееся название типа <b>${esc(n)}</b>`); });
  const globalDups = getGlobalDupOpCodes();
  globalDups.forEach(c => {
    const inTypes = schema.filter(t => t.operations.some(op => op.code === c)).map(t => `«${esc(t.name)}»`).join(', ');
    errors.push(`Дублирующийся код операции <b>${esc(c)}</b> (типы: ${inTypes})`);
  });
  schema.forEach((type) => {
    type.paramSets.forEach((ps, si) => {
      getDupCodes(ps.params).forEach(c => errors.push(`Тип «${esc(type.name)}», набор «${esc(ps.name) || `#${si+1}`}»: дубль <b>${esc(c)}</b>`));
    });
    const dupSetNames = getDupSetNames(type.paramSets);
    const reportedDupSetNames = new Set();
    type.paramSets.forEach((ps, si) => {
      if (!ps.name) errors.push(`Тип «${esc(type.name)}», набор #${si+1}: не указано название набора`);
      else if (dupSetNames.has(ps.name) && !reportedDupSetNames.has(ps.name)) {
        reportedDupSetNames.add(ps.name);
        errors.push(`Тип «${esc(type.name)}»: дублирующееся название набора «${esc(ps.name)}»`);
      }
    });
    type.operations.forEach(op => {
      getDupCodes(op.params).forEach(c => errors.push(`Операция «${esc(op.name)}» (${esc(op.code)}): дубль параметра <b>${esc(c)}</b>`));
    });
  });
  // Coefficient table duplicate codes
  const seenTblCodes = new Set(), dupTblCodes = new Set();
  coefTables.forEach(tbl => {
    if (tbl.code) { seenTblCodes.has(tbl.code) ? dupTblCodes.add(tbl.code) : seenTblCodes.add(tbl.code); }
  });
  dupTblCodes.forEach(c => errors.push(`Дублирующийся код таблицы <b>${esc(c)}</b>`));
  coefTables.forEach(tbl => {
    if (!tbl.code) errors.push(`Таблица «${esc(tbl.name || '(без названия)')}»: не указан код`);
  });

  // Coefficient table duplicate key names and duplicate rows
  coefTables.forEach(tbl => {
    const label = esc(tbl.name || tbl.code);
    const seenK = new Set(), dupK = new Set();
    tbl.keys.forEach(k => { if (k) { seenK.has(k) ? dupK.add(k) : seenK.add(k); } });
    dupK.forEach(k => errors.push(`Таблица «${label}»: дублирующееся название ключа <b>${esc(k)}</b>`));

    const seenR = new Map(), dupR = new Set();
    tbl.rows.forEach(row => {
      const combo = row.slice(0, tbl.keys.length).join('\x00');
      if (combo.trim().replace(/\x00/g, '') === '') return;
      seenR.has(combo) ? dupR.add(combo) : seenR.set(combo, true);
    });
    dupR.forEach(c => errors.push(`Таблица «${label}»: дублирующийся набор ключей <b>${esc(c.replace(/\x00/g, ' + '))}</b>`));
  });

  // Empty operation codes and parameter codes
  schema.forEach(type => {
    type.operations.forEach(op => {
      const opLabel = `Тип «${esc(type.name)}», операция «${esc(op.name) || '(без названия)'}»`;
      if (!op.name) errors.push(`${opLabel}: не указано название операции`);
      if (!op.code) errors.push(`${opLabel}: не указан код`);
      if (!op.shts && !op.shtsBranches) errors.push(`${opLabel}: не указан ШТС`);
      if (!op.prof && !op.profBranches) errors.push(`${opLabel}: не указан код профессии`);
    });
    const checkParams = (params, context) => params.forEach(p => {
      if (!p.name) errors.push(`${context}, параметр (код ${esc(p.code) || '?'}): не указано название`);
      if (!p.code) errors.push(`${context}, параметр «${esc(p.name) || '(без названия)'}»: не указан код`);
    });
    type.paramSets.forEach((ps, si) => checkParams(ps.params, `Тип «${esc(type.name)}», набор «${esc(ps.name) || `#${si+1}`}»`));
    type.operations.forEach(op => checkParams(op.params, `Операция «${esc(op.name) || '(без названия)'}» (${esc(op.code || '?')})`));
  });

  // Parameter code length > 10 (from loaded files)
  schema.forEach(type => {
    type.paramSets.forEach(ps => ps.params.forEach(p => {
      if (p.code && p.code.length > 10) errors.push(`Набор «${esc(ps.name) || '?'}», параметр «${esc(p.name) || '(без названия)'}»: код <b>${esc(p.code)}</b> превышает 10 символов`);
    }));
    type.operations.forEach(op => op.params.forEach(p => {
      if (p.code && p.code.length > 10) errors.push(`Операция «${esc(op.name) || '(без названия)'}», параметр «${esc(p.name) || '(без названия)'}»: код <b>${esc(p.code)}</b> превышает 10 символов`);
    }));
  });

  // Formula and protocol placeholder validation
  const tableCodes = new Set(coefTables.map(t => t.code).filter(Boolean));
  schema.forEach((type, ti) => {
    const typeParamCodes = new Set();
    type.paramSets.forEach(ps => ps.params.forEach(p => { if (p.code) typeParamCodes.add(p.code); }));
    const opCodes = new Set(type.operations.map(o => o.code).filter(Boolean));

    const checkPlaceholders = (text, context, allowValue) => {
      const builtins = new Set(['NAME', 'SHTS', 'PROF']);
      if (allowValue) builtins.add('VALUE');
      [...text.matchAll(/\{([^}]+)\}/g)].forEach(m => {
        const ph = m[1];
        if (builtins.has(ph)) return;
        if (ph.startsWith('p.')) { if (!typeParamCodes.has(ph.slice(2))) errors.push(`${context}: неизвестный параметр <b>{${esc(ph)}}</b>`); }
        else if (ph.startsWith('op.')) { if (!opCodes.has(ph.slice(3))) errors.push(`${context}: неизвестная операция <b>{${esc(ph)}}</b>`); }
        else if (ph.startsWith('K.')) { if (!tableCodes.has(ph.slice(2))) errors.push(`${context}: неизвестная таблица <b>{${esc(ph)}}</b>`); }
        else errors.push(`${context}: неизвестный плейсхолдер <b>{${esc(ph)}}</b>`);
      });
    };

    type.operations.forEach((op, oi) => {
      const feKey = `${ti}:${oi}`;
      const _setFE = (field, li) => {
        if (!_fieldErrors[feKey]) _fieldErrors[feKey] = { formula: false, formulaBranches: new Set(), protocol: new Set(), protocolBranches: new Set() };
        if (field === 'formula') _fieldErrors[feKey].formula = true;
        else if (field === 'formulaBranch') _fieldErrors[feKey].formulaBranches.add(li);
        else if (field === 'protocolBranch') _fieldErrors[feKey].protocolBranches.add(li);
        else _fieldErrors[feKey].protocol.add(li);
      };
      const opCtx = `Операция «${esc(op.name) || '(без названия)'}» (${esc(op.code || '?')})`;
      const allParamCodes = new Set([...typeParamCodes, ...op.params.map(p => p.code).filter(Boolean)]);
      const checkOp = (text, ctx, allowValue) => {
        const builtins = new Set(allowValue ? ['NAME', 'SHTS', 'PROF', 'VALUE'] : []);
        [...text.matchAll(/\{([^}]+)\}/g)].forEach(m => {
          const ph = m[1];
          if (builtins.has(ph)) return;
          if (ph.startsWith('p.')) { if (!allParamCodes.has(ph.slice(2))) errors.push(`${ctx}: неизвестный параметр <b>{${esc(ph)}}</b>`); }
          else if (ph.startsWith('op.')) { if (!opCodes.has(ph.slice(3))) errors.push(`${ctx}: неизвестная операция <b>{${esc(ph)}}</b>`); }
          else if (ph.startsWith('K.')) { if (!tableCodes.has(ph.slice(2))) errors.push(`${ctx}: неизвестная таблица <b>{${esc(ph)}}</b>`); }
          else errors.push(`${ctx}: неизвестный плейсхолдер <b>{${esc(ph)}}</b>`);
        });
      };
      const _fe0 = errors.length;
      const _allFormulas = op.formulaBranches
        ? op.formulaBranches.map(b => b.formula).filter(Boolean)
        : (op.formula ? [op.formula] : []);
      const _checkFormula = (fml, ctx) => {
        checkOp(fml, ctx, false);
        const paramTypes = new Map();
        type.paramSets.forEach(ps => ps.params.forEach(p => { if (p.code) paramTypes.set(p.code, p.type); }));
        op.params.forEach(p => { if (p.code) paramTypes.set(p.code, p.type); });
        [...fml.matchAll(/\{p\.([^}]+)\}/g)].forEach(m => {
          const pType = paramTypes.get(m[1]);
          if (pType === 'String' || pType === 'Date')
            errors.push(`${ctx}: параметр <b>${esc(m[1])}</b> имеет тип ${pType} — текстовые параметры нельзя использовать в формуле`);
        });
        const knownFns = /\b(Abs|Atn|Cos|Exp|Fix|Int|Log|Rnd|Sgn|Sin|Sqr|Tan|Round)\s*\(/gi;
        if (/\}\s*\{/.test(fml))
          errors.push(`${ctx}: между значениями отсутствует оператор`);
        const cleaned = fml
          .replace(/\{[^}]+\}/g, '1')
          .replace(/\bMod\b/gi, '%')
          .replace(knownFns, '(');
        if (!/^[\d\s+\-*/%^().eE,\\]*$/.test(cleaned)) {
          errors.push(`${ctx}: содержит недопустимые символы или неизвестные функции`);
        } else if (/[\d)]\s+[\d(]/.test(cleaned)) {
          errors.push(`${ctx}: между значениями отсутствует оператор`);
        } else if (/[*/%^\\]\s*[*/%^\\]/.test(cleaned)) {
          errors.push(`${ctx}: два оператора подряд`);
        } else if (/[*/%^\\]\s*[+]/.test(cleaned)) {
          errors.push(`${ctx}: некорректная последовательность операторов (используйте скобки: <b>* (-2)</b>)`);
        } else if (/[+\-]\s*[*/%^\\]/.test(cleaned)) {
          errors.push(`${ctx}: некорректная последовательность операторов`);
        } else if (/[+\-*/%^\\]\s*$/.test(cleaned)) {
          errors.push(`${ctx}: формула заканчивается оператором`);
        } else if (/^\s*[*/%^\\]/.test(cleaned)) {
          errors.push(`${ctx}: формула начинается с недопустимого оператора`);
        } else {
          let depth = 0;
          for (const c of cleaned) {
            if (c === '(') depth++;
            else if (c === ')') { depth--; if (depth < 0) break; }
          }
          if (depth !== 0) errors.push(`${ctx}: несбалансированные скобки`);
        }
      };
      if (op.formulaBranches) {
        op.formulaBranches.forEach((b, bi) => {
          const isDefault = bi === op.formulaBranches.length - 1;
          const ctx = `${opCtx}, вариант ${bi + 1}`;
          if (!isDefault) {
            const groups = b.conditionGroups || [];
            if (groups.length === 0 || groups.every(g => g.length === 0))
              errors.push(`${ctx}: не задано ни одного условия`);
            groups.forEach((group, gi) => group.forEach((c, ci) => {
              if (!c.code) errors.push(`${ctx}, группа ${gi+1}, условие ${ci+1}: не выбран параметр`);
              if (c.value === '' || c.value === undefined) errors.push(`${ctx}, группа ${gi+1}, условие ${ci+1}: не задано значение`);
            }));
          }
          const _bfFml0 = errors.length;
          if (!b.formula) errors.push(`${ctx}: формула не задана`);
          else _checkFormula(b.formula, `${ctx}, формула`);
          if (errors.length > _bfFml0) _setFE('formulaBranch', bi);
        });
      } else {
        if (!op.formula) {
          errors.push(`${opCtx}: формула не задана`);
          _setFE('formula');
        } else {
          _checkFormula(op.formula, `${opCtx}, формула`);
          if (errors.length > _fe0) _setFE('formula');
        }
      }
      if (op.protocolBranches) {
        op.protocolBranches.forEach((b, bi) => {
          const isDefault = bi === op.protocolBranches.length - 1;
          const ctx = `${opCtx}, протокол вариант ${bi + 1}`;
          if (!isDefault) {
            const groups = b.conditionGroups || [];
            if (groups.length === 0 || groups.every(g => g.length === 0))
              errors.push(`${ctx}: не задано ни одного условия`);
            groups.forEach((group, gi) => group.forEach((c, ci) => {
              if (!c.code) errors.push(`${ctx}, условие ${gi+1}.${ci+1}: не выбран параметр`);
              if (c.value === '' || c.value === undefined) errors.push(`${ctx}, условие ${gi+1}.${ci+1}: не задано значение`);
            }));
          }
          b.protocol.forEach((line, li) => {
            const _fp0 = errors.length;
            if (line) checkOp(line, `${ctx}, стр.${li+1}`, true);
            if (errors.length > _fp0) _setFE('protocolBranch', `${bi}:${li}`);
          });
        });
      } else {
        op.protocol.forEach((line, li) => {
          const _fp0 = errors.length;
          if (line) checkOp(line, `${opCtx}, протокол стр.${li+1}`, true);
          if (errors.length > _fp0) _setFE('protocol', li);
        });
      }

      ['shts', 'prof'].forEach(field => {
        const branches = op[field + 'Branches'];
        const fieldLabel = field === 'shts' ? 'ШТС' : 'Код профессии';
        if (branches) {
          branches.forEach((b, bi) => {
            const isDefault = bi === branches.length - 1;
            const ctx = `${opCtx}, ${fieldLabel} вариант ${bi + 1}`;
            if (!isDefault) {
              const groups = b.conditionGroups || [];
              if (groups.length === 0 || groups.every(g => g.length === 0))
                errors.push(`${ctx}: не задано ни одного условия`);
              groups.forEach((group, gi) => group.forEach((c, ci) => {
                if (!c.code) errors.push(`${ctx}, условие ${gi+1}.${ci+1}: не выбран параметр`);
                if (c.value === '' || c.value === undefined) errors.push(`${ctx}, условие ${gi+1}.${ci+1}: не задано значение`);
              }));
            }
            if (!b.value) errors.push(`${ctx}: не задано значение`);
          });
        }
      });
    });

  });

  // Invalid characters in codes (from loaded files)
  const hasInvalidCodeChars = /[^A-Za-z0-9_]/;
  schema.forEach(type => {
    type.operations.forEach(op => {
      if (op.code && hasInvalidCodeChars.test(op.code)) errors.push(`Операция «${esc(op.name) || '(без названия)'}»: код <b>${esc(op.code)}</b> содержит недопустимые символы`);
    });
    type.paramSets.forEach(ps => ps.params.forEach(p => {
      if (p.code && hasInvalidCodeChars.test(p.code)) errors.push(`Набор «${esc(ps.name) || '?'}», параметр «${esc(p.name) || '(без названия)'}»: код <b>${esc(p.code)}</b> содержит недопустимые символы`);
    }));
    type.operations.forEach(op => op.params.forEach(p => {
      if (p.code && hasInvalidCodeChars.test(p.code)) errors.push(`Операция «${esc(op.name) || '(без названия)'}», параметр «${esc(p.name) || '(без названия)'}»: код <b>${esc(p.code)}</b> содержит недопустимые символы`);
    }));
  });
  coefTables.forEach(tbl => {
    const label = esc(tbl.name || tbl.code);
    if (tbl.code && hasInvalidCodeChars.test(tbl.code)) errors.push(`Таблица «${label}»: код таблицы содержит недопустимые символы`);
    tbl.keys.forEach(k => {
      if (k && hasInvalidCodeChars.test(k)) errors.push(`Таблица «${label}»: ключ «${esc(k)}» содержит недопустимые символы`);
    });
  });

  // Empty table keys and unknown key param codes
  const globalParamMap = getAllParamMap();
  coefTables.forEach(tbl => {
    const label = `Таблица «${esc(tbl.name || tbl.code)}»`;
    tbl.keys.forEach((k, ki) => {
      if (!k) errors.push(`${label}: ключ №${ki + 1} не имеет названия`);
      else if (!globalParamMap.has(k)) errors.push(`${label}: ключ <b>${esc(k)}</b> не найден среди параметров схемы`);
    });
  });

  const indicator = document.getElementById('validIndicator');
  if (!indicator) return;
  if (errors.length === 0) { indicator.style.display = 'none'; return; }
  indicator.style.display = '';
  const n = errors.length;
  const word = (n % 10 === 1 && n % 100 !== 11) ? 'ошибка' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'ошибки' : 'ошибок';
  document.getElementById('validCount').textContent = `${n} ${word}`;
  document.getElementById('validTooltip').innerHTML =
    `<div class="valid-tooltip-inner"><div class="vt-title">⚠ Ошибки (${errors.length}):</div><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul></div>`;
}

function refreshEditorErrors() {
  if (!sel) return;
  if (sel.kind === 'op') {
    const op = schema[sel.ti].operations[sel.oi];
    const dupOps = getGlobalDupOpCodes();
    const nameInp = document.getElementById('fld-op-name');
    if (nameInp) nameInp.classList.toggle('err', !op.name);
    const inp = document.getElementById('fld-op-code');
    if (inp) inp.classList.toggle('err', !op.code || dupOps.has(op.code));
    const dups = getDupCodes(op.params);
    op.params.forEach((p, pi) => {
      const ni = document.getElementById(`fld-pn-${pi}`);
      if (ni) ni.classList.toggle('err', !p.name);
      const i = document.getElementById(`fld-p-${pi}`);
      if (i) i.classList.toggle('err', !p.code || dups.has(p.code));
    });
    ['shts', 'prof'].forEach(field => {
      const branches = op[field + 'Branches'];
      if (branches) {
        branches.forEach((b, bi) => {
          const vi = document.getElementById(`fld-fv-${field}-${bi}`);
          if (vi) vi.classList.toggle('err', !b.value);
          (b.conditionGroups || []).forEach((group, gi) => group.forEach((c, ci) => {
            const el = document.getElementById(`fld-fc-${field}-${bi}-${gi}-${ci}`);
            if (el) el.classList.toggle('err', c.value === '' || c.value === undefined);
          }));
        });
      } else {
        const si = document.getElementById(`fld-op-${field}`);
        if (si) si.classList.toggle('err', !op[field]);
      }
    });
    const tag = document.getElementById('tag-params');
    if (tag) { tag.textContent = op.params.length; tag.classList.toggle('err', dups.size > 0); }
    const fe = _fieldErrors[`${sel.ti}:${sel.oi}`];
    const fldFormula = document.getElementById('fld-formula');
    if (fldFormula) fldFormula.classList.toggle('err', !!(fe && fe.formula));
    op.formulaBranches && op.formulaBranches.forEach((b, bi) => {
      const ta = document.getElementById(`fld-fbf-${bi}`);
      if (ta) ta.classList.toggle('err', !!(fe && fe.formulaBranches && fe.formulaBranches.has(bi)));
      (b.conditionGroups || []).forEach((group, gi) => group.forEach((c, ci) => {
        const el = document.getElementById(`fld-cv-${bi}-${gi}-${ci}`);
        if (el) el.classList.toggle('err', c.value === '' || c.value === undefined);
      }));
    });
    if (op.protocolBranches) {
      op.protocolBranches.forEach((b, bi) => {
        b.protocol.forEach((_, li) => {
          const inp = document.getElementById(`fld-pbp-${bi}-${li}`);
          if (inp) inp.classList.toggle('err', !!(fe && fe.protocolBranches && fe.protocolBranches.has(`${bi}:${li}`)));
        });
        (b.conditionGroups || []).forEach((group, gi) => group.forEach((c, ci) => {
          const el = document.getElementById(`fld-pbc-${bi}-${gi}-${ci}`);
          if (el) el.classList.toggle('err', c.value === '' || c.value === undefined);
        }));
      });
    } else {
      op.protocol.forEach((_, li) => {
        const inp = document.getElementById(`fld-proto-${li}`);
        if (inp) inp.classList.toggle('err', !!(fe && fe.protocol && fe.protocol.has(li)));
      });
    }
  } else if (sel.kind === 'type' && sel.si === undefined) {
    const dupNames = getDupTypeNames();
    const nameInp = document.getElementById('fld-type-name');
    if (nameInp) nameInp.classList.toggle('err', dupNames.has(schema[sel.ti].name));
  } else if (sel.kind === 'type' && sel.si !== undefined) {
    const type = schema[sel.ti];
    const ps = type.paramSets[sel.si];
    const dups = getDupCodes(ps.params);
    ps.params.forEach((p, pi) => {
      const i = document.getElementById(`fld-p-${pi}`);
      if (i) i.classList.toggle('err', !p.code || dups.has(p.code));
    });
    const tag = document.getElementById('tag-params');
    if (tag) { tag.textContent = ps.params.length; tag.classList.toggle('err', dups.size > 0); }
    const dupNames = getDupSetNames(type.paramSets);
    const nameInp = document.getElementById('fld-set-name');
    if (nameInp) nameInp.classList.toggle('err', !ps.name || dupNames.has(ps.name));
  }
}
