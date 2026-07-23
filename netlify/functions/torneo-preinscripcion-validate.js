'use strict';

const { verifyAdminRequest } = require('./lib/admin-auth');
const { torneoPreinscripcionesRef } = require('./lib/firestore-admin');
const {
  sendTorneoEquipoValidadoEmails,
  sendTorneoPagoValidadoEmails
} = require('./lib/member-email');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');

function canValidateEquipo(record) {
  if (record.equipoValidado) return false;
  const st = String(record.plantillaStatus || '').toLowerCase();
  return st === 'enviada_club' || st === 'pagada';
}

function canValidatePayment(record) {
  if (String(record.paymentStatus || '').toLowerCase() !== 'pending_validation') return false;
  const pm = String(record.paymentMethod || record.offlinePaymentChannel || '').toLowerCase();
  return pm === 'transferencia' || pm === 'efectivo';
}

function actorLabel(auth) {
  return String(auth.email || auth.uid || 'admin').trim();
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || '').trim().toLowerCase();
    const preinscripcionId = String(body.preinscripcionId || body.id || '').trim();
    if (!preinscripcionId) {
      return jsonResponse(400, { ok: false, error: 'preinscripcionId requerido' }, origin);
    }

    const ref = torneoPreinscripcionesRef().doc(preinscripcionId);
    const snap = await ref.get();
    if (!snap.exists) {
      return jsonResponse(404, { ok: false, error: 'Preinscripción no encontrada' }, origin);
    }
    const record = { id: snap.id, ...snap.data() };
    const now = new Date().toISOString();

    if (action === 'equipo') {
      const auth = await verifyAdminRequest(event);
      if (!auth.ok) {
        return jsonResponse(auth.statusCode || 401, { ok: false, error: auth.error }, origin);
      }
      if (!canValidateEquipo(record)) {
        return jsonResponse(
          400,
          { ok: false, error: 'Este equipo no puede validarse (plantilla no enviada o ya validado).' },
          origin
        );
      }
      const actor = actorLabel(auth);
      const patch = {
        equipoValidado: true,
        equipoValidadoAt: now,
        equipoValidadoPor: actor,
        updatedAt: now
      };
      await ref.set(patch, { merge: true });
      const merged = Object.assign({}, record, patch);
      let mail = { sent: false };
      try {
        mail = await sendTorneoEquipoValidadoEmails(merged);
      } catch (e) {
        console.warn('torneo-preinscripcion-validate equipo email:', e.message || e);
      }
      return jsonResponse(
        200,
        { ok: true, action: 'equipo', record: merged, emailSent: !!mail.sent },
        origin
      );
    }

    if (action === 'pago') {
      const auth = await verifyAdminRequest(event);
      if (!auth.ok) {
        return jsonResponse(auth.statusCode || 401, { ok: false, error: auth.error }, origin);
      }
      if (!canValidatePayment(record)) {
        return jsonResponse(
          400,
          { ok: false, error: 'No hay pago pendiente de validación (transferencia/efectivo).' },
          origin
        );
      }
      const actor = actorLabel(auth);
      const patch = {
        paymentStatus: 'paid',
        plantillaStatus: 'pagada',
        paymentValidatedAt: now,
        paymentValidatedPor: actor,
        updatedAt: now
      };
      await ref.set(patch, { merge: true });
      const merged = Object.assign({}, record, patch);
      let mail = { sent: false };
      try {
        mail = await sendTorneoPagoValidadoEmails(merged);
      } catch (e) {
        console.warn('torneo-preinscripcion-validate pago email:', e.message || e);
      }
      return jsonResponse(
        200,
        { ok: true, action: 'pago', record: merged, emailSent: !!mail.sent },
        origin
      );
    }

    return jsonResponse(400, { ok: false, error: 'Acción no válida (equipo | pago)' }, origin);
  } catch (err) {
    console.error('torneo-preinscripcion-validate:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
