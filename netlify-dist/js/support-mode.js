/* Modo soporte CDSANABRIACF (no intrusivo)
 * - No altera flujos de negocio
 * - Solo añade observabilidad y utilidades de diagnóstico
 */
(function () {
  const KEY = 'cds_support_mode';
  const url = new URL(window.location.href);
  const qp = url.searchParams.get('support');
  const fromStorage = localStorage.getItem(KEY) === '1';
  const enabled = qp === '1' || fromStorage;

  function now() {
    try {
      return new Date().toISOString();
    } catch (_) {
      return String(Date.now());
    }
  }

  function prefixed(level, args) {
    if (!enabled) return;
    const prefix = `[CDS-SUPPORT][${level}][${now()}]`;
    if (level === 'ERROR') console.error(prefix, ...args);
    else if (level === 'WARN') console.warn(prefix, ...args);
    else console.log(prefix, ...args);
  }

  window.CDSSupport = {
    enabled,
    log: (...args) => prefixed('INFO', args),
    warn: (...args) => prefixed('WARN', args),
    error: (...args) => prefixed('ERROR', args),
    snapshot: function () {
      const safeLen = (key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return 0;
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.length : (parsed ? 1 : 0);
        } catch (_) {
          return -1;
        }
      };
      const data = {
        online: navigator.onLine,
        href: window.location.href,
        members: safeLen('clubMembers'),
        friends: safeLen('clubFriends'),
        players: safeLen('clubPlayers'),
        coaches: safeLen('clubCoaches'),
        teams: safeLen('clubTeams'),
        events: safeLen('clubEvents'),
        matches: safeLen('encuentros'),
        calendar: safeLen('clubCalendarEvents'),
        competitions: safeLen('clubCompetitions'),
        docs: safeLen('clubDocuments'),
        ads: safeLen('clubPublicidad'),
        push: safeLen('pushMessages')
      };
      prefixed('INFO', ['snapshot', data]);
      return data;
    }
  };

  window.enableSupportMode = function () {
    localStorage.setItem(KEY, '1');
    console.log('[CDS-SUPPORT] Activado. Recarga la página.');
  };

  window.disableSupportMode = function () {
    localStorage.removeItem(KEY);
    console.log('[CDS-SUPPORT] Desactivado. Recarga la página.');
  };

  window.addEventListener('error', function (evt) {
    prefixed('ERROR', ['window.error', evt.message, evt.filename, evt.lineno, evt.colno]);
  });

  window.addEventListener('unhandledrejection', function (evt) {
    prefixed('ERROR', ['unhandledrejection', evt.reason]);
  });

  window.addEventListener('online', function () {
    prefixed('INFO', ['Conexión recuperada']);
  });
  window.addEventListener('offline', function () {
    prefixed('WARN', ['Conexión perdida']);
  });

  if (enabled) {
    prefixed('INFO', ['Modo soporte activo']);
    setInterval(function () {
      try {
        window.CDSSupport.snapshot();
      } catch (_) {}
    }, 60000);
  }
})();

