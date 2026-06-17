'use strict';

const { getTorneoFichaByInvite, submitTorneoFichaByInvite } = require('./lib/torneo-equipo');

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
    const action = String(body.action || 'get').trim().toLowerCase();
    const inviteToken = body.inviteToken || body.invite || body.token;

    if (action === 'get') {
      const ficha = await getTorneoFichaByInvite(inviteToken);
      return json(200, { ok: true, ficha }, origin);
    }

    if (action === 'submit') {
      const ficha = await submitTorneoFichaByInvite(inviteToken, body.ficha || body);
      return json(200, { ok: true, ficha }, origin);
    }

    return json(400, { ok: false, error: 'Acción no válida' }, origin);
  } catch (err) {
    console.warn('torneo-jugador-ficha:', err.message || err);
    return json(400, { ok: false, error: err.message || 'Error' }, origin);
  }
};
