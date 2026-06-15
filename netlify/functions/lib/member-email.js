'use strict';

const {
  escapeHtml,
  getEmailConfig,
  CLUB_EMAIL_PUBLIC_DEFAULT,
  sendDirectToMemberEmail
} = require('./club-email');

const CLUB_NAME = 'CD Sanabria CF';

function clubContactEmail() {
  const pub = String(process.env.CLUB_PUBLIC_EMAIL || '').trim();
  if (pub && pub.includes('@')) return pub;
  return CLUB_EMAIL_PUBLIC_DEFAULT;
}

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
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${escapeHtml(clubContactEmail())}">${escapeHtml(clubContactEmail())}</a></p>
      <p style="font-size:0.85rem;color:#94a3b8">Este mensaje se envía automáticamente. No respondas a este correo si no es necesario.</p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu registro en ${CLUB_NAME} se ha guardado correctamente.\n` +
    `${formatSocNum(data.numeroSocio || data.memberNumber)}\n` +
    `Cuota: ${cuotaTxt}\n\n` +
    `${pasosText}\n\n` +
    `Consultas: ${clubContactEmail()}\n`;

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
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${escapeHtml(clubContactEmail())}">${escapeHtml(clubContactEmail())}</a></p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu cuota ha sido pagada correctamente. Tu alta en ${CLUB_NAME} está ACTIVA.\n` +
    `${formatSocNum(data.numeroSocio || data.memberNumber)}\n\n` +
    `Consultas: ${clubContactEmail()}\n`;

  return { subject, html, text };
}

async function sendMemberRegistrationEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildRegistrationContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

function buildPlayerApplicationApprovedContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const season = escapeHtml(String(data.season || '').trim() || '—');
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const inscripcionUrl = siteUrl
    ? `${escapeHtml(siteUrl)}/inscripcion-jugador.html?flow=finalize`
    : '';
  const contact = escapeHtml(clubContactEmail());

  const subject = `Solicitud aceptada — puedes completar la inscripción — ${CLUB_NAME}`;
  const linkBlock = inscripcionUrl
    ? `<p><a href="${inscripcionUrl}" style="font-weight:700;color:#1d4ed8;">Completar inscripción (ropa y pago)</a></p>`
    : '<p>Entra en la web del club → <strong>Inscripción jugador/a</strong> → <strong>Ya soy jugador/a</strong>.</p>';
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#059669;margin:0 0 12px">✅ Solicitud aceptada</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>El <strong>${CLUB_NAME}</strong> ha revisado tu solicitud para la temporada <strong>${season}</strong> y puedes continuar con la inscripción oficial.</p>
      ${linkBlock}
      <p>Allí completarás tallas de ropa, cuotas y forma de pago. Accede con tu <strong>DNI</strong> y la <strong>contraseña</strong> que elegiste al enviar la solicitud (si la olvidas, puedes recuperarla por email desde la misma página).</p>
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${contact}">${contact}</a></p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu solicitud en ${CLUB_NAME} (temporada ${data.season || ''}) ha sido ACEPTADA.\n` +
    `Completa la inscripción en la web: Inscripción jugador/a → Ya soy jugador/a.\n` +
    `Accede con tu DNI y la contraseña que elegiste al solicitar el alta.\n` +
    (siteUrl ? `${siteUrl}/inscripcion-jugador.html?flow=finalize\n\n` : '') +
    `Consultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

function resolvePlayerNotifyEmail(data) {
  const main = String(data.email || '').trim().toLowerCase();
  if (main.includes('@')) return main;
  const guardian = String(data.guardianEmail || '').trim().toLowerCase();
  if (guardian.includes('@')) return guardian;
  return '';
}

async function sendPlayerApplicationApprovedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = resolvePlayerNotifyEmail(data);
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildPlayerApplicationApprovedContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

async function sendMemberPaymentConfirmedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildPaymentConfirmedContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

function buildPlayerPortalResetContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const token = encodeURIComponent(String(data.token || ''));
  const resetUrl = siteUrl
    ? `${escapeHtml(siteUrl)}/inscripcion-jugador.html?flow=finalize&portalReset=${token}`
    : '';
  const contact = escapeHtml(clubContactEmail());
  const subject = `Restablecer contraseña de ficha — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 12px">🔑 Restablecer contraseña</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Has solicitado restablecer la contraseña de acceso a tu ficha de jugador/a en <strong>${CLUB_NAME}</strong>.</p>
      ${
        resetUrl
          ? `<p><a href="${resetUrl}" style="font-weight:700;color:#1d4ed8;">Elegir nueva contraseña</a></p>
             <p style="font-size:0.9rem;color:#64748b">El enlace caduca en aproximadamente 1 hora. Si no has sido tú, ignora este mensaje.</p>`
          : '<p>Entra en la web del club → Nuevo jugador/a → Finalizar ficha → Recuperar contraseña.</p>'
      }
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${contact}">${contact}</a></p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Restablece la contraseña de tu ficha en ${CLUB_NAME}.\n` +
    (siteUrl ? `${siteUrl}/inscripcion-jugador.html?flow=finalize&portalReset=${data.token}\n\n` : '') +
    `El enlace caduca en aproximadamente 1 hora.\n` +
    `Consultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

const CLUB_BANK_ACCOUNT = 'CAJA RURAL ES12 3085 0034 8222 5127 9226';

function formatEventPaymentLabel(channel) {
  const c = String(channel || '').trim().toLowerCase();
  if (c === 'transferencia' || c === 'transfer' || c === 'pending_transfer' || c === 'transfer_manual')
    return 'Transferencia bancaria';
  if (c === 'efectivo' || c === 'cash' || c === 'cash_manual') return 'Efectivo en el club';
  if (c === 'tpv' || c === 'pending_tpv') return 'TPV (datáfono en el club)';
  if (c === 'bizum' || c === 'redsys_bizum') return 'Bizum';
  if (c === 'tarjeta' || c === 'card' || c === 'redsys_card' || c === 'redsys_caja_rural') return 'Tarjeta';
  if (c === 'gratuito' || c === 'free') return 'Gratuito';
  if (c) return c;
  return '—';
}

function formatEventWhen(data) {
  const parts = [];
  const d = data.eventDate || data.date;
  if (d) {
    try {
      parts.push(new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    } catch (_) {
      parts.push(String(d));
    }
  }
  const t = data.eventTime || data.time;
  if (t) parts.push(String(t));
  const loc = data.eventLocation || data.location;
  if (loc) parts.push(String(loc));
  return parts.join(' · ') || '—';
}

function formatEurAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Gratuito';
  return n.toFixed(2) + ' €';
}

function buildEventRegistrationPendingContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const eventTitle = escapeHtml(String(data.eventTitle || data.title || 'Evento').trim());
  const when = escapeHtml(formatEventWhen(data));
  const total = escapeHtml(formatEurAmount(data.totalEur));
  const slots = escapeHtml(String(data.slots != null ? data.slots : 1));
  const guests = escapeHtml(String(data.guestCount != null ? data.guestCount : 0));
  const contact = escapeHtml(clubContactEmail());
  const bank = escapeHtml(CLUB_BANK_ACCOUNT);
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');

  const subject = `Inscripción a evento registrada — pendiente de pago — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 12px">📋 Inscripción registrada</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Tu inscripción al evento <strong>${eventTitle}</strong> del <strong>${CLUB_NAME}</strong> ha quedado registrada correctamente.</p>
      <table style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%">
        <tr><td><strong>Evento:</strong></td><td>${eventTitle}</td></tr>
        <tr><td><strong>Cuándo / dónde:</strong></td><td>${when}</td></tr>
        <tr><td><strong>Plazas:</strong></td><td>${slots} (invitados: ${guests})</td></tr>
        <tr><td><strong>Importe:</strong></td><td>${total}</td></tr>
        <tr><td><strong>Estado del pago:</strong></td><td>Pendiente de validación</td></tr>
      </table>
      <p>Realiza el ingreso por <strong>transferencia o efectivo</strong> en el club. Cuenta del club:</p>
      <p style="background:#eff6ff;padding:10px 12px;border-radius:8px;font-family:monospace;font-size:0.95rem">${bank}</p>
      <p>El club validará tu pago y confirmará tu plaza.</p>
      ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}" style="font-weight:700;color:#1d4ed8;">Ver la web del club</a></p>` : ''}
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${contact}">${contact}</a></p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu inscripción al evento "${data.eventTitle || 'Evento'}" ha quedado registrada.\n` +
    `Cuándo/dónde: ${formatEventWhen(data)}\n` +
    `Plazas: ${data.slots != null ? data.slots : 1} (invitados: ${data.guestCount != null ? data.guestCount : 0})\n` +
    `Importe: ${formatEurAmount(data.totalEur)}\n` +
    `Estado: pendiente de pago (transferencia o efectivo).\n` +
    `Cuenta: ${CLUB_BANK_ACCOUNT}\n\n` +
    `Consultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

function buildEventRegistrationConfirmedContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const eventTitle = escapeHtml(String(data.eventTitle || data.title || 'Evento').trim());
  const when = escapeHtml(formatEventWhen(data));
  const total = escapeHtml(formatEurAmount(data.totalEur));
  const slots = escapeHtml(String(data.slots != null ? data.slots : 1));
  const guests = escapeHtml(String(data.guestCount != null ? data.guestCount : 0));
  const payLabel = escapeHtml(formatEventPaymentLabel(data.paymentChannel || data.paymentMethod));
  const contact = escapeHtml(clubContactEmail());
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');

  const subject = `Inscripción a evento confirmada — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#059669;margin:0 0 12px">✅ Inscripción confirmada</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Tu inscripción al evento <strong>${eventTitle}</strong> está <strong>confirmada</strong>.</p>
      <table style="background:#ecfdf5;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%">
        <tr><td><strong>Evento:</strong></td><td>${eventTitle}</td></tr>
        <tr><td><strong>Cuándo / dónde:</strong></td><td>${when}</td></tr>
        <tr><td><strong>Plazas:</strong></td><td>${slots} (invitados: ${guests})</td></tr>
        <tr><td><strong>Importe:</strong></td><td>${total}</td></tr>
        <tr><td><strong>Pago:</strong></td><td>${payLabel} — correcto</td></tr>
      </table>
      <p>¡Te esperamos en el evento!</p>
      ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}" style="font-weight:700;color:#1d4ed8;">Web del club</a></p>` : ''}
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${contact}">${contact}</a></p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu inscripción al evento "${data.eventTitle || 'Evento'}" está CONFIRMADA.\n` +
    `Cuándo/dónde: ${formatEventWhen(data)}\n` +
    `Plazas: ${data.slots != null ? data.slots : 1} (invitados: ${data.guestCount != null ? data.guestCount : 0})\n` +
    `Importe: ${formatEurAmount(data.totalEur)}\n` +
    `Pago: ${formatEventPaymentLabel(data.paymentChannel || data.paymentMethod)} — correcto\n\n` +
    `Consultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

async function sendEventRegistrationPendingEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.email || '').trim().toLowerCase();
  if (!email.includes('@')) return { sent: false, reason: 'email vacío' };
  const content = buildEventRegistrationPendingContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

function formatTorneoCategoryList(data) {
  const labels = Array.isArray(data.categoryLabels) ? data.categoryLabels : [];
  if (labels.length) return labels.join(', ');
  const ids = Array.isArray(data.categories) ? data.categories : [];
  return ids.join(', ') || '—';
}

function buildTorneoPreinscripcionConfirmedContent(data) {
  const nombre = escapeHtml(String(data.contactName || '').trim() || 'Contacto');
  const eventName = escapeHtml(String(data.eventName || 'Torneo Fútbol 7 — 2026').trim());
  const teamName = escapeHtml(String(data.teamName || '').trim());
  const town = escapeHtml(String(data.town || '').trim());
  const cats = escapeHtml(formatTorneoCategoryList(data));
  const players = escapeHtml(String(data.playerCount != null ? data.playerCount : '—'));
  const contact = escapeHtml(clubContactEmail());
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');

  const subject = `Preinscripción registrada — ${data.eventName || 'Torneo'} — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 12px">🏆 Preinscripción registrada</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Hemos recibido la preinscripción de tu equipo para <strong>${eventName}</strong> del <strong>${CLUB_NAME}</strong>.</p>
      <table style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%">
        <tr><td><strong>Equipo:</strong></td><td>${teamName}</td></tr>
        <tr><td><strong>Población:</strong></td><td>${town}</td></tr>
        <tr><td><strong>Categorías:</strong></td><td>${cats}</td></tr>
        <tr><td><strong>Jugadores (aprox.):</strong></td><td>${players}</td></tr>
      </table>
      <p>Esta es una <strong>preinscripción</strong>. Más adelante el club solicitará los datos completos de los integrantes del equipo.</p>
      ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}" style="font-weight:700;color:#1d4ed8;">Web del club</a></p>` : ''}
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${contact}">${contact}</a></p>
    </div>`;
  const text =
    `Hola, ${String(data.contactName || '').trim() || 'Contacto'}.\n\n` +
    `Preinscripción registrada para ${data.eventName || 'Torneo'}.\n` +
    `Equipo: ${data.teamName || ''}\n` +
    `Población: ${data.town || ''}\n` +
    `Categorías: ${formatTorneoCategoryList(data)}\n` +
    `Jugadores (aprox.): ${data.playerCount != null ? data.playerCount : '—'}\n\n` +
    `Más adelante pediremos la ficha de cada jugador.\n` +
    `Consultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

async function sendTorneoPreinscripcionConfirmedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.contactEmail || data.email || '').trim().toLowerCase();
  if (!email.includes('@')) return { sent: false, reason: 'email vacío' };
  const content = buildTorneoPreinscripcionConfirmedContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

async function sendEventRegistrationConfirmedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.email || '').trim().toLowerCase();
  if (!email.includes('@')) return { sent: false, reason: 'email vacío' };
  const content = buildEventRegistrationConfirmedContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

function buildPlayerProfileUpdateConfirmedContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const diff = Array.isArray(data.diff) ? data.diff : [];
  const rows = diff.length
    ? diff
        .map(function (c) {
          return (
            '<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top"><strong>' +
            escapeHtml(c.label || '') +
            '</strong></td><td style="padding:6px 0">' +
            escapeHtml(String(c.before || '—')) +
            ' → <strong>' +
            escapeHtml(String(c.after || '—')) +
            '</strong></td></tr>'
          );
        })
        .join('')
    : '<tr><td colspan="2" style="padding:8px 0;color:#64748b">Datos actualizados correctamente.</td></tr>';
  const subject = `Actualización de ficha recibida — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 12px">Ficha actualizada</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Hemos recibido los cambios en tu ficha de jugador/a del <strong>${CLUB_NAME}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;padding:8px 12px">
        ${rows}
      </table>
      <p style="font-size:0.9rem;color:#64748b">Si no has sido tú, contacta con el club de inmediato.</p>
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${escapeHtml(clubContactEmail())}">${escapeHtml(clubContactEmail())}</a></p>
    </div>`;
  const textLines = [
    `Hola, ${memberDisplayName(data)}.`,
    '',
    `Hemos recibido los cambios en tu ficha de jugador/a del ${CLUB_NAME}.`,
    ''
  ];
  diff.forEach(function (c) {
    textLines.push((c.label || 'Campo') + ': ' + (c.before || '—') + ' → ' + (c.after || '—'));
  });
  textLines.push('', 'Si no has sido tú, contacta con el club.', 'Consultas: ' + clubContactEmail());
  return { subject, html, text: textLines.join('\n') };
}

async function sendPlayerProfileUpdateConfirmedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = resolvePlayerNotifyEmail(data);
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildPlayerProfileUpdateConfirmedContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

function offlineInscriptionPaymentHint(channel) {
  const c = String(channel || '').trim().toLowerCase();
  if (c === 'efectivo' || c === 'cash' || c === 'cash_manual') {
    return 'Realiza el pago en <strong>efectivo</strong> en el club. Un administrador validará tu inscripción al recibirlo.';
  }
  if (c === 'tpv' || c === 'pending_tpv') {
    return 'Realiza el pago con <strong>TPV (datáfono)</strong> en el club. Un administrador validará tu inscripción.';
  }
  return (
    'Realiza el ingreso por <strong>transferencia bancaria</strong> a la cuenta del club. ' +
    'Un administrador validará tu inscripción al ver el pago.'
  );
}

function offlineInscriptionPaymentHintText(channel) {
  const c = String(channel || '').trim().toLowerCase();
  if (c === 'efectivo' || c === 'cash' || c === 'cash_manual') {
    return 'Realiza el pago en efectivo en el club. Un administrador validará tu inscripción al recibirlo.';
  }
  if (c === 'tpv' || c === 'pending_tpv') {
    return 'Realiza el pago con TPV (datáfono) en el club. Un administrador validará tu inscripción.';
  }
  return 'Realiza el ingreso por transferencia bancaria a la cuenta del club. Un administrador validará tu inscripción al ver el pago.';
}

function normalizeNotifyFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && f.label)
    .map((f) => ({
      label: String(f.label).trim(),
      value: f.value == null || f.value === '' ? '—' : String(f.value)
    }));
}

function notifyFieldsHtmlRows(fields) {
  return normalizeNotifyFields(fields)
    .map(
      (f) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap"><strong>${escapeHtml(f.label)}</strong></td><td style="padding:6px 0;color:#1e293b">${escapeHtml(f.value)}</td></tr>`
    )
    .join('');
}

function notifyFieldsTextLines(fields) {
  return normalizeNotifyFields(fields)
    .map((f) => `${f.label}: ${f.value}`)
    .join('\n');
}

function buildPlayerInscriptionPendingContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const season = escapeHtml(String(data.season || data.inscriptionSeason || '').trim() || '—');
  const category = escapeHtml(String(data.category || data.categoria || '—').trim());
  const total = escapeHtml(formatEurAmount(data.totalEur));
  const payLabel = escapeHtml(formatEventPaymentLabel(data.paymentChannel || data.paymentMethod));
  const kitSummary = escapeHtml(String(data.kitSummary || '').trim());
  const contact = escapeHtml(clubContactEmail());
  const bank = escapeHtml(CLUB_BANK_ACCOUNT);
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const ch = String(data.paymentChannel || data.paymentMethod || '').trim().toLowerCase();
  const showBank =
    ch === 'transferencia' || ch === 'transfer' || ch === 'pending_transfer' || !ch || ch === 'transfer_manual';
  const payHint = offlineInscriptionPaymentHint(data.paymentChannel || data.paymentMethod);
  const extraFields = normalizeNotifyFields(data.fields);
  const hasExtraFields = extraFields.length > 0;
  const summaryRows = hasExtraFields
    ? notifyFieldsHtmlRows(extraFields)
    : `<tr><td><strong>Temporada:</strong></td><td>${season}</td></tr>
        <tr><td><strong>Categoría:</strong></td><td>${category}</td></tr>
        <tr><td><strong>Importe:</strong></td><td>${total}</td></tr>
        <tr><td><strong>Forma de pago:</strong></td><td>${payLabel}</td></tr>
        <tr><td><strong>Estado:</strong></td><td>Pendiente de validación</td></tr>
        ${kitSummary && kitSummary !== '—' ? `<tr><td style="vertical-align:top"><strong>Ropa (tallas):</strong></td><td>${kitSummary}</td></tr>` : ''}`;

  const subject = `Inscripción registrada — pendiente de pago — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 12px">📋 Inscripción registrada</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Tu inscripción como jugador/a en <strong>${CLUB_NAME}</strong> ha quedado registrada correctamente.</p>
      <table style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%">
        ${hasExtraFields ? `<tr><td colspan="2" style="padding:0 0 8px;font-weight:700;color:#1e3a8a">Datos de la inscripción</td></tr>` : ''}
        ${summaryRows}
        ${hasExtraFields ? `<tr><td><strong>Forma de pago:</strong></td><td>${payLabel}</td></tr><tr><td><strong>Estado:</strong></td><td>Pendiente de validación</td></tr>` : ''}
      </table>
      <p>${payHint}</p>
      <p>Tienes <strong>7 días</strong> para completar el pago. El club validará tu ficha al confirmar el ingreso.</p>
      ${
        showBank
          ? `<p style="background:#eff6ff;padding:10px 12px;border-radius:8px;font-family:monospace;font-size:0.95rem">Cuenta del club: ${bank}</p>`
          : ''
      }
      ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}/inscripcion-jugador.html?flow=lookup" style="font-weight:700;color:#1d4ed8;">Consultar mi ficha</a></p>` : ''}
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${contact}">${contact}</a></p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu inscripción en ${CLUB_NAME} ha quedado registrada.\n` +
    (hasExtraFields
      ? `${notifyFieldsTextLines(extraFields)}\nForma de pago: ${formatEventPaymentLabel(data.paymentChannel || data.paymentMethod)}\nEstado: pendiente de validación.\n`
      : `Temporada: ${data.season || data.inscriptionSeason || '—'}\n` +
        `Categoría: ${data.category || data.categoria || '—'}\n` +
        `Importe: ${formatEurAmount(data.totalEur)}\n` +
        `Forma de pago: ${formatEventPaymentLabel(data.paymentChannel || data.paymentMethod)}\n` +
        `Estado: pendiente de validación.\n` +
        (data.kitSummary && String(data.kitSummary).trim() && String(data.kitSummary).trim() !== '—'
          ? `Ropa (tallas): ${String(data.kitSummary).trim()}\n`
          : '')) +
    `\n${offlineInscriptionPaymentHintText(data.paymentChannel || data.paymentMethod)}\n` +
    `Tienes 7 días para completar el pago.\n` +
    (showBank ? `Cuenta del club: ${CLUB_BANK_ACCOUNT}\n` : '') +
    `\nConsultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

async function sendPlayerInscriptionPendingEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = resolvePlayerNotifyEmail(data);
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildPlayerInscriptionPendingContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

function buildPlayerInscriptionPaymentConfirmedContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const season = escapeHtml(String(data.season || data.inscriptionSeason || '').trim() || '—');
  const category = escapeHtml(String(data.category || data.categoria || '—').trim());
  const total = escapeHtml(formatEurAmount(data.totalEur));
  const payLabel = escapeHtml(formatEventPaymentLabel(data.paymentChannel || data.paymentMethod));
  const kitSummary = escapeHtml(String(data.kitSummary || '').trim());
  const contact = escapeHtml(clubContactEmail());
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const extraFields = normalizeNotifyFields(data.fields);
  const hasExtraFields = extraFields.length > 0;
  const summaryRows = hasExtraFields
    ? notifyFieldsHtmlRows(extraFields)
    : `<tr><td><strong>Temporada:</strong></td><td>${season}</td></tr>
        <tr><td><strong>Categoría:</strong></td><td>${category}</td></tr>
        <tr><td><strong>Importe:</strong></td><td>${total}</td></tr>
        <tr><td><strong>Pago:</strong></td><td>${payLabel} — correcto</td></tr>
        ${kitSummary && kitSummary !== '—' ? `<tr><td style="vertical-align:top"><strong>Ropa (tallas):</strong></td><td>${kitSummary}</td></tr>` : ''}`;

  const subject = `Inscripción pagada — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#059669;margin:0 0 12px">✅ Inscripción pagada correctamente</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Hemos recibido el pago de tu inscripción como jugador/a en <strong>${CLUB_NAME}</strong>.</p>
      <table style="background:#ecfdf5;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%">
        ${hasExtraFields ? `<tr><td colspan="2" style="padding:0 0 8px;font-weight:700;color:#059669">Datos de la inscripción</td></tr>` : ''}
        ${summaryRows}
        ${hasExtraFields ? `<tr><td><strong>Pago:</strong></td><td>${payLabel} — correcto</td></tr>` : ''}
      </table>
      <p>Tu ficha queda registrada con el pago confirmado.</p>
      ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}/inscripcion-jugador.html" style="font-weight:700;color:#1d4ed8;">Ver inscripción jugador/a</a></p>` : ''}
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${contact}">${contact}</a></p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu inscripción en ${CLUB_NAME} está PAGADA y confirmada.\n` +
    (hasExtraFields
      ? `${notifyFieldsTextLines(extraFields)}\nPago: ${formatEventPaymentLabel(data.paymentChannel || data.paymentMethod)} — correcto\n`
      : `Temporada: ${data.season || data.inscriptionSeason || '—'}\n` +
        `Categoría: ${data.category || data.categoria || '—'}\n` +
        `Importe: ${formatEurAmount(data.totalEur)}\n` +
        `Pago: ${formatEventPaymentLabel(data.paymentChannel || data.paymentMethod)} — correcto\n` +
        (data.kitSummary && String(data.kitSummary).trim() && String(data.kitSummary).trim() !== '—'
          ? `Ropa (tallas): ${String(data.kitSummary).trim()}\n`
          : '')) +
    `\nConsultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

function buildPlayerKitPurchaseConfirmedContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const season = escapeHtml(String(data.season || '').trim() || '—');
  const category = escapeHtml(String(data.category || data.categoria || '—').trim());
  const total = escapeHtml(formatEurAmount(data.totalEur));
  const payLabel = escapeHtml(formatEventPaymentLabel(data.paymentChannel || data.paymentMethod));
  const kitSummary = escapeHtml(String(data.kitSummary || '').trim());
  const contact = escapeHtml(clubContactEmail());

  const subject = `Equipación pagada — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#059669;margin:0 0 12px">✅ Equipación pagada correctamente</h2>
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Hemos recibido el pago de tu <strong>equipación</strong> en <strong>${CLUB_NAME}</strong>.</p>
      <table style="background:#ecfdf5;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%">
        <tr><td><strong>Temporada:</strong></td><td>${season}</td></tr>
        <tr><td><strong>Categoría:</strong></td><td>${category}</td></tr>
        <tr><td><strong>Importe ropa:</strong></td><td>${total}</td></tr>
        <tr><td><strong>Pago:</strong></td><td>${payLabel} — correcto</td></tr>
        ${kitSummary && kitSummary !== '—' ? `<tr><td style="vertical-align:top"><strong>Tallas pedidas:</strong></td><td>${kitSummary}</td></tr>` : ''}
      </table>
      <p>El club preparará tu pedido. Si tienes dudas, escríbenos.</p>
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${contact}">${contact}</a></p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu compra de equipación en ${CLUB_NAME} está PAGADA y confirmada.\n` +
    `Temporada: ${data.season || '—'}\n` +
    `Categoría: ${data.category || data.categoria || '—'}\n` +
    `Importe: ${formatEurAmount(data.totalEur)}\n` +
    `Pago: ${formatEventPaymentLabel(data.paymentChannel || data.paymentMethod)} — correcto\n` +
    (data.kitSummary && String(data.kitSummary).trim() && String(data.kitSummary).trim() !== '—'
      ? `Tallas pedidas: ${String(data.kitSummary).trim()}\n`
      : '') +
    `\nConsultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

async function sendPlayerKitPurchaseConfirmedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = resolvePlayerNotifyEmail(data);
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildPlayerKitPurchaseConfirmedContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

async function sendPlayerInscriptionPaymentConfirmedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = resolvePlayerNotifyEmail(data);
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildPlayerInscriptionPaymentConfirmedContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

async function sendPlayerPortalResetEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = resolvePlayerNotifyEmail(data);
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildPlayerPortalResetContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

function paymentTypeLabel(type) {
  const map = {
    membership_fee: 'cuota de socio/a',
    player_inscription: 'inscripción de jugador/a',
    player_kit: 'compra de equipación',
    event_registration: 'inscripción al evento'
  };
  return map[String(type || '').trim()] || 'pago en la web del club';
}

function buildPaymentFailedContent(data) {
  const concept = paymentTypeLabel(data.type);
  const amount = Number(data.amountEur);
  const amountTxt = Number.isFinite(amount) ? `${amount.toFixed(2)} €` : null;
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const subject = `Pago no completado — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#dc2626;margin:0 0 12px">Pago no completado</h2>
      <p>Hola:</p>
      <p>El banco <strong>no ha confirmado</strong> el pago de tu <strong>${escapeHtml(concept)}</strong>${amountTxt ? ` (${escapeHtml(amountTxt)})` : ''}.</p>
      <p><strong>No se ha registrado ningún dato</strong> en el club por este intento. Puedes volver a la web e intentarlo de nuevo cuando quieras.</p>
      ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}">Volver a la web del club</a></p>` : ''}
      <p style="font-size:0.9rem;color:#64748b">Si crees que es un error o necesitas ayuda: <a href="mailto:${escapeHtml(clubContactEmail())}">${escapeHtml(clubContactEmail())}</a></p>
    </div>`;
  const text =
    `Pago no completado — ${CLUB_NAME}\n\n` +
    `El banco no ha confirmado el pago de tu ${concept}${amountTxt ? ' (' + amountTxt + ')' : ''}.\n\n` +
    `No se ha registrado ningún dato en el club por este intento.\n\n` +
    `Consultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

async function sendPaymentFailedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.email || data.customerEmail || '').trim().toLowerCase();
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildPaymentFailedContent(data);
  try {
    const result = await sendDirectToMemberEmail({
      memberEmail: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: clubContactEmail()
    });
    return { sent: true, to: result.to, bcc: result.bcc };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

module.exports = {
  sendMemberRegistrationEmail,
  sendMemberPaymentConfirmedEmail,
  sendPlayerInscriptionPendingEmail,
  sendPlayerInscriptionPaymentConfirmedEmail,
  sendPlayerKitPurchaseConfirmedEmail,
  sendPlayerApplicationApprovedEmail,
  sendPlayerPortalResetEmail,
  sendPlayerProfileUpdateConfirmedEmail,
  sendEventRegistrationPendingEmail,
  sendEventRegistrationConfirmedEmail,
  sendTorneoPreinscripcionConfirmedEmail,
  sendPaymentFailedEmail
};
