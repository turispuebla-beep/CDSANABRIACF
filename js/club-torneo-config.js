/**
 * Configuración pública torneo Fútbol 7 — cuota inscripción equipo (tarjeta al cerrar plantilla).
 * En producción: variable Netlify TORNEO_INSCRIPTION_FEE_EUR (build genera cdsan-torneo-env.js).
 */
(function (global) {
  'use strict';

  const DEFAULT_FEE = 0;

  function getInscriptionFeeEur() {
    if (global.CDSAN_TORNEO && Number.isFinite(global.CDSAN_TORNEO.inscriptionFeeEur)) {
      return Math.max(0, Number(global.CDSAN_TORNEO.inscriptionFeeEur));
    }
    const n = parseFloat(String(global.CDSAN_TORNEO_INSCRIPTION_FEE_EUR || DEFAULT_FEE));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function formatFeeLabel(eur) {
    const n = Number(eur);
    if (!Number.isFinite(n) || n <= 0) return 'Sin cuota online (el club confirmará el importe)';
    return n.toFixed(2).replace('.', ',') + ' €';
  }

  global.ClubTorneoConfig = {
    getInscriptionFeeEur: getInscriptionFeeEur,
    formatFeeLabel: formatFeeLabel
  };
})(typeof window !== 'undefined' ? window : globalThis);
