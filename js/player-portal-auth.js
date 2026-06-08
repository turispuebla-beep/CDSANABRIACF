/**
 * Acceso protegido a ficha de jugador/a — servidor Netlify (si existe) o verificación local.
 * Recuperación sin SMTP: mailto al club (ver openPasswordRecoveryMailto).
 */
(function (global) {
  'use strict';

  const FN_PATH = '/.netlify/functions/player-portal-auth';
  const CLUB_EMAIL_NOTIFY_FALLBACK = 'cdsanabriacf@gmail.com';

  function normalizeDni(v) {
    if (global.PlayerInscription && global.PlayerInscription.normalizeDni) {
      return global.PlayerInscription.normalizeDni(v);
    }
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '');
  }

  function readLocalPlayers() {
    try {
      return JSON.parse(global.localStorage.getItem('clubPlayers') || '[]');
    } catch (_) {
      return [];
    }
  }

  function normalizeNamePart(v) {
    return String(v || '').trim().toLowerCase();
  }

  function findLocalPlayer(dni, name, surname, season) {
    const norm = normalizeDni(dni);
    const seasonStr = String(season || '').trim();
    const nm = normalizeNamePart(name);
    const sn = normalizeNamePart(surname);
    const players = readLocalPlayers();

    if (norm) {
      const byDni = players.find(function (p) {
        return normalizeDni(p.dni) === norm && String(p.inscriptionSeason || p.temporada || '') === seasonStr;
      });
      if (byDni) return byDni;
    }
    if (nm && sn) {
      return (
        players.find(function (p) {
          const pn = normalizeNamePart(p.name || p.nombre);
          const ps = normalizeNamePart(p.surname || p.apellidos);
          return pn === nm && ps === sn && String(p.inscriptionSeason || p.temporada || '') === seasonStr;
        }) || null
      );
    }
    return null;
  }

  function maskEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    if (!e || !e.includes('@')) return '';
    return e.replace(/^(.{1,2})[^@]*(@.*)$/, '$1***$2');
  }

  function playerPortalEmails(player) {
    const out = [];
    const main = String(player.email || '').trim().toLowerCase();
    const guardian = String(player.guardianEmail || '').trim().toLowerCase();
    if (main) out.push(main);
    if (guardian && guardian !== main) out.push(guardian);
    return out;
  }

  function sanitizePlayerForPortal(p) {
    if (!p) return null;
    return {
      id: p.id,
      name: p.name || p.nombre || '',
      nombre: p.name || p.nombre || '',
      surname: p.surname || p.apellidos || '',
      apellidos: p.surname || p.apellidos || '',
      dni: p.dni || '',
      email: p.email || '',
      phone: p.phone || p.telefono || '',
      telefono: p.phone || p.telefono || '',
      address: p.address || p.direccion || '',
      direccion: p.address || p.direccion || '',
      birthDate: p.birthDate || p.fechaNacimiento || '',
      fechaNacimiento: p.birthDate || p.fechaNacimiento || '',
      category: p.category || p.categoria || '',
      categoria: p.category || p.categoria || '',
      position: p.position || p.posicion || '',
      posicion: p.position || p.posicion || '',
      weightKg: p.weightKg != null ? p.weightKg : null,
      heightCm: p.heightCm != null ? p.heightCm : null,
      guardianName: p.guardianName || '',
      guardianDNI: p.guardianDNI || p.guardianDni || '',
      guardianPhone: p.guardianPhone || '',
      guardianEmail: p.guardianEmail || '',
      guardianAddress: p.guardianAddress || '',
      inscriptionSeason: p.inscriptionSeason || p.temporada || '',
      inscriptionStatus: p.inscriptionStatus || '',
      applicationId: p.applicationId || null,
      status: p.status || '',
      paymentStatus: p.paymentStatus || '',
      inscriptionPaid: !!p.inscriptionPaid,
      portalPasswordHash: p.portalPasswordHash || ''
    };
  }

  function isServerUnavailableError(err) {
    if (!err) return true;
    if (err.status === 404 || err.status === 502 || err.status === 503) return true;
    const msg = String(err.message || '').toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('not found');
  }

  async function postJson(payload) {
    const res = await fetch(FN_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {}
    if (!res.ok) {
      const err = new Error(data.error || data.message || 'Error de acceso');
      err.code = data.error;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function checkAccessLocal(opts) {
    const p = findLocalPlayer(opts.dni, opts.name, opts.surname, opts.season);
    if (!p) return { ok: false, error: 'not_found' };
    const emails = playerPortalEmails(p);
    return {
      ok: true,
      playerId: p.id,
      hasPortalPassword: !!String(p.portalPasswordHash || '').trim(),
      clubApproved: String(p.inscriptionStatus || '').toLowerCase() === 'approved_for_inscription',
      maskedEmail: maskEmail(emails[0] || '')
    };
  }

  async function checkAccess(opts) {
    try {
      return await postJson({
        action: 'check',
        dni: normalizeDni(opts.dni),
        name: opts.name || '',
        surname: opts.surname || '',
        season: opts.season || ''
      });
    } catch (e) {
      if (!isServerUnavailableError(e)) throw e;
      const local = checkAccessLocal(opts);
      if (!local.ok) throw e;
      return local;
    }
  }

  async function loginLocal(opts) {
    const p = findLocalPlayer(opts.dni, opts.name, opts.surname, opts.season);
    if (!p) {
      const err = new Error('not_found');
      err.code = 'not_found';
      throw err;
    }
    const hash = String(p.portalPasswordHash || '').trim();
    if (!hash) {
      const err = new Error('no_password');
      err.code = 'no_password';
      throw err;
    }
    if (!global.verifyClubAccessKey) {
      const err = new Error('verify_unavailable');
      err.code = 'verify_unavailable';
      throw err;
    }
    const ok = await global.verifyClubAccessKey(opts.password || '', hash);
    if (!ok) {
      const err = new Error('bad_password');
      err.code = 'bad_password';
      throw err;
    }
    return sanitizePlayerForPortal(p);
  }

  async function login(opts) {
    try {
      const data = await postJson({
        action: 'login',
        dni: normalizeDni(opts.dni),
        name: opts.name || '',
        surname: opts.surname || '',
        password: opts.password || '',
        season: opts.season || ''
      });
      return data.player || null;
    } catch (e) {
      if (e.code === 'bad_password' || e.code === 'not_found' || e.code === 'no_password') throw e;
      if (!isServerUnavailableError(e)) throw e;
      return loginLocal(opts);
    }
  }

  async function setupPassword(opts) {
    try {
      const data = await postJson({
        action: 'setup',
        dni: normalizeDni(opts.dni),
        email: String(opts.email || '').trim().toLowerCase(),
        password: opts.password || '',
        season: opts.season || ''
      });
      return data.player || null;
    } catch (e) {
      if (!isServerUnavailableError(e)) throw e;
      const err = new Error(
        'No se pudo guardar la contraseña en la nube. El club debe asignarla desde el panel de administración (Jugadores → Contraseña ficha) o escríbenos con el botón de recuperación.'
      );
      err.code = 'setup_requires_admin';
      throw err;
    }
  }

  async function requestPasswordReset(opts) {
    return postJson({
      action: 'request_reset',
      dni: normalizeDni(opts.dni),
      name: opts.name || '',
      surname: opts.surname || '',
      email: String(opts.email || '').trim().toLowerCase(),
      season: opts.season || ''
    });
  }

  async function resetPasswordWithToken(token, password) {
    const data = await postJson({
      action: 'reset',
      token: String(token || '').trim(),
      password: password || ''
    });
    return data.player || null;
  }

  function getClubNotifyEmail() {
    if (global.ClubMailto && global.ClubMailto.getClubNotifyEmail) {
      return global.ClubMailto.getClubNotifyEmail();
    }
    return CLUB_EMAIL_NOTIFY_FALLBACK;
  }

  function openPasswordRecoveryMailto(opts) {
    const identity = opts || {};
    const club = getClubNotifyEmail();
    const subject = 'Recuperación contraseña ficha jugador/a — CD Sanabria CF';
    const body =
      'Hola,\r\n\r\n' +
      'Solicito restablecer la contraseña de acceso a mi ficha de jugador/a (Buscar mi ficha).\r\n\r\n' +
      'DNI del jugador/a: ' +
      (identity.dni || '') +
      '\r\n' +
      'Nombre: ' +
      (identity.name || '') +
      '\r\n' +
      'Apellidos: ' +
      (identity.surname || '') +
      '\r\n' +
      'Email de contacto: ' +
      (identity.email || '') +
      '\r\n' +
      'Temporada: ' +
      (identity.season || '') +
      '\r\n\r\n' +
      'Gracias.';
    const mailto =
      global.ClubMailto && global.ClubMailto.buildNotifyClubMailto
        ? global.ClubMailto.buildNotifyClubMailto({
            subject: subject,
            requesterEmail: identity.email || '',
            body: body
          })
        : 'mailto:' +
          encodeURIComponent(club) +
          '?subject=' +
          encodeURIComponent(subject) +
          '&body=' +
          encodeURIComponent(body);
    if (mailto) global.location.href = mailto;
    return mailto;
  }

  function mergePlayerIntoLocalStorage(player) {
    if (!player || !player.id) return;
    try {
      const list = readLocalPlayers();
      const ix = list.findIndex(function (p) {
        return String(p.id) === String(player.id);
      });
      const merged =
        ix >= 0 ? Object.assign({}, list[ix], player) : Object.assign({ appScope: 'cdsanabriacf' }, player);
      if (ix >= 0) list[ix] = merged;
      else list.push(merged);
      global.localStorage.setItem('clubPlayers', JSON.stringify(list));
    } catch (_) {}
  }

  global.PlayerPortalAuth = {
    normalizeDni: normalizeDni,
    checkAccess: checkAccess,
    login: login,
    setupPassword: setupPassword,
    requestPasswordReset: requestPasswordReset,
    resetPasswordWithToken: resetPasswordWithToken,
    openPasswordRecoveryMailto: openPasswordRecoveryMailto,
    mergePlayerIntoLocalStorage: mergePlayerIntoLocalStorage
  };
})(typeof window !== 'undefined' ? window : globalThis);
