'use strict';

const { verifyAdminRequest } = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');
const { deliverClubPushNotification } = require('./lib/club-push-send');

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
    const title = String(body.title || '').trim();
    const messageBody = String(body.body || body.content || body.message || '').trim();

    if (!title || !messageBody) {
      return jsonResponse(400, { ok: false, error: 'Título y contenido obligatorios' }, origin);
    }

    const result = await deliverClubPushNotification({
      title,
      content: messageBody,
      message: messageBody,
      targetRoles: Array.isArray(body.targetRoles) ? body.targetRoles : ['all'],
      targetTeams: Array.isArray(body.targetTeams) ? body.targetTeams : [],
      priority: body.urgent ? 'high' : body.priority,
      type: body.type,
      broadcastId: body.broadcastId,
      id: body.broadcastId
    });

    return jsonResponse(200, { ok: true, ...result }, origin);
  } catch (err) {
    console.error('send-club-push:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error enviando push' }, origin);
  }
};
