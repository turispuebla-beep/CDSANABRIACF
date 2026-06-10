'use strict';

const { getEmailConfig } = require('./lib/club-email');
const {
  sendMemberRegistrationEmail,
  sendMemberPaymentConfirmedEmail,
  sendPlayerApplicationApprovedEmail,
  sendEventRegistrationPendingEmail,
  sendEventRegistrationConfirmedEmail
} = require('./lib/member-email');
const { sendClubAdminNotification } = require('./lib/club-admin-notify-email');
const { memberExistsForEmail } = require('./lib/firestore-admin');

const MEMBER_TYPES = new Set(['member_registered', 'member_validated_manual']);

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

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  const cfg = getEmailConfig();
  if (!cfg.ok) {
    return json(503, { ok: false, error: 'Correo no configurado en el servidor' }, origin);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const type = String(body.type || '').trim();

    const email = String(body.requesterEmail || body.email || '').trim().toLowerCase();

    if (type === 'club_admin_notify') {
      if (!email || !email.includes('@')) {
        return json(400, { ok: false, error: 'email del solicitante inválido' }, origin);
      }
      const result = await sendClubAdminNotification({
        kind: body.kind,
        title: body.title,
        subject: body.subject,
        paymentChannel: body.paymentChannel || body.paymentMethod,
        paymentMethod: body.paymentMethod || body.paymentChannel,
        fields: body.fields,
        requesterEmail: email,
        email: body.email || email,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        dni: body.dni,
        sexo: body.sexo,
        fechaNacimiento: body.fechaNacimiento || body.birthDate,
        direccion: body.direccion || body.address || body.domicilio,
        localidad: body.localidad,
        provincia: body.provincia,
        codigoPostal: body.codigoPostal || body.postalCode || body.cp,
        telefono: body.telefono || body.phone,
        phone: body.phone || body.telefono,
        numeroSocio: body.numeroSocio || body.memberNumber,
        memberNumber: body.memberNumber || body.numeroSocio,
        numeroAmigo: body.numeroAmigo || body.friendNumber,
        friendNumber: body.friendNumber || body.numeroAmigo
      });
      return json(200, { ok: true, sent: result.sent }, origin);
    }

    if (!email || !email.includes('@')) {
      return json(400, { ok: false, error: 'email inválido' }, origin);
    }

    if (MEMBER_TYPES.has(type)) {
      const exists = await memberExistsForEmail(email, body.memberId);
      if (!exists) {
        return json(404, { ok: false, error: 'Socio no encontrado' }, origin);
      }
    }

    if (type === 'player_application_approved') {
      const result = await sendPlayerApplicationApprovedEmail({
        email,
        guardianEmail: body.guardianEmail,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        season: body.season
      });
      return json(
        200,
        { ok: true, sent: result.sent, to: result.to || email, error: result.reason || '' },
        origin
      );
    }

    if (type === 'member_registered') {
      const nextStep = body.nextStep === 'card' ? 'card' : 'transfer';
      const result = await sendMemberRegistrationEmail({
        email,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        numeroSocio: body.numeroSocio || body.memberNumber,
        cuota: body.cuota,
        nextStep
      });
      return json(200, { ok: true, sent: result.sent }, origin);
    }

    if (type === 'member_validated_manual') {
      const result = await sendMemberPaymentConfirmedEmail({
        email,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        numeroSocio: body.numeroSocio || body.memberNumber
      });
      return json(200, { ok: true, sent: result.sent }, origin);
    }

    if (type === 'event_registration_pending') {
      const result = await sendEventRegistrationPendingEmail({
        email,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        eventTitle: body.eventTitle || body.title,
        eventDate: body.eventDate || body.date,
        eventTime: body.eventTime || body.time,
        eventLocation: body.eventLocation || body.location,
        totalEur: body.totalEur,
        slots: body.slots,
        guestCount: body.guestCount
      });
      return json(
        200,
        { ok: true, sent: result.sent, to: result.to || email, error: result.reason || '' },
        origin
      );
    }

    if (type === 'event_registration_confirmed') {
      const result = await sendEventRegistrationConfirmedEmail({
        email,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        eventTitle: body.eventTitle || body.title,
        eventDate: body.eventDate || body.date,
        eventTime: body.eventTime || body.time,
        eventLocation: body.eventLocation || body.location,
        totalEur: body.totalEur,
        slots: body.slots,
        guestCount: body.guestCount,
        paymentChannel: body.paymentChannel || body.paymentMethod
      });
      return json(
        200,
        { ok: true, sent: result.sent, to: result.to || email, error: result.reason || '' },
        origin
      );
    }

    return json(400, { ok: false, error: 'type no válido' }, origin);
  } catch (err) {
    console.error('send-club-email:', err);
    return json(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
