/**
 * Sesión de administrador (currentAdmin + compatibilidad adminUser).
 *
 * El botón Admin de la web principal siempre pide contraseña.
 * Tras un login correcto, la sesión se guarda para que el panel (PC y móvil)
 * no muestre el aviso de «sesión no válida».
 */
(function (global) {
  'use strict';

  const SESSION_HOURS = 24;
  const REMEMBER_HOURS = 24 * 30;
  const ADMIN_AUTH_AT_KEY = 'cdsanAdminAuthAt';
  const REMEMBER_KEY = 'cdsan_admin_remember_session';
  const OPEN_TOKEN_KEY = 'cdsanAdminOpenToken';

  function wantsRemember() {
    try {
      return global.localStorage.getItem(REMEMBER_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function setRememberPreference(on) {
    try {
      if (on) global.localStorage.setItem(REMEMBER_KEY, '1');
      else global.localStorage.removeItem(REMEMBER_KEY);
    } catch (_) {}
  }

  function sessionLimitHours() {
    return wantsRemember() ? REMEMBER_HOURS : SESSION_HOURS;
  }

  function storageGet(store, key) {
    try {
      return store.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function storageSet(store, key, value) {
    try {
      store.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function storageRemove(store, key) {
    try {
      store.removeItem(key);
    } catch (_) {}
  }

  function clearStoredAdminSession() {
    storageRemove(localStorage, 'currentAdmin');
    storageRemove(localStorage, 'adminUser');
    storageRemove(localStorage, 'isAdmin');
    storageRemove(localStorage, 'isSuperAdmin');
    storageRemove(localStorage, ADMIN_AUTH_AT_KEY);
    storageRemove(localStorage, OPEN_TOKEN_KEY);
    storageRemove(sessionStorage, 'currentAdmin');
    storageRemove(sessionStorage, 'adminUser');
    storageRemove(sessionStorage, ADMIN_AUTH_AT_KEY);
    storageRemove(sessionStorage, OPEN_TOKEN_KEY);
  }

  function markAdminAuthenticated() {
    const stamp = String(Date.now());
    storageSet(sessionStorage, ADMIN_AUTH_AT_KEY, stamp);
    storageSet(localStorage, ADMIN_AUTH_AT_KEY, stamp);
  }

  function stampIsValid(raw) {
    if (!raw) return false;
    const n = Number(raw);
    if (!n) return false;
    const hours = (Date.now() - n) / (1000 * 60 * 60);
    return hours <= sessionLimitHours();
  }

  function consumeOpenToken() {
    const raw = storageGet(localStorage, OPEN_TOKEN_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data || !data.exp || Date.now() > Number(data.exp)) {
        storageRemove(localStorage, OPEN_TOKEN_KEY);
        return false;
      }
      storageRemove(localStorage, OPEN_TOKEN_KEY);
      markAdminAuthenticated();
      return true;
    } catch (_) {
      storageRemove(localStorage, OPEN_TOKEN_KEY);
      return false;
    }
  }

  function issueAdminOpenToken() {
    markAdminAuthenticated();
    const payload = JSON.stringify({
      t: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 10),
      exp: Date.now() + 5 * 60 * 1000
    });
    storageSet(localStorage, OPEN_TOKEN_KEY, payload);
  }

  function isAdminAuthenticated() {
    if (stampIsValid(storageGet(sessionStorage, ADMIN_AUTH_AT_KEY))) return true;
    if (stampIsValid(storageGet(localStorage, ADMIN_AUTH_AT_KEY))) {
      storageSet(sessionStorage, ADMIN_AUTH_AT_KEY, storageGet(localStorage, ADMIN_AUTH_AT_KEY));
      return true;
    }
    return consumeOpenToken();
  }

  function parseJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function readSessionJson() {
    return (
      parseJson(storageGet(localStorage, 'currentAdmin')) ||
      parseJson(storageGet(sessionStorage, 'currentAdmin')) ||
      parseJson(storageGet(localStorage, 'adminUser')) ||
      parseJson(storageGet(sessionStorage, 'adminUser'))
    );
  }

  function getStoredAdminSession() {
    try {
      const data = readSessionJson();
      if (!data || !data.email) return null;
      if (data.loginTime) {
        const hours = (Date.now() - new Date(data.loginTime).getTime()) / (1000 * 60 * 60);
        if (hours > sessionLimitHours()) {
          clearStoredAdminSession();
          return null;
        }
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  function setStoredAdminSession(session) {
    const payload = Object.assign({}, session, {
      loginTime: session.loginTime || new Date().toISOString()
    });
    delete payload.password;
    delete payload.pass;
    delete payload.plainPassword;
    const json = JSON.stringify(payload);
    storageSet(sessionStorage, 'currentAdmin', json);
    storageSet(sessionStorage, 'adminUser', json);
    storageSet(localStorage, 'currentAdmin', json);
    storageSet(localStorage, 'adminUser', json);

    const isOrganizer = String(payload.role || '').trim() === 'competition_organizer';
    if (isOrganizer) {
      storageRemove(localStorage, 'isAdmin');
      storageRemove(localStorage, 'isSuperAdmin');
    } else {
      storageSet(localStorage, 'isAdmin', 'true');
      if (payload.role === 'super_admin' || payload.isSuperAdmin) {
        storageSet(localStorage, 'isSuperAdmin', 'true');
      } else {
        storageRemove(localStorage, 'isSuperAdmin');
      }
    }
  }

  function openAdminPanelWindow() {
    issueAdminOpenToken();
    let w = null;
    try {
      w = global.open('admin-panel.html', '_blank');
    } catch (_) {
      w = null;
    }
    if (w) return true;
    try {
      global.location.assign('admin-panel.html');
      return true;
    } catch (_) {
      return false;
    }
  }

  global.AdminSession = {
    clearStoredAdminSession: clearStoredAdminSession,
    getStoredAdminSession: getStoredAdminSession,
    setStoredAdminSession: setStoredAdminSession,
    markAdminAuthenticated: markAdminAuthenticated,
    isAdminAuthenticated: isAdminAuthenticated,
    wantsRemember: wantsRemember,
    setRememberPreference: setRememberPreference,
    openAdminPanelWindow: openAdminPanelWindow
  };
})(typeof window !== 'undefined' ? window : globalThis);
