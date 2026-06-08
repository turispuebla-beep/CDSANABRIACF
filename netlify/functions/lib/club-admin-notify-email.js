'use strict';

const { escapeHtml, getEmailConfig, sendViaSendGrid, CLUB_EMAIL_DEFAULT } = require('./club-email');

const CLUB_NAME = 'CD Sanabria CF';

function clubNotifyRecipient(cfg) {
  const notify = String(process.env.CLUB_NOTIFY_EMAIL || '').trim();
  if (notify && notify.includes('@')) return notify;
  return (
    String(process.env.CLUB_REPLY_EMAIL || '').trim() ||
    String(process.env.SMTP_FROM_EMAIL || '').trim() ||
    String(process.env.SENDGRID_FROM_EMAIL || '').trim() ||
    CLUB_EMAIL_DEFAULT
  );
}

function formatPaymentLabel(channel) {
  const c = String(channel || '').trim().toLowerCase();
  if (c === 'transferencia' || c === 'transfer' || c === 'pending_transfer') return 'Transferencia bancaria';
  if (c === 'efectivo' || c === 'cash' || c === 'cash_manual') return 'Efectivo';
  if (c === 'tpv' || c === 'pending_tpv') return 'TPV (datáfono en el club)';
  if (c === 'bizum' || c === 'redsys_bizum') return 'Bizum';
  if (c === 'tarjeta' || c === 'card' || c === 'redsys_card' || c === 'redsys_caja_rural') return 'Tarjeta';
  if (c === 'gateway_pending' || c === 'pasarela') return 'Pasarela (pendiente de pago)';
  if (c) return c;
  return '—';
}

function normalizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && f.label)
    .map((f) => ({
      label: String(f.label).trim(),
      value: f.value == null || f.value === '' ? '—' : String(f.value)
    }));
}

function buildClubAdminContent(data) {
  const title = escapeHtml(String(data.title || data.kind || 'Aviso web').trim());
  const kind = escapeHtml(String(data.kind || 'registro').trim());
  const paymentLabel = escapeHtml(formatPaymentLabel(data.paymentChannel || data.paymentMethod));
  const fields = normalizeFields(data.fields);
  const requester = String(data.requesterEmail || '').trim();

  const rows = fields
    .map(
      (f) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap"><strong>${escapeHtml(f.label)}</strong></td><td style="padding:6px 0;color:#1e293b">${escapeHtml(f.value)}</td></tr>`
    )
    .join('');

  const subject = `[${CLUB_NAME}] ${String(data.subject || data.title || 'Nuevo aviso').trim()}`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 8px">${title}</h2>
      <p style="margin:0 0 16px;font-size:0.9rem;color:#64748b">Tipo: ${kind} · ${new Date().toLocaleString('es-ES')}</p>
      <table style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:0 0 16px;width:100%">
        <tr><td style="padding:4px 12px 4px 0;color:#1e40af"><strong>Forma de pago elegida</strong></td><td style="padding:4px 0;font-weight:700;color:#1e3a8a">${paymentLabel}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
        ${rows}
      </table>
      ${requester ? `<p style="font-size:0.9rem">Correo del solicitante: <a href="mailto:${escapeHtml(requester)}">${escapeHtml(requester)}</a></p>` : ''}
      <p style="font-size:0.85rem;color:#94a3b8">Mensaje automático desde la web del club.</p>
    </div>`;

  const textLines = [
    title,
    'Tipo: ' + String(data.kind || ''),
    'Forma de pago: ' + formatPaymentLabel(data.paymentChannel || data.paymentMethod),
    ''
  ];
  fields.forEach((f) => {
    textLines.push(f.label + ': ' + f.value);
  });
  if (requester) textLines.push('', 'Correo solicitante: ' + requester);
  textLines.push('', 'Fecha: ' + new Date().toLocaleString('es-ES'));

  return { subject, html, text: textLines.join('\n') };
}

async function sendClubAdminNotification(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };

  const to = clubNotifyRecipient(cfg);
  const content = buildClubAdminContent(data);
  const requester = String(data.requesterEmail || '').trim();
  const replyTo = requester && requester.includes('@') ? requester : cfg.replyTo || cfg.fromEmail;

  await sendViaSendGrid({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    replyTo
  });

  return { sent: true, to };
}

module.exports = {
  formatPaymentLabel,
  sendClubAdminNotification
};
