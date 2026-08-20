'use strict';

/**
 * Borra avisos de sanabria_notifications por título exacto.
 *
 *   node scripts/delete-club-notifications-by-title.js
 *
 * Credenciales: FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS
 * o variables de Netlify (netlify env:list --json).
 */

const { execSync } = require('child_process');
const path = require('path');
const admin = require('firebase-admin');

const PROJECT_ID = 'cdsanabriacf2026';
const COLLECTION = 'sanabria_notifications';

const TITLES = [
  'HORARIO DE LOS PARTIDOS',
  'TORNEO FÚTBOL 7',
  'PARTIDO AMISTOSO',
  'PARTIDO AMISTOSO CD SANABRIA CF'
];

function normTitle(v) {
  return String(v || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const WANTED = new Set(TITLES.map(normTitle));

function loadServiceAccount() {
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawEnv) return JSON.parse(rawEnv);
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) return require(keyPath);
  const root = path.join(__dirname, '..');
  const out = execSync('netlify env:list --json', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const map = JSON.parse(out);
  const raw = map.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('No FIREBASE_SERVICE_ACCOUNT_JSON');
  if (typeof raw === 'object' && raw.value) {
    return typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value;
  }
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function main() {
  const cred = loadServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(cred),
      projectId: PROJECT_ID
    });
  }
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).get();
  const toDelete = [];
  snap.forEach(function (doc) {
    const data = doc.data() || {};
    const title = normTitle(data.title);
    if (WANTED.has(title)) {
      toDelete.push({ id: doc.id, title: data.title, sentAt: data.sentAt || data.timestamp || '' });
    }
  });
  console.log('Colección:', COLLECTION);
  console.log('Documentos totales:', snap.size);
  console.log('A borrar:', toDelete.length);
  toDelete.forEach(function (row) {
    console.log(' -', row.id, '|', row.title, '|', row.sentAt);
  });
  for (let i = 0; i < toDelete.length; i++) {
    await db.collection(COLLECTION).doc(toDelete[i].id).delete();
  }
  console.log('OK — borrados', toDelete.length);
}

main().catch(function (err) {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
