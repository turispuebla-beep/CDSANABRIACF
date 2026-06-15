/**
 * Acceso protegido a ficha de jugador/a — servidor Netlify (si existe) o verificación local.
 * Recuperación sin SMTP: mailto al club (ver openPasswordRecoveryMailto).
 */
(function (global) {
  'use strict';

  const FN_PATH = '/.netlify/functions/player-portal-auth';
  const CLUB_EMAIL_NOTIFY_FALLBACK = 'cdsanabriafc@gmail.com';

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
    const main = String(player.email || '').trim().toLowerCase();
    return main ? [main] : [];
  }

  function isPlayerInscriptionPaid(p) {
    if (!p) return false;
    return (
      !!p.inscriptionPaid ||
      String(p.paymentStatus || '').toLowerCase() === 'paid' ||
      String(p.inscriptionStatus || '').toLowerCase() === 'paid'
    );
  }

  function isPlayerProfileReadOnly(p) {
    if (!p) return true;
    const st = String(p.status || p.estado || '').toLowerCase();
    const ins = String(p.inscriptionStatus || '').toLowerCase();
    return st === 'rejected' || st === 'inactive' || st === 'baja' || ins === 'rejected';
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
      inscriptionPaid: isPlayerInscriptionPaid(p),
      portalPasswordHash: p.portalPasswordHash || ''
    };
  }

  function sanitizePlayerForPortalEdit(p) {
    const base = sanitizePlayerForPortal(p);
    if (!base) return null;
    return Object.assign({}, base, {
      domicilio: p.domicilio || p.address || p.direccion || '',
      localidad: p.localidad || p.town || '',
      provincia: p.provincia || p.province || 'Zamora',
      bloodGroup: p.bloodGroup || '',
      injuries: p.injuries || '',
      injuriesYear: p.injuriesYear || '',
      allergyIllness: p.allergyIllness || '',
      observations: p.observations || '',
      guardianDomicilio: p.guardianDomicilio || '',
      guardianLocalidad: p.guardianLocalidad || '',
      guardianProvincia: p.guardianProvincia || 'Zamora',
      guardianSameDomicilio: p.guardianSameDomicilio !== false,
      playerUpdatedBySelfAt: p.playerUpdatedBySelfAt || null,
      profileReadOnly: isPlayerProfileReadOnly(p)
    });
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

  async function loginForEdit(opts) {
    try {
      const data = await postJson({
        action: 'login_edit',
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
      const p = await loginLocal(opts);
      return sanitizePlayerForPortalEdit(p);
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

  async function changePasswordLocal(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    let p = null;
    if (o.playerId) {
      p = readLocalPlayers().find(function (x) {
        return String(x.id) === String(o.playerId);
      });
    } else {
      p = findLocalPlayer(o.dni, o.name, o.surname, o.season);
    }
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
    if (!global.verifyClubAccessKey || !global.hashClubAccessKey) {
      const err = new Error('verify_unavailable');
      err.code = 'verify_unavailable';
      throw err;
    }
    const ok = await global.verifyClubAccessKey(o.currentPassword || '', hash);
    if (!ok) {
      const err = new Error('bad_password');
      err.code = 'bad_password';
      throw err;
    }
    const newPwd = String(o.newPassword || '');
    if (newPwd.length < 6) {
      const err = new Error('weak_password');
      err.code = 'weak_password';
      throw err;
    }
    const newHash = await global.hashClubAccessKey(newPwd);
    const updated = Object.assign({}, p, {
      portalPasswordHash: newHash,
      portalPasswordSetAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    try {
      const players = readLocalPlayers();
      const pix = players.findIndex(function (x) {
        return String(x.id) === String(updated.id);
      });
      if (pix >= 0) players[pix] = updated;
      else players.push(updated);
      global.localStorage.setItem('clubPlayers', JSON.stringify(players));
      if (updated.linkedMemberId) {
        const members = JSON.parse(global.localStorage.getItem('clubMembers') || '[]');
        const mix = members.findIndex(function (m) {
          return String(m.id) === String(updated.linkedMemberId);
        });
        if (mix >= 0) {
          members[mix].portalPasswordHash = newHash;
          members[mix].passwordHash = newHash;
          global.localStorage.setItem('clubMembers', JSON.stringify(members));
          global.localStorage.setItem('socios', JSON.stringify(members));
        }
      }
    } catch (_) {}
    return sanitizePlayerForPortalEdit(updated);
  }

  async function changePassword(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    try {
      const data = await postJson({
        action: 'change_password',
        playerId: o.playerId || '',
        dni: normalizeDni(o.dni),
        name: o.name || '',
        surname: o.surname || '',
        season: o.season || '',
        currentPassword: o.currentPassword || '',
        newPassword: o.newPassword || ''
      });
      if (data.player) mergePlayerIntoLocalStorage(data.player);
      return data.player || null;
    } catch (e) {
      if (
        e.code === 'bad_password' ||
        e.code === 'no_password' ||
        e.code === 'weak_password' ||
        e.code === 'not_found'
      ) {
        throw e;
      }
      if (!isServerUnavailableError(e)) throw e;
      const player = await changePasswordLocal(o);
      mergePlayerIntoLocalStorage(player);
      return player;
    }
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
    loginForEdit: loginForEdit,
    setupPassword: setupPassword,
    requestPasswordReset: requestPasswordReset,
    resetPasswordWithToken: resetPasswordWithToken,
    changePassword: changePassword,
    openPasswordRecoveryMailto: openPasswordRecoveryMailto,
    mergePlayerIntoLocalStorage: mergePlayerIntoLocalStorage
  };
})(typeof window !== 'undefined' ? window : globalThis);
