'use strict';

const {
  getRedsysConfig,
  getRedsysPublicConfig,
  normalizePayMethod,
  generateRedsysOrderId,
  buildRedirectForm,
  amountToCents
} = require('./lib/redsys');
const {
  savePendingPayment,
  upsertMemberRegistrationRecord,
  upsertPlayerInscriptionRecord
} = require('./lib/firestore-admin');
const { assertPublicActionsAllowed, isSiteUpdateModeError } = require('./lib/site-public-mode');

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

    await assertPublicActionsAllowed();

    const body = JSON.parse(event.body || '{}');
    const type = String(body.type || '').trim();
    const amountEur = Number(body.amountEur);
    const email = String(body.email || '').trim().toLowerCase();
    const description = String(body.description || 'Pago CD Sanabria CF').slice(0, 125);

    if (!['membership_fee', 'event_registration', 'player_inscription', 'player_kit', 'torneo_team_inscription'].includes(type)) {
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

    let memberId = body.memberId || null;
    let registrationBundle = body.registrationBundle || null;
    let playerId = body.playerId || null;
    let playerRegistration = body.playerRegistration || null;

    // Cuota socio: asegurar ficha en sanabria_members (pendiente) antes del TPV,
    // para que aparezca en Socios del panel aunque el pago se abandone después.
    if (type === 'membership_fee' && registrationBundle && registrationBundle.member) {
      try {
        const memberPayload = {
          ...registrationBundle.member,
          email: registrationBundle.member.email || email,
          status: registrationBundle.member.status || 'pending_validation',
          estado: registrationBundle.member.estado || 'pendiente',
          pagado: false,
          pendingReason: registrationBundle.member.pendingReason || 'nueva_alta',
          registrationSource: registrationBundle.member.registrationSource || 'web_modal_socio'
        };
        const saved = await upsertMemberRegistrationRecord(memberPayload);
        memberId = saved.id || memberId;
        registrationBundle = {
          ...registrationBundle,
          member: { ...memberPayload, ...saved, id: saved.id }
        };
      } catch (memberErr) {
        console.error('redsys-create-payment upsert socio:', memberErr);
        return {
          statusCode: 503,
          headers: CORS,
          body: JSON.stringify({
            ok: false,
            error: 'No se pudo registrar el socio en la nube antes del pago. Reintenta o contacta con el club.'
          })
        };
      }
    }

    // Inscripción jugador: ficha pendiente en nube antes del TPV (retomar pago si se abandona).
    if (type === 'player_inscription' && playerRegistration) {
      try {
        // Solo pendiente: nunca confiar en flags de pagado del cliente antes del cobro.
        const playerPayload = {
          ...playerRegistration,
          email: playerRegistration.email || email,
          inscriptionStatus: 'pending_payment',
          status: 'pending_validation',
          estado: 'pendiente',
          paymentStatus: 'pending',
          inscriptionPaid: false,
          pagado: false,
          paidAt: null,
          validatedDate: null,
          validatedBy: null,
          paymentMethod: 'gateway_pending',
          pendingReason: 'pasarela_pendiente',
          registrationSource: playerRegistration.registrationSource || 'web_inscription'
        };
        if (playerId && !String(playerId).startsWith('PENDING_') && !String(playerId).startsWith('PLAYER_')) {
          playerPayload.id = playerId;
        }
        const upserted = await upsertPlayerInscriptionRecord(playerPayload);
        const savedPlayer = upserted && upserted.player ? upserted.player : null;
        if (savedPlayer && savedPlayer.id) {
          playerId = savedPlayer.id;
          playerRegistration = {
            ...playerPayload,
            ...savedPlayer,
            id: savedPlayer.id,
            inscriptionStatus: 'pending_payment',
            status: 'pending_validation',
            estado: 'pendiente',
            paymentStatus: 'pending',
            inscriptionPaid: false,
            pagado: false,
            paymentMethod: 'gateway_pending',
            pendingReason: 'pasarela_pendiente'
          };
        }
      } catch (playerErr) {
        console.error('redsys-create-payment upsert jugador:', playerErr);
        return {
          statusCode: 503,
          headers: CORS,
          body: JSON.stringify({
            ok: false,
            error: 'No se pudo registrar la inscripción en la nube antes del pago. Reintenta o contacta con el club.'
          })
        };
      }
    }

    const paymentDoc = {
      type,
      payMethod,
      amountEur,
      amountCents: cents,
      customerEmail: email,
      description,
      memberId,
      eventId: body.eventId || null,
      participant: body.participant || null,
      guests: Array.isArray(body.guests) ? body.guests : [],
      registrationBundle,
      priceTier: body.priceTier || null,
      playerId,
      playerRegistration,
      playerKitOrder: body.playerKitOrder || null,
      torneoPreinscripcionId: body.torneoPreinscripcionId || body.preinscripcionId || null,
      teamName: body.teamName || null,
      eventName: body.eventName || null,
      accessCode: body.accessCode || null
    };

    try {
      await savePendingPayment(orderId, paymentDoc);
    } catch (e) {
      console.error('Firestore savePendingPayment:', e);
      return {
        statusCode: 503,
        headers: CORS,
        body: JSON.stringify({ ok: false, error: 'No se pudo registrar el pedido (nube)' })
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
    if (isSiteUpdateModeError(err)) {
      return {
        statusCode: 503,
        headers: CORS,
        body: JSON.stringify({ ok: false, error: err.message, code: 'site_update_mode' })
      };
    }
    console.error('redsys-create-payment:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: err.message || 'Error interno' })
    };
  }
};
