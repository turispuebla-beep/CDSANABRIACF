'use strict';

const {
  verifyTorneoEquipoAccess,
  saveTorneoCoach,
  createTorneoFichaInvite,
  prepareTorneoFinalize,
  finalizeTorneoPlantillaFree,
  getTorneoInscriptionFeeEur
} = require('./lib/torneo-equipo');
const { savePendingPayment } = require('./lib/firestore-admin');
const { getRedsysConfig, getRedsysPublicConfig, generateRedsysOrderId, buildRedirectForm, amountToCents } = require('./lib/redsys');

const CORS_BASE = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function corsHeaders(origin) {
  const allowed = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const site = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const list = allowed.length ? allowed : site ? [site] : [];
  const ok = !list.length || list.includes(origin);
  return {
    ...CORS_BASE,
    'Access-Control-Allow-Origin': ok ? origin || list[0] || '*' : 'null'
  };
}

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function authFields(body) {
  return {
    accessCode: body.accessCode || body.code,
    contactEmail: body.contactEmail || body.email
  };
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || 'panel').trim().toLowerCase();
    const { accessCode, contactEmail } = authFields(body);

    if (action === 'panel' || action === 'refresh') {
      const panel = await verifyTorneoEquipoAccess(accessCode, contactEmail);
      return json(200, { ok: true, panel }, origin);
    }

    if (action === 'save_coach') {
      const panel = await saveTorneoCoach(accessCode, contactEmail, body.coach || body);
      return json(200, { ok: true, panel }, origin);
    }

    if (action === 'invite_player') {
      const result = await createTorneoFichaInvite(accessCode, contactEmail, body.invite || body);
      return json(200, { ok: true, ...result }, origin);
    }

    if (action === 'finalize') {
      const { record, panel, fee } = await prepareTorneoFinalize(accessCode, contactEmail);

      if (fee <= 0) {
        await finalizeTorneoPlantillaFree(accessCode, contactEmail);
        const updated = await verifyTorneoEquipoAccess(accessCode, contactEmail);
        return json(200, { ok: true, panel: updated, paymentRequired: false }, origin);
      }

      const cfg = getRedsysConfig();
      if (!cfg.ok) {
        return json(503, { ok: false, error: 'Pago con tarjeta no disponible. Contacta con el club.' }, origin);
      }

      const orderId = generateRedsysOrderId();
      const description = `Inscripción torneo — ${record.teamName || 'Equipo'}`.slice(0, 125);
      const paymentDoc = {
        type: 'torneo_team_inscription',
        payMethod: 'card',
        amountEur: fee,
        amountCents: amountToCents(fee),
        customerEmail: String(record.contactEmail || contactEmail).trim().toLowerCase(),
        description,
        torneoPreinscripcionId: record.id,
        preinscripcionId: record.id,
        teamName: record.teamName,
        eventName: record.eventName,
        accessCode: record.accessCode
      };

      await savePendingPayment(orderId, paymentDoc);

      const merchantParams = {
        DS_MERCHANT_AMOUNT: String(amountToCents(fee)),
        DS_MERCHANT_ORDER: orderId,
        DS_MERCHANT_MERCHANTCODE: cfg.merchantCode,
        DS_MERCHANT_CURRENCY: '978',
        DS_MERCHANT_TRANSACTIONTYPE: '0',
        DS_MERCHANT_TERMINAL: cfg.terminal,
        DS_MERCHANT_MERCHANTURL: `${cfg.siteUrl}/.netlify/functions/redsys-notification`,
        DS_MERCHANT_URLOK: `${cfg.siteUrl}/pago-resultado.html?result=ok&order=${orderId}&context=torneo`,
        DS_MERCHANT_URLKO: `${cfg.siteUrl}/pago-resultado.html?result=ko&order=${orderId}&context=torneo`,
        DS_MERCHANT_PRODUCTDESCRIPTION: description,
        DS_MERCHANT_TITULAR: String(record.contactEmail || '').slice(0, 60),
        DS_MERCHANT_MERCHANTNAME: 'CD Sanabria CF'
      };

      const form = buildRedirectForm(cfg, merchantParams);
      const publicCfg = getRedsysPublicConfig();

      await require('./lib/firestore-admin')
        .torneoPreinscripcionesRef()
        .doc(record.id)
        .set(
          {
            plantillaStatus: 'pendiente_pago',
            pendingPaymentOrderId: orderId,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );

      return json(
        200,
        {
          ok: true,
          paymentRequired: true,
          amountEur: fee,
          orderId,
          redirect: form,
          cardEnabled: publicCfg.cardEnabled
        },
        origin
      );
    }

    return json(400, { ok: false, error: 'Acción no válida' }, origin);
  } catch (err) {
    console.warn('torneo-equipo-manage:', err.message || err);
    return json(400, { ok: false, error: err.message || 'Error' }, origin);
  }
};
