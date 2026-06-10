'use strict';

const admin = require('firebase-admin');

function ensureFirebaseAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no configurado en Netlify');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  return admin;
}

function bearerToken(event) {
  const authHeader =
    (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function isClubAdminDoc(data) {
  if (!data || data.appScope !== 'cdsanabriacf') return false;
  return (
    data.isAdmin === true ||
    data.isSuperAdmin === true ||
    data.role === 'admin' ||
    data.role === 'super_admin'
  );
}

/**
 * Verifica Firebase ID token y documento sanabria_admins/{uid}.
 */
async function verifyAdminRequest(event) {
  const token = bearerToken(event);
  if (!token) {
    return { ok: false, statusCode: 401, error: 'Se requiere sesión de administrador (Bearer token)' };
  }
  try {
    const adm = ensureFirebaseAdmin();
    const decoded = await adm.auth().verifyIdToken(token);
    const snap = await adm.firestore().collection('sanabria_admins').doc(decoded.uid).get();
    if (!snap.exists || !isClubAdminDoc(snap.data())) {
      return { ok: false, statusCode: 403, error: 'Sin permisos de administrador del club' };
    }
    return {
      ok: true,
      uid: decoded.uid,
      email: decoded.email || snap.data().email || ''
    };
  } catch (e) {
    console.warn('verifyAdminRequest:', e.message || e);
    return { ok: false, statusCode: 401, error: 'Token de administrador inválido o caducado' };
  }
}

/**
 * Invocación programada de Netlify (cron) o secreto interno.
 */
function isNetlifyScheduledInvocation(event) {
  const h = event.headers || {};
  const ua = String(h['user-agent'] || h['User-Agent'] || '').toLowerCase();
  return (
    String(h['x-netlify-scheduled'] || '').toLowerCase() === 'true' ||
    String(h['x-nf-scheduled'] || '').toLowerCase() === 'true' ||
    String(h['x-netlify-event'] || '').toLowerCase() === 'schedule' ||
    ua.includes('netlify-scheduled')
  );
}

function verifyCronSecret(event) {
  const secret = String(process.env.NETLIFY_CRON_SECRET || '').trim();
  if (!secret) return false;
  const token = bearerToken(event);
  return token === secret;
}

/**
 * Renovación automática: solo cron de Netlify o admin autenticado.
 */
async function verifySeasonRenewalRequest(event) {
  if (isNetlifyScheduledInvocation(event) || verifyCronSecret(event)) {
    return { ok: true, source: 'cron' };
  }
  return verifyAdminRequest(event);
}

module.exports = {
  ensureFirebaseAdmin,
  verifyAdminRequest,
  verifySeasonRenewalRequest,
  isNetlifyScheduledInvocation,
  isClubAdminDoc
};
