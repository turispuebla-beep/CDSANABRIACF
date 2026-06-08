/**
 * Configuración inscripciones jugador/a — temporadas (2026-2027+)
 * localStorage: clubPlayerInscriptionSettings
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubPlayerInscriptionSettings';

  /** Tabla pública inscripción — cuotas ficha + socio por categoría */
  const INSCRIPTION_CATEGORY_ROWS = [
    { id: 'prebenjamin', label: 'P. BENJAMIN', years: '(2018/2019)', ficha: 65, socio: 10 },
    { id: 'benjamin', label: 'BENJAMIN', years: '(2016/2017)', ficha: 65, socio: 10 },
    { id: 'alevin', label: 'ALEVIN', years: '(2014/2015)', ficha: 65, socio: 10 },
    { id: 'infantil', label: 'INFANTIL', years: '(2012/2013)', ficha: 65, socio: 10 },
    { id: 'cadete', label: 'CADETE', years: '(2010/2011)', ficha: 65, socio: 10 },
    { id: 'juvenil', label: 'JUVENIL', years: '(2007/2008/2009)', ficha: 175, socio: 25 },
    { id: 'senior', label: 'SENIOR / AFICIONADO', years: '', ficha: 175, socio: 25 }
  ];

  const CATEGORIES = INSCRIPTION_CATEGORY_ROWS.map(function (r) {
    const yrs = r.years ? ' ' + r.years : '';
    return { id: r.id, label: r.label + yrs };
  });

  const CHILD_SIZES = ['4', '6', '8', '10', '12', '14'];
  const ADULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const ALL_SIZES = CHILD_SIZES.concat(ADULT_SIZES);
  /** Tallas ropa entreno — formulario público */
  const INSCRIPTION_KIT_SIZES = ['6/8', '10/12', 'S', 'M', 'L', 'XL'];

  const GARMENT_IDS = ['train_kit', 'tracksuit', 'train_jacket', 'cazadora'];

  const DEFAULT_GARMENT_PRICES = {
    train_kit: 16,
    tracksuit: 16,
    train_jacket: 18,
    cazadora: 40
  };

  const DEFAULT_GARMENTS = {
    train_kit: { label: 'Ropa de entreno', price: DEFAULT_GARMENT_PRICES.train_kit, enabled: true },
    tracksuit: { label: 'Sudadera', price: DEFAULT_GARMENT_PRICES.tracksuit, enabled: true },
    train_jacket: { label: 'Chubasquero', price: DEFAULT_GARMENT_PRICES.train_jacket, enabled: true },
    cazadora: { label: 'Cazadora', price: DEFAULT_GARMENT_PRICES.cazadora, enabled: true }
  };

  const LEGACY_GARMENT_IDS = ['match_shirt', 'match_shorts', 'train_shirt', 'train_shorts'];

  function defaultCategoryFees() {
    const ficha = {};
    const socio = {};
    INSCRIPTION_CATEGORY_ROWS.forEach(function (r) {
      ficha[r.id] = r.ficha;
      socio[r.id] = r.socio;
    });
    ficha.aficionado = 175;
    socio.aficionado = 25;
    return { ficha, socio };
  }

  function resolveSeason(raw) {
    if (raw && String(raw).trim()) return String(raw).trim();
    if (global.ClubSeason && global.ClubSeason.getActiveSeason) {
      return global.ClubSeason.getActiveSeason();
    }
    return '2026-2027';
  }

  function getDefaultSettings() {
    return {
      season: resolveSeason(''),
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
    merged.season = resolveSeason(merged.season);
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
    migrateTrainGarmentsToKit(merged);
    LEGACY_GARMENT_IDS.forEach(function (lid) {
      if (merged.garments[lid]) merged.garments[lid].enabled = false;
    });
    const jacketLabel = String(merged?.garments?.train_jacket?.label || '').trim().toLowerCase();
    if (jacketLabel === 'chaqueta / basquera' || jacketLabel === 'chaqueta/basquera') {
      merged.garments.train_jacket.label = 'Chubasquero';
    }
    const tracksuitLabel = String(merged?.garments?.tracksuit?.label || '').trim().toLowerCase();
    if (tracksuitLabel === 'chándal' || tracksuitLabel === 'chandal') {
      merged.garments.tracksuit.label = 'Sudadera';
    }
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
      merged = applyDefaultFeesIfEmpty(merged);
      try {
        if (!global.localStorage.getItem('cdsan_insc_garment_prices_v1')) {
          if (migrateGarmentPrices(merged)) {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          }
          global.localStorage.setItem('cdsan_insc_garment_prices_v1', '1');
        }
      } catch (_) {}
      if (
        migrateTrainGarmentsToKit(merged) ||
        migrateYouthFichaFees(merged) ||
        migrateSeniorFichaFees(merged)
      ) {
        try {
          global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch (_) {}
      }
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
    const id = categoryId === 'aficionado' ? 'senior' : categoryId;
    return Number(bucket[id] || bucket[categoryId] || 0);
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
    return 'senior';
  }

  const YOUTH_CATEGORY_IDS = ['prebenjamin', 'benjamin', 'alevin', 'infantil', 'cadete'];

  const SENIOR_CATEGORY_IDS = ['juvenil', 'senior', 'aficionado'];

  function migrateSeniorFichaFees(settings) {
    const s = settings;
    if (!s || !s.categoryFees || !s.categoryFees.ficha) return false;
    let changed = false;
    SENIOR_CATEGORY_IDS.forEach(function (id) {
      if (Number(s.categoryFees.ficha[id]) === 170) {
        s.categoryFees.ficha[id] = 175;
        changed = true;
      }
    });
    return changed;
  }

  function migrateGarmentPrices(settings) {
    if (!settings || !settings.garments) return false;
    let changed = false;
    GARMENT_IDS.forEach(function (id) {
      const canonical = DEFAULT_GARMENT_PRICES[id];
      if (canonical == null) return;
      const g = settings.garments[id] || {};
      if (!Number(g.price)) {
        settings.garments[id] = { ...g, price: canonical };
        changed = true;
      }
    });
    return changed;
  }

  function migrateTrainGarmentsToKit(settings) {
    if (!settings || !settings.garments) return false;
    const g = settings.garments;
    let changed = false;
    if (!g.train_kit) {
      g.train_kit = { label: 'Ropa de entreno', price: 0, enabled: true };
      changed = true;
    }
    const ts = g.train_shirt;
    const tsh = g.train_shorts;
    if (ts || tsh) {
      const legacyPrice = Number(ts?.price || 0) + Number(tsh?.price || 0);
      if (legacyPrice > 0 && !Number(g.train_kit.price)) {
        g.train_kit.price = legacyPrice;
        changed = true;
      }
      const eitherEnabled =
        (ts && ts.enabled !== false) || (tsh && tsh.enabled !== false);
      if (eitherEnabled && g.train_kit.enabled === false) {
        g.train_kit.enabled = true;
        changed = true;
      }
    }
    if (String(g.train_kit.label || '').trim() !== 'Ropa de entreno') {
      const lbl = String(g.train_kit.label || '').toLowerCase();
      if (
        lbl.indexOf('camiseta') >= 0 ||
        lbl.indexOf('pantal') >= 0 ||
        lbl.indexOf('entreno') >= 0
      ) {
        g.train_kit.label = 'Ropa de entreno';
        changed = true;
      }
    }
    return changed;
  }

  function migrateYouthFichaFees(settings) {
    const s = settings;
    if (!s || !s.categoryFees || !s.categoryFees.ficha) return false;
    let changed = false;
    YOUTH_CATEGORY_IDS.forEach(function (id) {
      if (Number(s.categoryFees.ficha[id]) === 50) {
        s.categoryFees.ficha[id] = 65;
        changed = true;
      }
    });
    return changed;
  }

  function applyDefaultFeesIfEmpty(settings) {
    const s = settings || read();
    const defs = defaultCategoryFees();
    let changed = false;
    INSCRIPTION_CATEGORY_ROWS.forEach(function (r) {
      if (!Number(s.categoryFees.ficha[r.id])) {
        s.categoryFees.ficha[r.id] = r.ficha;
        changed = true;
      }
      if (!Number(s.categoryFees.socio[r.id])) {
        s.categoryFees.socio[r.id] = r.socio;
        changed = true;
      }
    });
    if (migrateYouthFichaFees(s)) changed = true;
    if (migrateSeniorFichaFees(s)) changed = true;
    return changed ? s : settings;
  }

  global.ClubInscriptionConfig = {
    STORAGE_KEY: STORAGE_KEY,
    INSCRIPTION_CATEGORY_ROWS: INSCRIPTION_CATEGORY_ROWS,
    CATEGORIES: CATEGORIES,
    CHILD_SIZES: CHILD_SIZES,
    ADULT_SIZES: ADULT_SIZES,
    ALL_SIZES: ALL_SIZES,
    INSCRIPTION_KIT_SIZES: INSCRIPTION_KIT_SIZES,
    GARMENT_IDS: GARMENT_IDS,
    getDefaultSettings: getDefaultSettings,
    read: read,
    write: write,
    applyDefaultFeesIfEmpty: applyDefaultFeesIfEmpty,
    isOpenNow: isOpenNow,
    getCategoryFee: getCategoryFee,
    getEnabledGarments: getEnabledGarments,
    calculateAge: calculateAge,
    suggestCategoryFromBirthDate: suggestCategoryFromBirthDate
  };
})(typeof window !== 'undefined' ? window : globalThis);
