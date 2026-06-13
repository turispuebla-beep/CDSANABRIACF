'use strict';

const {
  getRedsysConfig,
  getRedsysPublicConfig,
  generateRedsysOrderId,
  buildPayGoldXmlData,
  normalizeEsMobile,
  sendPayGoldRequest,
  amountToCents
} = require('./lib/redsys');
const { savePendingPayment } = require('./lib/firestore-admin');
const { verifyAdminRequest } = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');

const VALID_CATEGORIES = new Set(['membership', 'kit', 'other']);

function normalizeCategory(value) {
  const v = String(value || 'other').trim().toLowerCase();
  if (v === 'cuota' || v === 'socio') return 'membership';
  if (v === 'ropa' || v === 'equipacion') return 'kit';
  return VALID_CATEGORIES.has(v) ? v : 'other';
}

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
    const cfg = getRedsysConfig();
    if (!cfg.ok) {
      return jsonResponse(503, { ok: false, error: cfg.error }, origin);
    }

    const publicCfg = getRedsysPublicConfig();
    if (!publicCfg.paygoldEnabled) {
      return jsonResponse(503, { ok: false, error: 'PayGold no está habilitado en el servidor' }, origin);
    }

    const body = JSON.parse(event.body || '{}');
    const amountEur = Number(body.amountEur);
    const conceptCategory = normalizeCategory(body.conceptCategory);
    const conceptLabel = String(body.conceptLabel || body.concept || 'Pago CD Sanabria CF').trim().slice(0, 125);
    const buyerName = String(body.buyerName || body.memberName || '').trim().slice(0, 120);
    const email = String(body.email || body.customerEmail || '').trim().toLowerCase();
    const sendSms = body.sendSms !== false;
    const sendEmail = body.sendEmail === true;

    if (!Number.isFinite(amountEur) || amountEur <= 0) {
      return jsonResponse(400, { ok: false, error: 'Importe inválido' }, origin);
    }
    if (!conceptLabel) {
      return jsonResponse(400, { ok: false, error: 'Concepto obligatorio' }, origin);
    }

    let mobile = '';
    if (sendSms) {
      try {
        mobile = normalizeEsMobile(body.mobile || body.phone || body.telefono);
      } catch (e) {
        return jsonResponse(400, { ok: false, error: e.message || 'Móvil inválido' }, origin);
      }
    }
    if (sendEmail && (!email || !email.includes('@'))) {
      return jsonResponse(400, { ok: false, error: 'Email obligatorio si envías por correo' }, origin);
    }
    if (!sendSms && !sendEmail) {
      return jsonResponse(400, { ok: false, error: 'Marca envío por SMS y/o email' }, origin);
    }

    const cents = amountToCents(amountEur);
    const orderId = generateRedsysOrderId();

    const paymentDoc = {
      type: 'paygold_custom',
      payMethod: 'paygold',
      conceptCategory,
      conceptLabel,
      amountEur,
      amountCents: cents,
      customerEmail: email || null,
      customerMobile: mobile || null,
      buyerName: buyerName || null,
      memberId: body.memberId || null,
      description: conceptLabel,
      paygoldChannel: sendSms && sendEmail ? 'sms_email' : sendSms ? 'sms' : 'email',
      createdByAdmin: auth.email || auth.uid,
      delivery: 'pending'
    };

    try {
      await savePendingPayment(orderId, paymentDoc);
    } catch (e) {
      console.error('savePendingPayment paygold:', e);
      return jsonResponse(503, { ok: false, error: 'No se pudo registrar el cobro (Firebase)' }, origin);
    }

    const merchantParams = {
      DS_MERCHANT_AMOUNT: String(cents),
      DS_MERCHANT_ORDER: orderId,
      DS_MERCHANT_MERCHANTCODE: cfg.merchantCode,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TERMINAL: cfg.terminal,
      DS_MERCHANT_TRANSACTIONTYPE: 'F',
      DS_MERCHANT_MERCHANTURL: `${cfg.siteUrl}/.netlify/functions/redsys-notification`,
      DS_MERCHANT_URLOK: `${cfg.siteUrl}/pago-resultado.html?result=ok&order=${orderId}`,
      DS_MERCHANT_URLKO: `${cfg.siteUrl}/pago-resultado.html?result=ko&order=${orderId}`,
      DS_MERCHANT_PRODUCTDESCRIPTION: conceptLabel.slice(0, 125),
      DS_MERCHANT_P2F_XMLDATA: buildPayGoldXmlData({
        buyerName: buyerName || 'Cliente CD Sanabria CF',
        concept: conceptLabel,
        subject: `Pago CD Sanabria CF — ${conceptLabel}`.slice(0, 80)
      })
    };

    if (sendSms && mobile) {
      merchantParams.DS_MERCHANT_CUSTOMER_MOBILE = mobile;
    }
    if (sendEmail && email) {
      merchantParams.DS_MERCHANT_CUSTOMER_MAIL = email;
    }
    if (buyerName) {
      merchantParams.DS_MERCHANT_TITULAR = buyerName.slice(0, 60);
    } else if (email) {
      merchantParams.DS_MERCHANT_TITULAR = email.slice(0, 60);
    }

    const result = await sendPayGoldRequest(cfg, merchantParams);
    if (!result.ok) {
      const { updatePayment } = require('./lib/firestore-admin');
      await updatePayment(orderId, {
        status: 'failed',
        delivery: 'failed',
        paygoldError: result.error,
        paygoldResponse: result.response || null
      });
      return jsonResponse(502, {
        ok: false,
        error: result.error,
        orderId,
        paymentUrl: result.paymentUrl || null,
        response: result.response || null
      }, origin);
    }

    const { updatePayment } = require('./lib/firestore-admin');
    await updatePayment(orderId, {
      status: result.paid ? 'paid' : 'link_sent',
      delivery: result.paid ? 'paid_immediate' : sendSms ? (sendEmail ? 'sms_email' : 'sms') : 'email',
      paygoldResponse: result.response,
      paygoldPaymentUrl: result.paymentUrl || null,
      linkSentAt: new Date().toISOString()
    });

    return jsonResponse(200, {
      ok: true,
      orderId,
      linkSent: !!result.linkSent,
      paid: !!result.paid,
      paymentUrl: result.paymentUrl || null,
      message: result.linkSent
        ? (sendSms ? 'Enlace PayGold enviado por SMS (Redsys).' : 'Enlace PayGold enviado por email (Redsys).')
        : 'Operación PayGold aceptada.'
    }, origin);
  } catch (err) {
    console.error('redsys-paygold-send:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
