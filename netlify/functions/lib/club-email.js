'use strict';

const nodemailer = require('nodemailer');

/** Buzón único del club (Gmail): web, modales, SMTP y avisos. */
const CLUB_EMAIL_DEFAULT = 'cdsanabriacf@gmail.com';
const CLUB_EMAIL_PUBLIC_DEFAULT = 'cdsanabriacf@gmail.com';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Proveedor de correo (prioridad):
 * 1) SMTP / Gmail — gratuito, ideal para pocos envíos del club
 * 2) SendGrid — si está configurado SENDGRID_API_KEY
 */
function getEmailConfig() {
  const notifyEmailRaw = String(process.env.CLUB_NOTIFY_EMAIL || '').trim();
  const fromNameDefault = String(process.env.SMTP_FROM_NAME || process.env.SENDGRID_FROM_NAME || 'CD Sanabria CF').trim();

  const smtpUser = String(process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').trim();
  if (smtpUser && smtpPass) {
    const fromEmail = String(process.env.SMTP_FROM_EMAIL || smtpUser).trim();
    const replyTo = String(process.env.CLUB_REPLY_EMAIL || fromEmail || CLUB_EMAIL_DEFAULT).trim();
    const notifyEmail = notifyEmailRaw || fromEmail || CLUB_EMAIL_DEFAULT;
    const smtpHost = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    return {
      ok: true,
      provider: 'smtp',
      smtpHost,
      smtpPort,
      smtpSecure: smtpPort === 465,
      smtpUser,
      smtpPass,
      fromEmail,
      fromName: fromNameDefault,
      replyTo,
      notifyEmail
    };
  }

  const apiKey = String(process.env.SENDGRID_API_KEY || '').trim();
  const fromEmail = String(process.env.SENDGRID_FROM_EMAIL || CLUB_EMAIL_DEFAULT).trim();
  const fromName = fromNameDefault;
  const replyTo = String(process.env.CLUB_REPLY_EMAIL || fromEmail || CLUB_EMAIL_DEFAULT).trim();
  const notifyEmail = notifyEmailRaw || fromEmail || CLUB_EMAIL_DEFAULT;
  if (apiKey && fromEmail) {
    return {
      ok: true,
      provider: 'sendgrid',
      apiKey,
      fromEmail,
      fromName,
      replyTo,
      notifyEmail
    };
  }

  return {
    ok: false,
    error:
      'Correo no configurado: define SMTP_USER + SMTP_PASS (Gmail) o SENDGRID_API_KEY + SENDGRID_FROM_EMAIL'
  };
}

function normalizeRecipients(to) {
  return (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
}

async function sendViaSmtp(cfg, { to, subject, html, text, bcc, replyTo }) {
  const toList = normalizeRecipients(to);
  if (!toList.length) throw new Error('Destinatario vacío');

  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: {
      user: cfg.smtpUser,
      pass: cfg.smtpPass
    }
  });

  const bccList = normalizeRecipients(bcc);
  const reply = String(replyTo || cfg.replyTo || cfg.fromEmail || CLUB_EMAIL_DEFAULT).trim();
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    replyTo: reply,
    to: toList.join(', '),
    bcc: bccList.length ? bccList.join(', ') : undefined,
    subject,
    text,
    html
  });
  return true;
}

async function sendViaSendGridApi(cfg, { to, subject, html, text, bcc, replyTo }) {
  const toList = normalizeRecipients(to).map((email) => ({ email }));
  if (!toList.length) throw new Error('Destinatario vacío');

  const personalizations = [{ to: toList }];
  const bccList = normalizeRecipients(bcc).map((email) => ({ email }));
  if (bccList.length) personalizations[0].bcc = bccList;

  const reply = String(replyTo || cfg.replyTo || cfg.fromEmail || CLUB_EMAIL_DEFAULT).trim();
  const body = {
    personalizations,
    from: { email: cfg.fromEmail, name: cfg.fromName },
    reply_to: { email: reply, name: cfg.fromName },
    subject,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html }
    ]
  };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SendGrid ${response.status}: ${details}`);
  }
  return true;
}

/** Envío unificado (Gmail SMTP o SendGrid). */
async function sendViaSendGrid(payload) {
  const cfg = getEmailConfig();
  if (!cfg.ok) throw new Error(cfg.error);
  if (cfg.provider === 'smtp') return sendViaSmtp(cfg, payload);
  return sendViaSendGridApi(cfg, payload);
}

module.exports = {
  CLUB_EMAIL_DEFAULT,
  CLUB_EMAIL_PUBLIC_DEFAULT,
  escapeHtml,
  getEmailConfig,
  sendViaSendGrid
};
