/**
 * Evita que localStorage lleno impida el login (Firebase Auth usa setItem).
 * Borra copias duplicadas y datos pesados (fotos en base64) y reintenta.
 */
(function (global) {
  'use strict';

  const DUPLICATE_KEYS = [
    'members',
    'socios',
    'allMembers',
    'friends',
    'amigos',
    'allFriends',
    'players',
    'jugadores',
    'events',
    'allEvents',
    'teams',
    'coaches',
    'entrenadores',
    'allCoaches',
    'competitions',
    'board',
    'directiva',
    'calendarEvents',
    'media'
  ];

  function isQuotaError(err) {
    if (!err) return false;
    const name = String(err.name || '');
    const msg = String(err.message || '');
    return (
      name === 'QuotaExceededError' ||
      name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      /quota/i.test(msg)
    );
  }

  function stripHeavyFields(value) {
    if (Array.isArray(value)) return value.map(stripHeavyFields);
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string' && value.length > 4000 && value.indexOf('data:') === 0) {
        return '';
      }
      return value;
    }
    const out = {};
    Object.keys(value).forEach(function (k) {
      const v = value[k];
      const lk = String(k).toLowerCase();
      if (
        typeof v === 'string' &&
        v.length > 4000 &&
        (v.indexOf('data:') === 0 ||
          lk.indexOf('photo') >= 0 ||
          lk.indexOf('image') >= 0 ||
          lk === 'src' ||
          lk === 'logo' ||
          lk === 'avatar')
      ) {
        out[k] = v.indexOf('http') === 0 ? v : '';
      } else {
        out[k] = stripHeavyFields(v);
      }
    });
    return out;
  }

  function nativeSet(storage, key, value) {
    const fn =
      (global.__CDSAN_QUOTA_NATIVE_SET_ITEM && global.__CDSAN_QUOTA_NATIVE_SET_ITEM) ||
      Storage.prototype.setItem;
    fn.call(storage, key, value);
  }

  function slimKey(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw || raw.length < 80000) return false;
      const slim = JSON.stringify(stripHeavyFields(JSON.parse(raw)));
      if (slim.length >= raw.length) return false;
      nativeSet(localStorage, key, slim);
      return true;
    } catch (_) {
      return false;
    }
  }

  function freeSpace() {
    if (typeof localStorage === 'undefined') return 0;
    let removed = 0;
    DUPLICATE_KEYS.forEach(function (k) {
      if (localStorage.getItem(k) == null) return;
      try {
        localStorage.removeItem(k);
        removed += 1;
      } catch (_) {}
    });
    const drop = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.indexOf('firebase:heartbeat') === 0 ||
        k.indexOf('firebase:host:') === 0 ||
        k.indexOf('firebase:previous_websocket') === 0
      ) {
        drop.push(k);
      }
    }
    drop.forEach(function (k) {
      try {
        localStorage.removeItem(k);
        removed += 1;
      } catch (_) {}
    });
    ['clubMedia', 'clubPlayers', 'clubMembers', 'clubEvents', 'clubCompetitions', 'clubCoaches'].forEach(
      function (k) {
        if (slimKey(k)) removed += 1;
      }
    );
    return removed;
  }

  function emergencyPurge(keepKey) {
    const keep = {
      currentAdmin: true,
      adminUser: true,
      cdsanAdminAuthAt: true,
      isAdmin: true,
      cdsanabria_cookies_aceptadas: true,
      cdsanabria_cookies_fecha: true,
      cdsanabria_cookies_config: true,
      cdsanPwaDeployVersion: true,
      clubAccountingLedger: true,
      clubMembershipPricing: true
    };
    if (keepKey) keep[keepKey] = true;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    keys.sort(function (a, b) {
      return (localStorage.getItem(b) || '').length - (localStorage.getItem(a) || '').length;
    });
    keys.forEach(function (k) {
      if (keep[k]) return;
      if (String(k).indexOf('firebase:authUser') === 0) return;
      if (String(k).indexOf('firebase:authEvent') === 0) return;
      try {
        localStorage.removeItem(k);
      } catch (_) {}
    });
  }

  if (typeof Storage !== 'undefined' && Storage.prototype && Storage.prototype.setItem) {
    const nativeSetItem = Storage.prototype.setItem;
    try {
      global.__CDSAN_QUOTA_NATIVE_SET_ITEM = nativeSetItem;
      if (typeof global.__CDSAN_NATIVE_SET_ITEM !== 'function') {
        global.__CDSAN_NATIVE_SET_ITEM = nativeSetItem;
      }
    } catch (_) {}
    Storage.prototype.setItem = function (key, value) {
      try {
        nativeSetItem.call(this, key, value);
      } catch (err) {
        if (!isQuotaError(err)) throw err;
        freeSpace();
        try {
          nativeSetItem.call(this, key, value);
        } catch (err2) {
          if (!isQuotaError(err2)) throw err2;
          emergencyPurge(key);
          nativeSetItem.call(this, key, value);
        }
      }
    };
  }

  try {
    freeSpace();
  } catch (_) {}

  global.CdsanLocalStorageQuota = {
    freeSpace: freeSpace,
    isQuotaError: isQuotaError
  };
})(typeof window !== 'undefined' ? window : this);
