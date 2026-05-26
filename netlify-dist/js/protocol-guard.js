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
