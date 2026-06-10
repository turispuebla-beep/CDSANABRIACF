'use strict';

const { approvePlayerApplication, rejectPlayerApplication } = require('./lib/firestore-admin');
const { verifyAdminRequest } = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');

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
    const action = String(body.action || 'approve').trim();
    const applicationId = String(body.applicationId || '').trim();
    if (!applicationId) {
      return jsonResponse(400, { ok: false, error: 'applicationId requerido' }, origin);
    }

    const validatedBy = body.validatedBy || auth.email || auth.uid || 'admin';

    if (action === 'reject') {
      const result = await rejectPlayerApplication(applicationId, {
        validatedBy,
        reason: body.reason || ''
      });
      return jsonResponse(200, { ok: true, application: result }, origin);
    }

    const result = await approvePlayerApplication(applicationId, { validatedBy });
    return jsonResponse(
      200,
      {
        ok: true,
        playerId: result.playerId,
        application: result.application,
        emailSent: !!result.emailSent,
        emailTo: result.emailTo || '',
        emailError: result.emailError || ''
      },
      origin
    );
  } catch (err) {
    console.error('approve-player-application:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
