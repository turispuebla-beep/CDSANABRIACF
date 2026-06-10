/**
 * Cabecera Authorization para funciones Netlify que requieren admin Firebase.
 */
(function (global) {
  'use strict';

  async function getAdminAuthHeaders(extra) {
    const out = { ...(extra || {}) };
    const auth = global.firebaseAuth;
    if (!auth || auth.isSimulation) {
      throw new Error('Inicia sesión como administrador en Firebase para esta acción.');
    }
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Sesión de administrador no activa. Vuelve a entrar al panel.');
    }
    const token = await user.getIdToken();
    out.Authorization = 'Bearer ' + token;
    return out;
  }

  async function adminFetch(url, options) {
    const opts = { ...(options || {}) };
    const headers = await getAdminAuthHeaders(opts.headers || {});
    opts.headers = headers;
    return fetch(url, opts);
  }

  global.CdsanAdminApiAuth = {
    getAdminAuthHeaders: getAdminAuthHeaders,
    adminFetch: adminFetch
  };
})(typeof window !== 'undefined' ? window : this);
