'use strict';

const { approvePlayerApplication, rejectPlayerApplication } = require('./lib/firestore-admin');

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
    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || 'approve').trim();
    const applicationId = String(body.applicationId || '').trim();
    if (!applicationId) {
      return json(400, { ok: false, error: 'applicationId requerido' }, origin);
    }

    if (action === 'reject') {
      const result = await rejectPlayerApplication(applicationId, {
        validatedBy: body.validatedBy || 'admin',
        reason: body.reason || ''
      });
      return json(200, { ok: true, application: result }, origin);
    }

    const result = await approvePlayerApplication(applicationId, {
      validatedBy: body.validatedBy || 'admin'
    });
    return json(
      200,
      {
        ok: true,
        playerId: result.playerId,
        application: result.application
      },
      origin
    );
  } catch (err) {
    console.error('approve-player-application:', err);
    return json(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
