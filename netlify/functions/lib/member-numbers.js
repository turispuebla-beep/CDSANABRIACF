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

function memberIsActive(m) {
  if (!m) return false;
  const st = String(m.status || '').toLowerCase();
  const est = String(m.estado || '').toLowerCase();
  return st === 'active' || est === 'activo';
}

function needsRegularMemberNumber(m) {
  if (!m || !memberIsActive(m)) return false;
  if (isSocioDeHonor(m)) return false;
  return getRegularNumber(m) == null;
}

/** Asigna el siguiente n.º ≥ 51 si el socio activo no tiene número real (ignora SOC… provisionales). */
function assignNextRegularNumberIfNeeded(member, members) {
  if (!member || isSocioDeHonor(member)) return member;
  if (getRegularNumber(member) != null) return member;
  if (!memberIsActive(member)) return member;
  const next = nextRegularMemberNumber(members);
  member.numeroSocioRegular = next;
  member.memberNumber = next;
  member.numeroSocio = next;
  member.membershipTier = 'regular';
  member.socioDeHonor = false;
  return member;
}

function memberNumberPatch(member, members) {
  const copy = { ...(member || {}) };
  assignNextRegularNumberIfNeeded(copy, members);
  if (getRegularNumber(copy) == null) return null;
  return {
    memberNumber: copy.memberNumber,
    numeroSocio: copy.numeroSocio,
    numeroSocioRegular: copy.numeroSocioRegular,
    membershipTier: copy.membershipTier || 'regular',
    socioDeHonor: false
  };
}

module.exports = {
  REGULAR_MIN,
  parseNumericMemberNumber,
  isSocioDeHonor,
  getRegularNumber,
  nextRegularMemberNumber,
  memberIsActive,
  needsRegularMemberNumber,
  assignNextRegularNumberIfNeeded,
  memberNumberPatch
};
