'use strict';

const {
  updatePlayerProfileByPortal,
  normalizeDni
} = require('./lib/firestore-admin');
const { sendClubAdminNotification } = require('./lib/club-admin-notify-email');
const { sendPlayerProfileUpdateConfirmedEmail } = require('./lib/member-email');

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

function playerDisplayName(p) {
  return [p.name || p.nombre, p.surname || p.apellidos].filter(Boolean).join(' ').trim();
}

function mapDiffToNotifyFields(diff) {
  if (!Array.isArray(diff) || !diff.length) {
    return [{ label: 'Cambios', value: 'Sin cambios detectados' }];
  }
  return diff.map(function (c) {
    return {
      label: c.label + ' (antes → después)',
      value: (c.before || '—') + ' → ' + (c.after || '—')
    };
  });
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
    const password = String(body.password || '');
    if (!password || password.length < 6) {
      return json(400, { ok: false, error: 'Contraseña requerida' }, origin);
    }

    const result = await updatePlayerProfileByPortal({
      playerId: body.playerId,
      dni: normalizeDni(body.dni),
      name: body.name || body.nombre,
      surname: body.surname || body.apellidos,
      password: password,
      season: String(body.season || '').trim(),
      incoming: body.incoming || body.profile || {}
    });

    if (!result.ok) {
      const status =
        result.error === 'bad_password'
          ? 401
          : result.error === 'profile_locked'
            ? 403
            : result.error === 'sin_cambios'
              ? 400
              : 404;
      return json(status, { ok: false, error: result.error }, origin);
    }

    const player = result.player || {};
    const diff = result.diff || [];
    const notifyName = playerDisplayName(player);

    try {
      await sendClubAdminNotification({
        kind: 'jugador_ficha_actualizada',
        title: 'Ficha actualizada por el jugador/a',
        subject: 'Ficha jugador/a actualizada — ' + notifyName,
        nombre: player.name || player.nombre,
        apellidos: player.surname || player.apellidos,
        dni: player.dni,
        telefono: player.phone || player.telefono,
        email: player.email,
        requesterEmail: player.email,
        paymentChannel: result.paid ? 'inscripcion_pagada' : 'pendiente',
        fields: [
          { label: 'ID ficha', value: player.id || '—' },
          { label: 'Temporada', value: player.inscriptionSeason || '—' },
          { label: 'Estado inscripción', value: result.paid ? 'Pagada (cambios limitados)' : 'Pendiente / sin pagar' },
          ...mapDiffToNotifyFields(diff)
        ]
      });
    } catch (mailErr) {
      console.warn('update-player-profile club notify:', mailErr);
    }

    try {
      await sendPlayerProfileUpdateConfirmedEmail({
        email: player.email,
        guardianEmail: player.guardianEmail,
        nombre: player.name || player.nombre,
        apellidos: player.surname || player.apellidos,
        diff: diff
      });
    } catch (mailErr) {
      console.warn('update-player-profile player confirm:', mailErr);
    }

    return json(
      200,
      {
        ok: true,
        player: player,
        diff: diff,
        member: result.member || null
      },
      origin
    );
  } catch (e) {
    console.error('update-player-profile:', e);
    return json(500, { ok: false, error: 'Error interno' }, origin);
  }
};
