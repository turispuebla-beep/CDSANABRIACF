'use strict';

const { repairPlayerInscriptionsFromPaymentOrders } = require('./lib/firestore-admin');
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
    const orderIds = Array.isArray(body.orderIds) ? body.orderIds : [];
    if (!orderIds.length) {
      return jsonResponse(400, { ok: false, error: 'orderIds requerido (array)' }, origin);
    }
    const result = await repairPlayerInscriptionsFromPaymentOrders(orderIds);
    return jsonResponse(200, result, origin);
  } catch (err) {
    console.error('repair-player-inscriptions:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
