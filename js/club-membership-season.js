/**
 * Temporada de socios: cierre 31 de mayo, plazo offline 7 días.
 * Valores por defecto alineados con variables Netlify (MEMBERSHIP_*).
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    closeMonth: 5,
    closeDay: 31,
    paymentDeadlineDays: 7,
    firstCloseYear: 2027
  };

  function readInjected() {
    var c = global.CDSAN_MEMBERSHIP_SEASON;
    if (!c || typeof c !== 'object') return {};
    return c;
  }

  function cfg() {
    var inj = readInjected();
    return {
      closeMonth: parseInt(inj.closeMonth || DEFAULTS.closeMonth, 10),
      closeDay: parseInt(inj.closeDay || DEFAULTS.closeDay, 10),
      paymentDeadlineDays: parseInt(inj.paymentDeadlineDays || DEFAULTS.paymentDeadlineDays, 10),
      firstCloseYear: parseInt(inj.firstCloseYear || DEFAULTS.firstCloseYear, 10)
    };
  }

  /** Mes 0-indexado para Date (mayo = 4). */
  function closeMonthIndex() {
    return cfg().closeMonth - 1;
  }

  function finDiaCierreTemporada(anio) {
    return new Date(anio, closeMonthIndex(), cfg().closeDay, 23, 59, 59, 999);
  }

  function getProximaVigenciaCuotaHasta(now) {
    var ref = now instanceof Date ? now : new Date();
    var y = cfg().firstCloseYear;
    for (var i = 0; i < 25; i++) {
      var d = finDiaCierreTemporada(y);
      if (d >= ref) return d;
      y++;
    }
    return finDiaCierreTemporada(cfg().firstCloseYear);
  }

  function getCuotaEdadReferenciaAnio(now) {
    var ref = now instanceof Date ? now : new Date();
    var y = cfg().firstCloseYear;
    while (ref > finDiaCierreTemporada(y)) y++;
    return y;
  }

  function getSeasonCloseYearToProcess(now) {
    var ref = now instanceof Date ? now : new Date();
    var y = ref.getFullYear();
    if (ref > finDiaCierreTemporada(y)) return y;
    return null;
  }

  function getCierreCuotaKey(anio) {
    var c = cfg();
    var m = String(c.closeMonth).padStart(2, '0');
    var d = String(c.closeDay).padStart(2, '0');
    return 'cierre-' + anio + '-' + m + '-' + d;
  }

  function getCurrentAutoRenewalKey(now) {
    var y = getSeasonCloseYearToProcess(now);
    return y != null ? getCierreCuotaKey(y) : null;
  }

  function formatCierreFechaCorta(anio) {
    var c = cfg();
    var m = String(c.closeMonth).padStart(2, '0');
    var d = String(c.closeDay).padStart(2, '0');
    return d + '/' + m + '/' + anio;
  }

  function formatCierreLabel(anio) {
    var meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    var c = cfg();
    var mes = meses[c.closeMonth - 1] || 'mayo';
    return c.closeDay + ' de ' + mes + ' de ' + anio;
  }

  function parseBirthDate(birth) {
    if (!birth) return null;
    var d = new Date(birth);
    return isNaN(d.getTime()) ? null : d;
  }

  function edadEnFechaReferenciaCierre(birth, anioCierre) {
    var ref = new Date(anioCierre, closeMonthIndex(), cfg().closeDay, 12, 0, 0, 0);
    var b = parseBirthDate(birth);
    if (!b) return NaN;
    var age = ref.getFullYear() - b.getFullYear();
    var m = ref.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
    return age;
  }

  function paymentDeadlineFromRegistration(regDate) {
    var reg = regDate instanceof Date ? regDate : new Date(regDate);
    if (isNaN(reg.getTime())) return null;
    return new Date(reg.getTime() + cfg().paymentDeadlineDays * 86400000);
  }

  function isOfflinePaymentChannel(ch) {
    var s = String(ch || '').toLowerCase();
    return s === 'transferencia' || s === 'transfer' || s === 'efectivo' || s === 'cash' || s === 'tpv';
  }

  function isRenovacionPending(member) {
    var pr = String((member && member.pendingReason) || '').toLowerCase();
    return pr === 'renovacion';
  }

  function isNuevaAltaPending(member) {
    var st = String((member && member.status) || (member && member.estado) || '').toLowerCase();
    if (st !== 'pending_validation' && st !== 'pendiente' && st !== 'pending') return false;
    return !isRenovacionPending(member);
  }

  var api = {
    getConfig: cfg,
    finDiaCierreTemporada: finDiaCierreTemporada,
    getProximaVigenciaCuotaHasta: getProximaVigenciaCuotaHasta,
    getCuotaEdadReferenciaAnio: getCuotaEdadReferenciaAnio,
    getSeasonCloseYearToProcess: getSeasonCloseYearToProcess,
    getCierreCuotaKey: getCierreCuotaKey,
    getCurrentAutoRenewalKey: getCurrentAutoRenewalKey,
    formatCierreFechaCorta: formatCierreFechaCorta,
    formatCierreLabel: formatCierreLabel,
    edadEnFechaReferenciaCierre: edadEnFechaReferenciaCierre,
    paymentDeadlineFromRegistration: paymentDeadlineFromRegistration,
    isOfflinePaymentChannel: isOfflinePaymentChannel,
    isRenovacionPending: isRenovacionPending,
    isNuevaAltaPending: isNuevaAltaPending,
    // Alias histórico (antes 31/08)
    edadEnFechaReferencia31Agosto: edadEnFechaReferenciaCierre
  };

  global.ClubMembershipSeason = api;
})(typeof window !== 'undefined' ? window : this);
