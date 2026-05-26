'use strict';

const { getPayment } = require('./lib/firestore-admin');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  const orderId = (event.queryStringParameters || {}).order;
  if (!orderId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'order requerido' }) };
  }
  try {
    const payment = await getPayment(orderId);
    if (!payment) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, error: 'Pedido no encontrado' }) };
    }
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        orderId,
        status: payment.status,
        type: payment.type,
        amountEur: payment.amountEur
      })
    };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
