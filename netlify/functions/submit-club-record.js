'use strict';

const {
  upsertMemberRegistrationRecord,
  upsertFriendRegistrationRecord,
  upsertPlayerInscriptionRecord,
  upsertCoachRecord,
  deleteCoachRecord,
  deleteMemberRecord,
  deleteFriendRecord,
  deletePlayerRecord
} = require('./lib/firestore-admin');
const { verifyAdminRequest } = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');

const UPSERT_HANDLERS = {
  member: upsertMemberRegistrationRecord,
  friend: upsertFriendRegistrationRecord,
  coach: upsertCoachRecord
};

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  const auth = await verifyAdminRequest(event);
  if (!auth.ok) {
    return jsonResponse(auth.statusCode || 401, { ok: false, error: auth.error }, origin);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const kind = String(body.kind || body.type || '').trim().toLowerCase();
    const action = String(body.action || 'upsert').trim().toLowerCase();
    const record = body.record;

    if (action === 'delete') {
      const recordId = body.id || (record && record.id);
      if (kind === 'coach') {
        await deleteCoachRecord(recordId);
        return jsonResponse(200, { ok: true, deleted: true, coachId: recordId }, origin);
      }
      if (kind === 'member') {
        await deleteMemberRecord(recordId, { email: body.email, dni: body.dni });
        return jsonResponse(200, { ok: true, deleted: true, memberId: recordId }, origin);
      }
      if (kind === 'friend') {
        await deleteFriendRecord(recordId);
        return jsonResponse(200, { ok: true, deleted: true, friendId: recordId }, origin);
      }
      if (kind === 'player') {
        await deletePlayerRecord(recordId, {
          email: body.email,
          dni: body.dni,
          name: body.name,
          surname: body.surname,
          season: body.season || body.inscriptionSeason,
          allowNotFound: body.allowNotFound === true,
          purgeTestRecords: body.purgeTestRecords === true
        });
        return jsonResponse(200, { ok: true, deleted: true, playerId: recordId }, origin);
      }
      return jsonResponse(400, { ok: false, error: 'delete no soportado para kind: ' + kind }, origin);
    }

    if (!record || typeof record !== 'object') {
      return jsonResponse(400, { ok: false, error: 'record ausente' }, origin);
    }

    if (kind === 'player') {
      const result = await upsertPlayerInscriptionRecord(record);
      return jsonResponse(
        200,
        { ok: true, playerId: result.player.id, player: result.player, member: result.member || null },
        origin
      );
    }

    const handler = UPSERT_HANDLERS[kind];
    if (!handler) {
      return jsonResponse(400, { ok: false, error: 'kind no válido (member, friend, player, coach)' }, origin);
    }

    const saved = await handler(record);
    const idKey = kind + 'Id';
    return jsonResponse(200, { ok: true, [idKey]: saved.id, [kind]: saved, record: saved }, origin);
  } catch (err) {
    console.error('submit-club-record:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
