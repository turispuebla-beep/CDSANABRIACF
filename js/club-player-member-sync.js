/**
 * Sincroniza fichas jugador/a con socios socio-jugador y elimina duplicados / intentos abortados.
 */
(function (global) {
  'use strict';

  const DEFAULT_SEASON = '2026-2027';

  function normalizeDni(value) {
    if (global.PlayerInscription && global.PlayerInscription.normalizeDni) {
      return global.PlayerInscription.normalizeDni(value);
    }
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '');
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeFullName(name, surname) {
    return `${String(name || '').trim()} ${String(surname || '').trim()}`.trim().toLowerCase();
  }

  function normalizeCategoryId(cat) {
    const c = String(cat || '').trim().toLowerCase();
    if (c === 'prebenajmin' || c === 'prebenjamin') return 'prebenjamin';
    if (c === 'juvenile' || c === 'juvenil') return 'juvenil';
    if (c === 'aficionado' || c === 'senior') return 'senior';
    return c;
  }

  function resolvePlayerCategoryId(player) {
    if (!player) return '';
    let cat = normalizeCategoryId(
      player.category || player.categoria || player.playerCategory || player.categoriaJugador || ''
    );
    if (cat) return cat;
    const birth = player.birthDate || player.fechaNacimiento;
    if (birth && global.ClubInscriptionConfig && global.ClubInscriptionConfig.suggestCategoryFromBirthDate) {
      return normalizeCategoryId(global.ClubInscriptionConfig.suggestCategoryFromBirthDate(birth));
    }
    return '';
  }

  function ensurePlayerCategoryFields(player) {
    if (!player || typeof player !== 'object') return player;
    const cat = resolvePlayerCategoryId(player);
    if (!cat) return player;
    player.category = cat;
    player.categoria = cat;
    player.playerCategory = cat;
    player.categoriaJugador = cat;
    return player;
  }

  function playerMatchesCategoryFilter(player, filterKey) {
    if (!filterKey || filterKey === 'all') return true;
    const playerCat = resolvePlayerCategoryId(player);
    if (!playerCat) return false;
    return playerCat === normalizeCategoryId(filterKey);
  }

  function getCanonicalPlayerCategoryOptions() {
    return [
      { id: 'prebenjamin', label: 'Prebenjamín (6-8 años)' },
      { id: 'benjamin', label: 'Benjamín (8-10 años)' },
      { id: 'alevin', label: 'Alevín (10-12 años)' },
      { id: 'infantil', label: 'Infantil (12-14 años)' },
      { id: 'cadete', label: 'Cadete (14-16 años)' },
      { id: 'juvenil', label: 'Juvenil (16-18 años)' },
      { id: 'senior', label: 'Senior / Aficionado (18+ años)' }
    ];
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

  function writePlayers(players) {
    const json = JSON.stringify(players);
    global.localStorage.setItem('clubPlayers', json);
    global.localStorage.setItem('players', json);
  }

  function writeMembers(members) {
    const json = JSON.stringify(members);
    global.localStorage.setItem('clubMembers', json);
    global.localStorage.setItem('socios', json);
    if (typeof global.syncClubMembersLocal === 'function') {
      global.syncClubMembersLocal(members);
    }
  }

  function currentSeason() {
    if (global.ClubInscriptionConfig && global.ClubInscriptionConfig.read) {
      const s = global.ClubInscriptionConfig.read();
      if (s && s.season) return String(s.season).trim();
    }
    return DEFAULT_SEASON;
  }

  function isFirebaseId(id) {
    const v = String(id || '');
    return v.length >= 8 && !v.startsWith('PLAYER_') && !v.startsWith('PENDING_') && !v.startsWith('MEMBER_');
  }

  function playerSeason(p) {
    return String((p && (p.inscriptionSeason || p.temporada)) || '').trim() || currentSeason();
  }

  function memberIsSocioJugador(m) {
    if (!m) return false;
    return !!(m.isJugador || m.socioJugador || String(m.playerCategory || m.categoriaJugador || '').trim());
  }

  function isPaidPlayer(p) {
    if (!p) return false;
    if (p.inscriptionPaid === true || p.pagado === true) return true;
    const ins = String(p.inscriptionStatus || '').toLowerCase();
    if (ins === 'paid') return true;
    if (String(p.paymentStatus || '').toLowerCase() === 'paid') return true;
    if (p.status === 'active' && p.validatedDate) return true;
    return false;
  }

  /** Intento abortado: pasarela sin pago y sin inscripción offline confirmada. */
  function isAbandonedInscriptionAttempt(p) {
    if (!p || isPaidPlayer(p)) return false;
    const method = String(p.paymentMethod || '').trim().toLowerCase();
    const offline = String(p.offlinePaymentChannel || '').trim().toLowerCase();
    const ins = String(p.inscriptionStatus || '').trim().toLowerCase();
    if (offline === 'transferencia' || offline === 'efectivo' || offline === 'tpv') return false;
    if (ins === 'pending_transfer' || ins === 'pending_cash' || ins === 'pending_tpv') return false;
    if (method === 'gateway_pending' || method === 'pasarela') return true;
    const id = String(p.id || '');
    if (id.startsWith('PENDING_') && !p.inscriptionWebSubmittedAt) return true;
    return false;
  }

  function playerIdentityKeys(p) {
    const season = playerSeason(p);
    const keys = [];
    const dni = normalizeDni(p.dni);
    const email = normalizeEmail(p.email);
    const name = normalizeFullName(p.name || p.nombre, p.surname || p.apellidos);
    if (dni) keys.push('dni:' + dni + '|' + season);
    if (email) keys.push('email:' + email + '|' + season);
    if (name) keys.push('name:' + name + '|' + season);
    if (p.id) keys.push('id:' + p.id);
    return keys;
  }

  function playerScore(p) {
    let score = 0;
    if (isFirebaseId(p.id)) score += 40;
    if (normalizeDni(p.dni)) score += 20;
    if (normalizeEmail(p.email)) score += 10;
    if (p.inscriptionWebSubmittedAt) score += 8;
    if (p.offlinePaymentChannel) score += 8;
    if (p.portalPasswordHash) score += 4;
    if (p.linkedMemberId) score += 4;
    if (isAbandonedInscriptionAttempt(p)) score -= 50;
    const t = Date.parse(p.updatedAt || p.registrationDate || '') || 0;
    return score + t / 1e14;
  }

  function dedupePlayers(players) {
    const list = Array.isArray(players) ? players.slice() : [];
    if (list.length < 2) return list;

    const parent = list.map(function (_, i) {
      return i;
    });
    function find(i) {
      while (parent[i] !== i) i = parent[i];
      return i;
    }
    function union(a, b) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    }

    const keyToIndex = new Map();
    list.forEach(function (p, idx) {
      playerIdentityKeys(p).forEach(function (key) {
        if (keyToIndex.has(key)) union(idx, keyToIndex.get(key));
        else keyToIndex.set(key, idx);
      });
    });

    const buckets = new Map();
    list.forEach(function (p, idx) {
      const root = find(idx);
      if (!buckets.has(root)) buckets.set(root, []);
      buckets.get(root).push(p);
    });

    const merged = [];
    buckets.forEach(function (group) {
      if (group.length === 1) {
        merged.push(group[0]);
        return;
      }
      group.sort(function (a, b) {
        return playerScore(b) - playerScore(a);
      });
      const keep = Object.assign({}, group[0]);
      for (let i = 1; i < group.length; i++) {
        const other = group[i];
        if (!keep.portalPasswordHash && other.portalPasswordHash) keep.portalPasswordHash = other.portalPasswordHash;
        if (!keep.linkedMemberId && other.linkedMemberId) keep.linkedMemberId = other.linkedMemberId;
        if (!keep.dni && other.dni) keep.dni = other.dni;
        if (!keep.chargeBreakdown && other.chargeBreakdown) keep.chargeBreakdown = other.chargeBreakdown;
        if (!keep.guardianName && other.guardianName) keep.guardianName = other.guardianName;
        if (!keep.guardianPhone && other.guardianPhone) keep.guardianPhone = other.guardianPhone;
      }
      merged.push(keep);
    });
    return merged;
  }

  function findPlayerForMember(players, member, season) {
    const playerId = String(member.playerId || '').trim();
    if (playerId) {
      const byId = players.find(function (p) {
        return String(p.id) === playerId;
      });
      if (byId) return byId;
    }
    const dni = normalizeDni(member.dni);
    const email = normalizeEmail(member.email);
    const name = normalizeFullName(member.nombre || member.name, member.apellidos || member.surname);
    return (
      players.find(function (p) {
        if (playerSeason(p) !== season) return false;
        if (dni && normalizeDni(p.dni) === dni) return true;
        if (email && normalizeEmail(p.email) === email) return true;
        if (name && normalizeFullName(p.name || p.nombre, p.surname || p.apellidos) === name) return true;
        return false;
      }) || null
    );
  }

  function suggestCategoryFromMember(member) {
    const stored = normalizeCategoryId(member.playerCategory || member.categoriaJugador);
    if (stored) return stored;
    const birth = member.birthDate || member.fechaNacimiento;
    if (birth && global.ClubInscriptionConfig && global.ClubInscriptionConfig.suggestCategoryFromBirthDate) {
      return normalizeCategoryId(global.ClubInscriptionConfig.suggestCategoryFromBirthDate(birth));
    }
    return 'senior';
  }

  function buildPlayerFromMember(member, season) {
    const now = new Date().toISOString();
    const category = suggestCategoryFromMember(member);
    const paid = !!(member.pagado || member.paymentStatus === 'paid' || member.status === 'active');
    const player = {
      id: member.playerId && isFirebaseId(member.playerId) ? member.playerId : 'PLAYER_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: member.nombre || member.name || '',
      nombre: member.nombre || member.name || '',
      surname: member.apellidos || member.surname || '',
      apellidos: member.apellidos || member.surname || '',
      dni: normalizeDni(member.dni),
      phone: member.telefono || member.phone || '',
      telefono: member.telefono || member.phone || '',
      email: normalizeEmail(member.email),
      domicilio: member.domicilio || '',
      localidad: member.localidad || '',
      provincia: member.provincia || 'Zamora',
      address: member.address || member.direccion || member.domicilio || '',
      direccion: member.direccion || member.address || member.domicilio || '',
      birthDate: member.birthDate || member.fechaNacimiento || '',
      fechaNacimiento: member.birthDate || member.fechaNacimiento || '',
      category: category,
      categoria: category,
      inscriptionSeason: season,
      temporada: season,
      status: paid ? 'active' : 'pending_validation',
      estado: paid ? 'activo' : 'pendiente',
      inscriptionStatus: paid ? 'paid' : 'pending_payment',
      paymentStatus: paid ? 'paid' : 'pending',
      inscriptionPaid: paid,
      paymentMethod: member.paymentMethod || '',
      offlinePaymentChannel: member.offlinePaymentChannel || '',
      pendingReason: member.pendingReason || (paid ? null : 'nueva_alta'),
      registrationSource: member.registrationSource || 'socio_jugador_sync',
      linkedMemberId: member.id,
      numeroSocio: member.numeroSocio || member.memberNumber,
      memberNumber: member.numeroSocio || member.memberNumber,
      guardianName: member.guardianName || '',
      guardianDNI: member.guardianDNI || member.guardianDni || '',
      guardianPhone: member.guardianPhone || '',
      guardianEmail: member.guardianEmail || '',
      guardianAddress: member.guardianAddress || '',
      portalPasswordHash: member.portalPasswordHash || member.passwordHash || '',
      chargeBreakdown: {
        ficha: 0,
        socio: Number(member.cuota) || 0,
        kit: 0,
        total: Number(member.cuota) || 0
      },
      registrationDate: member.registrationDate || member.fechaRegistro || now,
      updatedAt: now,
      socioJugador: true,
      isJugador: true
    };
    if (birthDateAge(player.birthDate)) player.age = birthDateAge(player.birthDate);
    return player;
  }

  function birthDateAge(birthDate) {
    if (!birthDate || !global.ClubInscriptionConfig || !global.ClubInscriptionConfig.calculateAge) return null;
    return global.ClubInscriptionConfig.calculateAge(birthDate);
  }

  function linkMemberToPlayer(member, player) {
    member.isJugador = true;
    member.socioJugador = true;
    member.playerId = player.id;
    const cat = resolvePlayerCategoryId(player);
    member.playerCategory = cat || player.category || player.categoria || member.playerCategory;
    member.categoriaJugador = member.playerCategory;
    member.inscriptionSeasonJugador = player.inscriptionSeason || player.temporada;
    if (!member.inscriptionSeasonSocio) member.inscriptionSeasonSocio = member.inscriptionSeasonJugador;
  }

  async function persistPlayer(player) {
    if (typeof global.persistRecordToFirebase === 'function') {
      await global.persistRecordToFirebase('clubPlayers', 'players', player);
      return player;
    }
    if (global.PlayerInscription && global.PlayerInscription.persistPlayerFirebase) {
      return global.PlayerInscription.persistPlayerFirebase(player, { requireCloud: false });
    }
    return player;
  }

  async function deletePlayerRemote(playerId) {
    if (!playerId || !isFirebaseId(playerId)) return;
    if (typeof global.deleteRecordFromFirebase === 'function') {
      await global.deleteRecordFromFirebase('players', playerId);
    }
  }

  function playerShouldHaveSocioMember(player) {
    if (!player) return false;
    const id = String(player.id || '');
    if (id.startsWith('PENDING_') && !player.inscriptionWebSubmittedAt) return false;
    if (global.PlayerInscription && global.PlayerInscription.playerInscriptionLinksSocio) {
      return global.PlayerInscription.playerInscriptionLinksSocio(player);
    }
    const season = String(player.inscriptionSeason || player.temporada || '').trim();
    const hasName = !!String(player.name || player.nombre || '').trim();
    return !!(season && hasName);
  }

  function resolveSocioCuotaFromPlayer(player) {
    const cb = player.chargeBreakdown || {};
    const socioLine = Number(cb.socio);
    if (Number.isFinite(socioLine) && socioLine > 0) return socioLine;
    if (global.ClubAccounting && global.ClubAccounting.cuotaDesdeFechaNacimiento) {
      const c = global.ClubAccounting.cuotaDesdeFechaNacimiento(
        player.birthDate || player.fechaNacimiento
      );
      if (Number.isFinite(c) && c > 0) return c;
    }
    return null;
  }

  function generarNumeroSocioProvisional(members) {
    const list = members || readMembers();
    if (global.ClubMemberNumbers && global.ClubMemberNumbers.generarNumeroProvisionalRegistro) {
      return global.ClubMemberNumbers.generarNumeroProvisionalRegistro(list);
    }
    return 'SOC' + String(Date.now()).slice(-6);
  }

  function buildMemberFromPlayer(player) {
    const now = new Date().toISOString();
    const season = playerSeason(player);
    const paid = isPaidPlayer(player);
    const cuota = resolveSocioCuotaFromPlayer(player);
    const category = normalizeCategoryId(player.category || player.categoria);
    const member = {
      id: 'MEMBER_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      name: player.name || player.nombre || '',
      nombre: player.name || player.nombre || '',
      surname: player.surname || player.apellidos || '',
      apellidos: player.surname || player.apellidos || '',
      dni: normalizeDni(player.dni),
      phone: player.phone || player.telefono || '',
      telefono: player.phone || player.telefono || '',
      email: normalizeEmail(player.email || player.guardianEmail),
      address: player.address || player.domicilio || player.guardianAddress || '',
      direccion: player.direccion || player.address || player.guardianAddress || '',
      domicilio: player.domicilio || '',
      localidad: player.localidad || '',
      provincia: player.provincia || 'Zamora',
      birthDate: player.birthDate || player.fechaNacimiento || '',
      fechaNacimiento: player.birthDate || player.fechaNacimiento || '',
      guardianName: player.guardianName || '',
      guardianDNI: player.guardianDNI || player.guardianDni || '',
      guardianPhone: player.guardianPhone || '',
      guardianEmail: player.guardianEmail || '',
      guardianAddress: player.guardianAddress || '',
      numeroSocio: generarNumeroSocioProvisional(),
      memberNumber: null,
      registrationDate: player.registrationDate || now,
      fechaRegistro: player.registrationDate || now,
      socioJugador: true,
      isJugador: true,
      playerId: player.id,
      playerCategory: category,
      categoriaJugador: category,
      inscriptionSeasonSocio: season,
      inscriptionSeasonJugador: season,
      registrationSource: 'socio_jugador_sync',
      cuotaSocioEnInscripcion: true,
      passwordHash: player.portalPasswordHash || '',
      portalPasswordHash: player.portalPasswordHash || '',
      pagado: paid,
      paymentStatus: paid ? 'paid' : 'pending',
      status: paid ? 'active' : 'pending_validation',
      estado: paid ? 'activo' : 'pendiente',
      pendingReason: paid
        ? null
        : player.pendingReason || player.offlinePaymentChannel || 'inscripcion_jugador_pendiente',
      paymentMethod: player.paymentMethod || '',
      offlinePaymentChannel: player.offlinePaymentChannel || '',
      lastModified: now,
      updatedAt: now
    };
    if (cuota != null) member.cuota = cuota;
    if (typeof global.applyClubRoleFlagsToMember === 'function') {
      global.applyClubRoleFlagsToMember(member);
    }
    return member;
  }

  function syncMemberPaymentFromPlayer(member, player, paymentMeta) {
    if (!member || !player) return member;
    if (global.PlayerInscription && global.PlayerInscription.isPlayerInscriptionPaid) {
      const paid = global.PlayerInscription.isPlayerInscriptionPaid(player, paymentMeta);
      if (!paid) return member;
      if (global.PlayerInscription.upsertMemberSocioJugador) {
        return global.PlayerInscription.upsertMemberSocioJugador(player, paymentMeta || { paid: true }, { force: true });
      }
    }
    const paid = isPaidPlayer(player) || !!(paymentMeta && paymentMeta.paid);
    if (!paid) return member;
    member.pagado = true;
    member.paymentStatus = 'paid';
    member.status = 'active';
    member.estado = 'activo';
    member.pendingReason = null;
    member.fechaLimitePago = null;
    member.validatedDate = player.validatedDate || new Date().toISOString();
    member.validatedBy = player.validatedBy || member.validatedBy || 'inscripcion_jugador';
    if (player.paymentOrderId) member.paymentOrderId = player.paymentOrderId;
    member.inscriptionSeasonSocio = player.inscriptionSeason || player.temporada || member.inscriptionSeasonSocio;
    return member;
  }

  function ensureMemberForPlayer(player, members, paymentMeta) {
    let member = findMemberForPlayer(members, player, playerSeason(player));
    if (member) {
      linkMemberToPlayer(member, player);
      member = syncMemberPaymentFromPlayer(member, player, paymentMeta);
      const mix = members.findIndex(function (m) {
        return String(m.id) === String(member.id);
      });
      if (mix >= 0) members[mix] = member;
      return member;
    }
    if (global.PlayerInscription && global.PlayerInscription.upsertMemberSocioJugador) {
      member = global.PlayerInscription.upsertMemberSocioJugador(player, paymentMeta || {}, { force: true });
      if (member) return member;
      members = readMembers();
    }
    member = buildMemberFromPlayer(player);
    members.push(member);
    writeMembers(members);
    return member;
  }

  function findMemberForPlayer(members, player, season) {
    if (global.PlayerInscription && global.PlayerInscription.findSocioJugadorMemberForPlayer) {
      return global.PlayerInscription.findSocioJugadorMemberForPlayer(members, player);
    }
    const linkedId = String(player.linkedMemberId || '').trim();
    if (linkedId) {
      const byLink = members.find(function (m) {
        return String(m.id) === linkedId;
      });
      if (byLink) return byLink;
    }
    const playerId = String(player.id || '').trim();
    if (playerId) {
      const byPlayerId = members.find(function (m) {
        return String(m.playerId || '') === playerId;
      });
      if (byPlayerId) return byPlayerId;
    }
    const dni = normalizeDni(player.dni);
    const name = normalizeFullName(player.name || player.nombre, player.surname || player.apellidos);
    return (
      members.find(function (m) {
        if (!memberIsSocioJugador(m) && !m.playerId) return false;
        if (dni && normalizeDni(m.dni) === dni) {
          if (name && normalizeFullName(m.nombre || m.name, m.apellidos || m.surname) !== name) {
            return false;
          }
          return true;
        }
        if (name && normalizeFullName(m.nombre || m.name, m.apellidos || m.surname) === name) {
          return true;
        }
        return false;
      }) || null
    );
  }

  async function persistMember(member) {
    if (global.PlayerInscription && global.PlayerInscription.persistMemberFirebase) {
      return global.PlayerInscription.persistMemberFirebase(member);
    }
    if (typeof global.persistRecordToFirebase === 'function') {
      await global.persistRecordToFirebase('clubMembers', 'members', member);
    }
    return member;
  }

  /**
   * Crea socios socio-jugador faltantes desde fichas de jugador/a (p. ej. Lucas sin socio).
   * @returns {Promise<{created:number,linked:number,total:number}>}
   */
  async function regularizeMembersFromPlayers(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const season = String(options.season || currentSeason()).trim();
    let players = readPlayers();
    let members = readMembers();
    let created = 0;
    let linked = 0;

    players = dedupePlayers(players);
    players = players.map(function (p) {
      return ensurePlayerCategoryFields(p);
    });

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (playerSeason(player) !== season) continue;
      if (!playerShouldHaveSocioMember(player)) continue;

      let member = findMemberForPlayer(members, player, season);
      if (!member) {
        member = ensureMemberForPlayer(player, members, {
          paid: isPaidPlayer(player),
          orderId: player.paymentOrderId,
          validatedBy: player.validatedBy,
          validatedAt: player.validatedDate
        });
        if (member) {
          members = readMembers();
          created += 1;
        }
      } else {
        linkMemberToPlayer(member, player);
        member = syncMemberPaymentFromPlayer(member, player, {
          paid: isPaidPlayer(player),
          orderId: player.paymentOrderId,
          validatedBy: player.validatedBy,
          validatedAt: player.validatedDate
        });
        const mix = members.findIndex(function (m) {
          return String(m.id) === String(member.id);
        });
        if (mix >= 0) members[mix] = member;
      }

      if (member) {
        linked += 1;
        const pix = players.findIndex(function (p) {
          return String(p.id) === String(player.id);
        });
        if (pix >= 0) {
          if (!players[pix].linkedMemberId) players[pix].linkedMemberId = member.id;
          if (!players[pix].socioJugador) players[pix].socioJugador = true;
          if (!players[pix].isJugador) players[pix].isJugador = true;
          if (!players[pix].registrationSource) players[pix].registrationSource = 'web_inscription';
        }
      }
    }

    writePlayers(players);
    writeMembers(members);

    if (options.persist !== false) {
      for (let j = 0; j < players.length; j++) {
        if (!playerShouldHaveSocioMember(players[j])) continue;
        try {
          await persistPlayer(players[j]);
        } catch (e) {
          console.warn('[ClubPlayerMemberSync] persist player', players[j].id, e);
        }
      }
      for (let k = 0; k < members.length; k++) {
        if (!memberIsSocioJugador(members[k])) continue;
        try {
          await persistMember(members[k]);
        } catch (e) {
          console.warn('[ClubPlayerMemberSync] persist member', members[k].id, e);
        }
      }
    }

    return { created: created, linked: linked, total: members.length };
  }

  /**
   * Regulariza jugadores: quita duplicados/intentos abortados y crea fichas desde socios-jugador.
   * @returns {Promise<{removed:number,created:number,deduped:number,linked:number}>}
   */
  async function regularizePlayersFromMembers(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const season = String(options.season || currentSeason()).trim();
    let players = readPlayers();
    let members = readMembers();
    const removedIds = [];
    const beforeCount = players.length;

    players = players.filter(function (p) {
      if (!isAbandonedInscriptionAttempt(p)) return true;
      removedIds.push(p.id);
      return false;
    });

    players = dedupePlayers(players);

    let created = 0;
    let linked = 0;

    members.forEach(function (member) {
      if (!memberIsSocioJugador(member)) return;
      let player = findPlayerForMember(players, member, season);
      if (!player) {
        player = buildPlayerFromMember(member, season);
        players.push(player);
        created += 1;
      } else {
        const ix = players.findIndex(function (p) {
          return String(p.id) === String(player.id);
        });
        if (ix >= 0) {
          players[ix] = Object.assign({}, players[ix], {
            category: normalizeCategoryId(players[ix].category || member.playerCategory) || players[ix].category,
            categoria: normalizeCategoryId(players[ix].category || member.playerCategory) || players[ix].categoria,
            linkedMemberId: member.id,
            numeroSocio: players[ix].numeroSocio || member.numeroSocio,
            memberNumber: players[ix].memberNumber || member.numeroSocio
          });
          player = players[ix];
        }
      }
      linkMemberToPlayer(member, player);
      linked += 1;
    });

    players = dedupePlayers(players);
    writePlayers(players);
    writeMembers(members);

    if (options.persist !== false) {
      for (let i = 0; i < removedIds.length; i++) {
        try {
          await deletePlayerRemote(removedIds[i]);
        } catch (e) {
          console.warn('[ClubPlayerMemberSync] delete', removedIds[i], e);
        }
      }
      for (let j = 0; j < players.length; j++) {
        try {
          await persistPlayer(players[j]);
        } catch (e) {
          console.warn('[ClubPlayerMemberSync] persist', players[j].id, e);
        }
      }
      for (let k = 0; k < members.length; k++) {
        if (!memberIsSocioJugador(members[k])) continue;
        try {
          if (typeof global.persistRecordToFirebase === 'function') {
            await global.persistRecordToFirebase('clubMembers', 'members', members[k]);
          }
        } catch (e) {
          console.warn('[ClubPlayerMemberSync] persist member', members[k].id, e);
        }
      }
    }

    return {
      removed: removedIds.length,
      created: created,
      deduped: beforeCount - players.length,
      linked: linked,
      total: players.length
    };
  }

  function getAdminPlayerCategories() {
    const map = {};
    getCanonicalPlayerCategoryOptions().forEach(function (opt) {
      map[opt.id] = opt.label;
    });
    return map;
  }

  function groupPlayersByCategory(players) {
    const categories = getAdminPlayerCategories();
    const grouped = {};
    Object.keys(categories).forEach(function (k) {
      grouped[k] = [];
    });
    grouped._other = [];
    (players || []).forEach(function (p) {
      const cat = resolvePlayerCategoryId(p);
      if (cat && grouped[cat]) grouped[cat].push(p);
      else grouped._other.push(p);
    });
    return { categories: categories, grouped: grouped };
  }

  function regularizePlayerCategories(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    let players = readPlayers();
    let members = readMembers();
    let updated = 0;

    players = players.map(function (p) {
      const before = JSON.stringify({
        c: p.category,
        ca: p.categoria,
        pc: p.playerCategory
      });
      ensurePlayerCategoryFields(p);
      const after = JSON.stringify({
        c: p.category,
        ca: p.categoria,
        pc: p.playerCategory
      });
      if (before !== after) updated += 1;
      return p;
    });

    players.forEach(function (player) {
      if (!player.linkedMemberId) return;
      const mix = members.findIndex(function (m) {
        return String(m.id) === String(player.linkedMemberId);
      });
      if (mix < 0) return;
      linkMemberToPlayer(members[mix], player);
    });

    writePlayers(players);
    writeMembers(members);

    if (options.persist !== false) {
      players.forEach(function (p) {
        if (!resolvePlayerCategoryId(p)) return;
        persistPlayer(p).catch(function (e) {
          console.warn('[ClubPlayerMemberSync] category persist player', p.id, e);
        });
      });
      members.forEach(function (m) {
        if (!memberIsSocioJugador(m)) return;
        persistMember(m).catch(function (e) {
          console.warn('[ClubPlayerMemberSync] category persist member', m.id, e);
        });
      });
    }

    return { updated: updated, total: players.length };
  }

  global.ClubPlayerMemberSync = {
    dedupePlayers: dedupePlayers,
    isAbandonedInscriptionAttempt: isAbandonedInscriptionAttempt,
    regularizeMembersFromPlayers: regularizeMembersFromPlayers,
    regularizePlayersFromMembers: regularizePlayersFromMembers,
    getAdminPlayerCategories: getAdminPlayerCategories,
    getCanonicalPlayerCategoryOptions: getCanonicalPlayerCategoryOptions,
    groupPlayersByCategory: groupPlayersByCategory,
    normalizeCategoryId: normalizeCategoryId,
    resolvePlayerCategoryId: resolvePlayerCategoryId,
    ensurePlayerCategoryFields: ensurePlayerCategoryFields,
    playerMatchesCategoryFilter: playerMatchesCategoryFilter,
    regularizePlayerCategories: regularizePlayerCategories,
  };
})(typeof window !== 'undefined' ? window : globalThis);
