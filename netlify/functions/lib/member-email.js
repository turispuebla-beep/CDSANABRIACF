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
      <p>Has elegido pagar con <strong>tarjeta</strong>. Completa el pago en la pasarela segura del banco.</p>
      <p>Cuando el pago sea correcto, tu alta quedará <strong>activa al instante</strong> con tu número de socio y acceso al carnet.</p>`;
    pasosText =
      'Has elegido tarjeta. Al confirmar el pago en el banco, tu alta quedará activa al instante con número de socio y carnet.';
  } else {
    pasosHtml = `
      <p>Has elegido pagar por <strong>transferencia, efectivo o TPV en el club</strong>. Tienes <strong>7 días</strong> para abonar la cuota.
      Serás socio/a de pleno derecho cuando un administrador del club compruebe el pago.</p>
      <p>Cuenta del club: <strong>CAJA RURAL ES12 3085 0034 8222 5127 9226</strong></p>`;
    pasosText =
      'Has elegido transferencia, efectivo o TPV. Tienes 7 días para abonar la cuota; el club te dará de alta al comprobar el pago.';
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

function formatAmigNum(raw) {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (/^AMIG/i.test(s)) return s;
  const n = parseInt(s, 10);
  if (Number.isFinite(n)) return 'N.º AMIG. ' + String(n).padStart(6, '0');
  return s;
}

function buildFriendRegistrationContent(data) {
  const nombre = escapeHtml(memberDisplayName(data));
  const numeroAmigo = escapeHtml(formatAmigNum(data.numeroAmigo || data.friendNumber));
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const subject = `Registro amigo/a confirmado — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 12px">¡Hola, ${nombre}!</h2>
      <p>Tu registro como <strong>amigo/a del club</strong> en <strong>${CLUB_NAME}</strong> se ha guardado correctamente.</p>
      <table style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%">
        <tr><td><strong>Nº amigo/a:</strong></td><td>${numeroAmigo}</td></tr>
        <tr><td><strong>Estado:</strong></td><td>Activo/a (gratuito)</td></tr>
      </table>
      <p>Ya puedes iniciar sesión en la web del club con tu correo y contraseña para acceder a competiciones y encuentros.</p>
      ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}/">Entrar en la web del club</a></p>` : ''}
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${escapeHtml(clubContactEmail())}">${escapeHtml(clubContactEmail())}</a></p>
      <p style="font-size:0.85rem;color:#94a3b8">Este mensaje se envía automáticamente. No respondas a este correo si no es necesario.</p>
    </div>`;
  const text =
    `Hola, ${memberDisplayName(data)}.\n\n` +
    `Tu registro como amigo/a del club en ${CLUB_NAME} se ha guardado correctamente.\n` +
    `${formatAmigNum(data.numeroAmigo || data.friendNumber)}\n` +
    `Estado: Activo/a (gratuito)\n\n` +
    `Puedes iniciar sesión en la web del club con tu correo y contraseña.\n` +
    (siteUrl ? `${siteUrl}/\n\n` : '') +
    `Consultas: ${clubContactEmail()}\n`;
  return { subject, html, text };
}

async function sendFriendRegistrationEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return { sent: false, reason: 'email vacío' };
  const content = buildFriendRegistrationContent(data);
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

function buildFriendClubNotifyFields(saved) {
  return [
    { label: 'Notificaciones push', value: saved.notificaciones ? 'Sí' : 'No' },
    { label: 'Estado', value: 'Activo (gratuito)' },
    { label: 'Origen registro', value: saved.registrationSource || 'web' },
    { label: 'ID registro', value: saved.id || '—' }
  ];
}

/** Correo al amigo/a y aviso al club tras alta en Firebase. */
async function notifyFriendRegistrationEmails(saved) {
  const row = saved && typeof saved === 'object' ? saved : {};
  const nombre = row.nombre || row.name || '';
  const apellidos = row.apellidos || row.surname || '';
  const email = String(row.email || '').trim().toLowerCase();
  if (!email) return { friend: { sent: false }, club: { sent: false } };

  const friendResult = await sendFriendRegistrationEmail({
    email,
    nombre,
    apellidos,
    numeroAmigo: row.numeroAmigo || row.friendNumber,
    friendNumber: row.friendNumber || row.numeroAmigo
  });

  let clubResult = { sent: false };
  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    clubResult = await sendClubAdminNotification({
      kind: 'registro_amigo',
      title: 'Nuevo registro de amigo/a',
      subject: 'Registro amigo/a — ' + nombre + ' ' + apellidos,
      paymentChannel: 'gratuito',
      requesterEmail: email,
      email,
      nombre,
      apellidos,
      dni: row.dni,
      telefono: row.telefono || row.phone,
      numeroAmigo: row.numeroAmigo || row.friendNumber,
      friendNumber: row.friendNumber || row.numeroAmigo,
      fields: buildFriendClubNotifyFields(row)
    });
  } catch (err) {
    clubResult = { sent: false, reason: err.message || String(err) };
  }

  return { friend: friendResult, club: clubResult };
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
  if (
    c === 'tarjeta' ||
    c === 'card' ||
    c === 'redsys_card' ||
    c === 'redsys_caja_rural' ||
    c === 'gateway_pending' ||
    c === 'pasarela_pendiente' ||
    c === 'pasarela'
  ) {
    return 'Tarjeta';
  }
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

const { getTorneoFeeForRecord, formatTorneoFeeEur, torneoPricingTableHtml, torneoPricingPlainText } = require('./torneo-pricing');

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
  const feeEst =
    data.estimatedFeeEur != null
      ? Number(data.estimatedFeeEur)
      : getTorneoFeeForRecord(data);
  const feeLabel = feeEst > 0 ? formatTorneoFeeEur(feeEst) : '—';
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
        <tr><td><strong>Cuota estimada:</strong></td><td>${escapeHtml(feeLabel)} (informativo)</td></tr>
      </table>
      <p style="margin:12px 0 8px;font-weight:700;color:#713f12;font-size:0.9rem;">Cuotas por categoría</p>
      ${torneoPricingTableHtml()}
      <p style="font-size:0.82rem;color:#854d0e;line-height:1.45;margin:8px 0 0;">Envía <strong>una preinscripción por equipo</strong>. El nombre debe ser distinto si repites categoría. Solo se realizará el pago al completar la inscripción.</p>
      <p>Esta es una <strong>preinscripción</strong>. Más adelante el club solicitará los datos completos de los integrantes del equipo.</p>
      ${data.responsibleCode ? `<div style="margin:16px 0;padding:14px 16px;background:#0f172a;color:#f8fafc;border-radius:8px;line-height:1.55;">
        <p style="margin:0 0 8px;font-family:ui-monospace,monospace;font-size:1.05rem;">Tu código personal de responsable: <strong>${escapeHtml(data.responsibleCode)}</strong></p>
        <p style="margin:0 0 8px;font-size:0.88rem;font-family:system-ui,sans-serif;color:#e2e8f0;">Es <strong>personal e intransferible</strong>: identifica a la persona de contacto de la preinscripción y sirve para <strong>todos tus equipos</strong> (todas las categorías que inscribas con el mismo email).</p>
        <p style="margin:0 0 8px;font-size:0.88rem;font-family:system-ui,sans-serif;color:#cbd5e1;">Entra en la web → <strong>Soy responsable del equipo</strong> con:<br>• Código <strong>${escapeHtml(data.responsibleCode)}</strong><br>• Tu email de contacto: <strong>${escapeHtml(String(data.contactEmail || '').trim())}</strong></p>
        <p style="margin:0;font-size:0.85rem;font-family:system-ui,sans-serif;color:#94a3b8;">No compartas este código en redes ni con otros entrenadores. Quien lo use junto con tu email puede gestionar tus inscripciones.</p>
      </div>` : ''}
      ${data.accessCode ? `<div style="margin:12px 0;padding:12px 16px;background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;color:#1e3a8a;line-height:1.5;">
        <p style="margin:0 0 6px;font-family:ui-monospace,monospace;">Código de <strong>este equipo</strong>: <strong>${escapeHtml(data.accessCode)}</strong></p>
        <p style="margin:0;font-size:0.85rem;font-family:system-ui,sans-serif;color:#475569;">Identifica esta inscripción concreta (equipo y categoría). También puedes entrar al panel con este código + tu email. Si inscribes otro equipo, recibirás otro código de equipo; tu código personal ${data.responsibleCode ? `<strong>${escapeHtml(data.responsibleCode)}</strong>` : 'TP-Rxxx'} se mantiene.</p>
      </div>` : ''}
      ${!data.responsibleCode && data.accessCode ? `<p style="margin:16px 0;padding:12px 16px;background:#0f172a;color:#f8fafc;border-radius:8px;font-family:ui-monospace,monospace;">Código: <strong>${escapeHtml(data.accessCode)}</strong></p>` : ''}
      ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}" style="font-weight:700;color:#1d4ed8;">Web del club</a></p>` : ''}
      <p style="font-size:0.9rem;color:#64748b">Consultas: <a href="mailto:${contact}">${contact}</a></p>
    </div>`;
  const text =
    `Hola, ${String(data.contactName || '').trim() || 'Contacto'}.\n\n` +
    `Preinscripción registrada para ${data.eventName || 'Torneo'}.\n` +
    `Equipo: ${data.teamName || ''}\n` +
    `Población: ${data.town || ''}\n` +
    `Categorías: ${formatTorneoCategoryList(data)}\n` +
    `Jugadores (aprox.): ${data.playerCount != null ? data.playerCount : '—'}\n` +
    `Cuota estimada: ${feeLabel} (informativo)\n\n` +
    `Cuotas por categoría:\n${torneoPricingPlainText()}\n\n` +
    `Varios equipos: una preinscripción por equipo; nombre distinto si repites categoría. Pago al completar la inscripción.\n\n` +
    (data.responsibleCode
      ? `CÓDIGO PERSONAL DE RESPONSABLE: ${data.responsibleCode}\n` +
        `(Personal e intransferible — válido para todos tus equipos con el email ${String(data.contactEmail || '').trim()})\n` +
        `Entra en la web → Soy responsable del equipo: código + tu email de contacto.\n` +
        `No compartas este código; quien lo use con tu email puede gestionar tus inscripciones.\n\n`
      : '') +
    (data.accessCode
      ? `Código de ESTE equipo: ${data.accessCode}\n` +
        `(Esta inscripción concreta; otro equipo = otro código de equipo)\n\n`
      : '') +
    (data.responsibleCode || data.accessCode
      ? `Panel: ${siteUrl ? siteUrl + '/torneo-equipo.html' : 'web del club → Soy responsable del equipo'}\n\n`
      : '') +
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
  if (
    c === 'tarjeta' ||
    c === 'card' ||
    c === 'gateway_pending' ||
    c === 'pasarela_pendiente' ||
    c === 'pasarela' ||
    c === 'bizum' ||
    c === 'redsys_bizum' ||
    c === 'redsys_card' ||
    c === 'redsys_caja_rural'
  ) {
    return (
      'Has elegido pagar con <strong>tarjeta</strong>. Si el pago no se completó en el banco, tu ficha queda ' +
      '<strong>guardada como pendiente (no pagada)</strong>. Entra de nuevo en «Inscripción jugador/a» con DNI y contraseña ' +
      'y pulsa <strong>Continuar pago con tarjeta</strong>.'
    );
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
  if (
    c === 'tarjeta' ||
    c === 'card' ||
    c === 'gateway_pending' ||
    c === 'pasarela_pendiente' ||
    c === 'pasarela' ||
    c === 'bizum' ||
    c === 'redsys_bizum' ||
    c === 'redsys_card' ||
    c === 'redsys_caja_rural'
  ) {
    return (
      'Has elegido pagar con tarjeta. Si el pago no se completó, tu ficha queda pendiente (no pagada). ' +
      'Vuelve a la inscripción con DNI y contraseña y pulsa «Continuar pago con tarjeta».'
    );
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
  const isCardPending =
    ch === 'tarjeta' ||
    ch === 'card' ||
    ch === 'gateway_pending' ||
    ch === 'pasarela_pendiente' ||
    ch === 'pasarela' ||
    ch === 'bizum' ||
    ch === 'redsys_bizum' ||
    ch === 'redsys_card' ||
    ch === 'redsys_caja_rural';
  const showBank =
    !isCardPending &&
    (ch === 'transferencia' || ch === 'transfer' || ch === 'pending_transfer' || !ch || ch === 'transfer_manual');
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
  const type = String(data.type || '').trim();
  const concept = paymentTypeLabel(type);
  const amount = Number(data.amountEur);
  const amountTxt = Number.isFinite(amount) ? `${amount.toFixed(2)} €` : null;
  const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const hasPendingRecord = type === 'player_inscription' || type === 'membership_fee';
  const resumeUrl =
    type === 'player_inscription'
      ? siteUrl
        ? `${siteUrl}/inscripcion-jugador.html?flow=lookup`
        : ''
      : siteUrl || '';
  const subject = `Pago no completado — pendiente — ${CLUB_NAME}`;
  const pendingHtml = hasPendingRecord
    ? `<p>Tu ficha <strong>sí quedó guardada como pendiente de pago</strong> (no está activa ni marcada como pagada). ` +
      `Puedes volver a la web y <strong>terminar el pago</strong> cuando quieras.</p>` +
      (resumeUrl
        ? `<p><a href="${escapeHtml(resumeUrl)}" style="font-weight:700;color:#1d4ed8;">Continuar / retomar el pago</a></p>`
        : '')
    : `<p><strong>No se ha activado ningún alta</strong> por este intento. Puedes volver a la web e intentarlo de nuevo cuando quieras.</p>`;
  const pendingText = hasPendingRecord
    ? `Tu ficha quedó guardada como pendiente de pago (no pagada). Puedes retomar el pago desde la web.\n` +
      (resumeUrl ? `${resumeUrl}\n` : '')
    : `No se ha activado ningún alta por este intento. Puedes intentarlo de nuevo desde la web.\n`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#dc2626;margin:0 0 12px">Pago no completado</h2>
      <p>Hola:</p>
      <p>El banco <strong>no ha confirmado</strong> el pago de tu <strong>${escapeHtml(concept)}</strong>${amountTxt ? ` (${escapeHtml(amountTxt)})` : ''}.</p>
      ${pendingHtml}
      ${siteUrl && !resumeUrl ? `<p><a href="${escapeHtml(siteUrl)}">Volver a la web del club</a></p>` : ''}
      <p style="font-size:0.9rem;color:#64748b">Si crees que es un error o necesitas ayuda: <a href="mailto:${escapeHtml(clubContactEmail())}">${escapeHtml(clubContactEmail())}</a></p>
    </div>`;
  const text =
    `Pago no completado — ${CLUB_NAME}\n\n` +
    `El banco no ha confirmado el pago de tu ${concept}${amountTxt ? ' (' + amountTxt + ')' : ''}.\n\n` +
    pendingText +
    `\nConsultas: ${clubContactEmail()}\n`;
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

function buildTorneoPlayerInviteContent(data) {
  const team = escapeHtml(String(data.teamName || 'Equipo').trim());
  const eventName = escapeHtml(String(data.eventName || 'Torneo Fútbol 7 — 2026').trim());
  const url = escapeHtml(String(data.inviteUrl || '').trim());
  const subject = `Ficha jugador/a — ${data.teamName || 'Torneo'} — ${CLUB_NAME}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 12px">⚽ Completa tu ficha del torneo</h2>
      <p>El responsable del equipo <strong>${team}</strong> te invita a rellenar tu ficha para <strong>${eventName}</strong> del <strong>${CLUB_NAME}</strong>.</p>
      <p style="margin:20px 0"><a href="${url}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Rellenar mi ficha</a></p>
      <p style="font-size:0.88rem;color:#64748b">Si el botón no funciona, copia este enlace:<br><a href="${url}">${url}</a></p>
    </div>`;
  const text =
    `Completa tu ficha del torneo para ${data.teamName || 'el equipo'}.\n\n` +
    `${data.inviteUrl || ''}\n`;
  return { subject, html, text };
}

async function sendTorneoPlayerInviteEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.inviteEmail || '').trim().toLowerCase();
  if (!email.includes('@')) return { sent: false, reason: 'email vacío' };
  const content = buildTorneoPlayerInviteContent(data);
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

/** Aviso al club cuando el responsable envía invitación de ficha a un jugador/a. */
async function sendTorneoPlayerInviteClubNotify(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const cats = Array.isArray(data.categoryLabels) ? data.categoryLabels.join(', ') : '—';
  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    await sendClubAdminNotification({
      kind: 'torneo_invite_jugador',
      title: 'Invitación ficha torneo enviada',
      subject: `Invitación ficha — ${data.label || data.inviteEmail || 'Jugador/a'} — ${data.teamName || 'Equipo'}`,
      requesterEmail: data.contactEmail,
      nombre: data.contactName,
      email: data.contactEmail,
      fields: [
        { label: 'Equipo', value: data.teamName || '—' },
        { label: 'Evento', value: data.eventName || '—' },
        { label: 'Categorías', value: cats },
        { label: 'Cód. responsable', value: data.responsibleCode || '—' },
        { label: 'Cód. equipo', value: data.accessCode || '—' },
        { label: 'Responsable', value: data.contactName || '—' },
        { label: 'Email responsable', value: data.contactEmail || '—' },
        { label: 'Jugador/a invitado/a', value: data.label || '—' },
        { label: 'Email invitación', value: data.inviteEmail || '—' },
        { label: 'Enlace ficha', value: data.inviteUrl || '—' }
      ]
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message || String(err) };
  }
}

async function sendTorneoFichaSubmittedEmails(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false };
  const {
    fichaDataToFields,
    documentsHtmlPreview,
    collectFichaAttachments,
    DOC_LEGAL_TEXT
  } = require('./torneo-email-docs');

  const fichaData = data.fichaData && typeof data.fichaData === 'object' ? data.fichaData : {};
  const playerName = String(data.playerName || 'Jugador/a').trim();
  const cats = Array.isArray(data.categoryLabels) ? data.categoryLabels.join(', ') : '—';
  const fields = fichaDataToFields(fichaData);
  const docHtml = documentsHtmlPreview(fichaData.documents);
  const userAttachments = collectFichaAttachments(fichaData);
  const extraHtml =
    '<h3 style="color:#1e3a8a;margin:20px 0 8px">Documentación acreditativa</h3>' +
    '<p style="font-size:0.85rem;color:#64748b;line-height:1.45;margin:0 0 12px">' +
    escapeHtml(DOC_LEGAL_TEXT) +
    '</p>' +
    docHtml;

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    await sendClubAdminNotification({
      kind: 'torneo_ficha_jugador',
      title: 'Ficha torneo recibida',
      subject: `Ficha torneo — ${playerName} — ${data.teamName || 'Equipo'}`,
      requesterEmail: fichaData.email || data.contactEmail,
      nombre: playerName,
      fields: [
        { label: 'Equipo', value: data.teamName || '—' },
        { label: 'Evento', value: data.eventName || '—' },
        { label: 'Categorías', value: cats },
        { label: 'Cód. responsable', value: data.responsibleCode || '—' },
        { label: 'Cód. equipo', value: data.accessCode || '—' },
        { label: 'Responsable', value: data.contactName || '—' },
        { label: 'Email responsable', value: data.contactEmail || '—' }
      ].concat(fields),
      extraHtml,
      userAttachments
    });
  } catch (e) {
    console.warn('sendTorneoFichaSubmittedEmails club:', e.message || e);
  }

  if (data.contactEmail) {
    try {
      const rows = fields
        .map(function (f) {
          return '<tr><td style="padding:4px 8px 4px 0;color:#64748b"><strong>' + escapeHtml(f.label) + '</strong></td><td style="padding:4px 0">' + escapeHtml(f.value) + '</td></tr>';
        })
        .join('');
      await sendDirectToMemberEmail({
        memberEmail: data.contactEmail,
        subject: `Ficha recibida — ${playerName} — ${data.teamName || 'Torneo'} — ${CLUB_NAME}`,
        html:
          '<div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#1e293b">' +
          '<p>Hola, <strong>' +
          escapeHtml(data.contactName || '') +
          '</strong>:</p>' +
          '<p>Se ha recibido la ficha de <strong>' +
          escapeHtml(playerName) +
          '</strong> para el equipo <strong>' +
          escapeHtml(data.teamName || '') +
          '</strong>.</p>' +
          '<table style="width:100%;border-collapse:collapse;margin:12px 0">' +
          rows +
          '</table>' +
          extraHtml +
          '<p style="font-size:0.85rem;color:#64748b">Los documentos PDF/imagen van adjuntos a este correo.</p></div>',
        text:
          'Ficha recibida de ' +
          playerName +
          ' para ' +
          (data.teamName || 'equipo') +
          '.\n\n' +
          fields.map(function (f) {
            return f.label + ': ' + f.value;
          }).join('\n'),
        attachments: userAttachments,
        replyTo: clubContactEmail()
      });
    } catch (e) {
      console.warn('sendTorneoFichaSubmittedEmails responsable:', e.message || e);
    }
  }

  return { sent: true };
}

async function sendTorneoPlantillaCerradaEmails(data) {
  const cfg = getEmailConfig();
  const {
    fichaDataToFields,
    coachToFields,
    documentsHtmlPreview,
    collectRecordAttachments,
    DOC_LEGAL_TEXT
  } = require('./torneo-email-docs');

  const fichas = Array.isArray(data.fichas) ? data.fichas.filter((f) => f.data) : [];
  const cats = Array.isArray(data.categoryLabels)
    ? data.categoryLabels.join(', ')
    : Array.isArray(data.categories)
      ? data.categories.join(', ')
      : '—';
  const coachFields = coachToFields(data.coach);
  let extraHtml =
    '<p style="font-size:0.85rem;color:#64748b;line-height:1.45;margin:0 0 16px">' +
    escapeHtml(DOC_LEGAL_TEXT) +
    '</p>';
  extraHtml +=
    '<h3 style="color:#1e3a8a;margin:16px 0 8px">Responsable técnico (torneo)</h3>' +
    '<table style="width:100%;border-collapse:collapse;margin:0 0 12px">' +
    coachFields
      .map(function (f) {
        return (
          '<tr><td style="padding:4px 8px 4px 0;color:#64748b;white-space:nowrap"><strong>' +
          escapeHtml(f.label) +
          '</strong></td><td style="padding:4px 0">' +
          escapeHtml(f.value) +
          '</td></tr>'
        );
      })
      .join('') +
    '</table>' +
    documentsHtmlPreview(data.coach && data.coach.documents);

  fichas.forEach(function (f, i) {
    const name = [f.data.name, f.data.surname].filter(Boolean).join(' ') || f.label || 'Jugador/a ' + (i + 1);
    const fields = fichaDataToFields(f.data);
    extraHtml +=
      '<h3 style="color:#1e3a8a;margin:20px 0 8px">Jugador/a ' +
      (i + 1) +
      ': ' +
      escapeHtml(name) +
      '</h3>' +
      '<table style="width:100%;border-collapse:collapse;margin:0 0 12px">' +
      fields
        .map(function (fd) {
          return (
            '<tr><td style="padding:4px 8px 4px 0;color:#64748b;white-space:nowrap"><strong>' +
            escapeHtml(fd.label) +
            '</strong></td><td style="padding:4px 0">' +
            escapeHtml(fd.value) +
            '</td></tr>'
          );
        })
        .join('') +
      '</table>' +
      documentsHtmlPreview(f.data.documents);
  });

  const userAttachments = collectRecordAttachments(data);
  const extraText = fichas
    .map(function (f, i) {
      const n = [f.data.name, f.data.surname].filter(Boolean).join(' ');
      return (i + 1) + '. ' + (n || f.label || '—');
    })
    .join('\n');

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    await sendClubAdminNotification({
      kind: 'torneo_plantilla_cerrada',
      title: 'Plantilla torneo cerrada',
      subject: `Plantilla cerrada — ${data.teamName || 'Equipo'} — ${data.eventName || 'Torneo'}`,
      requesterEmail: data.contactEmail,
      nombre: data.contactName,
      telefono: data.contactPhone,
      email: data.contactEmail,
      fields: [
        { label: 'Equipo', value: data.teamName },
        { label: 'Evento', value: data.eventName },
        { label: 'Categorías', value: cats },
        { label: 'Cód. responsable', value: data.responsibleCode || '—' },
        { label: 'Cód. equipo', value: data.accessCode },
        { label: 'Jugadores', value: String(fichas.length) },
        {
          label:
            data.paymentStatus === 'pending_validation' ? 'Cuota (pendiente)' : 'Cuota pagada',
          value:
            data.paymentStatus === 'pending_validation'
              ? (data.inscriptionFeeEur != null ? data.inscriptionFeeEur + ' €' : '—') +
                ' — ' +
                (data.offlinePaymentChannel || data.paymentMethod || 'offline')
              : data.inscriptionFeeEur != null
                ? data.inscriptionFeeEur + ' €'
                : '—'
        },
        { label: 'Quién envía / responsable', value: data.contactName || '—' },
        { label: 'Email de quien envía', value: data.contactEmail || '—' }
      ].concat(coachFields),
      extraHtml,
      extraText: extraText ? 'Plantilla:\n' + extraText : '',
      userAttachments
    });
  } catch (e) {
    console.warn('sendTorneoPlantillaCerradaEmails club:', e.message || e);
  }
  if (cfg.ok && data.contactEmail) {
    const offlineCh = String(data.offlinePaymentChannel || data.paymentMethod || '')
      .trim()
      .toLowerCase();
    let payHintHtml = '';
    let payHintText = '';
    if (data.paymentStatus === 'pending_validation') {
      const feeTxt = data.inscriptionFeeEur != null ? data.inscriptionFeeEur + ' €' : 'la cuota';
      if (offlineCh === 'transferencia') {
        payHintHtml =
          '<p style="margin:16px 0;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e40af;font-size:0.9rem;line-height:1.45;">' +
          '<strong>Pago pendiente — transferencia:</strong> ingresa <strong>' +
          escapeHtml(String(feeTxt)) +
          '</strong> en la cuenta del club:<br><span style="font-family:monospace;font-size:0.95rem;">' +
          escapeHtml(CLUB_BANK_ACCOUNT) +
          '</span></p>';
        payHintText =
          '\nPago pendiente por transferencia (' +
          feeTxt +
          ') a: ' +
          CLUB_BANK_ACCOUNT +
          '\n';
      } else if (offlineCh === 'efectivo') {
        payHintHtml =
          '<p style="margin:16px 0;padding:12px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;color:#713f12;font-size:0.9rem;">' +
          '<strong>Pago pendiente — efectivo:</strong> abona <strong>' +
          escapeHtml(String(feeTxt)) +
          '</strong> en el club.</p>';
        payHintText = '\nPago pendiente en efectivo (' + feeTxt + ') en el club.\n';
      }
    }
    try {
      await sendDirectToMemberEmail({
        memberEmail: data.contactEmail,
        subject: `Plantilla enviada — ${data.teamName || 'Torneo'} — ${CLUB_NAME}`,
        html:
          '<div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#1e293b">' +
          '<p>Hola, <strong>' +
          escapeHtml(data.contactName || '') +
          '</strong>:</p>' +
          '<p>Hemos recibido la plantilla completa de <strong>' +
          escapeHtml(data.teamName || '') +
          '</strong> para el torneo. El club la revisará pronto.</p>' +
          payHintHtml +
          extraHtml +
          '<p style="font-size:0.85rem;color:#64748b;margin-top:16px">Todos los datos y documentos PDF/imagen van adjuntos a este correo.</p></div>',
        text: `Plantilla de ${data.teamName || 'equipo'} recibida por el club.${payHintText}\n${extraText}`,
        attachments: userAttachments,
        replyTo: clubContactEmail()
      });
    } catch (_) {}
  }
  return { sent: true };
}

async function sendTorneoRosterBatchSavedEmails(data) {
  const cfg = getEmailConfig();
  const { fichaDataToFields, documentsHtmlPreview, collectFichaAttachments, DOC_LEGAL_TEXT } =
    require('./torneo-email-docs');

  const fichas = Array.isArray(data.fichas) ? data.fichas.filter((f) => f.data && String(f.status || '') === 'enviada') : [];
  const cats = Array.isArray(data.categoryLabels)
    ? data.categoryLabels.join(', ')
    : Array.isArray(data.categories)
      ? data.categories.join(', ')
      : '—';
  const docsPending = fichas.filter(function (f) {
    return f.documentsPending !== false && !(f.data && f.data.documents && f.data.documents.length);
  }).length;

  let extraHtml =
    '<p style="font-size:0.85rem;color:#64748b;line-height:1.45;margin:0 0 12px">' +
    escapeHtml(DOC_LEGAL_TEXT) +
    '</p>' +
    '<p style="margin:0 0 16px;padding:12px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;color:#713f12;font-size:0.88rem;">' +
    '<strong>Documentación DNI:</strong> ' +
    (docsPending
      ? 'Faltan documentos de ' + docsPending + ' jugador/es. El responsable puede subirlos desde el panel antes del inicio del torneo.'
      : 'Todos los documentos están subidos.') +
    '</p>';

  fichas.forEach(function (f, i) {
    const name = [f.data.name, f.data.surname].filter(Boolean).join(' ') || f.label || 'Jugador/a ' + (i + 1);
    const fields = fichaDataToFields(f.data);
    const pending =
      f.documentsPending !== false && !(f.data.documents && f.data.documents.length);
    extraHtml +=
      '<h3 style="color:#1e3a8a;margin:16px 0 8px">Jugador/a ' +
      (i + 1) +
      ': ' +
      escapeHtml(name) +
      (pending ? ' <span style="color:#b45309;font-size:0.82rem;">(DNI pendiente)</span>' : '') +
      '</h3>' +
      '<table style="width:100%;border-collapse:collapse;margin:0 0 12px">' +
      fields
        .map(function (fd) {
          return (
            '<tr><td style="padding:4px 8px 4px 0;color:#64748b;white-space:nowrap"><strong>' +
            escapeHtml(fd.label) +
            '</strong></td><td style="padding:4px 0">' +
            escapeHtml(fd.value) +
            '</td></tr>'
          );
        })
        .join('') +
      '</table>' +
      documentsHtmlPreview(f.data.documents);
  });

  const userAttachments = [];
  fichas.forEach(function (f) {
    userAttachments.push.apply(userAttachments, collectFichaAttachments(f.data));
  });

  const extraText = fichas
    .map(function (f, i) {
      const n = [f.data.name, f.data.surname].filter(Boolean).join(' ');
      const pending =
        f.documentsPending !== false && !(f.data.documents && f.data.documents.length);
      return (i + 1) + '. ' + (n || f.label || '—') + (pending ? ' [DNI pendiente]' : '');
    })
    .join('\n');

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    await sendClubAdminNotification({
      kind: 'torneo_roster_batch',
      title: 'Plantilla torneo registrada',
      subject: `Plantilla registrada — ${data.teamName || 'Equipo'} — ${fichas.length} jugadores`,
      requesterEmail: data.contactEmail,
      nombre: data.contactName,
      email: data.contactEmail,
      fields: [
        { label: 'Equipo', value: data.teamName },
        { label: 'Evento', value: data.eventName || 'Torneo Fútbol 7 — 2026' },
        { label: 'Categorías', value: cats },
        { label: 'Cód. responsable', value: data.responsibleCode || '—' },
        { label: 'Cód. equipo', value: data.accessCode },
        { label: 'Jugadores', value: String(fichas.length) },
        { label: 'DNI pendientes', value: String(docsPending) }
      ],
      extraHtml,
      extraText: extraText ? 'Plantilla:\n' + extraText : '',
      userAttachments
    });
  } catch (e) {
    console.warn('sendTorneoRosterBatchSavedEmails club:', e.message || e);
  }

  if (cfg.ok && data.contactEmail) {
    try {
      await sendDirectToMemberEmail({
        memberEmail: data.contactEmail,
        subject: `Plantilla guardada — ${data.teamName || 'Torneo'} — ${CLUB_NAME}`,
        html:
          '<div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#1e293b">' +
          '<p>Hola, <strong>' +
          escapeHtml(data.contactName || '') +
          '</strong>:</p>' +
          '<p>Has registrado la plantilla de <strong>' +
          escapeHtml(data.teamName || '') +
          '</strong> con <strong>' +
          fichas.length +
          '</strong> jugadores. El club ha recibido los datos.</p>' +
          (docsPending
            ? '<p style="color:#92400e;">Recuerda subir el DNI de cada jugador desde el panel antes del inicio del torneo.</p>'
            : '') +
          extraHtml +
          '</div>',
        text:
          'Plantilla guardada para ' +
          (data.teamName || 'equipo') +
          ' (' +
          fichas.length +
          ' jugadores).\n\n' +
          extraText,
        attachments: userAttachments,
        replyTo: clubContactEmail()
      });
    } catch (_) {}
  }
  return { sent: true };
}

async function sendTorneoFichaDocumentsUploadedEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false };
  const {
    documentsHtmlPreview,
    collectFichaAttachments,
    DOC_LEGAL_TEXT
  } = require('./torneo-email-docs');
  const playerName = String(data.playerName || 'Jugador/a').trim();
  const cats = Array.isArray(data.categoryLabels) ? data.categoryLabels.join(', ') : '—';
  const fichaData = data.fichaData && typeof data.fichaData === 'object' ? data.fichaData : {};
  const docHtml = documentsHtmlPreview(fichaData.documents);
  const userAttachments = collectFichaAttachments(fichaData);

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    await sendClubAdminNotification({
      kind: 'torneo_ficha_documentos',
      title: 'DNI jugador torneo',
      subject: `DNI recibido — ${playerName} — ${data.teamName || 'Equipo'}`,
      requesterEmail: data.contactEmail,
      nombre: playerName,
      fields: [
        { label: 'Equipo', value: data.teamName || '—' },
        { label: 'Categorías', value: cats },
        { label: 'Cód. equipo', value: data.accessCode || '—' },
        { label: 'Responsable', value: data.contactName || '—' }
      ],
      extraHtml:
        '<p style="font-size:0.85rem;color:#64748b">' +
        escapeHtml(DOC_LEGAL_TEXT) +
        '</p>' +
        docHtml,
      userAttachments
    });
  } catch (e) {
    console.warn('sendTorneoFichaDocumentsUploadedEmail club:', e.message || e);
  }
  return { sent: true };
}

function buildTorneoPlantillaReminderContent(data) {
  const nombre = escapeHtml(String(data.contactName || 'Responsable').trim() || 'Responsable');
  const panelUrl = escapeHtml(String(data.panelUrl || '').trim());
  const respCode = data.responsibleCode ? String(data.responsibleCode).trim() : '';
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const entryRows = entries
    .map(function (e) {
      const cats = Array.isArray(e.categories) ? e.categories.join(', ') : '—';
      const submitted = e.fichasSubmitted != null ? e.fichasSubmitted : 0;
      const pc = e.playerCount != null ? e.playerCount : '—';
      return (
        '<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">' +
        escapeHtml(e.teamName || 'Equipo') +
        '</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">' +
        escapeHtml(cats) +
        '</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:ui-monospace,monospace;font-size:0.85rem;">' +
        escapeHtml(e.accessCode || '—') +
        '</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">' +
        escapeHtml(e.plantillaStatus || 'pendiente') +
        ' (' +
        escapeHtml(String(submitted)) +
        '/' +
        escapeHtml(String(pc)) +
        ' fichas)</td></tr>'
      );
    })
    .join('');

  const subject = `Completa la plantilla del torneo — ${CLUB_NAME}`;
  const html =
    '<div style="font-family:system-ui,sans-serif;max-width:600px;color:#1e293b;line-height:1.5">' +
    '<h2 style="color:#1e3a8a;margin:0 0 12px">⚽ Recordatorio — plantilla y pago</h2>' +
    '<p>Hola, <strong>' +
    nombre +
    '</strong>:</p>' +
    '<p>Te recordamos completar la <strong>plantilla</strong> de tu(s) equipo(s) inscrito(s) en el <strong>Torneo Fútbol 7 — 2026</strong> del CD Sanabria CF:</p>' +
    '<ol style="margin:12px 0 16px;padding-left:22px;color:#334155;">' +
    '<li style="margin-bottom:6px;">Entra en el panel con tu código + email.</li>' +
    '<li style="margin-bottom:6px;">Rellena los datos del responsable técnico y sube documentación.</li>' +
    '<li style="margin-bottom:6px;">Rellena la plantilla completa de jugadores en el panel (o invita por email).</li>' +
    '<li style="margin-bottom:6px;">Sube el DNI de cada jugador antes del inicio del torneo.</li>' +
    '<li>Cuando esté todo, pulsa <strong>Finalizar</strong> para enviar al club y pagar (si aplica).</li>' +
    '</ol>' +
    (respCode
      ? '<p style="margin:0 0 12px;padding:12px 14px;background:#0f172a;color:#f8fafc;border-radius:8px;font-family:ui-monospace,monospace;">Código responsable: <strong>' +
        escapeHtml(respCode) +
        '</strong></p>'
      : '') +
    '<table style="width:100%;border-collapse:collapse;font-size:0.88rem;margin:0 0 16px;background:#f8fafc;border-radius:8px;">' +
    '<thead><tr style="background:#eff6ff;text-align:left;">' +
    '<th style="padding:8px;">Equipo</th><th style="padding:8px;">Categoría</th><th style="padding:8px;">Código</th><th style="padding:8px;">Plantilla</th></tr></thead><tbody>' +
    (entryRows || '<tr><td colspan="4" style="padding:10px;">—</td></tr>') +
    '</tbody></table>' +
    (panelUrl
      ? '<p style="margin:20px 0"><a href="' +
        panelUrl +
        '" style="display:inline-block;background:#1e3a8a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Abrir panel del equipo</a></p>' +
        '<p style="font-size:0.85rem;color:#64748b">Si el botón no funciona: ' +
        panelUrl +
        '</p>'
      : '') +
    '<p style="font-size:0.9rem;color:#64748b;margin-top:16px;">Consultas: <a href="mailto:' +
    escapeHtml(clubContactEmail()) +
    '">' +
    escapeHtml(clubContactEmail()) +
    '</a></p></div>';

  const textLines = entries.map(function (e) {
    const cats = Array.isArray(e.categories) ? e.categories.join(', ') : '—';
    return (
      '- ' +
      (e.teamName || 'Equipo') +
      ' | ' +
      cats +
      ' | ' +
      (e.accessCode || '—') +
      ' | plantilla: ' +
      (e.plantillaStatus || 'pendiente')
    );
  });
  const text =
    'Hola, ' +
    String(data.contactName || 'Responsable') +
    '.\n\n' +
    'Completa la plantilla del Torneo Fútbol 7 — 2026:\n' +
    '1) Entra al panel con código + email\n' +
    '2) Responsable técnico + documentos\n' +
    '3) Invita a cada jugador/a\n' +
    '4) Finalizar y pagar\n\n' +
    (respCode ? 'Código responsable: ' + respCode + '\n\n' : '') +
    textLines.join('\n') +
    '\n\nPanel: ' +
    (data.panelUrl || '') +
    '\n\nConsultas: ' +
    clubContactEmail() +
    '\n';

  return { subject, html, text };
}

async function sendTorneoPlantillaReminderEmail(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };
  const email = String(data.contactEmail || '').trim().toLowerCase();
  if (!email.includes('@')) return { sent: false, reason: 'email vacío' };
  const content = buildTorneoPlantillaReminderContent(data);
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

function torneoCatsLabel(data) {
  return Array.isArray(data.categoryLabels)
    ? data.categoryLabels.join(', ')
    : Array.isArray(data.categories)
      ? data.categories.join(', ')
      : '—';
}

function torneoBaseEmailFields(data) {
  return [
    { label: 'Equipo', value: data.teamName },
    { label: 'Evento', value: data.eventName || 'Torneo Fútbol 7' },
    { label: 'Categorías', value: torneoCatsLabel(data) },
    { label: 'Cód. responsable', value: data.responsibleCode || '—' },
    { label: 'Cód. equipo', value: data.accessCode || '—' },
    { label: 'Responsable', value: data.contactName || '—' },
    { label: 'Email responsable', value: data.contactEmail || '—' },
    { label: 'Teléfono', value: data.contactPhone || '—' }
  ];
}

function torneoPayMethodLabel(data) {
  const pm = String(data.paymentMethod || data.offlinePaymentChannel || data.payMethod || '')
    .trim()
    .toLowerCase();
  if (pm.indexOf('redsys_card') >= 0 || pm === 'card') return 'Tarjeta (Redsys)';
  if (pm.indexOf('redsys_bizum') >= 0 || pm === 'bizum') return 'Bizum (Redsys)';
  if (pm === 'gateway_pending') return 'Tarjeta (pendiente de confirmar)';
  if (pm === 'transferencia' || pm === 'transfer') return 'Transferencia bancaria';
  if (pm === 'efectivo' || pm === 'cash') return 'Efectivo en el club';
  if (pm === 'offline') return 'Transferencia o efectivo';
  return pm || '—';
}

function formatIsoEs(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
  } catch (_) {
    return String(iso);
  }
}

async function sendTorneoEquipoValidadoEmails(data) {
  const cfg = getEmailConfig();
  const validatedBy = data.equipoValidadoPor || data.validatedBy || 'Organización del torneo';
  const validatedAt = data.equipoValidadoAt || data.validatedAt || new Date().toISOString();
  const teamName = data.teamName || 'Equipo';
  const eventName = data.eventName || 'Torneo Fútbol 7';
  const fields = torneoBaseEmailFields(data).concat([
    { label: 'Validado por', value: validatedBy },
    { label: 'Fecha', value: formatIsoEs(validatedAt) }
  ]);

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    await sendClubAdminNotification({
      kind: 'torneo_equipo_validado',
      title: 'Equipo validado (torneo)',
      subject: `Equipo validado — ${teamName} — ${eventName}`,
      requesterEmail: data.contactEmail,
      nombre: data.contactName,
      telefono: data.contactPhone,
      email: data.contactEmail,
      fields: fields,
      extraHtml:
        '<p style="margin:12px 0;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;color:#166534;line-height:1.45;">' +
        'Validación <strong>deportiva/organizativa</strong> del equipo para el torneo. ' +
        'No implica por sí sola la confirmación del pago si este seguía pendiente.</p>',
      extraText: 'Equipo validado para el torneo (validación organizativa).'
    });
  } catch (e) {
    console.warn('sendTorneoEquipoValidadoEmails club:', e.message || e);
  }

  if (cfg.ok && data.contactEmail) {
    const feeTxt =
      data.inscriptionFeeEur != null ? String(data.inscriptionFeeEur) + ' €' : 'la cuota del torneo';
    const payPending = String(data.paymentStatus || '').toLowerCase() === 'pending_validation';
    let payNoteHtml = '';
    let payNoteText = '';
    if (payPending) {
      payNoteHtml =
        '<p style="margin:16px 0;padding:12px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;color:#713f12;font-size:0.9rem;line-height:1.45;">' +
        '<strong>Pago:</strong> tu equipo está validado para el torneo, pero la cuota (' +
        escapeHtml(feeTxt) +
        ') sigue pendiente de confirmación por el club.</p>';
      payNoteText = '\nNota: la cuota del torneo sigue pendiente de confirmación por el club.\n';
    }
    try {
      await sendDirectToMemberEmail({
        memberEmail: data.contactEmail,
        subject: `Equipo validado — ${teamName} — ${CLUB_NAME}`,
        html:
          '<div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#1e293b">' +
          '<p>Hola, <strong>' +
          escapeHtml(data.contactName || '') +
          '</strong>:</p>' +
          '<p>Tu equipo <strong>' +
          escapeHtml(teamName) +
          '</strong> ha sido <strong>validado</strong> para participar en <strong>' +
          escapeHtml(eventName) +
          '</strong>.</p>' +
          '<p>Código equipo: <span style="font-family:monospace;">' +
          escapeHtml(data.accessCode || '—') +
          '</span></p>' +
          payNoteHtml +
          '<p style="font-size:0.85rem;color:#64748b;margin-top:16px">Consultas: <a href="mailto:' +
          escapeHtml(clubContactEmail()) +
          '">' +
          escapeHtml(clubContactEmail()) +
          '</a></p></div>',
        text:
          `Hola, ${data.contactName || ''}.\n\n` +
          `Tu equipo ${teamName} ha sido validado para ${eventName}.\n` +
          `Código: ${data.accessCode || '—'}.${payNoteText}\n` +
          `Consultas: ${clubContactEmail()}\n`,
        replyTo: clubContactEmail()
      });
    } catch (e) {
      console.warn('sendTorneoEquipoValidadoEmails responsable:', e.message || e);
    }
  }
  return { sent: true };
}

async function sendTorneoPagoValidadoEmails(data) {
  const cfg = getEmailConfig();
  const teamName = data.teamName || 'Equipo';
  const eventName = data.eventName || 'Torneo Fútbol 7';
  const payLabel = torneoPayMethodLabel(data);
  const auto = !!data.paymentAuto;
  const validatedBy = data.paymentValidatedPor || data.validatedBy || (auto ? 'Pasarela Redsys' : 'Administración del club');
  const validatedAt = data.paymentValidatedAt || data.validatedAt || new Date().toISOString();
  const feeTxt = data.inscriptionFeeEur != null ? String(data.inscriptionFeeEur) + ' €' : '—';
  const whoName = data.contactName || data.paymentChangedByName || '—';
  const whoEmail = data.contactEmail || data.paymentChangedByEmail || '—';
  const fields = torneoBaseEmailFields(data).concat([
    { label: 'Cuota', value: feeTxt },
    { label: 'Forma de pago', value: payLabel },
    { label: 'Quién realiza el pago', value: whoName },
    { label: 'Email de quien paga', value: whoEmail },
    { label: 'Confirmado por', value: validatedBy },
    { label: 'Fecha', value: formatIsoEs(validatedAt) },
    { label: 'Pedido', value: data.paymentOrderId || data.orderId || '—' }
  ]);

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    await sendClubAdminNotification({
      kind: 'torneo_pago_validado',
      title: auto ? 'Pago torneo confirmado (automático)' : 'Pago torneo validado',
      subject: `${auto ? 'Pago confirmado' : 'Pago validado'} — ${teamName} — ${whoName}`,
      requesterEmail: data.contactEmail,
      nombre: data.contactName,
      telefono: data.contactPhone,
      email: data.contactEmail,
      fields: fields,
      extraHtml:
        '<p style="margin:12px 0;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e40af;line-height:1.45;">' +
        (auto
          ? 'Pago registrado <strong>automáticamente</strong> tras confirmación en la pasarela bancaria.'
          : 'Un administrador del club ha <strong>confirmado el ingreso</strong> de la cuota del torneo.') +
        '<br><strong>Quién:</strong> ' +
        escapeHtml(whoName) +
        ' (' +
        escapeHtml(whoEmail) +
        ')</p>',
      extraText:
        (auto ? 'Pago torneo confirmado automáticamente.' : 'Pago torneo validado por administrador.') +
        '\nQuién: ' +
        whoName +
        ' <' +
        whoEmail +
        '>'
    });
  } catch (e) {
    console.warn('sendTorneoPagoValidadoEmails club:', e.message || e);
  }

  if (cfg.ok && data.contactEmail) {
    try {
      await sendDirectToMemberEmail({
        memberEmail: data.contactEmail,
        subject: `Pago confirmado — ${teamName} — ${CLUB_NAME}`,
        html:
          '<div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#1e293b">' +
          '<p>Hola, <strong>' +
          escapeHtml(data.contactName || '') +
          '</strong>:</p>' +
          '<p>Hemos <strong>confirmado el pago</strong> de la inscripción de <strong>' +
          escapeHtml(teamName) +
          '</strong> en <strong>' +
          escapeHtml(eventName) +
          '</strong>.</p>' +
          '<table style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin:16px 0;width:100%;border-collapse:collapse">' +
          '<tr><td style="padding:4px 8px 4px 0;color:#64748b"><strong>Cuota:</strong></td><td>' +
          escapeHtml(feeTxt) +
          '</td></tr>' +
          '<tr><td style="padding:4px 8px 4px 0;color:#64748b"><strong>Forma:</strong></td><td>' +
          escapeHtml(payLabel) +
          '</td></tr>' +
          '<tr><td style="padding:4px 8px 4px 0;color:#64748b"><strong>A nombre de:</strong></td><td>' +
          escapeHtml(whoName) +
          ' &lt;' +
          escapeHtml(whoEmail) +
          '&gt;</td></tr>' +
          '<tr><td style="padding:4px 8px 4px 0;color:#64748b"><strong>Cód. equipo:</strong></td><td style="font-family:monospace">' +
          escapeHtml(data.accessCode || '—') +
          '</td></tr></table>' +
          '<p>Tu inscripción queda registrada como <strong>pagada</strong> en el club.</p>' +
          '<p style="font-size:0.85rem;color:#64748b;margin-top:16px">Consultas: <a href="mailto:' +
          escapeHtml(clubContactEmail()) +
          '">' +
          escapeHtml(clubContactEmail()) +
          '</a></p></div>',
        text:
          `Hola, ${data.contactName || ''}.\n\n` +
          `Pago confirmado para ${teamName} (${eventName}).\n` +
          `Cuota: ${feeTxt}. Forma: ${payLabel}.\n` +
          `A nombre de: ${whoName} <${whoEmail}>.\n` +
          `Código equipo: ${data.accessCode || '—'}.\n\n` +
          `Consultas: ${clubContactEmail()}\n`,
        replyTo: clubContactEmail()
      });
    } catch (e) {
      console.warn('sendTorneoPagoValidadoEmails responsable:', e.message || e);
    }
  }
  return { sent: true };
}

/** Aviso club + responsable: cambio de método (p. ej. efectivo/transferencia → tarjeta). */
async function sendTorneoPaymentMethodChangedEmails(data) {
  const cfg = getEmailConfig();
  const teamName = data.teamName || 'Equipo';
  const eventName = data.eventName || 'Torneo Fútbol 7';
  const fromLabel = torneoPayMethodLabel({
    paymentMethod: data.previousPaymentMethod || data.fromMethod,
    offlinePaymentChannel: data.previousOfflineChannel || data.fromMethod
  });
  const toLabel = torneoPayMethodLabel({
    paymentMethod: data.newPaymentMethod || data.toMethod || 'card',
    payMethod: data.newPaymentMethod || data.toMethod || 'card'
  });
  const whoName = data.contactName || data.changedByName || '—';
  const whoEmail = data.contactEmail || data.changedByEmail || '—';
  const feeTxt = data.inscriptionFeeEur != null ? String(data.inscriptionFeeEur) + ' €' : data.amountEur != null ? String(data.amountEur) + ' €' : '—';
  const fields = torneoBaseEmailFields(data).concat([
    { label: 'Método anterior', value: fromLabel },
    { label: 'Método nuevo', value: toLabel },
    { label: 'Importe', value: feeTxt },
    { label: 'Quién cambia el método', value: whoName },
    { label: 'Email de quien cambia', value: whoEmail },
    { label: 'Pedido', value: data.pendingPaymentOrderId || data.orderId || '—' },
    { label: 'Fecha', value: formatIsoEs(data.paymentMethodChangedAt || new Date().toISOString()) }
  ]);

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    await sendClubAdminNotification({
      kind: 'torneo_cambio_metodo_pago',
      title: 'Cambio método de pago torneo',
      subject: `Cambio a ${toLabel} — ${teamName} — ${whoName}`,
      requesterEmail: whoEmail !== '—' ? whoEmail : data.contactEmail,
      nombre: whoName,
      telefono: data.contactPhone,
      email: whoEmail !== '—' ? whoEmail : data.contactEmail,
      fields: fields,
      extraHtml:
        '<p style="margin:12px 0;padding:12px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;color:#92400e;line-height:1.45;">' +
        'El responsable ha cambiado el método de <strong>' +
        escapeHtml(fromLabel) +
        '</strong> a <strong>' +
        escapeHtml(toLabel) +
        '</strong> y va a completar el pago online.</p>',
      extraText:
        'Cambio de método: ' + fromLabel + ' → ' + toLabel + '\nQuién: ' + whoName + ' <' + whoEmail + '>'
    });
  } catch (e) {
    console.warn('sendTorneoPaymentMethodChangedEmails club:', e.message || e);
  }

  if (cfg.ok && data.contactEmail) {
    try {
      await sendDirectToMemberEmail({
        memberEmail: data.contactEmail,
        subject: `Cambio a ${toLabel} — ${teamName} — ${CLUB_NAME}`,
        html:
          '<div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#1e293b">' +
          '<p>Hola, <strong>' +
          escapeHtml(data.contactName || '') +
          '</strong>:</p>' +
          '<p>Has cambiado el método de pago de la inscripción de <strong>' +
          escapeHtml(teamName) +
          '</strong> de <strong>' +
          escapeHtml(fromLabel) +
          '</strong> a <strong>' +
          escapeHtml(toLabel) +
          '</strong>.</p>' +
          '<p>Importe: <strong>' +
          escapeHtml(feeTxt) +
          '</strong>. Completa el pago en la pasarela segura del banco. Cuando se confirme, recibirás otro correo y el club también.</p>' +
          '<p style="font-size:0.85rem;color:#64748b;margin-top:16px">Registrado a tu nombre: ' +
          escapeHtml(whoName) +
          ' (' +
          escapeHtml(whoEmail) +
          ').</p></div>',
        text:
          `Hola, ${data.contactName || ''}.\n\n` +
          `Has cambiado el método de pago de ${teamName}: ${fromLabel} → ${toLabel}.\n` +
          `Importe: ${feeTxt}. Completa el pago en la pasarela.\n` +
          `A nombre de: ${whoName} <${whoEmail}>.\n`,
        replyTo: clubContactEmail()
      });
    } catch (e) {
      console.warn('sendTorneoPaymentMethodChangedEmails responsable:', e.message || e);
    }
  }
  return { sent: true };
}

module.exports = {
  sendMemberRegistrationEmail,
  sendFriendRegistrationEmail,
  notifyFriendRegistrationEmails,
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
  sendTorneoPlayerInviteEmail,
  sendTorneoPlayerInviteClubNotify,
  sendTorneoFichaSubmittedEmails,
  sendTorneoRosterBatchSavedEmails,
  sendTorneoFichaDocumentsUploadedEmail,
  sendTorneoPlantillaCerradaEmails,
  sendTorneoPlantillaReminderEmail,
  sendTorneoEquipoValidadoEmails,
  sendTorneoPagoValidadoEmails,
  sendTorneoPaymentMethodChangedEmails,
  sendPaymentFailedEmail
};
