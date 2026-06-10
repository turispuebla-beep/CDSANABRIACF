'use strict';

const {
  upsertMemberRegistrationRecord,
  upsertFriendRegistrationRecord,
  upsertPlayerInscriptionRecord,
  upsertCoachRecord,
  deleteCoachRecord
} = require('./lib/firestore-admin');

const CORS_BASE = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const UPSERT_HANDLERS = {
  member: upsertMemberRegistrationRecord,
  friend: upsertFriendRegistrationRecord,
  coach: upsertCoachRecord
};

function corsHeaders(origin) {
  const allowed = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const site = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const list = allowed.length ? allowed : site ? [site] : [];
  const ok = !list.length || list.includes(origin);
  return {
    ...CORS_BASE,
    'Access-Control-Allow-Origin': ok ? origin || list[0] || '*' : 'null'
  };
}

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const kind = String(body.kind || body.type || '').trim().toLowerCase();
    const action = String(body.action || 'upsert').trim().toLowerCase();
    const record = body.record;

    if (action === 'delete') {
      if (kind !== 'coach') {
        return json(400, { ok: false, error: 'delete solo soportado para coach' }, origin);
      }
      const coachId = body.id || (record && record.id);
      await deleteCoachRecord(coachId);
      return json(200, { ok: true, deleted: true, coachId }, origin);
    }

    if (!record || typeof record !== 'object') {
      return json(400, { ok: false, error: 'record ausente' }, origin);
    }

    if (kind === 'player') {
      const result = await upsertPlayerInscriptionRecord(record);
      return json(200, { ok: true, playerId: result.player.id, player: result.player, member: result.member || null }, origin);
    }

    const handler = UPSERT_HANDLERS[kind];
    if (!handler) {
      return json(400, { ok: false, error: 'kind no válido (member, friend, player, coach)' }, origin);
    }

    const saved = await handler(record);
    const idKey = kind + 'Id';
    return json(200, { ok: true, [idKey]: saved.id, [kind]: saved, record: saved }, origin);
  } catch (err) {
    console.error('submit-club-record:', err);
    return json(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
