'use strict';

const { getEmailConfig } = require('./lib/club-email');
const { sendClubAdminNotification } = require('./lib/club-admin-notify-email');
const { sendTorneoPreinscripcionConfirmedEmail } = require('./lib/member-email');
const { createTorneoPreinscripcionRecord, torneoCategoryLabels } = require('./lib/firestore-admin');
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
    const raw = body.preinscripcion && typeof body.preinscripcion === 'object' ? body.preinscripcion : body;
    const saved = await createTorneoPreinscripcionRecord({
      eventName: raw.eventName,
      teamName: raw.teamName,
      playerCount: raw.playerCount,
      town: raw.town,
      categories: raw.categories,
      contactName: raw.contactName,
      contactEmail: raw.contactEmail,
      contactPhone: raw.contactPhone,
      localId: raw.localId || raw.id,
      source: 'web'
    });

    let emailClubSent = false;
    let emailContactSent = false;
    const cfg = getEmailConfig();
    if (cfg.ok) {
      const cats = torneoCategoryLabels(saved.categories);
      try {
        await sendClubAdminNotification({
          kind: 'torneo_preinscripcion',
          title: 'Nueva preinscripción torneo',
          subject: `Preinscripción torneo — ${saved.teamName} (${cats.join(', ') || '—'})`,
          requesterEmail: saved.contactEmail,
          nombre: saved.contactName,
          telefono: saved.contactPhone,
          email: saved.contactEmail,
          fields: [
            { label: 'Evento', value: saved.eventName },
            { label: 'Equipo', value: saved.teamName },
            { label: 'Población', value: saved.town },
            { label: 'Categorías', value: cats.join(', ') },
            { label: 'Nº jugadores (aprox.)', value: saved.playerCount },
            { label: 'Cuota estimada', value: saved.estimatedFeeEur != null ? saved.estimatedFeeEur + ' €' : '—' },
            { label: 'Cód. responsable', value: saved.responsibleCode || '—' },
            { label: 'Cód. equipo', value: saved.accessCode || '—' },
            { label: 'Contacto', value: saved.contactName },
            { label: 'Email contacto', value: saved.contactEmail },
            { label: 'Teléfono', value: saved.contactPhone },
            { label: 'ID preinscripción', value: saved.id }
          ]
        });
        emailClubSent = true;
      } catch (mailErr) {
        console.warn('submit-torneo-preinscripcion club email:', mailErr);
      }

      try {
        const contactResult = await sendTorneoPreinscripcionConfirmedEmail(saved);
        emailContactSent = !!contactResult.sent;
      } catch (mailErr) {
        console.warn('submit-torneo-preinscripcion contact email:', mailErr);
      }
    }

    return json(
      200,
      {
        ok: true,
        id: saved.id,
        preinscripcion: saved,
        emailClubSent,
        emailContactSent
      },
      origin
    );
  } catch (err) {
    if (isSiteUpdateModeError(err)) {
      return json(503, { ok: false, error: err.message, code: 'site_update_mode' }, origin);
    }
    console.error('submit-torneo-preinscripcion:', err);
    return json(500, { ok: false, error: err.message || 'Error interno' }, origin);
  }
};
