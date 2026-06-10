/**
 * Numeración de amigos/as del club — CD Sanabria CF
 * Provisional al registrarse: AMIG + 6 dígitos (como SOC en socios)
 */
(function (global) {
  'use strict';

  function padFriendNum(n) {
    return String(n).padStart(6, '0');
  }

  function parseNumericFriendNumber(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'number' && Number.isFinite(val)) return Math.trunc(val);
    const s = String(val).trim();
    if (!s || /^AMIG/i.test(s)) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }

  function getDisplayNumber(f) {
    if (!f) return null;
    const n = parseNumericFriendNumber(f.numeroAmigo) || parseNumericFriendNumber(f.friendNumber);
    if (n != null) return n;
    const prov = String(f.numeroAmigo || f.friendNumber || '').trim();
    return prov || null;
  }

  function formatFriendLabel(f) {
    const raw = getDisplayNumber(f);
    if (raw == null) return '';
    if (typeof raw === 'string' && /^AMIG/i.test(raw)) return raw + ' (provisional)';
    if (typeof raw === 'number') return 'N.º AMIG. ' + padFriendNum(raw);
    return String(raw);
  }

  function formatFriendBadge(f) {
    const label = formatFriendLabel(f);
    return label ? '🤝 ' + label : '';
  }

  function generarNumeroProvisionalRegistro(friends) {
    let provisional;
    let exists = true;
    let guard = 0;
    while (exists && guard < 100) {
      provisional = 'AMIG' + String(Date.now()).slice(-6);
      exists = (friends || []).some(function (a) {
        return (
          String(a.numeroAmigo || '') === provisional ||
          String(a.friendNumber || '') === provisional
        );
      });
      guard++;
    }
    return provisional;
  }

  global.ClubFriendNumbers = {
    padFriendNum: padFriendNum,
    formatFriendLabel: formatFriendLabel,
    formatFriendBadge: formatFriendBadge,
    generarNumeroProvisionalRegistro: generarNumeroProvisionalRegistro,
    getDisplayNumber: getDisplayNumber
  };
})(typeof window !== 'undefined' ? window : globalThis);
