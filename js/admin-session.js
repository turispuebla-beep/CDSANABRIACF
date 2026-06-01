/**
 * Sesión de administrador (currentAdmin + compatibilidad adminUser).
 */
(function (global) {
  'use strict';

  const SESSION_HOURS = 24;

  function clearStoredAdminSession() {
    localStorage.removeItem('currentAdmin');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('isSuperAdmin');
  }

  function getStoredAdminSession() {
    try {
      const raw = localStorage.getItem('currentAdmin') || localStorage.getItem('adminUser');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.email) return null;
      if (data.loginTime) {
        const hours = (Date.now() - new Date(data.loginTime).getTime()) / (1000 * 60 * 60);
        if (hours > SESSION_HOURS) {
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
    localStorage.setItem('currentAdmin', json);
    localStorage.setItem('adminUser', json);
    localStorage.setItem('isAdmin', 'true');
    if (payload.role === 'super_admin' || payload.isSuperAdmin) {
      localStorage.setItem('isSuperAdmin', 'true');
    } else {
      localStorage.removeItem('isSuperAdmin');
    }
  }

  function openAdminPanelWindow() {
    const w = global.open('admin-panel.html', '_blank');
    return !!w;
  }

  global.AdminSession = {
    clearStoredAdminSession: clearStoredAdminSession,
    getStoredAdminSession: getStoredAdminSession,
    setStoredAdminSession: setStoredAdminSession,
    openAdminPanelWindow: openAdminPanelWindow
  };
})(typeof window !== 'undefined' ? window : globalThis);
