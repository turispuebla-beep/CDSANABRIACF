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
    if (p.status === 'active' && ins !== 'pending_payment' && ins !== 'pending_transfer') return p;
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
    if (ins === 'pending_payment' || ins === 'pending_transfer') return true;
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
      address: form.address || '',
      direccion: form.address || '',
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
      guardianAddress: form.guardianAddress || '',
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
      updatedAt: new Date().toISOString()
    };
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
      players[idx] = { ...players[idx], ...player, id: players[idx].id };
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

  async function persistPlayerFirebase(player) {
    if (typeof global.persistRecordToFirebase === 'function') {
      await global.persistRecordToFirebase('clubPlayers', 'players', player);
      return player;
    }
    if (typeof global.createDocument !== 'function' || typeof global.updateDocument !== 'function') {
      return player;
    }
    try {
      if (isTemporaryLocalId(player.id)) {
        const newId = await global.createDocument('players', player);
        if (newId) {
          const players = readPlayers();
          const ix = players.findIndex((p) => p.id === player.id);
          if (ix >= 0) {
            players[ix].id = newId;
            player.id = newId;
            global.localStorage.setItem('clubPlayers', JSON.stringify(players));
          }
        }
      } else {
        await global.updateDocument('players', player.id, player);
      }
    } catch (e) {
      console.warn('persistPlayerFirebase:', e);
    }
    return player;
  }

  function generarNumeroSocioProvisional() {
    const members = readMembers();
    if (global.ClubMemberNumbers && global.ClubMemberNumbers.generarNumeroProvisionalRegistro) {
      return global.ClubMemberNumbers.generarNumeroProvisionalRegistro(members);
    }
    return 'SOC' + String(Date.now()).slice(-6);
  }

  function upsertMemberSocioJugador(player, paySocio, paymentMeta) {
    const members = readMembers();
    const playerDni = normalizeDni(player.dni);
    const now = new Date().toISOString();
    let member = null;

    if (playerDni) {
      member = members.find((m) => normalizeDni(m.dni) === playerDni);
    }
    if (!member && player.email) {
      const em = String(player.email).trim().toLowerCase();
      member = members.find((m) => String(m.email || '').trim().toLowerCase() === em);
    }
    if (!member && player.guardianEmail) {
      const gem = String(player.guardianEmail).trim().toLowerCase();
      member = members.find((m) => String(m.email || '').trim().toLowerCase() === gem);
    }

    if (member) {
      member.isJugador = true;
      member.socioJugador = true;
      member.playerId = player.id;
      member.playerCategory = player.category;
      member.categoriaJugador = player.category;
      member.nombre = member.nombre || player.nombre;
      member.name = member.name || player.name;
      member.apellidos = member.apellidos || player.apellidos;
      member.surname = member.surname || player.surname;
      member.telefono = member.telefono || player.telefono;
      member.phone = member.phone || player.phone;
      member.email = member.email || player.email;
      member.address = member.address || player.address;
      member.direccion = member.direccion || player.direccion;
      member.birthDate = member.birthDate || player.birthDate;
      member.fechaNacimiento = member.fechaNacimiento || player.fechaNacimiento;
      if (!member.dni && playerDni) member.dni = playerDni;
      if (player.guardianName) member.guardianName = player.guardianName;
      if (player.guardianDNI) member.guardianDNI = player.guardianDNI;
      if (player.guardianPhone) member.guardianPhone = player.guardianPhone;
      if (player.guardianEmail) member.guardianEmail = player.guardianEmail;
      if (player.guardianAddress) member.guardianAddress = player.guardianAddress;
      member.inscriptionSeasonJugador = player.inscriptionSeason;
      member.lastModified = now;
      if (paymentMeta && paymentMeta.paid) {
        member.pagado = true;
        member.paymentStatus = 'paid';
        member.status = 'active';
        member.estado = 'activo';
        member.inscriptionSeasonSocio = player.inscriptionSeason;
      }
      if (typeof global.applyClubRoleFlagsToMember === 'function') {
        global.applyClubRoleFlagsToMember(member);
      }
    } else {
      const memberDni = playerDni || normalizeDni(player.guardianDNI) || '';
      const memberEmail = player.email || player.guardianEmail || '';
      member = {
        id: 'MEMBER_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        name: player.name,
        nombre: player.name,
        surname: player.surname,
        apellidos: player.surname,
        dni: memberDni,
        phone: player.phone || player.guardianPhone || '',
        telefono: player.phone || player.guardianPhone || '',
        email: memberEmail,
        address: player.address || player.guardianAddress || '',
        direccion: player.address || player.guardianAddress || '',
        birthDate: player.birthDate,
        fechaNacimiento: player.birthDate,
        guardianName: player.guardianName || '',
        guardianDNI: player.guardianDNI || '',
        guardianPhone: player.guardianPhone || '',
        guardianEmail: player.guardianEmail || '',
        guardianAddress: player.guardianAddress || '',
        numeroSocio: generarNumeroSocioProvisional(),
        memberNumber: null,
        status: paymentMeta && paymentMeta.paid ? 'active' : 'pending_validation',
        estado: paymentMeta && paymentMeta.paid ? 'activo' : 'pendiente',
        pagado: !!(paymentMeta && paymentMeta.paid),
        paymentStatus: paymentMeta && paymentMeta.paid ? 'paid' : 'pending',
        registrationDate: now,
        socioJugador: true,
        isJugador: true,
        playerId: player.id,
        playerCategory: player.category,
        categoriaJugador: player.category,
        inscriptionSeasonSocio: player.inscriptionSeason,
        inscriptionSeasonJugador: player.inscriptionSeason,
        registrationSource: 'web_inscription_socio_jugador',
        cuotaSocioEnInscripcion: !!paySocio
      };
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
    } else if (method === 'transfer') {
      player.inscriptionStatus = 'pending_transfer';
      player.status = 'pending_validation';
      player.estado = 'pendiente';
      player.paymentStatus = 'pending';
      player.inscriptionPaid = false;
      player.pendingReason = 'transferencia';
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

    player.paymentMethod = method || player.paymentMethod || '';
    player.paymentOrderId = paymentMeta?.orderId || player.paymentOrderId || null;
    if (!paid) {
      player.paidAt = null;
      player.validatedDate = null;
      player.validatedBy = null;
    }
    player.updatedAt = now;

    const saved = upsertPlayerLocal(player);
    await persistPlayerFirebase(saved);

    const member = upsertMemberSocioJugador(saved, !!player.paySocioSelected, {
      paid: paid,
      orderId: paymentMeta?.orderId
    });
    if (member) {
      saved.linkedMemberId = member.id;
      const players = readPlayers();
      const pix = players.findIndex((p) => p.id === saved.id);
      if (pix >= 0) {
        players[pix].linkedMemberId = member.id;
        global.localStorage.setItem('clubPlayers', JSON.stringify(players));
      }
      await persistMemberFirebase(member);
      await persistPlayerFirebase(saved);
      if (typeof global.refreshMembersRoleFlagsForIdentity === 'function') {
        await refreshMemberRoles(saved.dni, saved.name, saved.surname);
      }
    } else if (paid) {
      await refreshMemberRoles(player.dni, player.name, player.surname);
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
      await finalizeInscription(registration, { paid: false, method: 'transfer' });
      return { ok: true, transfer: true };
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
    findPlayerByDni: findPlayerByDni,
    findMemberByDni: findMemberByDni,
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
    PENDING_KEY: PENDING_KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
