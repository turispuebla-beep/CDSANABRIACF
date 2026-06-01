'use strict';

const { getEmailConfig, sendViaSendGrid, escapeHtml } = require('./lib/club-email');
const {
  normalizeDni,
  findApplicationByDniSeason,
  createPlayerApplication,
  applicationsRef
} = require('./lib/firestore-admin');

const CORS_BASE = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function corsHeaders(origin) {
  const allowed = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const site = String(process.env.SITE_URL || '').replace(/\/$/, '');
  const list = allowed.length ? allowed : site ? [site] : [];
  const ok = !list.length || list.includes(origin);
  return {
    ...CORS_BASE,
    'Access-Control-Allow-Origin': ok ? origin || list[0] || '*' : 'null'
  };
}

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function getActiveSeasonIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 5) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function buildNotifyEmail(app) {
  const subject = `Nueva solicitud jugador/a — ${app.name} ${app.surname} (${app.season})`;
  const lines = [
    `Temporada: ${app.season}`,
    `Nombre: ${app.name} ${app.surname}`,
    `DNI: ${app.dni || '—'}`,
    `Email: ${app.email}`,
    `Teléfono: ${app.phone}`,
    `Nacimiento: ${app.birthDate || '—'}`,
    `Categoría sugerida: ${app.category || '—'}`,
    app.isMinor
      ? `Tutor/a: ${app.guardianName} ${app.guardianSurname || ''} — DNI ${app.guardianDni} — ${app.guardianPhone} — ${app.guardianEmail}`
      : '',
    `Estado: pendiente de revisión en el panel de administración.`
  ].filter(Boolean);
  const text = lines.join('\n');
  const html =
    '<h2>Nueva solicitud de jugador/a</h2><ul>' +
    lines.map((l) => '<li>' + escapeHtml(l) + '</li>').join('') +
    '</ul>';
  return { subject, text, html };
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const season = String(body.season || getActiveSeasonIso()).trim();
    const name = String(body.name || '').trim();
    const surname = String(body.surname || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const birthDate = String(body.birthDate || '').trim();

    if (!name || !surname || !email || !phone || !birthDate) {
      return json(400, { ok: false, error: 'Faltan datos obligatorios' }, origin);
    }
    if (!email.includes('@')) {
      return json(400, { ok: false, error: 'Email no válido' }, origin);
    }
    if (!body.commitmentAccepted || !body.clubRulesAccepted) {
      return json(400, { ok: false, error: 'Debe aceptar el compromiso y las normas del club' }, origin);
    }
    const portalPasswordHash = String(body.portalPasswordHash || '').trim();
    if (!portalPasswordHash || portalPasswordHash.length < 32) {
      return json(400, { ok: false, error: 'Debe indicar una contraseña de acceso a la ficha' }, origin);
    }

    const dni = normalizeDni(body.dni);
    const existing = await findApplicationByDniSeason(dni, email, season);
    if (existing) {
      return json(
        409,
        {
          ok: false,
          error:
            existing.status === 'pending_review'
              ? 'Ya hay una solicitud pendiente de revisión con estos datos.'
              : 'Ya existe una solicitud o ficha para esta temporada.'
        },
        origin
      );
    }

    const application = await createPlayerApplication({
      season,
      name,
      nombre: name,
      surname,
      apellidos: surname,
      dni,
      email,
      phone,
      telefono: phone,
      address: String(body.address || '').trim(),
      direccion: String(body.address || '').trim(),
      birthDate,
      fechaNacimiento: birthDate,
      category: String(body.category || '').trim(),
      categoria: String(body.category || '').trim(),
      guardianName: String(body.guardianName || '').trim(),
      guardianSurname: String(body.guardianSurname || '').trim(),
      guardianDni: normalizeDni(body.guardianDni || body.guardianDNI),
      guardianDNI: normalizeDni(body.guardianDni || body.guardianDNI),
      guardianPhone: String(body.guardianPhone || '').trim(),
      guardianEmail: String(body.guardianEmail || '').trim().toLowerCase(),
      guardianAddress: String(body.guardianAddress || '').trim(),
      commitmentAccepted: true,
      clubRulesAccepted: true,
      isMinor: !!body.isMinor,
      portalPasswordHash: portalPasswordHash,
      portalPasswordSetAt: new Date().toISOString(),
      status: 'pending_review'
    });

    const cfg = getEmailConfig();
    if (cfg.ok && cfg.notifyEmail) {
      try {
        const mail = buildNotifyEmail(application);
        await sendViaSendGrid({
          to: cfg.notifyEmail,
          subject: mail.subject,
          text: mail.text,
          html: mail.html
        });
      } catch (mailErr) {
        console.warn('submit-player-application email:', mailErr);
      }
    }

    return json(200, { ok: true, application }, origin);
  } catch (err) {
    console.error('submit-player-application:', err);
    return json(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
