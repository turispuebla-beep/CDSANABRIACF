/**
 * Inscripción pública jugador/a — temporada, ropa, cuota ficha/socio, pago
 */
(function (global) {
  'use strict';

  const PENDING_KEY = 'cdsan_pending_player_inscription';

  function normalizeDni(v) {
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '');
  }

  function composeAddress(parts) {
    const domicilio = String(parts?.domicilio || '').trim();
    const localidad = String(parts?.localidad || parts?.town || '').trim();
    const provincia = String(parts?.provincia || parts?.province || '').trim();
    return [domicilio, localidad, provincia].filter(Boolean).join(', ');
  }

  function readPlayers() {
    try {
      return JSON.parse(global.localStorage.getItem('clubPlayers') || '[]');
    } catch (_) {
      return [];
    }
  }

  function readMembers() {
    try {
      return JSON.parse(global.localStorage.getItem('clubMembers') || '[]');
    } catch (_) {
      return [];
    }
  }

  function findPlayerByDni(dni) {
    const n = normalizeDni(dni);
    return readPlayers().find((p) => normalizeDni(p.dni) === n) || null;
  }

  function findPlayerForSeason(dni, season) {
    const n = normalizeDni(dni);
    return (
      readPlayers().find(
        (p) => normalizeDni(p.dni) === n && String(p.inscriptionSeason || '') === String(season)
      ) || null
    );
  }

  function findPaidPlayerForSeason(dni, season) {
    const p = findPlayerForSeason(dni, season);
    if (!p) return null;
    if (p.inscriptionPaid === true || p.paymentStatus === 'paid') return p;
    const ins = String(p.inscriptionStatus || '').toLowerCase();
    if (ins === 'paid') return p;
    if (
      p.status === 'active' &&
      ins !== 'pending_payment' &&
      ins !== 'pending_transfer' &&
      ins !== 'pending_cash' &&
      ins !== 'pending_tpv'
    ) {
      return p;
    }
    return null;
  }

  function findApprovedForInscription(dni, season) {
    const p = findPlayerForSeason(dni, season);
    if (!p) return null;
    const ins = String(p.inscriptionStatus || '').toLowerCase();
    if (ins === 'approved_for_inscription') return p;
    return null;
  }

  function isApprovedForInscription(player, season) {
    if (!player) return false;
    return (
      String(player.inscriptionStatus || '').toLowerCase() === 'approved_for_inscription' &&
      String(player.inscriptionSeason || '') === String(season || '')
    );
  }

  function findApprovedForInscriptionByIdentity(dni, name, surname, season) {
    const s = String(season || '');
    if (dni) {
      const byDni = findApprovedForInscription(dni, s);
      if (byDni) return byDni;
    }
    const nm = String(name || '').trim().toLowerCase();
    const sn = String(surname || '').trim().toLowerCase();
    if (!nm || !sn) return null;
    return (
      readPlayers().find(function (p) {
        if (!isApprovedForInscription(p, s)) return false;
        const pn = String(p.name || p.nombre || '').trim().toLowerCase();
        const ps = String(p.surname || p.apellidos || '').trim().toLowerCase();
        return pn === nm && ps === sn;
      }) || null
    );
  }

  function findPlayerForContinueLookup(dni, name, surname, season) {
    const n = normalizeDni(dni);
    const s = String(season || '');
    const players = readPlayers();
    if (n) {
      const byDni = players.find(function (p) {
        return normalizeDni(p.dni) === n && String(p.inscriptionSeason || '') === s;
      });
      if (byDni) return byDni;
    }
    const nm = String(name || '').trim().toLowerCase();
    const sn = String(surname || '').trim().toLowerCase();
    if (nm && sn) {
      return (
        players.find(function (p) {
          const pn = String(p.name || p.nombre || '').trim().toLowerCase();
          const ps = String(p.surname || p.apellidos || '').trim().toLowerCase();
          return pn === nm && ps === sn && String(p.inscriptionSeason || '') === s;
        }) || null
      );
    }
    return null;
  }

  /** Jugador/a que ya figura en el club (cualquier temporada) y aún no ha completado inscripción web de la temporada actual. */
  function findReturningPlayerForInscription(dni, name, surname, season) {
    const s = String(season || '');
    const players = readPlayers();
    const n = normalizeDni(dni);

    function isPaidThisSeason(p) {
      const pdni = normalizeDni(p && p.dni);
      if (!pdni) return false;
      return !!findPaidPlayerForSeason(pdni, s);
    }

    function sortRecent(list) {
      return list.slice().sort(function (a, b) {
        return String(b.updatedAt || b.registrationDate || '').localeCompare(
          String(a.updatedAt || a.registrationDate || '')
        );
      });
    }

    if (n) {
      const matches = players.filter(function (p) {
        return normalizeDni(p.dni) === n;
      });
      if (matches.length) {
        const sorted = sortRecent(matches);
        const sameSeason = sorted.find(function (p) {
          return String(p.inscriptionSeason || '') === s && !isPaidThisSeason(p);
        });
        if (sameSeason) return sameSeason;
        const open = sorted.find(function (p) {
          return !isPaidThisSeason(p);
        });
        if (open) return open;
      }
    }

    const nm = String(name || '').trim().toLowerCase();
    const sn = String(surname || '').trim().toLowerCase();
    if (nm && sn) {
      const matches = players.filter(function (p) {
        const pn = String(p.name || p.nombre || '').trim().toLowerCase();
        const ps = String(p.surname || p.apellidos || '').trim().toLowerCase();
        return pn === nm && ps === sn;
      });
      if (matches.length) {
        const sorted = sortRecent(matches);
        const sameSeason = sorted.find(function (p) {
          return String(p.inscriptionSeason || '') === s && !isPaidThisSeason(p);
        });
        if (sameSeason) return sameSeason;
        const open = sorted.find(function (p) {
          return !isPaidThisSeason(p);
        });
        if (open) return open;
      }
    }
    return null;
  }

  function getDisplayStatus(player) {
    const ins = String(player.inscriptionStatus || '').toLowerCase();
    if (player.inscriptionPaid || ins === 'paid' || player.paymentStatus === 'paid') {
      return { key: 'paid', text: 'Pagado / Activo', color: '#059669' };
    }
    if (ins === 'pending_transfer') {
      return { key: 'pending_transfer', text: 'Pendiente transferencia', color: '#d97706' };
    }
    if (ins === 'pending_tpv') {
      return { key: 'pending_tpv', text: 'Pendiente TPV', color: '#d97706' };
    }
    if (ins === 'pending_cash') {
      return { key: 'pending_cash', text: 'Pendiente efectivo', color: '#d97706' };
    }
    if (ins === 'pending_payment') {
      return { key: 'pending_payment', text: 'Pendiente de pago', color: '#ea580c' };
    }
    if (player.status === 'pending_validation') {
      return { key: 'pending_validation', text: 'Pendiente validación', color: '#f59e0b' };
    }
    if (player.status === 'active') {
      return { key: 'active', text: 'Activo', color: '#059669' };
    }
    return { key: 'inactive', text: 'Inactivo', color: '#dc2626' };
  }

  function needsPaymentValidation(player) {
    if (!player) return false;
    const ins = String(player.inscriptionStatus || '').toLowerCase();
    if (ins === 'pending_payment' || ins === 'pending_transfer' || ins === 'pending_cash' || ins === 'pending_tpv') {
      return true;
    }
    if (player.registrationSource === 'web_inscription' && !player.inscriptionPaid) return true;
    return false;
  }

  function findMemberByDni(dni) {
    const n = normalizeDni(dni);
    return readMembers().find((m) => normalizeDni(m.dni) === n) || null;
  }

  function computeCart(settings, categoryId, kitItems, payFicha, paySocio) {
    const s = settings || global.ClubInscriptionConfig.read();
    let kitTotal = 0;
    (kitItems || []).forEach((it) => {
      kitTotal += Number(it.price || 0);
    });
    let ficha = 0;
    let socio = 0;
    if (payFicha && s.chargeFicha) {
      ficha = global.ClubInscriptionConfig.getCategoryFee(s, categoryId, 'ficha');
    }
    if (paySocio && s.chargeSocio) {
      socio = global.ClubInscriptionConfig.getCategoryFee(s, categoryId, 'socio');
    }
    const total = Math.round((kitTotal + ficha + socio) * 100) / 100;
    return {
      kitTotal: Math.round(kitTotal * 100) / 100,
      fichaFee: ficha,
      socioFee: socio,
      total: total,
      payFicha: !!payFicha && s.chargeFicha,
      paySocio: !!paySocio && s.chargeSocio
    };
  }

  function buildPlayerRecord(form, cart, settings) {
    const s = settings || global.ClubInscriptionConfig.read();
    const age = global.ClubInscriptionConfig.calculateAge(form.birthDate);
    const existing = form.dni ? findPlayerByDni(form.dni) : null;
    const id = existing && existing.id ? existing.id : 'PLAYER_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

    return {
      id: id,
      name: form.name,
      nombre: form.name,
      surname: form.surname,
      apellidos: form.surname,
      dni: form.dni ? normalizeDni(form.dni) : '',
      phone: form.phone,
      telefono: form.phone,
      email: String(form.email || '').trim().toLowerCase(),
      domicilio: form.domicilio || '',
      localidad: form.localidad || '',
      provincia: form.provincia || 'Zamora',
      address: composeAddress(form) || form.address || '',
      direccion: composeAddress(form) || form.address || '',
      birthDate: form.birthDate,
      fechaNacimiento: form.birthDate,
      age: age,
      edad: age,
      category: form.category,
      categoria: form.category,
      number: existing?.number || existing?.dorsal || '',
      dorsal: existing?.dorsal || existing?.number || '',
      position: form.position || '',
      posicion: form.position || '',
      license: existing?.license || existing?.licencia || '',
      licencia: existing?.licencia || existing?.license || '',
      weightKg: form.weightKg != null ? Number(form.weightKg) : null,
      peso: form.weightKg != null ? Number(form.weightKg) : null,
      heightCm: form.heightCm != null ? Number(form.heightCm) : null,
      altura: form.heightCm != null ? Number(form.heightCm) : null,
      guardianName: form.guardianName || '',
      guardianDNI: form.guardianDNI || '',
      guardianPhone: form.guardianPhone || '',
      guardianEmail: form.guardianEmail || '',
      guardianSameDomicilio: !!form.guardianSameDomicilio,
      guardianDomicilio: form.guardianDomicilio || '',
      guardianLocalidad: form.guardianLocalidad || '',
      guardianProvincia: form.guardianProvincia || '',
      guardianAddress:
        form.guardianAddress ||
        composeAddress({
          domicilio: form.guardianDomicilio,
          localidad: form.guardianLocalidad,
          provincia: form.guardianProvincia
        }) ||
        '',
      categorySuperiorConsent: !!form.categorySuperiorConsent,
      playerConsent: !!form.playerConsent,
      photoConsent: !!form.photoConsent,
      photo: form.photoData || existing?.photo || null,
      matches: existing?.matches || 0,
      goals: existing?.goals || 0,
      assists: existing?.assists || 0,
      yellowCards: existing?.yellowCards || 0,
      redCards: existing?.redCards || 0,
      inscriptionSeason: s.season,
      temporada: s.season,
      kit: {
        mode: s.kitMode,
        items: cart.kitItems || []
      },
      kitOrder: cart.kitItems || [],
      chargeBreakdown: {
        kit: cart.kitTotal,
        ficha: cart.fichaFee,
        socio: cart.socioFee,
        total: cart.total
      },
      payFichaSelected: cart.payFicha,
      paySocioSelected: cart.paySocio,
      socioJugador: true,
      isJugador: true,
      membershipKind: 'socio',
      playerCategory: form.category,
      registrationSource: 'web_inscription',
      registrationDate: new Date().toISOString(),
      inscriptionStatus: 'pending_payment',
      status: 'pending_validation',
      paymentStatus: 'pending',
      inscriptionPaid: false,
      isMinor: age != null && age < 18,
      portalPasswordHash: form.portalPasswordHash || existing?.portalPasswordHash || '',
      portalPasswordSetAt:
        form.portalPasswordHash || existing?.portalPasswordSetAt
          ? form.portalPasswordSetAt || existing?.portalPasswordSetAt || new Date().toISOString()
          : '',
      injuries: form.injuries || '',
      injuriesYear: form.injuriesYear || '',
      allergyIllness: form.allergyIllness || '',
      bloodGroup: form.bloodGroup || '',
      observations: form.observations || '',
      previousSeasonPlayed: form.previousSeasonPlayed || '',
      updatedAt: new Date().toISOString()
    };
  }

  function requiresPasswordForInscriptionAccess(dni, season) {
    const n = normalizeDni(dni);
    if (!n) return false;
    if (findPaidPlayerForSeason(n, season)) return true;
    const p = findPlayerForSeason(n, season);
    if (!p) return false;
    const ins = String(p.inscriptionStatus || '').toLowerCase();
    if (
      ins === 'pending_payment' ||
      ins === 'pending_transfer' ||
      ins === 'pending_cash' ||
      ins === 'pending_tpv' ||
      ins === 'paid'
    ) {
      return true;
    }
    if (p.inscriptionWebSubmittedAt) return true;
    if (
      p.registrationSource === 'web_inscription' &&
      ((p.kitOrder && p.kitOrder.length) || (p.kit && p.kit.items && p.kit.items.length))
    ) {
      return true;
    }
    return false;
  }

  function rememberInscriptionLockDni(dni) {
    try {
      if (dni) global.sessionStorage.setItem('cdsan_insc_lock_dni', normalizeDni(dni));
    } catch (_) {}
  }

  function upsertPlayerLocal(player) {
    const players = readPlayers();
    const dni = normalizeDni(player.dni);
    const season = String(player.inscriptionSeason || '');
    let idx = players.findIndex(
      (p) => normalizeDni(p.dni) === dni && String(p.inscriptionSeason || '') === season
    );
    if (idx < 0) {
      idx = players.findIndex((p) => normalizeDni(p.dni) === dni);
    }
    if (idx >= 0) {
      players[idx] = {
        ...players[idx],
        ...player,
        id: players[idx].id,
        portalPasswordHash: player.portalPasswordHash || players[idx].portalPasswordHash || ''
      };
    } else {
      players.push(player);
    }
    global.localStorage.setItem('clubPlayers', JSON.stringify(players));
    return players[idx >= 0 ? idx : players.length - 1];
  }

  function isTemporaryLocalId(id) {
    const v = String(id || '');
    return !v || v.startsWith('PLAYER_') || v.startsWith('MEMBER_');
  }

  function normalizePlayerDualFields(player) {
    if (!player || typeof player !== 'object') return player;
    const p = { ...player };
    const name = String(p.name || p.nombre || '').trim();
    const surname = String(p.surname || p.apellidos || '').trim();
    const phone = String(p.phone || p.telefono || '').trim();
    const legacyAddress = String(p.address || p.direccion || '').trim();
    let domicilio = String(p.domicilio || '').trim();
    const localidad = String(p.localidad || p.town || '').trim();
    const provincia = String(p.provincia || p.province || 'Zamora').trim() || 'Zamora';
    if (!domicilio && legacyAddress && !localidad) domicilio = legacyAddress;
    const address = composeAddress({ domicilio: domicilio, localidad: localidad, provincia: provincia }) || legacyAddress;
    const birthDate = String(p.birthDate || p.fechaNacimiento || '').trim();
    const category = String(p.category || p.categoria || '').trim();
    const gDni = normalizeDni(p.guardianDNI || p.guardianDni);
    p.name = name;
    p.nombre = name;
    p.surname = surname;
    p.apellidos = surname;
    p.phone = phone;
    p.telefono = phone;
    p.domicilio = domicilio;
    p.localidad = localidad;
    p.provincia = provincia;
    p.address = address;
    p.direccion = address;
    p.birthDate = birthDate;
    p.fechaNacimiento = birthDate;
    p.category = category;
    p.categoria = category;
    if (gDni) {
      p.guardianDNI = gDni;
      p.guardianDni = gDni;
    }
    p.appScope = p.appScope || 'cdsanabriacf';
    return p;
  }

  function syncLocalPlayerAfterRemote(player, remotePlayer) {
    const players = readPlayers();
    const normDni = normalizeDni(player.dni);
    const email = String(player.email || '').trim().toLowerCase();
    let ix = players.findIndex(function (p) {
      return p.id === player.id || (normDni && normalizeDni(p.dni) === normDni);
    });
    if (ix < 0 && email) {
      ix = players.findIndex(function (p) {
        return String(p.email || '').trim().toLowerCase() === email;
      });
    }
    const merged = { ...(ix >= 0 ? players[ix] : player), ...player, ...(remotePlayer || {}) };
    if (remotePlayer && remotePlayer.id) merged.id = remotePlayer.id;
    if (ix >= 0) {
      players[ix] = merged;
    } else {
      players.push(merged);
    }
    global.localStorage.setItem('clubPlayers', JSON.stringify(players));
    return merged;
  }

  function syncLocalMemberAfterRemote(localMember, remoteMember) {
    if (!remoteMember || !remoteMember.id) return localMember;
    const members = readMembers();
    let ix = -1;
    if (localMember && localMember.id) {
      ix = members.findIndex(function (m) {
        return m.id === localMember.id;
      });
    }
    if (ix < 0) {
      const dni = normalizeDni(remoteMember.dni);
      if (dni) {
        ix = members.findIndex(function (m) {
          return normalizeDni(m.dni) === dni;
        });
      }
    }
    if (ix < 0 && remoteMember.email) {
      const em = String(remoteMember.email).trim().toLowerCase();
      ix = members.findIndex(function (m) {
        return String(m.email || '').trim().toLowerCase() === em;
      });
    }
    const merged = { ...(ix >= 0 ? members[ix] : localMember || {}), ...remoteMember };
    if (ix >= 0) {
      members[ix] = merged;
    } else {
      members.push(merged);
    }
    global.localStorage.setItem('clubMembers', JSON.stringify(members));
    global.localStorage.setItem('socios', JSON.stringify(members));
    return merged;
  }

  async function persistInscriptionViaNetlify(player) {
    const payload = normalizePlayerDualFields(player);
    delete payload.photo;
    const res = await fetch('/.netlify/functions/submit-player-inscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: payload })
    });
    const json = await res.json().catch(function () {
      return { ok: false };
    });
    if (!res.ok || !json.ok) {
      const err = new Error(
        json.error ||
          'No se pudo registrar la inscripción en la nube. Reintenta o contacta con el club (cdsanabriafc@gmail.com).'
      );
      err.code = 'firebase_persist_failed';
      throw err;
    }
    const remotePlayer = json.player || null;
    const remoteMember = json.member || null;
    if (json.playerId) player.id = json.playerId;
    else if (remotePlayer && remotePlayer.id) player.id = remotePlayer.id;
    if (json.memberId) player.linkedMemberId = json.memberId;
    else if (remoteMember && remoteMember.id) player.linkedMemberId = remoteMember.id;
    const savedPlayer = syncLocalPlayerAfterRemote(player, remotePlayer || { id: player.id });
    let savedMember = null;
    if (remoteMember) {
      savedMember = syncLocalMemberAfterRemote(null, remoteMember);
    }
    return { player: savedPlayer, member: savedMember };
  }

  async function persistPlayerViaNetlify(player) {
    const result = await persistInscriptionViaNetlify(player);
    return result.player;
  }

  async function persistProfileUpdateViaNetlify(opts) {
    const payload = opts && typeof opts === 'object' ? opts : {};
    const incoming = normalizePlayerDualFields(payload.incoming || {});
    delete incoming.photo;
    delete incoming.portalPasswordHash;
    const res = await fetch('/.netlify/functions/update-player-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: payload.playerId,
        dni: payload.dni,
        name: payload.name,
        surname: payload.surname,
        password: payload.password,
        season: payload.season,
        incoming: incoming
      })
    });
    const json = await res.json().catch(function () {
      return { ok: false };
    });
    if (!res.ok || !json.ok) {
      const err = new Error(
        json.error === 'bad_password'
          ? 'Contraseña incorrecta.'
          : json.error === 'profile_locked'
            ? 'Tu ficha no admite cambios (rechazada o de baja).'
            : json.error === 'sin_cambios'
              ? 'No hay cambios que guardar.'
              : json.error ||
                'No se pudieron guardar los cambios. Reintenta o contacta con el club.'
      );
      err.code = json.error;
      throw err;
    }
    const remotePlayer = json.player || null;
    const remoteMember = json.member || null;
    let savedPlayer = remotePlayer;
    if (remotePlayer) {
      savedPlayer = syncLocalPlayerAfterRemote(
        { id: payload.playerId, ...(payload.incoming || {}) },
        remotePlayer
      );
    }
    if (remoteMember) {
      syncLocalMemberAfterRemote(null, remoteMember);
    }
    return { player: savedPlayer, diff: json.diff || [], member: remoteMember };
  }

  async function persistPlayerFirebase(player, opts) {
    const normalized = normalizePlayerDualFields(player);
    const requireCloud =
      opts && opts.requireCloud !== undefined
        ? opts.requireCloud
        : String(player.registrationSource || '') === 'web_inscription';

    if (requireCloud) {
      const remote = await persistInscriptionViaNetlify(normalized);
      return remote.player;
    }

    if (typeof global.persistRecordToFirebase === 'function') {
      try {
        await global.persistRecordToFirebase('clubPlayers', 'players', normalized);
        return normalized;
      } catch (e) {
        console.warn('persistRecordToFirebase:', e);
      }
    }
    try {
      return await persistPlayerViaNetlify(normalized);
    } catch (netlifyErr) {
      console.warn('persistPlayerViaNetlify:', netlifyErr);
    }
    if (typeof global.createDocument !== 'function' || typeof global.updateDocument !== 'function') {
      return normalized;
    }
    try {
      if (isTemporaryLocalId(normalized.id)) {
        const newId = await global.createDocument('players', normalized);
        if (newId) {
          const players = readPlayers();
          const ix = players.findIndex((p) => p.id === normalized.id);
          if (ix >= 0) {
            players[ix].id = newId;
            normalized.id = newId;
            global.localStorage.setItem('clubPlayers', JSON.stringify(players));
          }
        }
      } else {
        await global.updateDocument('players', normalized.id, normalized);
      }
    } catch (e) {
      console.warn('persistPlayerFirebase:', e);
    }
    return normalized;
  }

  function generarNumeroSocioProvisional() {
    const members = readMembers();
    if (global.ClubMemberNumbers && global.ClubMemberNumbers.generarNumeroProvisionalRegistro) {
      return global.ClubMemberNumbers.generarNumeroProvisionalRegistro(members);
    }
    return 'SOC' + String(Date.now()).slice(-6);
  }

  /** Inscripción web: el socio es el propio jugador/a (menor o mayor), nunca el tutor por inscripción. */
  function playerInscriptionLinksSocio(player) {
    return String(player.registrationSource || '') === 'web_inscription';
  }

  function resolveSocioCuotaFromPlayer(player) {
    const cb = player.chargeBreakdown || {};
    const socioLine = Number(cb.socio);
    if (Number.isFinite(socioLine) && socioLine > 0) return socioLine;
    if (
      typeof global.ClubAccounting !== 'undefined' &&
      global.ClubAccounting.cuotaDesdeFechaNacimiento
    ) {
      const c = global.ClubAccounting.cuotaDesdeFechaNacimiento(
        player.birthDate || player.fechaNacimiento
      );
      if (Number.isFinite(c) && c > 0) return c;
    }
    const total = Number(cb.total);
    return Number.isFinite(total) && total > 0 ? total : null;
  }

  function applyMemberPaymentStateFromPlayer(member, player, paymentMeta) {
    const paid = !!(paymentMeta && paymentMeta.paid);
    const cuota = resolveSocioCuotaFromPlayer(player);
    if (cuota != null) member.cuota = cuota;

    if (paid) {
      member.pagado = true;
      member.paymentStatus = 'paid';
      member.status = 'active';
      member.estado = 'activo';
      member.pendingReason = null;
      member.inscriptionSeasonSocio = player.inscriptionSeason;
      member.validatedDate = paymentMeta.validatedAt || new Date().toISOString();
      member.validatedBy = paymentMeta.validatedBy || member.validatedBy || 'inscripcion_jugador';
      if (paymentMeta.orderId) member.paymentOrderId = paymentMeta.orderId;
      return;
    }

    member.pagado = false;
    member.paymentStatus = 'pending';
    member.status = 'pending_validation';
    member.estado = 'pendiente';
    member.pendingReason =
      player.pendingReason || player.offlinePaymentChannel || 'inscripcion_jugador_pendiente';
    if (player.paymentMethod) member.paymentMethod = player.paymentMethod;
    if (player.offlinePaymentChannel) member.offlinePaymentChannel = player.offlinePaymentChannel;
    member.inscriptionSeasonSocio = player.inscriptionSeason;
  }

  function upsertMemberSocioJugador(player, paymentMeta) {
    if (!playerInscriptionLinksSocio(player)) return null;

    const members = readMembers();
    const playerDni = normalizeDni(player.dni);
    const now = new Date().toISOString();
    let member = null;

    if (playerDni) {
      member = members.find((m) => normalizeDni(m.dni) === playerDni);
    }
    if (!member && player.id) {
      member = members.find((m) => m.playerId === player.id);
    }
    if (!member && player.email && playerDni) {
      const em = String(player.email).trim().toLowerCase();
      member = members.find(
        (m) => String(m.email || '').trim().toLowerCase() === em && normalizeDni(m.dni) === playerDni
      );
    }
    if (!member && player.email) {
      const em = String(player.email).trim().toLowerCase();
      member = members.find(function (m) {
        return (
          String(m.email || '').trim().toLowerCase() === em &&
          (m.socioJugador || m.isJugador || m.playerId === player.id)
        );
      });
    }

    if (member) {
      member.isJugador = true;
      member.socioJugador = true;
      member.playerId = player.id;
      member.playerCategory = player.category;
      member.categoriaJugador = player.category;
      member.nombre = player.nombre || player.name;
      member.name = player.name || player.nombre;
      member.apellidos = player.apellidos || player.surname;
      member.surname = player.surname || player.apellidos;
      member.telefono = player.telefono || player.phone || member.telefono;
      member.phone = player.phone || player.telefono || member.phone;
      if (player.email) member.email = String(player.email).trim().toLowerCase();
      member.address = player.address || player.domicilio || member.address;
      member.direccion = player.direccion || player.address || member.direccion;
      member.domicilio = player.domicilio || member.domicilio;
      member.localidad = player.localidad || member.localidad;
      member.provincia = player.provincia || member.provincia;
      member.birthDate = player.birthDate;
      member.fechaNacimiento = player.birthDate;
      if (playerDni) member.dni = playerDni;
      if (player.portalPasswordHash) {
        member.passwordHash = player.portalPasswordHash;
        member.portalPasswordHash = player.portalPasswordHash;
      }
      if (player.guardianName) member.guardianName = player.guardianName;
      if (player.guardianDNI) member.guardianDNI = player.guardianDNI;
      if (player.guardianPhone) member.guardianPhone = player.guardianPhone;
      if (player.guardianEmail) member.guardianEmail = player.guardianEmail;
      if (player.guardianAddress) member.guardianAddress = player.guardianAddress;
      member.inscriptionSeasonJugador = player.inscriptionSeason;
      member.registrationSource = member.registrationSource || 'web_inscription_socio_jugador';
      member.lastModified = now;
      applyMemberPaymentStateFromPlayer(member, player, paymentMeta);
      if (typeof global.applyClubRoleFlagsToMember === 'function') {
        global.applyClubRoleFlagsToMember(member);
      }
    } else {
      member = {
        id: 'MEMBER_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        name: player.name,
        nombre: player.name,
        surname: player.surname,
        apellidos: player.surname,
        dni: playerDni || '',
        phone: player.phone || '',
        telefono: player.phone || '',
        email: String(player.email || '').trim().toLowerCase(),
        address: player.address || player.domicilio || '',
        direccion: player.direccion || player.address || '',
        domicilio: player.domicilio || '',
        localidad: player.localidad || '',
        provincia: player.provincia || 'Zamora',
        birthDate: player.birthDate,
        fechaNacimiento: player.birthDate,
        guardianName: player.guardianName || '',
        guardianDNI: player.guardianDNI || '',
        guardianPhone: player.guardianPhone || '',
        guardianEmail: player.guardianEmail || '',
        guardianAddress: player.guardianAddress || '',
        numeroSocio: generarNumeroSocioProvisional(),
        memberNumber: null,
        registrationDate: now,
        socioJugador: true,
        isJugador: true,
        playerId: player.id,
        playerCategory: player.category,
        categoriaJugador: player.category,
        inscriptionSeasonSocio: player.inscriptionSeason,
        inscriptionSeasonJugador: player.inscriptionSeason,
        registrationSource: 'web_inscription_socio_jugador',
        cuotaSocioEnInscripcion: true,
        passwordHash: player.portalPasswordHash || '',
        portalPasswordHash: player.portalPasswordHash || ''
      };
      applyMemberPaymentStateFromPlayer(member, player, paymentMeta);
      if (typeof global.applyClubRoleFlagsToMember === 'function') {
        global.applyClubRoleFlagsToMember(member);
      }
      members.push(member);
    }

    global.localStorage.setItem('clubMembers', JSON.stringify(members));
    global.localStorage.setItem('socios', JSON.stringify(members));
    return member;
  }

  async function persistMemberFirebase(member) {
    if (!member) return member;
    if (typeof global.persistMemberToFirebase === 'function') {
      await global.persistMemberToFirebase(member);
      return member;
    }
    if (typeof global.persistRecordToFirebase === 'function') {
      await global.persistRecordToFirebase('clubMembers', 'members', member);
      return member;
    }
    if (typeof global.createDocument !== 'function' || typeof global.updateDocument !== 'function') {
      return member;
    }
    try {
      if (isTemporaryLocalId(member.id)) {
        const newId = await global.createDocument('members', member);
        if (newId) {
          const members = readMembers();
          const ix = members.findIndex((m) => m.id === member.id);
          if (ix >= 0) {
            members[ix].id = newId;
            member.id = newId;
            global.localStorage.setItem('clubMembers', JSON.stringify(members));
            global.localStorage.setItem('socios', JSON.stringify(members));
          }
        }
      } else {
        await global.updateDocument('members', member.id, member);
      }
    } catch (e) {
      console.warn('persistMemberFirebase:', e);
    }
    return member;
  }

  async function refreshMemberRoles(dni, name, surname) {
    if (typeof global.refreshMembersRoleFlagsForIdentity === 'function') {
      const touched = global.refreshMembersRoleFlagsForIdentity(dni, name, surname);
      for (let i = 0; i < touched.length; i++) {
        try {
          if (typeof global.persistMemberToFirebase === 'function') {
            await global.persistMemberToFirebase(touched[i]);
          }
        } catch (e) {
          console.warn(e);
        }
      }
    }
  }

  async function finalizeInscription(player, paymentMeta, opts) {
    const now = new Date().toISOString();
    const paid = !!(paymentMeta && paymentMeta.paid);
    const method = String(paymentMeta?.method || '');

    if (paid) {
      player.inscriptionStatus = 'paid';
      player.status = 'active';
      player.estado = 'activo';
      player.paymentStatus = 'paid';
      player.inscriptionPaid = true;
      player.paidAt = paymentMeta?.paidAt || now;
      player.validatedDate = now;
      player.validatedBy =
        paymentMeta?.validatedBy ||
        (method.indexOf('redsys') >= 0 ? 'redsys_auto' : method === 'free' ? 'inscripcion_gratis' : 'admin');
    } else if (method === 'transfer' || method === 'cash' || method === 'tpv') {
      const offlineCh =
        paymentMeta?.offlinePaymentChannel ||
        player.offlinePaymentChannel ||
        (method === 'cash' ? 'efectivo' : method === 'tpv' ? 'tpv' : 'transferencia');
      player.offlinePaymentChannel = offlineCh;
      if (offlineCh === 'efectivo') {
        player.inscriptionStatus = 'pending_cash';
        player.paymentMethod = 'cash';
      } else if (offlineCh === 'tpv') {
        player.inscriptionStatus = 'pending_tpv';
        player.paymentMethod = 'tpv';
      } else {
        player.inscriptionStatus = 'pending_transfer';
        player.paymentMethod = 'transfer';
      }
      player.status = 'pending_validation';
      player.estado = 'pendiente';
      player.paymentStatus = 'pending';
      player.inscriptionPaid = false;
      player.pendingReason = offlineCh;
    } else {
      player.inscriptionStatus = 'pending_payment';
      player.status = 'pending_validation';
      player.estado = 'pendiente';
      player.paymentStatus = 'pending';
      player.inscriptionPaid = false;
      if (method === 'gateway_pending') {
        player.pendingReason = 'pasarela_pendiente';
      }
    }

    if (method !== 'transfer' && method !== 'cash' && method !== 'tpv') {
      player.paymentMethod = method || player.paymentMethod || '';
    }
    player.paymentOrderId = paymentMeta?.orderId || player.paymentOrderId || null;
    if (!paid) {
      player.paidAt = null;
      player.validatedDate = null;
      player.validatedBy = null;
    }
    player.updatedAt = now;
    player.inscriptionWebSubmittedAt = player.inscriptionWebSubmittedAt || now;
    rememberInscriptionLockDni(player.dni);

    const saved = upsertPlayerLocal(player);
    const member = upsertMemberSocioJugador(saved, {
      paid: paid,
      orderId: paymentMeta?.orderId,
      validatedBy: paymentMeta?.validatedBy,
      validatedAt: paymentMeta?.validatedAt
    });
    if (member) {
      saved.linkedMemberId = member.id;
      const players = readPlayers();
      const pix = players.findIndex((p) => p.id === saved.id);
      if (pix >= 0) {
        players[pix].linkedMemberId = member.id;
        global.localStorage.setItem('clubPlayers', JSON.stringify(players));
      }
    }

    await persistPlayerFirebase(saved, { requireCloud: true });

    if (typeof global.refreshMembersRoleFlagsForIdentity === 'function') {
      await refreshMemberRoles(saved.dni, saved.name, saved.surname);
    }

    const keepPending = opts && opts.keepPending;
    if (!keepPending) {
      try {
        global.localStorage.removeItem(PENDING_KEY);
      } catch (_) {}
    }
    return saved;
  }

  /** Validación manual por administrador (transferencia, efectivo, etc.) */
  async function markInscriptionPaidByAdmin(playerId, adminMeta) {
    const players = readPlayers();
    const ix = players.findIndex((p) => p.id === playerId);
    if (ix < 0) throw new Error('Jugador no encontrado');
    const methodMap = { 1: 'transfer_manual', 2: 'cash_manual', 3: 'admin_manual' };
    let method = adminMeta?.method || 'admin_manual';
    if (adminMeta?.methodChoice) {
      method = methodMap[String(adminMeta.methodChoice)] || method;
    }
    return finalizeInscription(players[ix], {
      paid: true,
      method: method,
      validatedBy: adminMeta?.validatedBy || 'admin'
    });
  }

  function savePending(registration) {
    global.localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ registration: registration, savedAt: new Date().toISOString() })
    );
  }

  function loadPending() {
    try {
      return JSON.parse(global.localStorage.getItem(PENDING_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  async function submitCheckout(registration, payMethod) {
    if (global.SiteUpdateMode && global.SiteUpdateMode.isActive && global.SiteUpdateMode.isActive()) {
      throw new Error(global.SiteUpdateMode.getMessage());
    }
    const cart = registration.chargeBreakdown
      ? {
          total: registration.chargeBreakdown.total,
          kitTotal: registration.chargeBreakdown.kit,
          fichaFee: registration.chargeBreakdown.ficha,
          socioFee: registration.chargeBreakdown.socio
        }
      : computeCart(
          global.ClubInscriptionConfig.read(),
          registration.category,
          registration.kit?.items || registration.kitOrder,
          registration.payFichaSelected,
          registration.paySocioSelected
        );

    const total = Number(registration.chargeBreakdown?.total ?? cart.total);

    if (total <= 0) {
      await finalizeInscription(registration, { paid: true, method: 'free' });
      return { ok: true, free: true };
    }

    if (payMethod === 'transfer') {
      const raw = registration.offlinePaymentChannel;
      const ch =
        raw === 'efectivo' ? 'efectivo' : raw === 'tpv' ? 'tpv' : 'transferencia';
      registration.offlinePaymentChannel = ch;
      const method = ch === 'efectivo' ? 'cash' : ch === 'tpv' ? 'tpv' : 'transfer';
      await finalizeInscription(registration, {
        paid: false,
        method: method,
        offlinePaymentChannel: ch
      });
      return { ok: true, transfer: true, offlineChannel: ch };
    }

    if (!global.CdsanRedsys) throw new Error('Pasarela de pago no disponible');

    const saved = await finalizeInscription(registration, { paid: false, method: 'gateway_pending' }, { keepPending: true });
    savePending(saved);

    await global.CdsanRedsys.payPlayerInscription({
      payMethod: payMethod,
      amountEur: total,
      email: saved.email,
      playerId: saved.id,
      playerRegistration: saved,
      description: 'Inscripción ' + saved.inscriptionSeason + ' — CD Sanabria CF'
    });
    return { ok: true, redirect: true };
  }

  /** Tras vuelta OK de Redsys (cliente) */
  async function finalizeFromPendingOrder(orderId) {
    const pending = loadPending();
    if (!pending || !pending.registration) return false;
    await finalizeInscription(pending.registration, {
      paid: true,
      method: 'redsys_card',
      orderId: orderId,
      validatedBy: 'redsys_auto'
    });
    return true;
  }

  global.PlayerInscription = {
    normalizeDni: normalizeDni,
    findPlayerForSeason: findPlayerForSeason,
    findPaidPlayerForSeason: findPaidPlayerForSeason,
    findApprovedForInscription: findApprovedForInscription,
    isApprovedForInscription: isApprovedForInscription,
    findApprovedForInscriptionByIdentity: findApprovedForInscriptionByIdentity,
    findPlayerForContinueLookup: findPlayerForContinueLookup,
    findReturningPlayerForInscription: findReturningPlayerForInscription,
    requiresPasswordForInscriptionAccess: requiresPasswordForInscriptionAccess,
    rememberInscriptionLockDni: rememberInscriptionLockDni,
    findPlayerByDni: findPlayerByDni,
    findMemberByDni: findMemberByDni,
    composeAddress: composeAddress,
    computeCart: computeCart,
    buildPlayerRecord: buildPlayerRecord,
    finalizeInscription: finalizeInscription,
    submitCheckout: submitCheckout,
    finalizeFromPendingOrder: finalizeFromPendingOrder,
    markInscriptionPaidByAdmin: markInscriptionPaidByAdmin,
    getDisplayStatus: getDisplayStatus,
    needsPaymentValidation: needsPaymentValidation,
    savePending: savePending,
    loadPending: loadPending,
    persistProfileUpdateViaNetlify: persistProfileUpdateViaNetlify,
    PENDING_KEY: PENDING_KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
