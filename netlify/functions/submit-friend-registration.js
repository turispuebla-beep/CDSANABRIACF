'use strict';

const { upsertFriendRegistrationRecord } = require('./lib/firestore-admin');
const { notifyFriendRegistrationEmails } = require('./lib/member-email');
const { assertPublicActionsAllowed, isSiteUpdateModeError } = require('./lib/site-public-mode');

const CORS_BASE = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
    await assertPublicActionsAllowed();
    const body = JSON.parse(event.body || '{}');
    const friend = body.friend;
    if (!friend || typeof friend !== 'object') {
      return json(400, { ok: false, error: 'Datos de amigo/a ausentes' }, origin);
    }
    const saved = await upsertFriendRegistrationRecord(friend);

    let emailsSent = false;
    try {
      const mail = await notifyFriendRegistrationEmails(saved);
      emailsSent = !!(mail.friend && mail.friend.sent) || !!(mail.club && mail.club.sent);
    } catch (mailErr) {
      console.warn('submit-friend-registration emails:', mailErr.message || mailErr);
    }

    return json(200, { ok: true, friendId: saved.id, friend: saved, emailsSent }, origin);
  } catch (err) {
    if (isSiteUpdateModeError(err)) {
      return json(503, { ok: false, error: err.message, code: 'site_update_mode' }, origin);
    }
    console.error('submit-friend-registration:', err);
    return json(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
