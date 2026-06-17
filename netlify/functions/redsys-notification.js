'use strict';

const {
  getRedsysConfig,
  verifyNotificationSignature,
  isRedsysPaymentOk
} = require('./lib/redsys');
const {
  getPayment,
  updatePayment,
  completeMembershipPayment,
  completePayGoldPayment,
  completeEventPayment,
  completePlayerInscription,
  completePlayerKitPurchase,
  sendPaymentFailedNotification
} = require('./lib/firestore-admin');
const { completeTorneoTeamInscriptionPayment } = require('./lib/torneo-equipo');

function parseBody(event) {
  const raw = event.body || '';
  if (event.isBase64Encoded) {
    return Buffer.from(raw, 'base64').toString('utf8');
  }
  return raw;
}

function parseFormBody(body) {
  const params = new URLSearchParams(body);
  return {
    Ds_SignatureVersion: params.get('Ds_SignatureVersion') || params.get('DS_SIGNATUREVERSION'),
    Ds_MerchantParameters: params.get('Ds_MerchantParameters') || params.get('DS_MERCHANTPARAMETERS'),
    Ds_Signature: params.get('Ds_Signature') || params.get('DS_SIGNATURE')
  };
}

exports.handler = async (event) => {
  try {
    const cfg = getRedsysConfig();
    if (!cfg.ok) {
      return { statusCode: 503, body: 'Config error' };
    }

    const body = parseBody(event);
    const { Ds_MerchantParameters, Ds_Signature, Ds_SignatureVersion } = parseFormBody(body);

    if (!Ds_MerchantParameters || !Ds_Signature) {
      return { statusCode: 400, body: 'Missing params' };
    }

    const verified = verifyNotificationSignature(
      Ds_MerchantParameters,
      Ds_Signature,
      cfg.secretKey,
      Ds_SignatureVersion
    );
    if (!verified.ok) {
      console.warn('redsys-notification verify:', verified.error);
      return { statusCode: 400, body: 'Invalid signature' };
    }

    const { params, order } = verified;
    const responseCode = params.Ds_Response || params.DS_RESPONSE;
    const ok = isRedsysPaymentOk(responseCode);

    const payment = await getPayment(order);
    if (!payment) {
      console.warn('Payment not found:', order);
      return { statusCode: 200, body: 'OK' };
    }

    if (payment.status === 'paid') {
      return { statusCode: 200, body: 'OK' };
    }

    if (!ok) {
      await updatePayment(order, {
        status: 'failed',
        redsysResponse: String(responseCode),
        redsysParams: params
      });
      try {
        await sendPaymentFailedNotification({ ...payment, orderId: order });
      } catch (mailErr) {
        console.warn('redsys-notification KO email:', mailErr.message || mailErr);
      }
      return { statusCode: 200, body: 'OK' };
    }

    await updatePayment(order, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      redsysResponse: String(responseCode),
      redsysParams: params
    });

    if (payment.type === 'membership_fee') {
      await completeMembershipPayment(payment, params);
    } else if (payment.type === 'event_registration') {
      await completeEventPayment(payment);
    } else if (payment.type === 'player_inscription') {
      await completePlayerInscription(payment);
    } else if (payment.type === 'player_kit') {
      await completePlayerKitPurchase(payment);
    } else if (payment.type === 'paygold_custom') {
      await completePayGoldPayment(payment, params);
    } else if (payment.type === 'torneo_team_inscription') {
      await completeTorneoTeamInscriptionPayment(payment);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('redsys-notification:', err);
    return { statusCode: 500, body: 'Error' };
  }
};
