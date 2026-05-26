'use strict';

const {
  getRedsysConfig,
  getRedsysPublicConfig,
  normalizePayMethod,
  generateRedsysOrderId,
  buildRedirectForm,
  amountToCents
} = require('./lib/redsys');
const { savePendingPayment } = require('./lib/firestore-admin');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const cfg = getRedsysConfig();
    if (!cfg.ok) {
      return { statusCode: 503, headers: CORS, body: JSON.stringify({ ok: false, error: cfg.error }) };
    }

    const body = JSON.parse(event.body || '{}');
    const type = String(body.type || '').trim();
    const amountEur = Number(body.amountEur);
    const email = String(body.email || '').trim().toLowerCase();
    const description = String(body.description || 'Pago CD Sanabria CF').slice(0, 125);

    if (!['membership_fee', 'event_registration', 'player_inscription'].includes(type)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'type inválido' }) };
    }
    if (!email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'email obligatorio' }) };
    }

    const payMethod = normalizePayMethod(body.payMethod);
    const publicCfg = getRedsysPublicConfig();
    if (payMethod === 'bizum' && !publicCfg.bizumEnabled) {
      return {
        statusCode: 503,
        headers: CORS,
        body: JSON.stringify({
          ok: false,
          error: 'Bizum no está activado todavía. Usa tarjeta o transferencia, o inténtalo cuando el club confirme la activación.'
        })
      };
    }

    const cents = amountToCents(amountEur);
    const orderId = generateRedsysOrderId();

    const paymentDoc = {
      type,
      payMethod,
      amountEur,
      amountCents: cents,
      customerEmail: email,
      description,
      memberId: body.memberId || null,
      eventId: body.eventId || null,
      participant: body.participant || null,
      guests: Array.isArray(body.guests) ? body.guests : [],
      registrationBundle: body.registrationBundle || null,
      priceTier: body.priceTier || null,
      playerId: body.playerId || null,
      playerRegistration: body.playerRegistration || null
    };

    try {
      await savePendingPayment(orderId, paymentDoc);
    } catch (e) {
      console.error('Firestore savePendingPayment:', e);
      return {
        statusCode: 503,
        headers: CORS,
        body: JSON.stringify({ ok: false, error: 'No se pudo registrar el pedido (Firebase Admin)' })
      };
    }

    const merchantParams = {
      DS_MERCHANT_AMOUNT: String(cents),
      DS_MERCHANT_ORDER: orderId,
      DS_MERCHANT_MERCHANTCODE: cfg.merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: cfg.terminal,
      DS_MERCHANT_MERCHANTURL: `${cfg.siteUrl}/.netlify/functions/redsys-notification`,
      DS_MERCHANT_URLOK: `${cfg.siteUrl}/pago-resultado.html?result=ok&order=${orderId}`,
      DS_MERCHANT_URLKO: `${cfg.siteUrl}/pago-resultado.html?result=ko&order=${orderId}`,
      DS_MERCHANT_PRODUCTDESCRIPTION: description,
      DS_MERCHANT_TITULAR: email.slice(0, 60),
      DS_MERCHANT_MERCHANTNAME: 'CD Sanabria CF'
    };

    if (payMethod === 'bizum') {
      merchantParams.DS_MERCHANT_PAYMETHODS = 'z';
    }

    const form = buildRedirectForm(cfg, merchantParams);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, orderId, redirect: form })
    };
  } catch (err) {
    console.error('redsys-create-payment:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: err.message || 'Error interno' })
    };
  }
};
