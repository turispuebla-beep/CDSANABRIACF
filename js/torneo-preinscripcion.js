/**
 * Preinscripción Torneo Fútbol 7 — público, sin login (mailto al club).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubTorneoPreinscripciones';
  const EVENT_NAME = 'Torneo Fútbol 7 — 2026';

  const TORNEO_CATEGORIES = [
    { id: 'benjamin', label: 'Benjamín' },
    { id: 'alevin', label: 'Alevín' },
    { id: 'infantil', label: 'Infantil' },
    { id: 'cadete', label: 'Cadete' },
    { id: 'juvenil', label: 'Juvenil' },
    { id: 'senior', label: 'Senior' }
  ];

  function getCategories() {
    return TORNEO_CATEGORIES.slice();
  }

  function readAll() {
    try {
      return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function writeAll(list) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
  }

  function getClubNotifyEmail() {
    if (global.ClubMailto && global.ClubMailto.getClubNotifyEmail) {
      return global.ClubMailto.getClubNotifyEmail();
    }
    if (global.PlayerApplication && global.PlayerApplication.getClubNotifyEmail) {
      return global.PlayerApplication.getClubNotifyEmail();
    }
    return (
      (global.ClubContactDefaults && global.ClubContactDefaults.CLUB_EMAIL_NOTIFY) ||
      'cdsanabriafc@gmail.com'
    );
  }

  function buildMailtoUrl(to, cc, subject, body) {
    if (global.ClubMailto && global.ClubMailto.buildMailtoUrl) {
      return global.ClubMailto.buildMailtoUrl(to, cc, subject, body);
    }
    const addr = String(to || '').trim();
    if (!addr || !addr.includes('@')) return '';
    const q = [];
    if (cc && String(cc).includes('@')) q.push('cc=' + encodeURIComponent(String(cc).trim()));
    if (subject) q.push('subject=' + encodeURIComponent(subject));
    if (body) q.push('body=' + encodeURIComponent(body));
    return 'mailto:' + encodeURIComponent(addr) + (q.length ? '?' + q.join('&') : '');
  }

  function categoryLabels(ids) {
    const map = {};
    getCategories().forEach(function (c) {
      map[c.id] = c.label;
    });
    return (ids || []).map(function (id) {
      return map[id] || id;
    });
  }

  function validate(data) {
    if (!data.teamName) return 'Indica el nombre del equipo.';
    const n = parseInt(data.playerCount, 10);
    if (!n || n < 1) return 'Indica el número de jugadores del equipo.';
    if (!data.town) return 'Indica la población a la que pertenece el equipo.';
    if (!data.categories || !data.categories.length) {
      return 'Selecciona al menos una categoría.';
    }
    if (!data.contactName) return 'Indica el nombre de la persona de contacto.';
    if (!data.contactEmail || !String(data.contactEmail).includes('@')) {
      return 'Indica un email de contacto válido.';
    }
    if (!data.contactPhone) return 'Indica un teléfono de contacto.';
    return null;
  }

  function formatMailBody(data) {
    const cats = categoryLabels(data.categories).join(', ');
    if (global.ClubMailto && global.ClubMailto.formatStructuredEmail) {
      return global.ClubMailto.formatStructuredEmail({
        title: 'PREINSCRIPCIÓN — ' + EVENT_NAME,
        sections: [
          {
            heading: 'DATOS DEL EQUIPO',
            fields: [
              { label: 'Evento', value: EVENT_NAME },
              { label: 'Nombre equipo', value: data.teamName },
              { label: 'Nº jugadores', value: data.playerCount },
              { label: 'Población', value: data.town },
              { label: 'Categorías', value: cats }
            ]
          },
          {
            heading: 'PERSONA DE CONTACTO',
            fields: [
              { label: 'Nombre', value: data.contactName },
              { label: 'Email', value: data.contactEmail },
              { label: 'Teléfono', value: data.contactPhone }
            ]
          }
        ],
        footerLines: [
          'Esta es una PREINSCRIPCIÓN. Los datos completos de todos los integrantes se solicitarán más adelante.'
        ],
        requesterEmail: data.contactEmail
      });
    }
    return [
      'Preinscripción — ' + EVENT_NAME,
      'CD Sanabria CF',
      '',
      'Evento: ' + EVENT_NAME,
      'Nombre del equipo: ' + (data.teamName || ''),
      'Número de jugadores: ' + (data.playerCount || ''),
      'Población: ' + (data.town || ''),
      'Categorías: ' + cats,
      '',
      'Persona de contacto: ' + (data.contactName || ''),
      'Email: ' + (data.contactEmail || ''),
      'Teléfono: ' + (data.contactPhone || ''),
      '',
      'Nota: esta es una PREINSCRIPCIÓN. Los datos completos de todos los integrantes se solicitarán más adelante.',
      '',
      'Enviado desde la web del club el ' + new Date().toLocaleString('es-ES')
    ].join('\r\n');
  }

  function savePreinscripcion(data) {
    const entry = {
      id: 'tp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      eventName: EVENT_NAME,
      teamName: data.teamName,
      playerCount: data.playerCount,
      town: data.town,
      categories: data.categories.slice(),
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      createdAt: new Date().toISOString(),
      status: 'preinscripcion_enviada'
    };
    const list = readAll();
    list.push(entry);
    writeAll(list);
    syncPreinscripcionToFirestore(entry);
    return entry;
  }

  function syncPreinscripcionToFirestore(entry) {
    if (!global.createDocument || !entry) return Promise.resolve();
    if (global.firebaseDb && global.firebaseDb.isSimulation) return Promise.resolve();
    const playerCount = parseInt(entry.playerCount, 10);
    return global
      .createDocument('torneo_preinscripciones', {
        eventName: entry.eventName || EVENT_NAME,
        teamName: String(entry.teamName || '').trim(),
        playerCount: playerCount > 0 ? playerCount : 0,
        town: String(entry.town || '').trim(),
        categories: Array.isArray(entry.categories) ? entry.categories : [],
        contactName: String(entry.contactName || '').trim(),
        contactEmail: String(entry.contactEmail || '').trim().toLowerCase(),
        contactPhone: String(entry.contactPhone || '').trim(),
        status: entry.status || 'preinscripcion_enviada',
        source: 'web_mailto',
        localId: entry.id
      })
      .catch(function (err) {
        console.warn('[TorneoPreinscripcion] Firestore:', err);
      });
  }

  function submitPreinscripcion(formData) {
    const err = validate(formData);
    if (err) throw new Error(err);
    const saved = savePreinscripcion(formData);
    return {
      entry: saved,
      mailtoUrl: buildClubNotifyMailto(formData)
    };
  }

  function buildClubNotifyMailto(data) {
    const subject =
      'Preinscripción ' +
      EVENT_NAME +
      ' — ' +
      (data.teamName || 'Equipo') +
      ' (' +
      categoryLabels(data.categories).join(', ') +
      ')';
    const requesterEmail = String(data.contactEmail || '').trim();
    if (global.ClubMailto && global.ClubMailto.buildNotifyClubMailto) {
      return global.ClubMailto.buildNotifyClubMailto({
        subject: subject,
        requesterEmail: requesterEmail,
        body: formatMailBody(data)
      });
    }
    return buildMailtoUrl(getClubNotifyEmail(), requesterEmail, subject, formatMailBody(data));
  }

  function openMailto(url) {
    if (global.ClubMailto && global.ClubMailto.openMailto) {
      return global.ClubMailto.openMailto(url);
    }
    if (!url) return false;
    global.location.href = url;
    return true;
  }

  global.TorneoPreinscripcion = {
    STORAGE_KEY: STORAGE_KEY,
    EVENT_NAME: EVENT_NAME,
    getCategories: getCategories,
    readAll: readAll,
    validate: validate,
    submitPreinscripcion: submitPreinscripcion,
    buildClubNotifyMailto: buildClubNotifyMailto,
    formatMailBody: formatMailBody,
    openMailto: openMailto
  };
})(typeof window !== 'undefined' ? window : globalThis);
