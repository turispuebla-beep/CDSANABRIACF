'use strict';

const {
  verifyTorneoEquipoAccess,
  saveTorneoCoach,
  createTorneoFichaInvite,
  saveTorneoPlantillaBatch,
  uploadTorneoFichaDocuments,
  prepareTorneoFinalize,
  finalizeTorneoPlantillaFree,
  finalizeTorneoPlantillaOffline,
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
    const login = authFields(body);
    const accessCode = body.activeAccessCode || body.code || login.accessCode;
    const contactEmail = login.contactEmail;

    if (action === 'panel' || action === 'refresh') {
      const panel = await verifyTorneoEquipoAccess(login.accessCode, contactEmail, accessCode);
      return json(200, { ok: true, panel }, origin);
    }

    if (action === 'save_coach') {
      const panel = await saveTorneoCoach(login.accessCode, contactEmail, body.coach || body, accessCode);
      return json(200, { ok: true, panel }, origin);
    }

    if (action === 'invite_player') {
      const result = await createTorneoFichaInvite(login.accessCode, contactEmail, body.invite || body, accessCode);
      return json(200, { ok: true, ...result }, origin);
    }

    if (action === 'save_roster_batch') {
      const panel = await saveTorneoPlantillaBatch(
        login.accessCode,
        contactEmail,
        body.players || body.roster,
        accessCode
      );
      return json(200, { ok: true, panel }, origin);
    }

    if (action === 'upload_ficha_documents') {
      const panel = await uploadTorneoFichaDocuments(
        login.accessCode,
        contactEmail,
        body.fichaId || body.playerId,
        body.documents,
        accessCode
      );
      return json(200, { ok: true, panel }, origin);
    }

    if (action === 'finalize') {
      if (!body.inscripcionPremiosAceptados) {
        return json(
          400,
          { ok: false, error: 'Debes leer y aceptar los términos sobre premios.' },
          origin
        );
      }
      const payMethod = String(body.payMethod || 'card')
        .trim()
        .toLowerCase();
      const offlineMethods = ['transferencia', 'efectivo'];
      const nowIso = new Date().toISOString();

      if (payMethod === 'gratis') {
        return json(
          400,
          { ok: false, error: 'Debes elegir una forma de pago para finalizar la inscripción.' },
          origin
        );
      }
      if (payMethod === 'tpv') {
        return json(
          400,
          {
            ok: false,
            error: 'Para el torneo solo está disponible tarjeta, transferencia o efectivo.'
          },
          origin
        );
      }

      const { record, panel, fee, unpaidRecords, unpaidPanels } = await prepareTorneoFinalize(
        accessCode,
        contactEmail
      );

      if (fee <= 0) {
        return json(
          400,
          { ok: false, error: 'Cuota de inscripción no configurada. Contacta con el club.' },
          origin
        );
      }

      const activeCode = body.activeAccessCode || accessCode;

      if (offlineMethods.includes(payMethod)) {
        const updatedPanel = await finalizeTorneoPlantillaOffline(
          accessCode,
          contactEmail,
          {
            payMethod: payMethod,
            inscripcionPremiosAceptados: true,
            inscripcionPremiosAceptadosAt: nowIso
          },
          activeCode
        );
        return json(
          200,
          { ok: true, panel: updatedPanel, offlinePayment: payMethod },
          origin
        );
      }

      const unpaidIds = unpaidRecords.map(function (r) {
        return r.id;
      });
      const { recordInscripcionPremiosAcceptance } = require('./lib/torneo-equipo');
      await recordInscripcionPremiosAcceptance(unpaidIds);

      const cfg = getRedsysConfig();
      if (!cfg.ok) {
        return json(503, { ok: false, error: 'Pago con tarjeta no disponible. Contacta con el club.' }, origin);
      }

      const onlineMethod = payMethod === 'bizum' ? 'bizum' : 'card';
      if (onlineMethod !== 'card') {
        return json(
          400,
          { ok: false, error: 'Por ahora solo está disponible el pago con tarjeta online.' },
          origin
        );
      }
      const publicCfg = getRedsysPublicConfig();

      const orderId = generateRedsysOrderId();
      const teamLabels = unpaidPanels
        .map(function (p) {
          return p.teamName || 'Equipo';
        })
        .join(' + ');
      const description = `Inscripción torneo — ${teamLabels}`.slice(0, 125);
      const paymentDoc = {
        type: 'torneo_team_inscription',
        payMethod: onlineMethod,
        amountEur: fee,
        amountCents: amountToCents(fee),
        customerEmail: String(record.contactEmail || contactEmail).trim().toLowerCase(),
        description,
        torneoPreinscripcionId: record.id,
        torneoPreinscripcionIds: unpaidIds,
        preinscripcionId: record.id,
        teamName: teamLabels,
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

      if (onlineMethod === 'bizum') {
        merchantParams.DS_MERCHANT_PAYMETHODS = 'z';
      }

      const form = buildRedirectForm(cfg, merchantParams);

      const preRef = require('./lib/firestore-admin').torneoPreinscripcionesRef();
      const now = new Date().toISOString();
      for (let i = 0; i < unpaidIds.length; i++) {
        await preRef.doc(unpaidIds[i]).set(
          {
            plantillaStatus: 'pendiente_pago',
            pendingPaymentOrderId: orderId,
            updatedAt: now
          },
          { merge: true }
        );
      }

      return json(
        200,
        {
          ok: true,
          paymentRequired: true,
          amountEur: fee,
          orderId,
          redirect: form,
          cardEnabled: publicCfg.cardEnabled,
          teamCount: unpaidIds.length
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
