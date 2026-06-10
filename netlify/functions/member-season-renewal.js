'use strict';

const { applyAutomaticSeasonRenewal } = require('./lib/firestore-admin');
const { verifySeasonRenewalRequest } = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');

/**
 * Renovación automática de socios tras el cierre de temporada (31/05).
 * Solo: cron Netlify, NETLIFY_CRON_SECRET o admin autenticado.
 */
exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  const auth = await verifySeasonRenewalRequest(event);
  if (!auth.ok) {
    return jsonResponse(auth.statusCode || 401, { ok: false, error: auth.error }, origin);
  }

  try {
    const body = event.body ? JSON.parse(event.body || '{}') : {};
    const force = body.force === true && auth.source !== 'cron';
    const result = await applyAutomaticSeasonRenewal({ force });
    console.log('member-season-renewal:', result);
    return jsonResponse(200, { ok: true, ...result }, origin);
  } catch (err) {
    console.error('member-season-renewal:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
