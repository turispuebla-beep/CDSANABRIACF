'use strict';

const { escapeHtml, getEmailConfig, sendViaSendGrid } = require('./club-email');

const CLUB_NAME = 'CD Sanabria CF';
const CLUB_CONTACT = 'cdsanabriafc@gmail.com';

function memberDisplayName(data) {
  const n = [data.nombre || data.name, data.apellidos || data.surname].filter(Boolean).join(' ').trim();
  return n || 'Socio/a';
}

function formatSocNum(raw) {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (s.startsWith('SOC')) return s; // provisional
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return s;
  return 'N.º SOC. ' + String(n).padStart(6, '0');
}

function buildRegistrationContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const numeroSocio = escapeHtml(formatSocNum(data.numeroSocio || data.memberNumber));
  const cuota = Number(data.cuota);
  const cuotaTxt = Number.isFinite(cuota) ? `${cuota.toFixed(2)} €` : '—';
  const nextStep = String(data.nextStep || 'transfer');
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');

  let pasosHtml;
  let pasosText;
  if (nextStep === 'card') {
    pasosHtml = `
      <p>Para activar tu alta, completa el pago de la cuota con tarjeta en la pasarela segura del banco.</p>
      ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}/pago-cuota-socio.html">Pagar cuota con tarjeta</a></p>` : ''}
      <p>Cuando el pago sea correcto, tu alta quedará <strong>activa al instante</strong>.</p>`;
    pasosText =
      'Completa el pago con tarjeta en la web del club. Cuando el pago sea correcto, tu alta quedará activa al instante.';
  } else {
    pasosHtml = `
      <p>Si vas a pagar por <strong>transferencia o efectivo</strong>, tienes <strong>7 días</strong> para ingresar la cuota.
      Un administrador validará tu alta al ver el pago en la cuenta del club.</p>`;
    pasosText =
      'Si pagas por transferencia o efectivo: tienes 7 días para ingresar la cuota; el club validará tu alta al ver el pago.';
  }

  const subject = `Registro recibido — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 12px">¡Hola, ${nombre}!</h2>
      <p>Tu registro como socio/a en <strong>${CLUB_NAME}</strong> se ha guardado correctamente.</p>
      <table style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%">
        <tr><td><strong>Nº socio:</strong></td><td>${numeroSocio}</td></tr>
        <tr><td><strong>Cuota:</strong></td><td>${escapeHtml(cuotaTxt)}</td></tr>
      </table>
      ${pasosHtml}
      <p>Ya puedes iniciar sesión en la web del club con el correo y la contraseña que elegiste.</p>
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${CLUB_CONTACT}">${CLUB_CONTACT}</a></p>
      <p style="font-size:0.85rem;color:#94a3b8">Este mensaje se envía automáticamente. No respondas a este correo si no es necesario.</p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu registro en ${CLUB_NAME} se ha guardado correctamente.\n` +
    `${formatSocNum(data.numeroSocio || data.memberNumber)}\n` +
    `Cuota: ${cuotaTxt}\n\n` +
    `${pasosText}\n\n` +
    `Consultas: ${CLUB_CONTACT}\n`;

  return { subject, html, text };
}

function buildPaymentConfirmedContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const numeroSocio = escapeHtml(formatSocNum(data.numeroSocio || data.memberNumber));
  const subject = `Alta activa — cuota pagada — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#059669;margin:0 0 12px">✅ Cuota pagada correctamente</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Hemos recibido el pago de tu cuota. Tu alta como socio/a en <strong>${CLUB_NAME}</strong> está <strong>activa</strong>.</p>
      <table style="background:#ecfdf5;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%">
        <tr><td><strong>Nº socio:</strong></td><td>${numeroSocio}</td></tr>
        <tr><td><strong>Estado:</strong></td><td>Activo/a</td></tr>
      </table>
      <p>Puedes iniciar sesión en la web del club cuando quieras.</p>
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${CLUB_CONTACT}">${CLUB_CONTACT}</a></p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu cuota ha sido pagada correctamente. Tu alta en ${CLUB_NAME} está ACTIVA.\n` +
    `${formatSocNum(data.numeroSocio || data.memberNumber)}\n\n` +
    `Consultas: ${CLUB_CONTACT}\n`;

  return { subject, html, text };
}

async function sendMemberRegistrationEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildRegistrationContent(data);
  const bcc = cfg.notifyEmail && cfg.notifyEmail !== email ? cfg.notifyEmail : undefined;
  await sendViaSendGrid({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    bcc
  });
  return { sent: true };
}

async function sendMemberPaymentConfirmedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildPaymentConfirmedContent(data);
  await sendViaSendGrid({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text
  });
  return { sent: true };
}

module.exports = {
  sendMemberRegistrationEmail,
  sendMemberPaymentConfirmedEmail
};
