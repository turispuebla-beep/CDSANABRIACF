'use strict';

const CATEGORY_ABBREV = {
  prebenjamin: 'PBJ',
  benjamin: 'BEN',
  alevin: 'ALE',
  infantil: 'INF',
  cadete: 'CAD',
  juvenil: 'JUV',
  senior: 'SEN',
  aficionado: 'SEN'
};

function normalizeTorneoAccessCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function isLegacyTorneoAccessCode(code) {
  return /^TP-\d{4}-[A-Z0-9]{4}$/.test(normalizeTorneoAccessCode(code));
}

function isResponsibleOnlyCode(code) {
  return /^TP-R\d{3}$/.test(normalizeTorneoAccessCode(code));
}

function formatResponsibleCode(num) {
  const n = parseInt(num, 10);
  if (!Number.isFinite(n) || n < 1) return 'TP-R001';
  return 'TP-R' + String(n).padStart(3, '0');
}

function parseResponsibleNumber(code) {
  const c = normalizeTorneoAccessCode(code);
  let m = /^TP-R(\d{3})$/.exec(c);
  if (m) return parseInt(m[1], 10);
  m = /^TP-R(\d{3})-/.exec(c);
  if (m) return parseInt(m[1], 10);
  return 0;
}

function categoryAbbrev(categoryId) {
  const key = String(categoryId || '').trim().toLowerCase();
  return CATEGORY_ABBREV[key] || key.slice(0, 3).toUpperCase() || 'EQP';
}

function buildCategorySuffix(categories) {
  const ids = Array.isArray(categories) ? categories : [];
  const abbrevs = [];
  const seen = new Set();
  ids.forEach(function (id) {
    const key = String(id || '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    abbrevs.push(categoryAbbrev(key));
  });
  abbrevs.sort();
  return abbrevs.length ? abbrevs.join('-') : 'EQP';
}

function buildTeamAccessCode(responsibleCode, categories, existingRecords) {
  const rc = normalizeTorneoAccessCode(responsibleCode);
  const suffix = buildCategorySuffix(categories);
  const base = rc + '-' + suffix;
  const list = Array.isArray(existingRecords) ? existingRecords : [];
  let maxSeq = 0;
  list.forEach(function (row) {
    const ac = normalizeTorneoAccessCode(row && row.accessCode);
    if (!ac || ac === base) {
      maxSeq = Math.max(maxSeq, 1);
      return;
    }
    const m = new RegExp('^' + base.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '-(\\d+)$').exec(ac);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  });
  if (maxSeq === 0) return base;
  return base + '-' + (maxSeq + 1);
}

function nextResponsibleNumberFromRecords(records) {
  let max = 0;
  (Array.isArray(records) ? records : []).forEach(function (row) {
    max = Math.max(max, parseResponsibleNumber(row && row.responsibleCode));
    max = Math.max(max, parseResponsibleNumber(row && row.accessCode));
  });
  return max + 1;
}

function pickResponsibleCodeForEmail(existingForEmail, allRecords) {
  const list = Array.isArray(existingForEmail) ? existingForEmail : [];
  for (let i = 0; i < list.length; i++) {
    const rc = list[i] && list[i].responsibleCode;
    if (rc) return normalizeTorneoAccessCode(rc);
  }
  const n = nextResponsibleNumberFromRecords(allRecords);
  return formatResponsibleCode(n);
}

/** Migra filas antiguas: asigna responsibleCode por email (no cambia accessCode legacy). */
function backfillResponsibleCodes(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const byEmail = {};
  list.forEach(function (row) {
    if (!row || !isActiveRow(row)) return;
    const email = String(row.contactEmail || '')
      .trim()
      .toLowerCase();
    if (!email) return;
    if (!byEmail[email]) byEmail[email] = [];
    byEmail[email].push(row);
  });
  let nextNum = nextResponsibleNumberFromRecords(list);
  Object.keys(byEmail).forEach(function (email) {
    const group = byEmail[email];
    if (group.some(function (r) { return r.responsibleCode; })) return;
    const rc = formatResponsibleCode(nextNum++);
    group.forEach(function (row) {
      row.responsibleCode = rc;
    });
  });
  return list;
}

function isActiveRow(record) {
  const st = String((record && record.status) || 'preinscripcion_enviada')
    .trim()
    .toLowerCase();
  return st !== 'descartada' && st !== 'eliminada' && st !== 'cancelada';
}

function assignCodesForNewPreinscripcion(patch, existingForEmail, allRecords) {
  const responsibleCode = pickResponsibleCodeForEmail(existingForEmail, allRecords);
  const accessCode = buildTeamAccessCode(responsibleCode, patch.categories, existingForEmail);
  return {
    responsibleCode: responsibleCode,
    accessCode: accessCode,
    isNewResponsible: !(existingForEmail || []).some(function (r) {
      return r && r.responsibleCode;
    })
  };
}

module.exports = {
  CATEGORY_ABBREV,
  normalizeTorneoAccessCode,
  isLegacyTorneoAccessCode,
  isResponsibleOnlyCode,
  formatResponsibleCode,
  parseResponsibleNumber,
  categoryAbbrev,
  buildCategorySuffix,
  buildTeamAccessCode,
  pickResponsibleCodeForEmail,
  assignCodesForNewPreinscripcion,
  backfillResponsibleCodes,
  isActiveRow
};
