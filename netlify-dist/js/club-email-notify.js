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

  global.CdsanClubEmail = {
    sendMemberRegistered
  };
})(typeof window !== 'undefined' ? window : globalThis);
