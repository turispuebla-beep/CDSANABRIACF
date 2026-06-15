/**
 * Solicitudes «Nuevo jugador» — envío público y lectura local (espejo Firebase en admin).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubPlayerApplications';
  const FN_PATH = '/.netlify/functions/submit-player-application';

  function normalizeDni(v) {
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '');
  }

  function readApplications() {
    try {
      return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function writeApplications(list) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
  }

  function getActiveSeason() {
    if (global.ClubSeason && global.ClubSeason.getActiveSeason) {
      return global.ClubSeason.getActiveSeason();
    }
    return '2026-2027';
  }

  function calculateAge(birthDateStr) {
    if (global.ClubInscriptionConfig && global.ClubInscriptionConfig.calculateAge) {
      return global.ClubInscriptionConfig.calculateAge(birthDateStr);
    }
    if (!birthDateStr) return null;
    const b = new Date(birthDateStr);
    if (isNaN(b.getTime())) return null;
    const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    const md = t.getMonth() - b.getMonth();
    if (md < 0 || (md === 0 && t.getDate() < b.getDate())) a--;
    return a;
  }

  function validateApplicationForm(data) {
    if (!data.name || !data.surname || !data.email || !data.phone || !data.birthDate) {
      return 'Completa nombre, apellidos, email, teléfono y fecha de nacimiento.';
    }
    const age = calculateAge(data.birthDate);
    if (age != null && age >= 18 && !data.dni) {
      return 'El DNI es obligatorio para mayores de edad.';
    }
    if (age != null && age < 18) {
      if (
        !data.guardianName ||
        !data.guardianSurname ||
        !data.guardianDni ||
        !data.guardianPhone ||
        !data.guardianEmail
      ) {
        return 'Para menores, indica nombre, apellidos, DNI, teléfono y email del tutor/a.';
      }
      const em = String(data.email || '').trim().toLowerCase();
      const gEm = String(data.guardianEmail || '').trim().toLowerCase();
      if (!em && !gEm) {
        return 'Indica un email de contacto del jugador/a o del tutor/a.';
      }
    }
    if (!data.commitmentAccepted) {
      return 'Debes confirmar el compromiso y la política interna del club.';
    }
    if (!data.clubRulesAccepted) {
      return 'Debes leer y aceptar el compromiso deportivo del club.';
    }
    const pwd = String(data.portalPassword || '');
    const pwd2 = String(data.portalPasswordConfirm || '');
    if (!pwd || pwd.length < 6) {
      return 'Indica una contraseña de acceso a tu ficha (mínimo 6 caracteres).';
    }
    if (pwd !== pwd2) {
      return 'Las contraseñas de acceso a la ficha no coinciden.';
    }
    return null;
  }

  function buildApplicationPayload(formData, season, portalPasswordHash) {
    return {
      season: season,
      name: formData.name.trim(),
      nombre: formData.name.trim(),
      surname: formData.surname.trim(),
      apellidos: formData.surname.trim(),
      dni: formData.dni ? normalizeDni(formData.dni) : '',
      email: String(formData.email).trim().toLowerCase(),
      phone: formData.phone.trim(),
      telefono: formData.phone.trim(),
      address: (formData.address || '').trim(),
      direccion: (formData.address || '').trim(),
      birthDate: formData.birthDate,
      fechaNacimiento: formData.birthDate,
      category:
        formData.category ||
        (global.ClubInscriptionConfig
          ? global.ClubInscriptionConfig.suggestCategoryFromBirthDate(formData.birthDate)
          : ''),
      categoria:
        formData.category ||
        (global.ClubInscriptionConfig
          ? global.ClubInscriptionConfig.suggestCategoryFromBirthDate(formData.birthDate)
          : ''),
      guardianName: (formData.guardianName || '').trim(),
      guardianSurname: (formData.guardianSurname || '').trim(),
      guardianDni: formData.guardianDni ? normalizeDni(formData.guardianDni) : '',
      guardianDNI: formData.guardianDni ? normalizeDni(formData.guardianDni) : '',
      guardianPhone: (formData.guardianPhone || '').trim(),
      guardianEmail: String(formData.guardianEmail || '').trim().toLowerCase(),
      guardianAddress: (formData.guardianAddress || '').trim(),
      commitmentAccepted: !!formData.commitmentAccepted,
      clubRulesAccepted: !!formData.clubRulesAccepted,
      isMinor: calculateAge(formData.birthDate) != null && calculateAge(formData.birthDate) < 18,
      portalPasswordHash: portalPasswordHash,
      photoDataUrl: formData.photoDataUrl ? String(formData.photoDataUrl).trim() : '',
      appScope: 'cdsanabriacf',
      status: 'pending_review',
      source: 'web_mailto'
    };
  }

  function upsertLocalApplication(application) {
    const list = readApplications();
    const dni = normalizeDni(application.dni);
    const season = String(application.season || '');
    const ix = list.findIndex(function (a) {
      return normalizeDni(a.dni) === dni && String(a.season || '') === season;
    });
    if (ix >= 0) list[ix] = Object.assign({}, list[ix], application);
    else list.push(application);
    writeApplications(list);
    return application;
  }

  function syncApplicationToFirestore(application) {
    if (!global.createDocument || !application) return Promise.resolve();
    if (global.firebaseDb && global.firebaseDb.isSimulation) return Promise.resolve();
    const doc = Object.assign({}, application, { localId: application.id });
    return global.createDocument('player_applications', doc).catch(function (err) {
      console.warn('[PlayerApplication] Firestore:', err);
    });
  }

  async function trySubmitApplicationServer(payload) {
    try {
      const res = await fetch(FN_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(function () {
        return { ok: false, error: 'Respuesta no válida del servidor' };
      });
      if (!res.ok || !json.ok) {
        if (res.status === 503 && json.code === 'site_update_mode') {
          const blocked = new Error(json.error || 'Registros temporalmente desactivados.');
          blocked.code = 'site_update_mode';
          throw blocked;
        }
        console.warn('submit-player-application:', json.error || res.status);
        return null;
      }
      return json.application || null;
    } catch (err) {
      if (err && err.code === 'site_update_mode') throw err;
      console.warn('submit-player-application:', err);
      return null;
    }
  }

  /**
   * Guarda la solicitud en el servidor (requerido). No usa mailto/local si el modo actualización está activo.
   */
  async function submitApplication(formData) {
    if (global.SiteUpdateMode && global.SiteUpdateMode.isActive && global.SiteUpdateMode.isActive()) {
      throw new Error(global.SiteUpdateMode.getMessage());
    }
    const err = validateApplicationForm(formData);
    if (err) throw new Error(err);

    const season = getActiveSeason();
    let portalPasswordHash = '';
    if (typeof global.hashClubAccessKey === 'function') {
      portalPasswordHash = await global.hashClubAccessKey(formData.portalPassword);
    } else {
      throw new Error('No se pudo proteger la contraseña. Recarga la página e inténtalo de nuevo.');
    }

    const payload = buildApplicationPayload(formData, season, portalPasswordHash);
    let application = Object.assign(
      {
        id: 'APP_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        createdAt: new Date().toISOString()
      },
      payload
    );

    const serverApp = await trySubmitApplicationServer(payload);
    if (!serverApp) {
      if (global.SiteUpdateMode && global.SiteUpdateMode.isEnabledGlobally && global.SiteUpdateMode.isEnabledGlobally()) {
        throw new Error(global.SiteUpdateMode.getMessage());
      }
      throw new Error(
        'No se pudo enviar la solicitud al club. Comprueba la conexión o contacta con cdsanabriafc@gmail.com.'
      );
    }

    application = Object.assign({}, application, serverApp);
    application = upsertLocalApplication(application);

    return {
      ok: true,
      application: application,
      serverSynced: !!serverApp,
      mailtoUrl: buildClubNotifyMailto(
        Object.assign({}, formData, application, { season: application.season || season })
      )
    };
  }

  function getClubNotifyEmail() {
    if (global.ClubMailto && global.ClubMailto.getClubNotifyEmail) {
      return global.ClubMailto.getClubNotifyEmail();
    }
    if (global.ClubContactDefaults && global.ClubContactDefaults.getNotifyEmail) {
      return global.ClubContactDefaults.getNotifyEmail();
    }
    return (
      (global.ClubContactDefaults && global.ClubContactDefaults.CLUB_EMAIL_NOTIFY) ||
      'cdsanabriafc@gmail.com'
    );
  }

  function getSiteBaseUrl() {
    if (global.location && /^https?:$/i.test(global.location.protocol)) {
      return String(global.location.origin).replace(/\/$/, '');
    }
    return 'https://www.cdsanabriacf.com';
  }

  function buildMailtoUrl(to, subject, body) {
    if (global.ClubMailto && global.ClubMailto.buildMailtoUrl) {
      return global.ClubMailto.buildMailtoUrl(to, '', subject, body);
    }
    const addr = String(to || '').trim();
    if (!addr || !addr.includes('@')) return '';
    const q = [];
    if (subject) q.push('subject=' + encodeURIComponent(subject));
    if (body) q.push('body=' + encodeURIComponent(body));
    return 'mailto:' + encodeURIComponent(addr) + (q.length ? '?' + q.join('&') : '');
  }

  function formatApplicationBody(data) {
    const requesterEmail = String(data.email || data.guardianEmail || '').trim();
    const sections = [
      {
        heading: 'DATOS DEL JUGADOR/A',
        fields: [
          { label: 'Temporada', value: data.season || getActiveSeason() },
          { label: 'Nombre', value: (data.name || '') + ' ' + (data.surname || '') },
          { label: 'DNI', value: data.dni },
          { label: 'Email', value: data.email },
          { label: 'Teléfono', value: data.phone },
          { label: 'Nacimiento', value: data.birthDate },
          { label: 'Dirección', value: data.address },
          { label: 'Categoría', value: data.category }
        ]
      }
    ];
    if (data.photoDataUrl) {
      sections[0].fields.push({ label: 'Foto', value: 'Adjunta en la solicitud (panel admin)' });
    }
    if (data.isMinor || (data.guardianName && data.guardianEmail)) {
      sections.push({
        heading: 'TUTOR/A LEGAL',
        fields: [
          {
            label: 'Nombre',
            value: (data.guardianName || '') + ' ' + (data.guardianSurname || '')
          },
          { label: 'DNI tutor/a', value: data.guardianDni },
          { label: 'Tel. tutor/a', value: data.guardianPhone },
          { label: 'Email tutor/a', value: data.guardianEmail },
          { label: 'Dirección tutor/a', value: data.guardianAddress }
        ]
      });
    }
    if (global.ClubMailto && global.ClubMailto.formatStructuredEmail) {
      return global.ClubMailto.formatStructuredEmail({
        title: 'SOLICITUD INSCRIPCIÓN JUGADOR/A',
        sections: sections,
        footerLines: ['Estado: pendiente de revisión en el panel de administración.'],
        requesterEmail: requesterEmail
      });
    }
    return formatApplicationBodyLegacy(data);
  }

  function formatApplicationBodyLegacy(data) {
    const lines = [
      'Nueva solicitud de jugador/a — CD Sanabria CF',
      '',
      'Temporada: ' + (data.season || getActiveSeason()),
      'Nombre: ' + (data.name || '') + ' ' + (data.surname || ''),
      'DNI: ' + (data.dni || '—'),
      'Email: ' + (data.email || ''),
      'Teléfono: ' + (data.phone || ''),
      'Nacimiento: ' + (data.birthDate || '—'),
      'Dirección: ' + (data.address || '—'),
      'Categoría: ' + (data.category || '—')
    ];
    if (data.isMinor || (data.guardianName && data.guardianEmail)) {
      lines.push(
        '',
        'Tutor/a legal:',
        (data.guardianName || '') + ' ' + (data.guardianSurname || ''),
        'DNI tutor/a: ' + (data.guardianDni || '—'),
        'Tel. tutor/a: ' + (data.guardianPhone || '—'),
        'Email tutor/a: ' + (data.guardianEmail || '—')
      );
    }
    lines.push('', 'Estado: pendiente de revisión en el panel de administración.');
    return lines.join('\r\n');
  }

  /** Correo al club tras guardar solicitud (mailto, sin servidor SMTP). */
  function buildClubNotifyMailto(data) {
    const subject =
      'Nueva solicitud jugador/a — ' +
      (data.name || '') +
      ' ' +
      (data.surname || '') +
      ' (' +
      (data.season || getActiveSeason()) +
      ')';
    const requesterEmail = String(data.email || data.guardianEmail || '').trim();
    const body = formatApplicationBody(data);
    if (global.ClubMailto && global.ClubMailto.buildNotifyClubMailto) {
      return global.ClubMailto.buildNotifyClubMailto({
        subject: subject,
        requesterEmail: requesterEmail,
        body: body
      });
    }
    return buildMailtoUrl(getClubNotifyEmail(), subject, body);
  }

  /** Correo al jugador/a cuando el admin acepta (mailto). */
  function buildPlayerApprovedMailto(app) {
    const season = app.season || getActiveSeason();
    const base = getSiteBaseUrl();
    const link = base + '/inscripcion-jugador.html?flow=finalize';
    const body =
      'Hola ' +
      (app.name || '') +
      ' ' +
      (app.surname || '') +
      ',\n\n' +
      'El CD Sanabria CF ha aceptado tu solicitud para la temporada ' +
      season +
      '.\n\n' +
      'Puedes completar la inscripción (ropa y pago) en la web:\n' +
      link +
      '\n\n' +
      'Entra en «Nuevo jugador/a» → «Finalizar ficha» (solo admitidos) con tu DNI y la contraseña que elegiste al solicitar el alta.\n\n' +
      'Un saludo,\nCD Sanabria CF';
    const subject = 'Solicitud aceptada — completa tu inscripción — CD Sanabria CF';
    const to = String(app.email || app.guardianEmail || '').trim();
    return buildMailtoUrl(to, subject, body);
  }

  function openMailto(url) {
    if (global.ClubMailto && global.ClubMailto.openMailto) {
      return global.ClubMailto.openMailto(url);
    }
    if (!url) return false;
    global.location.href = url;
    return true;
  }

  function findPendingByDni(dni, season) {
    const n = normalizeDni(dni);
    const s = season || getActiveSeason();
    return (
      readApplications().find(function (a) {
        return (
          normalizeDni(a.dni) === n &&
          String(a.season || '') === String(s) &&
          String(a.status || '') === 'pending_review'
        );
      }) || null
    );
  }

  global.PlayerApplication = {
    STORAGE_KEY: STORAGE_KEY,
    normalizeDni: normalizeDni,
    readApplications: readApplications,
    writeApplications: writeApplications,
    getActiveSeason: getActiveSeason,
    validateApplicationForm: validateApplicationForm,
    submitApplication: submitApplication,
    findPendingByDni: findPendingByDni,
    getClubNotifyEmail: getClubNotifyEmail,
    buildClubNotifyMailto: buildClubNotifyMailto,
    buildPlayerApprovedMailto: buildPlayerApprovedMailto,
    openMailto: openMailto
  };
})(typeof window !== 'undefined' ? window : globalThis);
