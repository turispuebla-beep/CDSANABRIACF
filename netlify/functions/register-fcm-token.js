'use strict';

const { ensureFirebaseAdmin } = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');

const APP_SCOPE = 'cdsanabriacf';

function isSafeDocId(id) {
  return /^[A-Za-z0-9_-]{8,128}$/.test(String(id || ''));
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const fcmToken = String(body.fcmToken || '').trim();
    const docId = String(body.docId || '').trim();

    if (fcmToken.length < 20 || fcmToken.length > 4096) {
      return jsonResponse(400, { ok: false, error: 'Token no válido' }, origin);
    }
    if (!isSafeDocId(docId) || !(docId.startsWith('dev_') || docId.length >= 16)) {
      return jsonResponse(400, { ok: false, error: 'Identificador no válido' }, origin);
    }

    const userRoles = Array.isArray(body.userRoles)
      ? body.userRoles.map(function (r) {
          return String(r || '').toLowerCase().slice(0, 32);
        }).filter(Boolean).slice(0, 12)
      : [];
    const teams = Array.isArray(body.teams)
      ? body.teams.map(function (t) {
          return String(t || '').toLowerCase().slice(0, 80);
        }).filter(Boolean).slice(0, 20)
      : [];

    const adm = ensureFirebaseAdmin();
    await adm.firestore().collection('sanabria_fcm_tokens').doc(docId).set(
      {
        appScope: APP_SCOPE,
        fcmToken: fcmToken,
        userRole: String(body.userRole || userRoles[0] || 'guest').toLowerCase().slice(0, 32),
        userRoles: userRoles.length ? userRoles : ['guest'],
        wantsPush: body.wantsPush !== false,
        email: String(body.email || '').trim().toLowerCase().slice(0, 120),
        teams: teams,
        authUid: String(body.authUid || '').slice(0, 128),
        lastTokenUpdate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    return jsonResponse(200, { ok: true }, origin);
  } catch (err) {
    console.error('register-fcm-token:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error guardando token' }, origin);
  }
};
