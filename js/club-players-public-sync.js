/**
 * Ficha pública de jugadores/as del club (sin DNI, email ni datos de torneo F7).
 * Los participantes del torneo viven en sanabria_torneo_preinscripciones — nunca aquí.
 */
(function (global) {
  'use strict';

  const APP_SCOPE = 'cdsanabriacf';
  const PUBLIC_COLLECTION = 'sanabria_players_public';

  function pickCategory(player) {
    return String(
      player.category || player.categoria || player.teamCategory || player.equipo || ''
    ).trim();
  }

  function pickTeam(player) {
    return String(player.team || player.teamName || player.equipoNombre || '').trim();
  }

  function pickNumber(player) {
    const n = player.playerNumber != null ? player.playerNumber : player.dorsal != null ? player.dorsal : player.numero;
    if (n == null || n === '') return '';
    return String(n).trim();
  }

  /** Solo campos seguros para la web pública del club. */
  function buildPublicPlayerDoc(player) {
    const p = player && typeof player === 'object' ? player : {};
    const clubPlayerId = String(p.id || p.firebaseId || '').trim();
    if (!clubPlayerId) return null;

    const nombre = String(p.name || p.nombre || '').trim();
    const apellidos = String(p.surname || p.apellidos || '').trim();
    const status = String(p.status || p.inscriptionStatus || 'active').toLowerCase();

    return {
      appScope: APP_SCOPE,
      clubPlayerId: clubPlayerId,
      source: 'club_player',
      name: nombre,
      surname: apellidos,
      nombre: nombre,
      apellidos: apellidos,
      playerNumber: pickNumber(p),
      category: pickCategory(p),
      team: pickTeam(p),
      status: status,
      photoUrl: String(p.photoUrl || p.photo || '').trim(),
      updatedAt: new Date().toISOString()
    };
  }

  async function syncClubPlayerPublic(player) {
    if (!global.updateDocument || !global.createDocument) return;
    const doc = buildPublicPlayerDoc(player);
    if (!doc) return;
    const id = doc.clubPlayerId;
    try {
      await global.updateDocument('players_public', id, doc);
    } catch (_) {
      try {
        await global.createDocument('players_public', Object.assign({ id: id }, doc));
      } catch (e2) {
        console.warn('[ClubPlayersPublicSync] sync:', e2.message || e2);
      }
    }
  }

  async function removeClubPlayerPublic(playerId) {
    if (!global.deleteDocument || !playerId) return;
    try {
      await global.deleteDocument('players_public', String(playerId), 'admin');
    } catch (e) {
      console.warn('[ClubPlayersPublicSync] remove:', e.message || e);
    }
  }

  async function syncAllClubPlayersPublic(players) {
    const list = Array.isArray(players) ? players : [];
    for (let i = 0; i < list.length; i++) {
      await syncClubPlayerPublic(list[i]);
    }
  }

  async function afterClubPlayerWrite(player) {
    if (!(await global.firebaseUserIsClubAdmin())) return;
    await syncClubPlayerPublic(player);
  }

  async function afterClubPlayerDelete(playerId) {
    if (!(await global.firebaseUserIsClubAdmin())) return;
    await removeClubPlayerPublic(playerId);
  }

  global.ClubPlayersPublicSync = {
    PUBLIC_COLLECTION: PUBLIC_COLLECTION,
    buildPublicPlayerDoc: buildPublicPlayerDoc,
    syncClubPlayerPublic: syncClubPlayerPublic,
    removeClubPlayerPublic: removeClubPlayerPublic,
    syncAllClubPlayersPublic: syncAllClubPlayersPublic,
    afterClubPlayerWrite: afterClubPlayerWrite,
    afterClubPlayerDelete: afterClubPlayerDelete
  };
})(typeof window !== 'undefined' ? window : globalThis);
