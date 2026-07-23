/**
 * Preinscripción Torneo Fútbol 7 — público, sin login.
 * Guarda en Firebase (función Netlify) y envía correos automáticos al club y al contacto.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubTorneoPreinscripciones';
  const EVENT_NAME = 'Torneo Fútbol 7 — 2026';
  const API = '/.netlify/functions/submit-torneo-preinscripcion';

  function getCategories() {
    if (global.ClubTorneoPricing && global.ClubTorneoPricing.getCategories) {
      return global.ClubTorneoPricing.getCategories();
    }
    return [
      { id: 'prebenjamin', label: 'Prebenjamín (Chupetines)', feeEur: 60 },
      { id: 'benjamin', label: 'Benjamín', feeEur: 60 },
      { id: 'alevin', label: 'Alevín', feeEur: 60 },
      { id: 'infantil', label: 'Infantil', feeEur: 60 },
      { id: 'cadete', label: 'Cadete', feeEur: 60 },
      { id: 'juvenil', label: 'Juvenil', feeEur: 100 },
      { id: 'senior', label: 'Senior', feeEur: 100 }
    ];
  }

  function estimateFeeEur(categoryIds) {
    if (global.ClubTorneoPricing && global.ClubTorneoPricing.sumFeesForCategoryIds) {
      return global.ClubTorneoPricing.sumFeesForCategoryIds(categoryIds);
    }
    return 0;
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

  function isLocalFile() {
    return global.location && global.location.protocol === 'file:';
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

  function formatFeeForMail(categoryIds) {
    const fee = estimateFeeEur(categoryIds);
    if (global.ClubTorneoPricing && global.ClubTorneoPricing.formatEur) {
      return fee > 0 ? global.ClubTorneoPricing.formatEur(fee) + ' (informativo)' : '—';
    }
    return fee > 0 ? fee + ' € (informativo)' : '—';
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
    if (!data.premiosAceptados) return 'Debes leer y aceptar los términos sobre premios.';
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
              { label: 'Categorías', value: cats },
              { label: 'Cuota estimada', value: formatFeeForMail(data.categories) }
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
      'Inscripción — ' + EVENT_NAME,
      'CD Sanabria CF',
      '',
      'Evento: ' + EVENT_NAME,
      'Nombre del equipo: ' + (data.teamName || ''),
      'Número de jugadores: ' + (data.playerCount || ''),
      'Población: ' + (data.town || ''),
      'Categorías: ' + cats,
      'Cuota estimada: ' + formatFeeForMail(data.categories),
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

  function savePreinscripcionLocal(data) {
    const entry = {
      id: 'tp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      eventName: EVENT_NAME,
      teamName: data.teamName,
      playerCount: data.playerCount,
      town: data.town,
      categories: data.categories.slice(),
      estimatedFeeEur: estimateFeeEur(data.categories),
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      createdAt: new Date().toISOString(),
      status: 'preinscripcion_enviada'
    };
    const list = readAll();
    list.push(entry);
    writeAll(list);
    return entry;
  }

  function updateLocalEntry(localId, patch) {
    const list = readAll();
    const ix = list.findIndex(function (e) {
      return String(e.id) === String(localId);
    });
    if (ix < 0) return;
    list[ix] = Object.assign({}, list[ix], patch || {});
    writeAll(list);
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
        source: 'web_fallback',
        localId: entry.id
      })
      .catch(function (err) {
        console.warn('[TorneoPreinscripcion] Firestore:', err);
      });
  }

  async function submitPreinscripcionToServer(formData, localEntry) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preinscripcion: Object.assign({}, formData, {
          eventName: EVENT_NAME,
          localId: localEntry.id,
          premiosAceptados: !!formData.premiosAceptados,
          premiosAceptadosAt: formData.premiosAceptados ? new Date().toISOString() : null
        })
      })
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      const blocked = new Error(data.error || 'No se pudo registrar la preinscripción en el servidor');
      if (res.status === 503 && data.code === 'site_update_mode') {
        blocked.code = 'site_update_mode';
      }
      throw blocked;
    }
    return data;
  }

  async function submitPreinscripcion(formData) {
    if (global.SiteUpdateMode && global.SiteUpdateMode.isActive && global.SiteUpdateMode.isActive()) {
      throw new Error(global.SiteUpdateMode.getMessage());
    }
    const err = validate(formData);
    if (err) throw new Error(err);
    const saved = savePreinscripcionLocal(formData);

    if (isLocalFile()) {
      if (global.SiteUpdateMode && global.SiteUpdateMode.isEnabledGlobally && global.SiteUpdateMode.isEnabledGlobally()) {
        throw new Error(global.SiteUpdateMode.getMessage());
      }
      syncPreinscripcionToFirestore(saved);
      return {
        entry: saved,
        serverOk: false,
        emailContactSent: false,
        emailClubSent: false,
        mailtoUrl: buildClubNotifyMailto(formData)
      };
    }

    try {
      const result = await submitPreinscripcionToServer(formData, saved);
      updateLocalEntry(saved.id, {
        firestoreId: result.id,
        status: 'preinscripcion_enviada'
      });
      return {
        entry: Object.assign({}, saved, { firestoreId: result.id }),
        serverOk: true,
        emailContactSent: !!result.emailContactSent,
        emailClubSent: !!result.emailClubSent,
        preinscripcion: result.preinscripcion || null
      };
    } catch (serverErr) {
      if (serverErr && serverErr.code === 'site_update_mode') {
        throw serverErr;
      }
      if (global.SiteUpdateMode && global.SiteUpdateMode.isEnabledGlobally && global.SiteUpdateMode.isEnabledGlobally()) {
        throw new Error(global.SiteUpdateMode.getMessage());
      }
      console.warn('[TorneoPreinscripcion] servidor:', serverErr);
      await syncPreinscripcionToFirestore(saved);
      return {
        entry: saved,
        serverOk: false,
        emailContactSent: false,
        emailClubSent: false,
        mailtoUrl: buildClubNotifyMailto(formData),
        error: serverErr.message || String(serverErr)
      };
    }
  }

  function buildClubNotifyMailto(data) {
    const subject =
      'Inscripción ' +
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
    estimateFeeEur: estimateFeeEur,
    readAll: readAll,
    validate: validate,
    submitPreinscripcion: submitPreinscripcion,
    buildClubNotifyMailto: buildClubNotifyMailto,
    formatMailBody: formatMailBody,
    openMailto: openMailto
  };
})(typeof window !== 'undefined' ? window : globalThis);
