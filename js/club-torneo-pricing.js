/**
 * Cuotas torneo Fútbol 7 — 2026 por categoría (informativo + cálculo).
 */
(function (global) {
  'use strict';

  const CATEGORIES = [
    { id: 'prebenjamin', label: 'Prebenjamín (Chupetines)', feeEur: 60 },
    { id: 'benjamin', label: 'Benjamín', feeEur: 60 },
    { id: 'alevin', label: 'Alevín', feeEur: 60 },
    { id: 'infantil', label: 'Infantil', feeEur: 60 },
    { id: 'cadete', label: 'Cadete', feeEur: 60 },
    { id: 'juvenil', label: 'Juvenil', feeEur: 100 },
    { id: 'senior', label: 'Senior', feeEur: 100 }
  ];

  const FEE_BY_ID = {};
  CATEGORIES.forEach(function (c) {
    FEE_BY_ID[c.id] = c.feeEur;
  });
  FEE_BY_ID.aficionado = 100;

  function getCategories() {
    return CATEGORIES.slice();
  }

  function getFeeForCategoryId(id) {
    const key = String(id || '').trim().toLowerCase();
    const n = FEE_BY_ID[key];
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function sumFeesForCategoryIds(ids) {
    const list = Array.isArray(ids) ? ids : [];
    const seen = new Set();
    let sum = 0;
    list.forEach(function (id) {
      const key = String(id || '').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      sum += getFeeForCategoryId(key);
    });
    return Math.round(sum * 100) / 100;
  }

  function sumFeesForRecords(records) {
    const list = Array.isArray(records) ? records : [];
    let sum = 0;
    list.forEach(function (r) {
      if (!r) return;
      const st = String(r.plantillaStatus || '').toLowerCase();
      if (st === 'enviada_club' || st === 'pagada') return;
      sum += sumFeesForCategoryIds(r.categories);
    });
    return Math.round(sum * 100) / 100;
  }

  function formatEur(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return '0 €';
    return n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
  }

  function pricingTableHtml() {
    const rows = CATEGORIES.map(function (c) {
      return (
        '<tr><td style="padding:4px 8px 4px 0;">' +
        c.label +
        '</td><td style="padding:4px 0;text-align:right;font-weight:700;">' +
        formatEur(c.feeEur) +
        '</td></tr>'
      );
    }).join('');
    return (
      '<table style="width:100%;border-collapse:collapse;font-size:0.88rem;color:#334155;margin:0;">' +
      rows +
      '</table>'
    );
  }

  function pricingNoticeHtml() {
    return (
      '<div style="margin:0 0 14px;padding:12px 14px;background:#fefce8;border:1px solid #fde047;border-radius:10px;">' +
      '<p style="margin:0 0 8px;font-weight:700;color:#713f12;font-size:0.9rem;">Cuotas de inscripción (informativo)</p>' +
      pricingTableHtml() +
      '<p style="margin:8px 0 0;font-size:0.8rem;color:#854d0e;line-height:1.4;">' +
      'Envía <strong>una preinscripción por equipo</strong>. El nombre debe ser distinto si repites categoría (p. ej. «Leones A» y «Leones B»). El pago se realiza al completar la inscripción.</p></div>'
    );
  }

  function pricingPlainText() {
    return CATEGORIES.map(function (c) {
      return c.label + ': ' + formatEur(c.feeEur);
    }).join('\n');
  }

  global.ClubTorneoPricing = {
    CATEGORIES: CATEGORIES,
    getCategories: getCategories,
    getFeeForCategoryId: getFeeForCategoryId,
    sumFeesForCategoryIds: sumFeesForCategoryIds,
    sumFeesForRecords: sumFeesForRecords,
    formatEur: formatEur,
    pricingTableHtml: pricingTableHtml,
    pricingNoticeHtml: pricingNoticeHtml,
    pricingPlainText: pricingPlainText
  };
})(typeof window !== 'undefined' ? window : globalThis);
