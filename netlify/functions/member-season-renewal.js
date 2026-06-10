'use strict';

const { applyAutomaticSeasonRenewal } = require('./lib/firestore-admin');

/**
 * Renovación automática de socios tras el cierre de temporada (31/05).
 * Programado en netlify.toml; también invocable por POST (panel admin).
 */
exports.handler = async (event) => {
  try {
    if (event.httpMethod && event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
      return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
    }
    const body = event.body ? JSON.parse(event.body || '{}') : {};
    const result = await applyAutomaticSeasonRenewal({ force: body.force === true });
    console.log('member-season-renewal:', result);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, ...result })
    };
  } catch (err) {
    console.error('member-season-renewal:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message || 'Error interno' })
    };
  }
};
