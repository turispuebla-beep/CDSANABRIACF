'use strict';

const TORNEO_CATEGORIES = [
  { id: 'prebenjamin', label: 'Prebenjamín (Chupetines)', feeEur: 60 },
  { id: 'benjamin', label: 'Benjamín', feeEur: 60 },
  { id: 'alevin', label: 'Alevín', feeEur: 60 },
  { id: 'infantil', label: 'Infantil', feeEur: 60 },
  { id: 'cadete', label: 'Cadete', feeEur: 60 },
  { id: 'juvenil', label: 'Juvenil', feeEur: 100 },
  { id: 'senior', label: 'Senior', feeEur: 100 }
];

const FEE_BY_ID = {};
TORNEO_CATEGORIES.forEach(function (c) {
  FEE_BY_ID[c.id] = c.feeEur;
});
FEE_BY_ID.aficionado = 100;

function getTorneoFeeForCategoryId(id) {
  const key = String(id || '').trim().toLowerCase();
  const n = FEE_BY_ID[key];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getTorneoFeeForCategories(categories) {
  const list = Array.isArray(categories) ? categories : [];
  const seen = new Set();
  let sum = 0;
  list.forEach(function (id) {
    const key = String(id || '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    sum += getTorneoFeeForCategoryId(key);
  });
  return Math.round(sum * 100) / 100;
}

function getTorneoFeeForRecord(record) {
  if (!record || typeof record !== 'object') return 0;
  return getTorneoFeeForCategories(record.categories);
}

function getTorneoFeeForRecords(records) {
  const list = Array.isArray(records) ? records : [];
  let sum = 0;
  list.forEach(function (r) {
    if (!r) return;
    const st = String(r.plantillaStatus || '').toLowerCase();
    if (st === 'enviada_club' || st === 'pagada') return;
    sum += getTorneoFeeForRecord(r);
  });
  return Math.round(sum * 100) / 100;
}

function formatTorneoFeeEur(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '0 €';
  return n.toFixed(0) + ' €';
}

function torneoPricingPlainText() {
  return TORNEO_CATEGORIES.map(function (c) {
    return c.label + ': ' + formatTorneoFeeEur(c.feeEur);
  }).join('\n');
}

function torneoPricingTableHtml() {
  const rows = TORNEO_CATEGORIES.map(function (c) {
    return (
      '<tr><td style="padding:4px 8px 4px 0;">' +
      c.label +
      '</td><td style="padding:4px 0;text-align:right;font-weight:700;">' +
      formatTorneoFeeEur(c.feeEur) +
      '</td></tr>'
    );
  }).join('');
  return (
    '<table style="width:100%;border-collapse:collapse;font-size:0.88rem;color:#334155;margin:8px 0;">' +
    rows +
    '</table>'
  );
}

/** Compatibilidad: cuota única antigua (env) solo si no hay categorías. */
function getTorneoInscriptionFeeEurLegacy() {
  const n = parseFloat(String(process.env.TORNEO_INSCRIPTION_FEE_EUR || '0'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

module.exports = {
  TORNEO_CATEGORIES,
  getTorneoFeeForCategoryId,
  getTorneoFeeForCategories,
  getTorneoFeeForRecord,
  getTorneoFeeForRecords,
  formatTorneoFeeEur,
  torneoPricingPlainText,
  torneoPricingTableHtml,
  getTorneoInscriptionFeeEurLegacy
};
