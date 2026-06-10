'use strict';

const {
  checkPlayerPortalAccess,
  verifyPlayerPortalLogin,
  loginPlayerForProfileEdit,
  setupPlayerPortalPassword,
  findPlayerForPortalLookup,
  emailMatchesPlayer,
  createPlayerPortalResetToken,
  resetPlayerPortalPasswordWithToken,
  normalizeDni
} = require('./lib/firestore-admin');
const { sendPlayerPortalResetEmail } = require('./lib/member-email');

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

function validatePassword(pwd) {
  const s = String(pwd || '');
  if (s.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  return null;
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
    const action = String(body.action || '').trim();
    const season = String(body.season || '').trim();
    const dni = normalizeDni(body.dni);

    if (action === 'check') {
      const result = await checkPlayerPortalAccess(
        dni,
        body.name || body.nombre,
        body.surname || body.apellidos,
        season
      );
      if (!result.ok) {
        return json(404, { ok: false, error: 'not_found' }, origin);
      }
      return json(200, { ok: true, ...result }, origin);
    }

    if (action === 'login') {
      const pwdErr = validatePassword(body.password);
      if (pwdErr) return json(400, { ok: false, error: pwdErr }, origin);
      const result = await verifyPlayerPortalLogin(
        dni,
        body.password,
        season,
        body.name || body.nombre,
        body.surname || body.apellidos
      );
      if (!result.ok) {
        const code = result.error === 'bad_password' ? 401 : 404;
        return json(code, { ok: false, error: result.error }, origin);
      }
      return json(200, { ok: true, player: result.player }, origin);
    }

    if (action === 'login_edit') {
      const pwdErr = validatePassword(body.password);
      if (pwdErr) return json(400, { ok: false, error: pwdErr }, origin);
      const result = await loginPlayerForProfileEdit(
        dni,
        body.password,
        season,
        body.name || body.nombre,
        body.surname || body.apellidos
      );
      if (!result.ok) {
        const code =
          result.error === 'bad_password'
            ? 401
            : result.error === 'no_password'
              ? 403
              : 404;
        return json(code, { ok: false, error: result.error }, origin);
      }
      return json(200, { ok: true, player: result.player }, origin);
    }

    if (action === 'setup') {
      const pwdErr = validatePassword(body.password);
      if (pwdErr) return json(400, { ok: false, error: pwdErr }, origin);
      const result = await setupPlayerPortalPassword(dni, body.email, body.password, season);
      if (!result.ok) {
        const status =
          result.error === 'email_mismatch' ? 403 : result.error === 'already_set' ? 409 : 404;
        return json(status, { ok: false, error: result.error }, origin);
      }
      return json(200, { ok: true, player: result.player }, origin);
    }

    if (action === 'request_reset') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return json(400, { ok: false, error: 'email inválido' }, origin);
      }
      const found = await findPlayerForPortalLookup(dni, body.name, body.surname, season);
      if (!found || !emailMatchesPlayer(found.data, email)) {
        return json(200, {
          ok: true,
          message:
            'Si los datos coinciden con una ficha, recibirás un correo con instrucciones en unos minutos.'
        }, origin);
      }
      const token = await createPlayerPortalResetToken(found.data.id);
      const mail = await sendPlayerPortalResetEmail({
        email,
        nombre: found.data.name || found.data.nombre,
        apellidos: found.data.surname || found.data.apellidos,
        token
      });
      if (!mail.sent) {
        return json(503, { ok: false, error: mail.reason || 'No se pudo enviar el correo' }, origin);
      }
      return json(200, {
        ok: true,
        message:
          'Si los datos coinciden con una ficha, recibirás un correo con instrucciones en unos minutos.'
      }, origin);
    }

    if (action === 'reset') {
      const pwdErr = validatePassword(body.password);
      if (pwdErr) return json(400, { ok: false, error: pwdErr }, origin);
      const result = await resetPlayerPortalPasswordWithToken(body.token, body.password);
      if (!result.ok) {
        const status = result.error === 'expired' ? 410 : 400;
        return json(status, { ok: false, error: result.error }, origin);
      }
      return json(200, { ok: true, player: result.player || null }, origin);
    }

    return json(400, { ok: false, error: 'Acción no válida' }, origin);
  } catch (e) {
    console.error('player-portal-auth:', e);
    return json(500, { ok: false, error: 'Error interno' }, origin);
  }
};
