'use strict';

const DOC_ID = 'sitePublicMode';
const COLLECTION = 'sanabria_config';

const DEFAULT_MESSAGE =
  'Estamos actualizando la web del club. Puedes consultar la información, la tienda y el torneo, pero los registros e inscripciones están temporalmente desactivados. Disculpa las molestias.';

let cache = null;
let cacheAt = 0;
const TTL_MS = 12000;

function getDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no configurado en Netlify');
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return admin.firestore();
}

async function getSitePublicMode() {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;
  const snap = await getDb().collection(COLLECTION).doc(DOC_ID).get();
  const data = snap.exists ? snap.data() : {};
  cache = {
    actionsDisabled: data.actionsDisabled === true,
    message: String(data.message || DEFAULT_MESSAGE).trim() || DEFAULT_MESSAGE
  };
  cacheAt = now;
  return cache;
}

async function assertPublicActionsAllowed() {
  const mode = await getSitePublicMode();
  if (!mode.actionsDisabled) return mode;
  const err = new Error(mode.message);
  err.code = 'site_update_mode';
  err.statusCode = 503;
  throw err;
}

function isSiteUpdateModeError(err) {
  return !!(err && err.code === 'site_update_mode');
}

module.exports = {
  DEFAULT_MESSAGE,
  getSitePublicMode,
  assertPublicActionsAllowed,
  isSiteUpdateModeError
};
