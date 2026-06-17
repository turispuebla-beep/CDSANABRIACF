/**
 * Persistencia panel admin → Firebase vía Netlify (Admin SDK).
 * Socios/amigos/jugadores/entrenadores dados de alta manualmente en el panel.
 * Entrenadores: solo passwordHash (clave asignada por el club), nunca texto plano.
 */
(function (global) {
  'use strict';

  const API = '/.netlify/functions/submit-club-record';

  function stripPlainSecrets(record) {
    const m = record && typeof record === 'object' ? { ...record } : {};
    delete m.password;
    delete m.pass;
    delete m.plainPassword;
    delete m.portalPassword;
    return m;
  }

  function cloudRequired() {
    if (global.clubCloudPersistIsRequired) return global.clubCloudPersistIsRequired();
    try {
      return global.location && global.location.protocol !== 'file:';
    } catch (_) {
      return true;
    }
  }

  async function postPayload(payload) {
    const headers = { 'Content-Type': 'application/json' };
    if (global.CdsanAdminApiAuth && global.CdsanAdminApiAuth.getAdminAuthHeaders) {
      Object.assign(headers, await global.CdsanAdminApiAuth.getAdminAuthHeaders());
    }
    const res = await fetch(API, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(function () {
      return { ok: false };
    });
    if (!res.ok || !json.ok) {
      const err = new Error(json.error || 'No se pudo guardar en la nube del club');
      err.code = 'admin_cloud_persist_failed';
      throw err;
    }
    return json;
  }

  function mergeIntoLocal(localKey, syncFn, eventName, remote, matchFn) {
    if (!remote || !remote.id) return remote;
    const list = JSON.parse(global.localStorage.getItem(localKey) || '[]');
    let ix = list.findIndex(function (x) {
      return x && x.id === remote.id;
    });
    if (ix < 0 && matchFn) ix = matchFn(list, remote);
    const merged = { ...(ix >= 0 ? list[ix] : {}), ...remote };
    if (ix >= 0) list[ix] = merged;
    else list.push(merged);
    if (typeof syncFn === 'function') syncFn(list);
    else global.localStorage.setItem(localKey, JSON.stringify(list));
    try {
      global.dispatchEvent(new CustomEvent(eventName, { detail: list }));
    } catch (_) {}
    return merged;
  }

  async function persistMember(record) {
    if (global.ClubMemberCloudPersist && global.ClubMemberCloudPersist.persistMemberViaNetlify) {
      return global.ClubMemberCloudPersist.persistMemberViaNetlify(stripPlainSecrets(record));
    }
    const json = await postPayload({ kind: 'member', record: stripPlainSecrets(record) });
    const remote = json.member || json.record || { id: json.memberId, ...record };
    return mergeIntoLocal(
      'clubMembers',
      global.syncClubMembersLocal,
      'membersUpdated',
      remote,
      function (list, r) {
        const em = String(r.email || '').trim().toLowerCase();
        return list.findIndex(function (s) {
          return String(s.email || '').trim().toLowerCase() === em;
        });
      }
    );
  }

  async function persistFriend(record) {
    if (global.ClubFriendCloudPersist && global.ClubFriendCloudPersist.persistFriendViaNetlify) {
      return global.ClubFriendCloudPersist.persistFriendViaNetlify(stripPlainSecrets(record));
    }
    const json = await postPayload({ kind: 'friend', record: stripPlainSecrets(record) });
    const remote = json.friend || json.record || { id: json.friendId, ...record };
    return mergeIntoLocal(
      'clubFriends',
      global.syncClubFriendsLocal,
      'friendsUpdated',
      remote,
      function (list, r) {
        const em = String(r.email || '').trim().toLowerCase();
        return list.findIndex(function (a) {
          return String(a.email || '').trim().toLowerCase() === em;
        });
      }
    );
  }

  async function persistPlayer(record) {
    const json = await postPayload({ kind: 'player', record: stripPlainSecrets(record) });
    const remote = json.player || json.record || { id: json.playerId, ...record };
    return mergeIntoLocal(
      'clubPlayers',
      global.syncClubPlayersLocal,
      'playersUpdated',
      remote,
      function (list, r) {
        const dni = String(r.dni || '').trim().toUpperCase();
        return list.findIndex(function (p) {
          return String(p.dni || '').trim().toUpperCase() === dni;
        });
      }
    );
  }

  async function persistCoach(record) {
    const safe = stripPlainSecrets(record);
    if (!safe.passwordHash && !safe.id) {
      throw new Error('Falta passwordHash del entrenador');
    }
    const json = await postPayload({ kind: 'coach', record: safe });
    const remote = json.coach || json.record || { id: json.coachId, ...safe };
    return mergeIntoLocal(
      'clubCoaches',
      global.syncClubCoachesLocal,
      'coachesUpdated',
      remote,
      function (list, r) {
        const em = String(r.email || '').trim().toLowerCase();
        return list.findIndex(function (c) {
          return String(c.email || '').trim().toLowerCase() === em;
        });
      }
    );
  }

  async function deleteCoach(coachId) {
    await postPayload({ kind: 'coach', action: 'delete', id: coachId });
  }

  async function deleteMember(memberId, identity) {
    const payload = { kind: 'member', action: 'delete', id: memberId };
    if (identity && identity.email) payload.email = String(identity.email).trim().toLowerCase();
    if (identity && identity.dni) payload.dni = identity.dni;
    await postPayload(payload);
  }

  async function deleteFriend(friendId) {
    await postPayload({ kind: 'friend', action: 'delete', id: friendId });
  }

  async function deletePlayer(playerId, identity) {
    const payload = { kind: 'player', action: 'delete', id: playerId };
    const ident = identity && typeof identity === 'object' ? identity : {};
    if (ident.email) payload.email = String(ident.email).trim().toLowerCase();
    if (ident.dni) payload.dni = ident.dni;
    if (ident.name) payload.name = ident.name;
    if (ident.surname) payload.surname = ident.surname;
    if (ident.season || ident.inscriptionSeason) {
      payload.season = ident.season || ident.inscriptionSeason;
    }
    if (ident.allowNotFound) payload.allowNotFound = true;
    if (ident.purgeTestRecords) payload.purgeTestRecords = true;
    await postPayload(payload);
  }

  async function persist(kind, record) {
    if (kind === 'member') return persistMember(record);
    if (kind === 'friend') return persistFriend(record);
    if (kind === 'player') return persistPlayer(record);
    if (kind === 'coach') return persistCoach(record);
    throw new Error('kind no soportado: ' + kind);
  }

  async function assignPendingMemberNumbers(opts) {
    const headers = { 'Content-Type': 'application/json' };
    if (global.CdsanAdminApiAuth && global.CdsanAdminApiAuth.getAdminAuthHeaders) {
      Object.assign(headers, await global.CdsanAdminApiAuth.getAdminAuthHeaders());
    }
    const res = await fetch('/.netlify/functions/assign-member-numbers', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ dryRun: !!(opts && opts.dryRun) })
    });
    const json = await res.json().catch(function () {
      return { ok: false };
    });
    if (!res.ok || !json.ok) {
      const err = new Error(json.error || 'No se pudieron asignar números de socio');
      err.code = 'assign_member_numbers_failed';
      throw err;
    }
    return json;
  }

  async function repairPlayerInscriptions(orderIds) {
    const headers = { 'Content-Type': 'application/json' };
    if (global.CdsanAdminApiAuth && global.CdsanAdminApiAuth.getAdminAuthHeaders) {
      Object.assign(headers, await global.CdsanAdminApiAuth.getAdminAuthHeaders());
    }
    const res = await fetch('/.netlify/functions/repair-player-inscriptions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ orderIds: orderIds || [] })
    });
    const json = await res.json().catch(function () {
      return { ok: false };
    });
    if (!res.ok || !json.ok) {
      const err = new Error(json.error || 'No se pudieron reparar inscripciones');
      err.code = 'repair_player_inscriptions_failed';
      throw err;
    }
    return json;
  }

  global.AdminClubCloudPersist = {
    persist: persist,
    persistMember: persistMember,
    persistFriend: persistFriend,
    persistPlayer: persistPlayer,
    persistCoach: persistCoach,
    deleteCoach: deleteCoach,
    deleteMember: deleteMember,
    deleteFriend: deleteFriend,
    deletePlayer: deletePlayer,
    assignPendingMemberNumbers: assignPendingMemberNumbers,
    repairPlayerInscriptions: repairPlayerInscriptions,
    cloudRequired: cloudRequired
  };
})(typeof window !== 'undefined' ? window : globalThis);
