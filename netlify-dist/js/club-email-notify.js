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
      friendNumber: opts.friendNumber || opts.numeroAmigo
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

  global.CdsanClubEmail = {
    sendMemberRegistered: sendMemberRegistered,
    sendClubAdminNotify: sendClubAdminNotify,
    sendEventRegistrationPending: sendEventRegistrationPending,
    sendEventRegistrationConfirmed: sendEventRegistrationConfirmed
  };
})(typeof window !== 'undefined' ? window : globalThis);
