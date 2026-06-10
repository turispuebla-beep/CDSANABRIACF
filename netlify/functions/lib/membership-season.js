'use strict';

function readInt(name, fallback) {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function getConfig() {
  return {
    closeMonth: readInt('MEMBERSHIP_SEASON_CLOSE_MONTH', 5),
    closeDay: readInt('MEMBERSHIP_SEASON_CLOSE_DAY', 31),
    paymentDeadlineDays: readInt('MEMBERSHIP_PAYMENT_DEADLINE_DAYS', 7),
    firstCloseYear: readInt('MEMBERSHIP_SEASON_FIRST_CLOSE_YEAR', 2027)
  };
}

function closeMonthIndex() {
  return getConfig().closeMonth - 1;
}

function finDiaCierreTemporada(anio) {
  const c = getConfig();
  return new Date(anio, closeMonthIndex(), c.closeDay, 23, 59, 59, 999);
}

function proximoCierreTemporadaIso(now = new Date()) {
  return getProximaVigenciaCuotaHasta(now).toISOString();
}

function getProximaVigenciaCuotaHasta(now = new Date()) {
  const c = getConfig();
  let y = c.firstCloseYear;
  for (let i = 0; i < 25; i++) {
    const d = finDiaCierreTemporada(y);
    if (d >= now) return d;
    y++;
  }
  return finDiaCierreTemporada(c.firstCloseYear);
}

function getCuotaEdadReferenciaAnio(now = new Date()) {
  const c = getConfig();
  let y = c.firstCloseYear;
  while (now > finDiaCierreTemporada(y)) y++;
  return y;
}

function getSeasonCloseYearToProcess(now = new Date()) {
  const y = now.getFullYear();
  if (now > finDiaCierreTemporada(y)) return y;
  return null;
}

function getCierreCuotaKey(anio) {
  const c = getConfig();
  const m = String(c.closeMonth).padStart(2, '0');
  const d = String(c.closeDay).padStart(2, '0');
  return `cierre-${anio}-${m}-${d}`;
}

function getCurrentAutoRenewalKey(now = new Date()) {
  const y = getSeasonCloseYearToProcess(now);
  return y != null ? getCierreCuotaKey(y) : null;
}

function edadEnFechaReferenciaCierre(birth, anioCierre) {
  const c = getConfig();
  const ref = new Date(anioCierre, closeMonthIndex(), c.closeDay, 12, 0, 0, 0);
  const b = birth ? new Date(birth) : null;
  if (!b || isNaN(b.getTime())) return NaN;
  let age = ref.getFullYear() - b.getFullYear();
  const m = ref.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
  return age;
}

function paymentDeadlineIsoFromRegistration(regIso) {
  const c = getConfig();
  const reg = new Date(regIso || Date.now());
  if (isNaN(reg.getTime())) return null;
  return new Date(reg.getTime() + c.paymentDeadlineDays * 86400000).toISOString();
}

function cuotaSegunEdad(edad, pricing) {
  const p = pricing || { cuotaMenor: 10, cuotaMayor: 25, edadMaxMenor: 17 };
  if (edad == null || isNaN(edad)) return p.cuotaMayor;
  return edad <= p.edadMaxMenor ? p.cuotaMenor : p.cuotaMayor;
}

function cuotaSegunMiembro(member, anioRef, pricing) {
  const birth = member.birthDate || member.fechaNacimiento;
  const edad = edadEnFechaReferenciaCierre(birth, anioRef);
  return cuotaSegunEdad(edad, pricing);
}

function cierreRefLabel(anio) {
  const c = getConfig();
  const m = String(c.closeMonth).padStart(2, '0');
  const d = String(c.closeDay).padStart(2, '0');
  return `${anio}-${m}-${d}`;
}

module.exports = {
  getConfig,
  finDiaCierreTemporada,
  proximoCierreTemporadaIso,
  getProximaVigenciaCuotaHasta,
  getCuotaEdadReferenciaAnio,
  getSeasonCloseYearToProcess,
  getCierreCuotaKey,
  getCurrentAutoRenewalKey,
  edadEnFechaReferenciaCierre,
  paymentDeadlineIsoFromRegistration,
  cuotaSegunEdad,
  cuotaSegunMiembro,
  cierreRefLabel
};
