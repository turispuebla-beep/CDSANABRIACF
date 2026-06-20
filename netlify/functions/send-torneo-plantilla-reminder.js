'use strict';

const { getEmailConfig } = require('./lib/club-email');
const { sendTorneoPlantillaReminderEmail } = require('./lib/member-email');
const { ensureFirebaseAdmin, isClubAdminOrOrganizerDoc } = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');

function bearerToken(event) {
  const authHeader =
    (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function verifyAdminOrOrganizerRequest(event) {
  const token = bearerToken(event);
  if (!token) {
    return { ok: false, statusCode: 401, error: 'Se requiere sesión de administrador (Bearer token)' };
  }
  try {
    const adm = ensureFirebaseAdmin();
    const decoded = await adm.auth().verifyIdToken(token);
    const snap = await adm.firestore().collection('sanabria_admins').doc(decoded.uid).get();
    if (!snap.exists || !isClubAdminOrOrganizerDoc(snap.data())) {
      return { ok: false, statusCode: 403, error: 'Sin permisos de administrador u organizador' };
    }
    return { ok: true, uid: decoded.uid, email: decoded.email || snap.data().email || '' };
  } catch (e) {
    console.warn('verifyAdminOrOrganizerRequest:', e.message || e);
    return { ok: false, statusCode: 401, error: 'Token inválido o caducado' };
  }
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  const cfg = getEmailConfig();
  if (!cfg.ok) {
    return jsonResponse(503, { ok: false, error: 'Correo no configurado en el servidor' }, origin);
  }

  try {
    const auth = await verifyAdminOrOrganizerRequest(event);
    if (!auth.ok) {
      return jsonResponse(auth.statusCode || 401, { ok: false, error: auth.error }, origin);
    }

    const body = JSON.parse(event.body || '{}');
    const contactEmail = String(body.contactEmail || '').trim().toLowerCase();
    if (!contactEmail.includes('@')) {
      return jsonResponse(400, { ok: false, error: 'Email de contacto inválido' }, origin);
    }

    const result = await sendTorneoPlantillaReminderEmail({
      contactEmail: contactEmail,
      contactName: body.contactName,
      contactPhone: body.contactPhone,
      responsibleCode: body.responsibleCode,
      panelUrl: body.panelUrl,
      entries: Array.isArray(body.entries) ? body.entries : []
    });

    return jsonResponse(
      200,
      { ok: true, sent: !!result.sent, reason: result.reason || null, to: result.to || contactEmail },
      origin
    );
  } catch (err) {
    console.error('send-torneo-plantilla-reminder:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
