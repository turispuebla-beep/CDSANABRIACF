/**
 * Temporada deportiva CD Sanabria CF.
 * Desde el 1 de junio: temporada Y-(Y+1). Antes de junio: (Y-1)-Y.
 * Ej.: mayo 2027 → 2026-2027; junio 2027 → 2027-2028.
 */
(function (global) {
  'use strict';

  function getActiveSeason(referenceDate) {
    const d = referenceDate ? new Date(referenceDate) : new Date();
    if (isNaN(d.getTime())) return '2026-2027';
    const year = d.getFullYear();
    const month = d.getMonth();
    if (month >= 5) {
      return year + '-' + (year + 1);
    }
    return year - 1 + '-' + year;
  }

  global.ClubSeason = {
    getActiveSeason: getActiveSeason
  };
})(typeof window !== 'undefined' ? window : globalThis);
