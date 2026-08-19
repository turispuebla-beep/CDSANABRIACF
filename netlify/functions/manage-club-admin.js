'use strict';

/**
 * Crea o actualiza un administrador/organizador en Firebase Authentication
 * y el documento sanabria_admins/{uid} (el ID debe ser el UID o no podrá entrar).
 */
const { ensureFirebaseAdmin, verifyAdminRequest } = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');

const ROLE_SPEC = {
  competition_organizer: {
    role: 'competition_organizer',
    isAdmin: false,
    isSuperAdmin: false
  },
  team_admin: {
    role: 'admin',
    isAdmin: true,
    isSuperAdmin: false
  },
  assistant_admin: {
    role: 'admin',
    isAdmin: true,
    isSuperAdmin: false
  },
  admin: {
    role: 'admin',
    isAdmin: true,
    isSuperAdmin: false
  }
};

function normalizeEmail(v) {
  return String(v || '')
    .trim()
    .toLowerCase();
}

function assertPassword(password) {
  const p = String(password || '');
  if (p.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  const gate = await verifyAdminRequest(event);
  if (!gate.ok) {
    return jsonResponse(gate.statusCode || 401, { ok: false, error: gate.error }, origin);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const email = normalizeEmail(body.email);
    const name = String(body.name || '').trim();
    const password = body.password != null ? String(body.password) : '';
    const roleKey = String(body.role || 'competition_organizer').trim();
    const spec = ROLE_SPEC[roleKey] || ROLE_SPEC.competition_organizer;

    if (!email || !email.includes('@')) {
      return jsonResponse(400, { ok: false, error: 'Email no válido.' }, origin);
    }
    if (email === 'amco@gmx.es') {
      return jsonResponse(
        400,
        { ok: false, error: 'No se puede crear ni cambiar el administrador principal desde aquí.' },
        origin
      );
    }
    assertPassword(password);

    const adm = ensureFirebaseAdmin();
    const authApi = adm.auth();
    const db = adm.firestore();

    let user;
    let created = false;
    try {
      user = await authApi.getUserByEmail(email);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      user = null;
    }

    if (!user) {
      user = await authApi.createUser({
        email,
        password,
        displayName: name || email,
        emailVerified: true
      });
      created = true;
    } else {
      const patch = { password: password, emailVerified: true };
      if (name) patch.displayName = name;
      await authApi.updateUser(user.uid, patch);
    }

    const doc = {
      appScope: 'cdsanabriacf',
      isAdmin: spec.isAdmin,
      isSuperAdmin: spec.isSuperAdmin,
      role: spec.role,
      email,
      name: name || user.displayName || email,
      updatedAt: new Date().toISOString(),
      updatedBy: gate.email || gate.uid
    };
    if (created) doc.createdAt = doc.updatedAt;

    await db.collection('sanabria_admins').doc(user.uid).set(doc, { merge: true });

    return jsonResponse(
      200,
      {
        ok: true,
        uid: user.uid,
        email,
        role: spec.role,
        created
      },
      origin
    );
  } catch (e) {
    console.warn('manage-club-admin:', e.message || e);
    return jsonResponse(400, { ok: false, error: e.message || 'No se pudo guardar el acceso' }, origin);
  }
};
