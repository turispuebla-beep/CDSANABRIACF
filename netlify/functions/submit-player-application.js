'use strict';

const { getEmailConfig } = require('./lib/club-email');
const { sendClubAdminNotification } = require('./lib/club-admin-notify-email');
const {
  normalizeDni,
  findApplicationByDniSeason,
  createPlayerApplication,
  applicationsRef
} = require('./lib/firestore-admin');
const { assertPublicActionsAllowed, isSiteUpdateModeError } = require('./lib/site-public-mode');

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

function buildNotifyFields(app) {
  return [
    { label: 'Temporada', value: app.season },
    { label: 'Categoría sugerida', value: app.category },
    { label: 'Domicilio', value: app.address || app.direccion },
    { label: 'Dirección tutor/a', value: app.guardianAddress },
    app.isMinor
      ? {
          label: 'Tutor/a',
          value: `${app.guardianName || ''} ${app.guardianSurname || ''} — DNI ${app.guardianDni} — ${app.guardianPhone} — ${app.guardianEmail}`
        }
      : null,
    { label: 'Estado', value: 'Pendiente de revisión en el panel de administración' },
    { label: 'ID solicitud', value: app.id || '—' },
    app.photoDataUrl ? { label: 'Foto', value: 'Incluida en la solicitud (panel admin)' } : null
  ].filter(Boolean);
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
    await assertPublicActionsAllowed();
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
      photoDataUrl: String(body.photoDataUrl || '').trim(),
      status: 'pending_review'
    });

    const cfg = getEmailConfig();
    if (cfg.ok) {
      try {
        await sendClubAdminNotification({
          kind: 'nuevo_jugador',
          title: 'Nueva solicitud de jugador/a',
          subject: `Nueva solicitud jugador/a — ${application.name} ${application.surname} (${application.season})`,
          requesterEmail: application.email,
          nombre: application.name,
          apellidos: application.surname,
          dni: application.dni,
          telefono: application.phone,
          email: application.email,
          fechaNacimiento: application.birthDate,
          direccion: application.address || application.direccion,
          fields: buildNotifyFields({ ...application, id: application.id })
        });
      } catch (mailErr) {
        console.warn('submit-player-application email:', mailErr);
      }
    }

    return json(200, { ok: true, application }, origin);
  } catch (err) {
    if (isSiteUpdateModeError(err)) {
      return json(503, { ok: false, error: err.message, code: 'site_update_mode' }, origin);
    }
    console.error('submit-player-application:', err);
    return json(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
