'use strict';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmailConfig() {
  const apiKey = String(process.env.SENDGRID_API_KEY || '').trim();
  const fromEmail = String(process.env.SENDGRID_FROM_EMAIL || '').trim();
  const fromName = String(process.env.SENDGRID_FROM_NAME || 'CD Sanabria CF').trim();
  const replyTo = String(process.env.CLUB_REPLY_EMAIL || fromEmail).trim();
  const notifyEmail = String(process.env.CLUB_NOTIFY_EMAIL || '').trim();
  if (!apiKey || !fromEmail) {
    return { ok: false, error: 'SENDGRID_API_KEY o SENDGRID_FROM_EMAIL no configurados' };
  }
  return { ok: true, apiKey, fromEmail, fromName, replyTo, notifyEmail };
}

async function sendViaSendGrid({ to, subject, html, text, bcc }) {
  const cfg = getEmailConfig();
  if (!cfg.ok) throw new Error(cfg.error);

  const toList = (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean)
    .map((email) => ({ email }));

  if (!toList.length) throw new Error('Destinatario vacío');

  const personalizations = [{ to: toList }];
  const bccList = (Array.isArray(bcc) ? bcc : bcc ? [bcc] : [])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean)
    .map((email) => ({ email }));
  if (bccList.length) personalizations[0].bcc = bccList;

  const body = {
    personalizations,
    from: { email: cfg.fromEmail, name: cfg.fromName },
    reply_to: { email: cfg.replyTo || cfg.fromEmail, name: cfg.fromName },
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

module.exports = {
  escapeHtml,
  getEmailConfig,
  sendViaSendGrid
};
