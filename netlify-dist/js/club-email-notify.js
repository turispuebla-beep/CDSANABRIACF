/**
 * Avisos por correo del club (SendGrid vía Netlify).
 * No bloquea el registro si falla el envío.
 */
(function (global) {
  'use strict';

  const API = '/.netlify/functions/send-club-email';

  function isLocalFile() {
    return global.location && global.location.protocol === 'file:';
  }

  async function post(payload) {
    if (isLocalFile()) return { ok: false, skipped: 'file' };
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('club-email:', data.error || res.status);
      return { ok: false, ...data };
    }
    return data;
  }

  /** Correo tras registro guardado (pendiente pago o transferencia). */
  function sendMemberRegistered(opts) {
    return post({
      type: 'member_registered',
      email: opts.email,
      memberId: opts.memberId,
      nombre: opts.nombre,
      apellidos: opts.apellidos,
      numeroSocio: opts.numeroSocio,
      cuota: opts.cuota,
      nextStep: opts.nextStep === 'card' ? 'card' : 'transfer'
    });
  }

  /** Aviso estructurado al club (transferencia, efectivo, pago pasarela, etc.). */
  function sendClubAdminNotify(opts) {
    return post({
      type: 'club_admin_notify',
      kind: opts.kind,
      title: opts.title,
      subject: opts.subject,
      paymentChannel: opts.paymentChannel,
      paymentMethod: opts.paymentMethod,
    fields: opts.fields,
    attachments: opts.attachments,
    requesterEmail: opts.requesterEmail,
      email: opts.email || opts.requesterEmail,
      nombre: opts.nombre || opts.name,
      apellidos: opts.apellidos || opts.surname,
      dni: opts.dni,
      sexo: opts.sexo,
      fechaNacimiento: opts.fechaNacimiento || opts.birthDate,
      direccion: opts.direccion || opts.address || opts.domicilio,
      localidad: opts.localidad,
      provincia: opts.provincia,
      codigoPostal: opts.codigoPostal || opts.postalCode || opts.cp,
      telefono: opts.telefono || opts.phone,
      phone: opts.phone || opts.telefono,
      numeroSocio: opts.numeroSocio || opts.memberNumber,
      memberNumber: opts.memberNumber || opts.numeroSocio,
      numeroAmigo: opts.numeroAmigo || opts.friendNumber,
      friendNumber: opts.friendNumber || opts.numeroAmigo,
      playerId: opts.playerId
    });
  }

  /** Confirmación al inscrito: evento registrado (pendiente transferencia/efectivo). */
  function sendEventRegistrationPending(opts) {
    return post({
      type: 'event_registration_pending',
      email: opts.email,
      nombre: opts.nombre || opts.name,
      apellidos: opts.apellidos || opts.surname,
      eventTitle: opts.eventTitle || opts.title,
      eventDate: opts.eventDate || opts.date,
      eventTime: opts.eventTime || opts.time,
      eventLocation: opts.eventLocation || opts.location,
      totalEur: opts.totalEur,
      slots: opts.slots,
      guestCount: opts.guestCount
    });
  }

  /** Confirmación al inscrito: evento confirmado (gratuito o pago OK). */
  function sendEventRegistrationConfirmed(opts) {
    return post({
      type: 'event_registration_confirmed',
      email: opts.email,
      nombre: opts.nombre || opts.name,
      apellidos: opts.apellidos || opts.surname,
      eventTitle: opts.eventTitle || opts.title,
      eventDate: opts.eventDate || opts.date,
      eventTime: opts.eventTime || opts.time,
      eventLocation: opts.eventLocation || opts.location,
      totalEur: opts.totalEur,
      slots: opts.slots,
      guestCount: opts.guestCount,
      paymentChannel: opts.paymentChannel || opts.paymentMethod
    });
  }

  /** Confirmación al jugador/a: inscripción registrada (pendiente transferencia/efectivo/TPV). */
  function sendPlayerInscriptionPending(opts) {
    return post({
      type: 'player_inscription_pending',
      email: opts.email,
      requesterEmail: opts.email,
      guardianEmail: opts.guardianEmail,
      dni: opts.dni,
      nombre: opts.nombre || opts.name,
      apellidos: opts.apellidos || opts.surname,
      season: opts.season || opts.inscriptionSeason,
      inscriptionSeason: opts.inscriptionSeason || opts.season,
      category: opts.category || opts.categoria,
      categoria: opts.categoria || opts.category,
      totalEur: opts.totalEur,
      paymentChannel: opts.paymentChannel || opts.paymentMethod,
      paymentMethod: opts.paymentMethod || opts.paymentChannel,
      fields: opts.fields,
      playerId: opts.playerId,
      kitSummary: opts.kitSummary
    });
  }
  function sendPlayerInscriptionPaymentConfirmed(opts) {
    return post({
      type: 'player_inscription_payment_confirmed',
      email: opts.email,
      requesterEmail: opts.email,
      guardianEmail: opts.guardianEmail,
      dni: opts.dni,
      playerId: opts.playerId,
      nombre: opts.nombre || opts.name,
      apellidos: opts.apellidos || opts.surname,
      season: opts.season || opts.inscriptionSeason,
      inscriptionSeason: opts.inscriptionSeason || opts.season,
      category: opts.category || opts.categoria,
      categoria: opts.categoria || opts.category,
      totalEur: opts.totalEur,
      paymentChannel: opts.paymentChannel || opts.paymentMethod,
      paymentMethod: opts.paymentMethod || opts.paymentChannel,
      kitSummary: opts.kitSummary,
      fields: opts.fields
    });
  }

  /** Correo al amigo/a tras registro guardado en Firebase. */
  function sendFriendRegistered(opts) {
    return post({
      type: 'friend_registered',
      email: opts.email,
      friendId: opts.friendId,
      nombre: opts.nombre,
      apellidos: opts.apellidos,
      numeroAmigo: opts.numeroAmigo || opts.friendNumber,
      friendNumber: opts.friendNumber || opts.numeroAmigo
    });
  }

  global.CdsanClubEmail = {
    sendMemberRegistered: sendMemberRegistered,
    sendFriendRegistered: sendFriendRegistered,
    sendClubAdminNotify: sendClubAdminNotify,
    sendEventRegistrationPending: sendEventRegistrationPending,
    sendEventRegistrationConfirmed: sendEventRegistrationConfirmed,
    sendPlayerInscriptionPending: sendPlayerInscriptionPending,
    sendPlayerInscriptionPaymentConfirmed: sendPlayerInscriptionPaymentConfirmed
  };
})(typeof window !== 'undefined' ? window : globalThis);
