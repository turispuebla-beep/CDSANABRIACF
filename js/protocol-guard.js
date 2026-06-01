/**
 * Espera a que firebase-config.js exponga las APIs del club (cdsanabriacf2026).
 */
(function () {
  const isFile = location.protocol === 'file:';
  window.__CDSAN_FILE_PROTOCOL__ = isFile;

  window.waitForFirebaseReady = function waitForFirebaseReady(maxMs) {
    const limit = typeof maxMs === 'number' ? maxMs : 20000;
    const start = Date.now();
    return new Promise(function (resolve) {
      function tick() {
        if (isFile) {
          resolve({ ok: false, reason: 'file_protocol' });
          return;
        }
        const db = window.firebaseDb;
        const hasApi = typeof window.getDocuments === 'function' && window.firebaseAuth;
        const simulation = !!(db && db.isSimulation);
        const real = hasApi && db && !simulation;
        if (real || (hasApi && simulation)) {
          resolve({ ok: true, simulation: simulation });
          return;
        }
        if (Date.now() - start >= limit) {
          resolve({ ok: false, reason: 'timeout' });
          return;
        }
        setTimeout(tick, 80);
      }
      tick();
    });
  };

  /** Espera al primer estado de Auth (sesión restaurada o ausente). Evita falsos «caducada» al abrir el panel. */
  window.waitForFirebaseAuthUser = function waitForFirebaseAuthUser(maxMs) {
    const limit = typeof maxMs === 'number' ? maxMs : 12000;
    return new Promise(function (resolve) {
      if (!window.firebaseAuth || window.firebaseAuth.isSimulation) {
        resolve(null);
        return;
      }
      if (window.firebaseAuth.currentUser) {
        resolve(window.firebaseAuth.currentUser);
        return;
      }
      let settled = false;
      let unsub = function () {};
      const timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try {
          unsub();
        } catch (_) {}
        resolve(window.firebaseAuth.currentUser || null);
      }, limit);
      import('https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js')
        .then(function (mod) {
          unsub = mod.onAuthStateChanged(window.firebaseAuth, function (user) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
              unsub();
            } catch (_) {}
            resolve(user);
          });
        })
        .catch(function () {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(window.firebaseAuth.currentUser || null);
        });
    });
  };

  const runSanitize = function () {
    if (typeof window.sanitizeClubLocalCredentials === 'function') {
      window.sanitizeClubLocalCredentials().catch(function () {});
    }
  };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runSanitize);
    } else {
      runSanitize();
    }
  }
})();
