/**
 * Enlaces entre personas del club: un socio puede ser también jugador, entrenador y/o directiva.
 * Cruza por DNI y nombre completo con listas en localStorage (sincronizadas con Firebase).
 */
(function (global) {
  'use strict';

  function normalizeDni(value) {
    return String(value || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  }

  function normalizeFullName(name, surname) {
    return `${String(name || '').trim()} ${String(surname || '').trim()}`.trim().toLowerCase();
  }

  function readList(key) {
    try {
      const raw = global.localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function resolveBoardLink(dniVal, fullName) {
    const board = readList('clubBoard');
    const byDni = board.find((m) => normalizeDni(m.dni) && normalizeDni(m.dni) === normalizeDni(dniVal));
    if (byDni) return byDni;
    if (!fullName) return null;
    const normalizedName = String(fullName).trim().toLowerCase();
    return board.find((m) => normalizeFullName(m.name, m.surname) === normalizedName) || null;
  }

  function resolvePlayerLink(dniVal, name, surname) {
    const players = readList('clubPlayers');
    const normalizedRegistrantName = normalizeFullName(name, surname);
    return (
      players.find((p) => {
        const sameDni = normalizeDni(p.dni) && normalizeDni(p.dni) === normalizeDni(dniVal);
        const sameName =
          normalizedRegistrantName &&
          normalizeFullName(p.name || p.nombre, p.surname || p.apellidos) === normalizedRegistrantName;
        return sameDni || sameName;
      }) || null
    );
  }

  function resolveCoachLink(dniVal, name, surname) {
    const coaches = readList('clubCoaches');
    const normalizedRegistrantName = normalizeFullName(name, surname);
    return (
      coaches.find((c) => {
        if (String(c.status || '').toLowerCase() === 'inactive') return false;
        const sameDni = normalizeDni(c.dni) && normalizeDni(c.dni) === normalizeDni(dniVal);
        const sameName =
          normalizedRegistrantName &&
          normalizeFullName(c.name || c.nombre, c.surname || c.apellidos) === normalizedRegistrantName;
        return sameDni || sameName;
      }) || null
    );
  }

  function detectClubRolesForPerson(dni, nombre, apellidos) {
    const boardLink = resolveBoardLink(dni, `${nombre || ''} ${apellidos || ''}`);
    const coachLink = resolveCoachLink(dni, nombre, apellidos);
    const playerLink = resolvePlayerLink(dni, nombre, apellidos);
    let detectedBy = 'none';
    if (boardLink) detectedBy = normalizeDni(dni) ? 'dni' : 'nombre';
    else if (coachLink) detectedBy = normalizeDni(dni) ? 'dni' : 'nombre';
    else if (playerLink) detectedBy = normalizeDni(dni) ? 'dni' : 'nombre';
    const isDirectiva = !!boardLink;
    return {
      detectedBy,
      isDirectiva,
      isBoardMember: isDirectiva,
      boardRole: boardLink ? boardLink.role || boardLink.cargo || '' : '',
      boardId: boardLink ? boardLink.id : null,
      isEntrenador: !!coachLink,
      coachId: coachLink ? coachLink.id : null,
      coachTeam: coachLink ? coachLink.team || coachLink.equipo || '' : '',
      isJugador: !!playerLink,
      playerId: playerLink ? playerLink.id : null,
      playerCategory: playerLink ? playerLink.category || playerLink.categoria || '' : ''
    };
  }

  function mergeStoredRoleFlags(detection, storedProfile) {
    const det = detection || detectClubRolesForPerson('', '', '');
    if (!storedProfile) return det;
    const isDirectiva = !!(det.isDirectiva || storedProfile.isDirectiva || storedProfile.isBoardMember);
    return {
      ...det,
      isDirectiva,
      isBoardMember: isDirectiva,
      boardRole: det.boardRole || storedProfile.boardRole || '',
      boardId: det.boardId || storedProfile.boardId || null,
      isEntrenador: !!(det.isEntrenador || storedProfile.isEntrenador),
      coachId: det.coachId || storedProfile.coachId || null,
      coachTeam: det.coachTeam || storedProfile.coachTeam || '',
      isJugador: !!(det.isJugador || storedProfile.isJugador),
      playerId: det.playerId || storedProfile.playerId || null,
      playerCategory: det.playerCategory || storedProfile.playerCategory || ''
    };
  }

  function applyClubRoleFlagsToMember(member) {
    if (!member || typeof member !== 'object') return detectClubRolesForPerson('', '', '');
    const nombre = member.nombre || member.name || '';
    const apellidos = member.apellidos || member.surname || '';
    const det = mergeStoredRoleFlags(detectClubRolesForPerson(member.dni, nombre, apellidos), member);
    member.isDirectiva = det.isDirectiva;
    member.isBoardMember = det.isBoardMember;
    member.boardRole = det.boardRole;
    member.boardId = det.boardId;
    member.isEntrenador = det.isEntrenador;
    member.coachId = det.coachId;
    member.coachTeam = det.coachTeam;
    member.isJugador = det.isJugador;
    member.playerId = det.playerId;
    member.playerCategory = det.playerCategory;
    member.detectedBy = det.detectedBy;
    member.roleFlagsUpdatedAt = new Date().toISOString();
    return det;
  }

  function memberMatchesIdentity(member, dni, name, surname) {
    if (!member) return false;
    const dniNorm = normalizeDni(dni);
    const memberDni = normalizeDni(member.dni);
    if (dniNorm && memberDni && dniNorm === memberDni) return true;
    const target = normalizeFullName(name, surname);
    if (!target) return false;
    return normalizeFullName(member.name || member.nombre, member.surname || member.apellidos) === target;
  }

  function formatClubRoleMessage(roles) {
    const parts = [];
    if (roles && roles.isDirectiva) parts.push(`👔 Directiva${roles.boardRole ? ' (' + roles.boardRole + ')' : ''}`);
    if (roles && roles.isJugador) parts.push(`⚽ Jugador/a${roles.playerCategory ? ' — ' + roles.playerCategory : ''}`);
    if (roles && roles.isEntrenador) parts.push(`🎯 Entrenador/a${roles.coachTeam ? ' — ' + roles.coachTeam : ''}`);
    if (!parts.length) return '';
    return '\n\n🔍 Perfil detectado (además de socio):\n• ' + parts.join('\n• ');
  }

  function formatClubRoleBadgesHtml(roles) {
    if (!roles) return '';
    const chips = [];
    if (roles.isJugador) {
      chips.push(`<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:0.75rem;margin-right:4px;">⚽ Jugador${roles.playerCategory ? ' · ' + roles.playerCategory : ''}</span>`);
    }
    if (roles.isEntrenador) {
      chips.push(`<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:12px;font-size:0.75rem;margin-right:4px;">🎯 Entrenador</span>`);
    }
    if (roles.isDirectiva) {
      chips.push(`<span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:12px;font-size:0.75rem;margin-right:4px;">👔 Directiva${roles.boardRole ? ' · ' + roles.boardRole : ''}</span>`);
    }
    if (!chips.length) return '';
    return `<div style="margin-top:6px;">${chips.join('')}</div>`;
  }

  function refreshMembersRoleFlagsForIdentity(dni, name, surname) {
    const members = readList('clubMembers');
    const touched = [];
    members.forEach((m) => {
      if (!memberMatchesIdentity(m, dni, name, surname)) return;
      applyClubRoleFlagsToMember(m);
      touched.push(m);
    });
    if (touched.length && typeof global.syncClubMembersLocal === 'function') {
      global.syncClubMembersLocal(members);
    } else if (touched.length) {
      try {
        global.localStorage.setItem('clubMembers', JSON.stringify(members));
      } catch (_) {}
    }
    if (touched.length) {
      try {
        global.dispatchEvent(new CustomEvent('memberRoleFlagsUpdated', { detail: { members: touched } }));
      } catch (_) {}
    }
    return touched;
  }

  function refreshAllMembersRoleFlags() {
    const members = readList('clubMembers');
    members.forEach((m) => applyClubRoleFlagsToMember(m));
    if (typeof global.syncClubMembersLocal === 'function') {
      global.syncClubMembersLocal(members);
    } else {
      try {
        global.localStorage.setItem('clubMembers', JSON.stringify(members));
      } catch (_) {}
    }
    try {
      global.dispatchEvent(new CustomEvent('memberRoleFlagsUpdated', { detail: { members, all: true } }));
    } catch (_) {}
    return members;
  }

  function appendRoleFlagsToPayload(payload, member) {
    const m = member || {};
    payload.isDirectiva = !!m.isDirectiva;
    payload.isBoardMember = !!m.isBoardMember;
    payload.boardRole = m.boardRole || '';
    payload.boardId = m.boardId || null;
    payload.isEntrenador = !!m.isEntrenador;
    payload.coachId = m.coachId || null;
    payload.coachTeam = m.coachTeam || '';
    payload.isJugador = !!m.isJugador;
    payload.playerId = m.playerId || null;
    payload.playerCategory = m.playerCategory || '';
    const isSocioJugador = !!(
      m.socioJugador ||
      m.isJugador ||
      m.playerId ||
      m.memberKind === 'jugador' ||
      m.memberKind === 'player'
    );
    payload.socioJugador = isSocioJugador;
    payload.memberKind = isSocioJugador ? 'jugador' : 'normal';
    if (!isSocioJugador) payload.playerId = null;
    payload.detectedBy = m.detectedBy || 'none';
    payload.roleFlagsUpdatedAt = m.roleFlagsUpdatedAt || new Date().toISOString();
    return payload;
  }

  global.detectClubRolesForPerson = detectClubRolesForPerson;
  global.mergeStoredRoleFlags = mergeStoredRoleFlags;
  global.applyClubRoleFlagsToMember = applyClubRoleFlagsToMember;
  global.formatClubRoleMessage = formatClubRoleMessage;
  global.formatClubRoleBadgesHtml = formatClubRoleBadgesHtml;
  global.refreshMembersRoleFlagsForIdentity = refreshMembersRoleFlagsForIdentity;
  global.refreshAllMembersRoleFlags = refreshAllMembersRoleFlags;
  global.appendClubRoleFlagsToPayload = appendRoleFlagsToPayload;
  global.memberMatchesClubIdentity = memberMatchesIdentity;
})(typeof window !== 'undefined' ? window : globalThis);
