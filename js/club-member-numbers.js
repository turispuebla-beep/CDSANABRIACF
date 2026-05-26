/**
 * Numeración de socios — CD Sanabria CF
 * 1–50: reservados (Socio de Honor, asignación manual del club)
 * 51+: numeración automática en altas/validaciones
 */
(function (global) {
  'use strict';

  const HONOR_MIN = 1;
  const HONOR_MAX = 50;
  const REGULAR_MIN = 51;

  function parseNumericMemberNumber(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'number' && Number.isFinite(val)) return Math.trunc(val);
    const s = String(val).trim();
    if (!s || /^SOC/i.test(s)) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }

  function isSocioDeHonor(m) {
    if (!m || typeof m !== 'object') return false;
    return m.socioDeHonor === true || m.membershipTier === 'honor';
  }

  function getHonorNumber(m) {
    if (!m) return null;
    const n = parseNumericMemberNumber(m.numeroSocioHonor);
    if (n != null && n >= HONOR_MIN && n <= HONOR_MAX) return n;
    if (isSocioDeHonor(m)) {
      const fallback = parseNumericMemberNumber(m.memberNumber) || parseNumericMemberNumber(m.numeroSocio);
      if (fallback != null && fallback >= HONOR_MIN && fallback <= HONOR_MAX) return fallback;
    }
    return null;
  }

  function getRegularNumber(m) {
    if (!m) return null;
    const backup = parseNumericMemberNumber(m.numeroSocioRegular);
    if (backup != null && backup >= REGULAR_MIN) return backup;
    if (isSocioDeHonor(m)) return null;
    const n = parseNumericMemberNumber(m.memberNumber) || parseNumericMemberNumber(m.numeroSocio);
    if (n != null && n >= REGULAR_MIN) return n;
    return null;
  }

  function getDisplayNumber(m) {
    if (isSocioDeHonor(m)) return getHonorNumber(m);
    return getRegularNumber(m);
  }

  /** Formatea un entero con ceros a la izquierda hasta 6 dígitos. Ej: 51 → "000051" */
  function padSocNum(n) {
    return String(n).padStart(6, '0');
  }

  /** Etiqueta completa. Ej: "N.º SOC. 000051"  /  "🏅 SOCIO DE HONOR · N.º SOC. 000003" */
  function formatMemberLabel(m) {
    if (isSocioDeHonor(m)) {
      const h = getHonorNumber(m);
      return h != null ? 'SOCIO DE HONOR · N.º SOC. ' + padSocNum(h) : 'SOCIO DE HONOR';
    }
    const n = getDisplayNumber(m);
    return n != null ? 'N.º SOC. ' + padSocNum(n) : '';
  }

  function formatMemberBadge(m) {
    if (isSocioDeHonor(m)) {
      const h = getHonorNumber(m);
      return h != null ? '🏅 SOCIO DE HONOR · N.º SOC. ' + padSocNum(h) : '🏅 SOCIO DE HONOR';
    }
    const n = getDisplayNumber(m);
    return n != null ? '🏷️ N.º SOC. ' + padSocNum(n) : '';
  }

  function formatMemberBadgeHtml(m) {
    if (isSocioDeHonor(m)) {
      const h = getHonorNumber(m);
      const label = h != null ? 'SOCIO DE HONOR · N.º SOC. ' + padSocNum(h) : 'SOCIO DE HONOR';
      return '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:6px;font-weight:700;font-size:0.85rem;">🏅 ' + label + '</span>';
    }
    const n = getDisplayNumber(m);
    if (n == null) return '';
    return '<span style="color:#059669;font-weight:600;">N.º SOC. ' + padSocNum(n) + '</span>';
  }

  function honorNumberTaken(members, num, excludeId) {
    const n = parseInt(num, 10);
    if (!Number.isFinite(n) || n < HONOR_MIN || n > HONOR_MAX) return true;
    return (members || []).some(function (m) {
      if (excludeId && String(m.id) === String(excludeId)) return false;
      return isSocioDeHonor(m) && getHonorNumber(m) === n;
    });
  }

  function nextRegularMemberNumber(members) {
    let max = REGULAR_MIN - 1;
    (members || []).forEach(function (m) {
      const regular = getRegularNumber(m);
      if (regular != null && regular > max) max = regular;
      const backup = parseNumericMemberNumber(m.numeroSocioRegular);
      if (backup != null && backup >= REGULAR_MIN && backup > max) max = backup;
      if (!isSocioDeHonor(m)) {
        const n = parseNumericMemberNumber(m.memberNumber) || parseNumericMemberNumber(m.numeroSocio);
        if (n != null && n >= REGULAR_MIN && n > max) max = n;
      }
    });
    return Math.max(max + 1, REGULAR_MIN);
  }

  function syncMemberNumberFields(m) {
    if (!m) return m;
    if (isSocioDeHonor(m)) {
      const h = getHonorNumber(m);
      if (h != null) {
        m.numeroSocioHonor = h;
        m.memberNumber = h;
        m.numeroSocio = h;
      }
      m.membershipTier = 'honor';
    } else {
      m.socioDeHonor = false;
      delete m.numeroSocioHonor;
      m.membershipTier = 'regular';
      const r = getRegularNumber(m);
      if (r != null) {
        m.memberNumber = r;
        m.numeroSocio = r;
      }
    }
    return m;
  }

  function assignNextRegularNumberIfNeeded(member, members) {
    if (!member || isSocioDeHonor(member)) return member;
    if (getRegularNumber(member) != null) return member;
    const next = nextRegularMemberNumber(members);
    member.numeroSocioRegular = next;
    member.memberNumber = next;
    member.numeroSocio = next;
    member.membershipTier = 'regular';
    member.socioDeHonor = false;
    return member;
  }

  function applyHonorToMember(member, honorNum, members, excludeId) {
    const n = parseInt(honorNum, 10);
    if (!Number.isFinite(n) || n < HONOR_MIN || n > HONOR_MAX) {
      return { ok: false, error: 'El número de honor debe estar entre ' + HONOR_MIN + ' y ' + HONOR_MAX };
    }
    if (honorNumberTaken(members, n, excludeId || member.id)) {
      return { ok: false, error: 'El número ' + n + ' ya está asignado a otro Socio de Honor' };
    }
    const prevRegular = getRegularNumber(member);
    if (prevRegular != null && prevRegular >= REGULAR_MIN) {
      member.numeroSocioRegular = prevRegular;
    } else {
      const loose = parseNumericMemberNumber(member.memberNumber) || parseNumericMemberNumber(member.numeroSocio);
      if (loose != null && loose >= REGULAR_MIN) member.numeroSocioRegular = loose;
    }
    member.socioDeHonor = true;
    member.numeroSocioHonor = n;
    member.memberNumber = n;
    member.numeroSocio = n;
    member.membershipTier = 'honor';
    member.honorAssignedAt = new Date().toISOString();
    return { ok: true };
  }

  function removeHonorFromMember(member, members) {
    if (!member) return { ok: true };
    member.socioDeHonor = false;
    member.numeroSocioHonor = null;
    member.membershipTier = 'regular';
    const restored = parseNumericMemberNumber(member.numeroSocioRegular);
    if (restored != null && restored >= REGULAR_MIN) {
      member.memberNumber = restored;
      member.numeroSocio = restored;
    } else if (String(member.status || '').toLowerCase() === 'active' || member.estado === 'activo') {
      assignNextRegularNumberIfNeeded(member, members);
    } else {
      member.memberNumber = member.memberNumber || member.numeroSocio || null;
    }
    return { ok: true };
  }

  /** Nº provisional al registrarse (antes de validar/pagar): no usa el rango 1–50 ni 51+ */
  function generarNumeroProvisionalRegistro(members) {
    let provisional;
    let exists = true;
    let guard = 0;
    while (exists && guard < 100) {
      provisional = 'SOC' + String(Date.now()).slice(-6);
      exists = (members || []).some(function (s) {
        return String(s.numeroSocio || '') === provisional || String(s.memberNumber || '') === provisional;
      });
      guard++;
    }
    return provisional;
  }

  global.ClubMemberNumbers = {
    padSocNum: padSocNum,
    formatMemberLabel: formatMemberLabel,
    HONOR_MIN: HONOR_MIN,
    HONOR_MAX: HONOR_MAX,
    REGULAR_MIN: REGULAR_MIN,
    parseNumericMemberNumber: parseNumericMemberNumber,
    isSocioDeHonor: isSocioDeHonor,
    getHonorNumber: getHonorNumber,
    getRegularNumber: getRegularNumber,
    getDisplayNumber: getDisplayNumber,
    formatMemberBadge: formatMemberBadge,
    formatMemberBadgeHtml: formatMemberBadgeHtml,
    honorNumberTaken: honorNumberTaken,
    nextRegularMemberNumber: nextRegularMemberNumber,
    syncMemberNumberFields: syncMemberNumberFields,
    assignNextRegularNumberIfNeeded: assignNextRegularNumberIfNeeded,
    applyHonorToMember: applyHonorToMember,
    removeHonorFromMember: removeHonorFromMember,
    generarNumeroProvisionalRegistro: generarNumeroProvisionalRegistro
  };
})(typeof window !== 'undefined' ? window : globalThis);
