'use strict';

const { getEmailConfig } = require('./lib/club-email');
const {
  sendMemberRegistrationEmail,
  sendMemberPaymentConfirmedEmail,
  sendFriendRegistrationEmail,
  sendPlayerApplicationApprovedEmail,
  sendPlayerProfileUpdateConfirmedEmail,
  sendPlayerInscriptionPendingEmail,
  sendPlayerInscriptionPaymentConfirmedEmail,
  sendEventRegistrationPendingEmail,
  sendEventRegistrationConfirmedEmail
} = require('./lib/member-email');
const { sendClubAdminNotification } = require('./lib/club-admin-notify-email');
const { memberExistsForEmail, friendExistsForEmail, clubRecordExistsForNotify } = require('./lib/firestore-admin');
const { verifyAdminRequest } = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');

const NOTIFY_KINDS_SKIP_RECORD_CHECK = new Set([
  'colaborador_publicidad',
  'registro_socio',
  'registro_amigo'
]);

const ADMIN_ONLY_TYPES = new Set([
  'member_validated_manual',
  'player_application_approved',
  'player_profile_update_confirmed'
]);

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
    const body = JSON.parse(event.body || '{}');
    const type = String(body.type || '').trim();

    if (ADMIN_ONLY_TYPES.has(type)) {
      const auth = await verifyAdminRequest(event);
      if (!auth.ok) {
        return jsonResponse(auth.statusCode || 401, { ok: false, error: auth.error }, origin);
      }
    }

    const email = String(body.requesterEmail || body.email || '').trim().toLowerCase();

    if (type === 'club_admin_notify') {
      if (!email || !email.includes('@')) {
        return jsonResponse(400, { ok: false, error: 'email del solicitante inválido' }, origin);
      }
      const kind = String(body.kind || '').trim();
      if (!NOTIFY_KINDS_SKIP_RECORD_CHECK.has(kind)) {
        const known = await clubRecordExistsForNotify(body);
        if (!known) {
          return jsonResponse(404, { ok: false, error: 'No hay registro del club para este aviso' }, origin);
        }
      }
      const result = await sendClubAdminNotification({
        kind: body.kind,
        title: body.title,
        subject: body.subject,
        paymentChannel: body.paymentChannel || body.paymentMethod,
        paymentMethod: body.paymentMethod || body.paymentChannel,
        fields: body.fields,
        userAttachments: body.attachments,
        requesterEmail: email,
        email: body.email || email,
        playerId: body.playerId,
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
      return jsonResponse(200, { ok: true, sent: result.sent }, origin);
    }

    if (!email || !email.includes('@')) {
      return jsonResponse(400, { ok: false, error: 'email inválido' }, origin);
    }

    if (type === 'member_registered') {
      // No bloquear el correo si la ficha aún no está indexada: el aviso debe salir
      // con cualquier método de pago (tarjeta / transferencia / efectivo / TPV).
      const exists = await memberExistsForEmail(email, body.memberId);
      if (!exists) {
        console.warn('member_registered: socio aún no en nube, se envía correo igual:', email);
      }
      const nextStep = body.nextStep === 'card' ? 'card' : 'transfer';
      const result = await sendMemberRegistrationEmail({
        email,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        numeroSocio: body.numeroSocio || body.memberNumber,
        cuota: body.cuota,
        nextStep
      });
      return jsonResponse(200, { ok: true, sent: result.sent }, origin);
    }

    if (type === 'friend_registered') {
      const exists = await friendExistsForEmail(email, body.friendId);
      if (!exists) {
        return jsonResponse(404, { ok: false, error: 'Amigo/a no encontrado/a' }, origin);
      }
      const result = await sendFriendRegistrationEmail({
        email,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        numeroAmigo: body.numeroAmigo || body.friendNumber,
        friendNumber: body.friendNumber || body.numeroAmigo
      });
      return jsonResponse(200, { ok: true, sent: result.sent }, origin);
    }

    if (type === 'member_validated_manual') {
      const exists = await memberExistsForEmail(email, body.memberId);
      if (!exists) {
        return jsonResponse(404, { ok: false, error: 'Socio no encontrado' }, origin);
      }
      const result = await sendMemberPaymentConfirmedEmail({
        email,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        numeroSocio: body.numeroSocio || body.memberNumber
      });
      return jsonResponse(200, { ok: true, sent: result.sent }, origin);
    }

    if (type === 'player_application_approved') {
      const result = await sendPlayerApplicationApprovedEmail({
        email,
        guardianEmail: body.guardianEmail,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        season: body.season
      });
      return jsonResponse(
        200,
        { ok: true, sent: result.sent, to: result.to || email, error: result.reason || '' },
        origin
      );
    }

    if (type === 'player_profile_update_confirmed') {
      const result = await sendPlayerProfileUpdateConfirmedEmail({
        email,
        guardianEmail: body.guardianEmail,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        diff: body.diff
      });
      return jsonResponse(
        200,
        { ok: true, sent: result.sent, to: result.to || email, error: result.reason || '' },
        origin
      );
    }

    if (type === 'player_inscription_pending') {
      const known = await clubRecordExistsForNotify(body);
      if (!known) {
        return jsonResponse(404, { ok: false, error: 'No hay registro del jugador/a para este aviso' }, origin);
      }
      const result = await sendPlayerInscriptionPendingEmail({
        email,
        guardianEmail: body.guardianEmail,
        dni: body.dni,
        playerId: body.playerId,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        season: body.season || body.inscriptionSeason,
        inscriptionSeason: body.inscriptionSeason || body.season,
        category: body.category || body.categoria,
        categoria: body.categoria || body.category,
        totalEur: body.totalEur,
        paymentChannel: body.paymentChannel || body.paymentMethod,
        paymentMethod: body.paymentMethod || body.paymentChannel,
        kitSummary: body.kitSummary,
        fields: body.fields
      });
      return jsonResponse(
        200,
        { ok: true, sent: result.sent, to: result.to || email, error: result.reason || '' },
        origin
      );
    }

    if (type === 'player_inscription_payment_confirmed') {
      const known = await clubRecordExistsForNotify(body);
      if (!known) {
        return jsonResponse(404, { ok: false, error: 'No hay registro del jugador/a para este aviso' }, origin);
      }
      const result = await sendPlayerInscriptionPaymentConfirmedEmail({
        email,
        guardianEmail: body.guardianEmail,
        dni: body.dni,
        playerId: body.playerId,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        season: body.season || body.inscriptionSeason,
        inscriptionSeason: body.inscriptionSeason || body.season,
        category: body.category || body.categoria,
        categoria: body.categoria || body.category,
        totalEur: body.totalEur,
        paymentChannel: body.paymentChannel || body.paymentMethod,
        paymentMethod: body.paymentMethod || body.paymentChannel,
        kitSummary: body.kitSummary,
        fields: body.fields
      });
      return jsonResponse(
        200,
        { ok: true, sent: result.sent, to: result.to || email, error: result.reason || '' },
        origin
      );
    }

    if (type === 'event_registration_pending' || type === 'event_registration_confirmed') {
      const title = String(body.eventTitle || body.title || '').trim();
      if (!title) {
        return jsonResponse(400, { ok: false, error: 'eventTitle requerido' }, origin);
      }
      if (type === 'event_registration_pending') {
        const result = await sendEventRegistrationPendingEmail({
          email,
          nombre: body.nombre || body.name,
          apellidos: body.apellidos || body.surname,
          eventTitle: title,
          eventDate: body.eventDate || body.date,
          eventTime: body.eventTime || body.time,
          eventLocation: body.eventLocation || body.location,
          totalEur: body.totalEur,
          slots: body.slots,
          guestCount: body.guestCount
        });
        return jsonResponse(
          200,
          { ok: true, sent: result.sent, to: result.to || email, error: result.reason || '' },
          origin
        );
      }
      const result = await sendEventRegistrationConfirmedEmail({
        email,
        nombre: body.nombre || body.name,
        apellidos: body.apellidos || body.surname,
        eventTitle: title,
        eventDate: body.eventDate || body.date,
        eventTime: body.eventTime || body.time,
        eventLocation: body.eventLocation || body.location,
        totalEur: body.totalEur,
        slots: body.slots,
        guestCount: body.guestCount,
        paymentChannel: body.paymentChannel || body.paymentMethod
      });
      return jsonResponse(
        200,
        { ok: true, sent: result.sent, to: result.to || email, error: result.reason || '' },
        origin
      );
    }

    return jsonResponse(400, { ok: false, error: 'type no válido' }, origin);
  } catch (err) {
    console.error('send-club-email:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
