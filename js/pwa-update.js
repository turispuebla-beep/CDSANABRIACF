/**
 * Actualización PWA (iOS, Android, Huawei/HarmonyOS).
 * Compara /deploy-version.json al abrir/reanudar y recarga una sola vez
 * si el deploy cambió. iPhone y Huawei cachean agresivo: se borra SW+cache.
 */
(function (global) {
  'use strict';

  var VERSION_URL = '/deploy-version.json';
  var STORAGE_KEY = 'cdsanPwaDeployVersion';
  var RELOAD_KEY = 'cdsanPwaReloadedCv';
  var started = false;
  var checking = false;
  var reloading = false;
  var lastCheck = 0;

  function ua() {
    return String((global.navigator && navigator.userAgent) || '');
  }

  function esIOS() {
    return /iPad|iPhone|iPod/i.test(ua()) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function esHuawei() {
    return /HUAWEI|HuaweiBrowser|HarmonyOS|OpenHarmony|HMSCore|Harmony/i.test(ua());
  }

  function cacheAgresivo() {
    return esIOS() || esHuawei() || !('serviceWorker' in navigator);
  }

  function mostrarAviso(texto) {
    try {
      var el = document.getElementById('cdsanPwaUpdateToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'cdsanPwaUpdateToast';
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:12px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 16px;border-radius:999px;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);max-width:90vw;';
        (document.body || document.documentElement).appendChild(el);
      }
      el.textContent = texto;
    } catch (_) {}
  }

  function versionDesdeUrl(href) {
    try {
      return new URL(href, location.href).searchParams.get('_cv') || '';
    } catch (_) {
      return '';
    }
  }

  function urlConVersion(version) {
    var u = new URL(location.href);
    u.searchParams.set('_cv', version);
    return u.pathname + u.search + u.hash;
  }

  function borrarCaches() {
    if (!global.caches || !caches.keys) return Promise.resolve();
    return caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).catch(function () {});
  }

  function unregisterWorkers() {
    if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistrations) {
      return Promise.resolve();
    }
    return navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister(); }));
    }).catch(function () {});
  }

  function recargarFresco(version) {
    if (reloading) return;
    reloading = true;
    mostrarAviso('Actualizando la app…');
    try { sessionStorage.setItem(RELOAD_KEY, version); } catch (_) {}

    var delay = cacheAgresivo() ? 700 : 250;
    var go = function () {
      location.replace(urlConVersion(version));
    };

    var purge = borrarCaches();
    var dropSw = unregisterWorkers();
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'PURGE_CACHES' });
      }
    } catch (_) {}

    Promise.all([purge, dropSw]).then(function () {
      setTimeout(go, delay);
    }).catch(function () {
      setTimeout(go, delay);
    });
  }

  function fetchVersion() {
    var url = VERSION_URL + '?t=' + Date.now() + '&r=' + Math.random().toString(36).slice(2);
    return fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    }).then(function (res) {
      if (!res.ok) throw new Error('version http ' + res.status);
      return res.json();
    }).then(function (data) {
      return String((data && data.cacheVersion) || '').trim();
    });
  }

  function comprobar() {
    var ahora = Date.now();
    if (checking || reloading) return Promise.resolve();
    if (ahora - lastCheck < 2000) return Promise.resolve();
    lastCheck = ahora;
    checking = true;

    var pingSw = Promise.resolve();
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        pingSw = navigator.serviceWorker.getRegistration().then(function (reg) {
          if (!reg) return;
          if (reg.waiting) {
            try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
          }
          return reg.update();
        });
      }
    } catch (_) {}

    return Promise.resolve(pingSw).catch(function () {}).then(function () {
      return fetchVersion();
    }).then(function (remote) {
      checking = false;
      if (!remote) return;
      var local = '';
      try { local = localStorage.getItem(STORAGE_KEY) || ''; } catch (_) {}
      if (!local) {
        try { localStorage.setItem(STORAGE_KEY, remote); } catch (_) {}
        return;
      }
      if (local === remote) return;
      var already = '';
      try { already = sessionStorage.getItem(RELOAD_KEY) || ''; } catch (_) {}
      var cv = versionDesdeUrl(location.href);
      if (already === remote || cv === remote) {
        try { localStorage.setItem(STORAGE_KEY, remote); } catch (_) {}
        return;
      }
      recargarFresco(remote);
    }).catch(function () {
      checking = false;
    });
  }

  function registrarSW() {
    if (!('serviceWorker' in navigator)) return Promise.resolve();
    if (location.protocol === 'file:' || !location.origin || location.origin === 'null') {
      return Promise.resolve();
    }
    var swPath = (location.pathname || '/').replace(/[^/]*$/, '') + 'sw.js';
    return navigator.serviceWorker.register(swPath, { updateViaCache: 'none' }).then(function (registration) {
      registration.update().catch(function () {});
      registration.addEventListener('updatefound', function () {
        var nw = registration.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller && registration.waiting) {
            try { registration.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
          }
        });
      });
      return registration;
    }).catch(function (err) {
      console.warn('PWA SW:', err);
    });
  }

  function start() {
    if (started) {
      comprobar();
      return;
    }
    started = true;
    registrarSW().then(function () { comprobar(); });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') comprobar();
    });
    global.addEventListener('pageshow', function (event) {
      comprobar();
      if (event && event.persisted) comprobar();
    });
    global.addEventListener('focus', comprobar);
    global.addEventListener('online', comprobar);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        comprobar();
      });
      navigator.serviceWorker.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'SW_UPDATED') comprobar();
      });
    }

    setInterval(function () {
      if (document.visibilityState === 'visible') comprobar();
    }, cacheAgresivo() ? 25000 : 45000);
  }

  global.CDSanPwaUpdate = {
    start: start,
    check: comprobar,
    esIOS: esIOS,
    esHuawei: esHuawei
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
