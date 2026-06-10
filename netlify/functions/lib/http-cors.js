'use strict';

const CORS_BASE = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function corsHeaders(origin) {
  const allowed = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const site = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const list = allowed.length ? allowed : site ? [site] : [];
  const ok = origin && list.length ? list.includes(origin) : list.length > 0;
  return {
    ...CORS_BASE,
    'Access-Control-Allow-Origin': ok ? origin : list[0] || 'null'
  };
}

function jsonResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

module.exports = { CORS_BASE, corsHeaders, jsonResponse };
