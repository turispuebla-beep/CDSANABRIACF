/**
 * Configuración inscripciones jugador/a — temporadas (2026-2027+)
 * localStorage: clubPlayerInscriptionSettings
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubPlayerInscriptionSettings';

  const CATEGORIES = [
    { id: 'prebenjamin', label: 'Prebenjamín (6-8 años)' },
    { id: 'benjamin', label: 'Benjamín (8-10 años)' },
    { id: 'alevin', label: 'Alevín (10-12 años)' },
    { id: 'infantil', label: 'Infantil (12-14 años)' },
    { id: 'cadete', label: 'Cadete (14-16 años)' },
    { id: 'juvenil', label: 'Juvenil (16-18 años)' },
    { id: 'aficionado', label: 'Aficionado (18+ años)' }
  ];

  const CHILD_SIZES = ['4', '6', '8', '10', '12', '14'];
  const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const ALL_SIZES = CHILD_SIZES.concat(ADULT_SIZES);

  const GARMENT_IDS = [
    'match_shirt',
    'match_shorts',
    'tracksuit',
    'train_shirt',
    'train_shorts',
    'train_jacket'
  ];

  const DEFAULT_GARMENTS = {
    match_shirt: { label: 'Camiseta de partido', price: 0, enabled: true },
    match_shorts: { label: 'Pantalón corto de partido', price: 0, enabled: true },
    tracksuit: { label: 'Chándal', price: 0, enabled: true },
    train_shirt: { label: 'Camiseta de entreno', price: 0, enabled: true },
    train_shorts: { label: 'Pantalón de entreno', price: 0, enabled: true },
    train_jacket: { label: 'Chaqueta / basquera', price: 0, enabled: true }
  };

  function defaultCategoryFees() {
    const ficha = {};
    const socio = {};
    CATEGORIES.forEach((c) => {
      ficha[c.id] = 0;
      socio[c.id] = 0;
    });
    return { ficha, socio };
  }

  function getDefaultSettings() {
    return {
      season: '2026-2027',
      registrationsOpen: true,
      openFrom: '',
      openUntil: '',
      chargeFicha: true,
      chargeSocio: true,
      kitMode: 'per_garment',
      allowUncheckInFullPack: true,
      categoryFees: defaultCategoryFees(),
      garments: JSON.parse(JSON.stringify(DEFAULT_GARMENTS)),
      paymentMethods: { card: true, bizum: false, transfer: true },
      updatedAt: new Date().toISOString()
    };
  }

  function mergeSettings(raw) {
    const base = getDefaultSettings();
    if (!raw || typeof raw !== 'object') return base;
    const merged = { ...base, ...raw };
    merged.categoryFees = merged.categoryFees || base.categoryFees;
    merged.categoryFees.ficha = { ...base.categoryFees.ficha, ...(merged.categoryFees.ficha || {}) };
    merged.categoryFees.socio = { ...base.categoryFees.socio, ...(merged.categoryFees.socio || {}) };
    merged.garments = { ...DEFAULT_GARMENTS, ...(merged.garments || {}) };
    GARMENT_IDS.forEach((id) => {
      merged.garments[id] = {
        ...DEFAULT_GARMENTS[id],
        ...(merged.garments[id] || {})
      };
    });
    merged.paymentMethods = { ...base.paymentMethods, ...(merged.paymentMethods || {}) };
    merged.registrationsOpen = raw?.registrationsOpen !== false;
    return merged;
  }

  function read() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || 'null');
      let merged = mergeSettings(raw);
      try {
        if (!global.localStorage.getItem('cdsan_insc_default_open_v1')) {
          merged.registrationsOpen = true;
          global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          global.localStorage.setItem('cdsan_insc_default_open_v1', '1');
        }
      } catch (_) {}
      return merged;
    } catch (_) {
      return getDefaultSettings();
    }
  }

  function write(settings) {
    const merged = mergeSettings(settings);
    merged.updatedAt = new Date().toISOString();
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    if (typeof global.syncLocalSettingsBlobToFirebase === 'function') {
      global.syncLocalSettingsBlobToFirebase(STORAGE_KEY).catch(function () {});
    }
    return merged;
  }

  function isOpenNow(settings) {
    const s = settings || read();
    if (!s.registrationsOpen) return { ok: false, reason: 'Las inscripciones están cerradas para la temporada ' + s.season + '.' };
    const now = new Date();
    if (s.openFrom) {
      const from = new Date(s.openFrom);
      if (!isNaN(from.getTime()) && now < from) {
        return { ok: false, reason: 'Las inscripciones abren el ' + from.toLocaleDateString('es-ES') + '.' };
      }
    }
    if (s.openUntil) {
      const until = new Date(s.openUntil);
      if (!isNaN(until.getTime()) && now > until) {
        return { ok: false, reason: 'El plazo de inscripción finalizó el ' + until.toLocaleDateString('es-ES') + '.' };
      }
    }
    return { ok: true, settings: s };
  }

  function getCategoryFee(settings, categoryId, type) {
    const s = settings || read();
    const fees = s.categoryFees || defaultCategoryFees();
    const bucket = type === 'socio' ? fees.socio : fees.ficha;
    return Number(bucket[categoryId] || 0);
  }

  function getEnabledGarments(settings) {
    const s = settings || read();
    return GARMENT_IDS.filter((id) => s.garments[id] && s.garments[id].enabled !== false).map((id) => ({
      id: id,
      label: s.garments[id].label,
      price: Number(s.garments[id].price || 0)
    }));
  }

  function calculateAge(birthDateStr) {
    if (!birthDateStr) return null;
    const birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const md = today.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function suggestCategoryFromBirthDate(birthDateStr) {
    const age = calculateAge(birthDateStr);
    if (age == null) return '';
    if (age <= 8) return 'prebenjamin';
    if (age <= 10) return 'benjamin';
    if (age <= 12) return 'alevin';
    if (age <= 14) return 'infantil';
    if (age <= 16) return 'cadete';
    if (age <= 18) return 'juvenil';
    return 'aficionado';
  }

  global.ClubInscriptionConfig = {
    STORAGE_KEY: STORAGE_KEY,
    CATEGORIES: CATEGORIES,
    CHILD_SIZES: CHILD_SIZES,
    ADULT_SIZES: ADULT_SIZES,
    ALL_SIZES: ALL_SIZES,
    GARMENT_IDS: GARMENT_IDS,
    getDefaultSettings: getDefaultSettings,
    read: read,
    write: write,
    isOpenNow: isOpenNow,
    getCategoryFee: getCategoryFee,
    getEnabledGarments: getEnabledGarments,
    calculateAge: calculateAge,
    suggestCategoryFromBirthDate: suggestCategoryFromBirthDate
  };
})(typeof window !== 'undefined' ? window : globalThis);
