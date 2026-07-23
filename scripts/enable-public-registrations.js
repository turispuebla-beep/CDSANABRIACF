'use strict';

/**
 * Desactiva el "modo actualización" (sanabria_config/sitePublicMode).
 * Reabre: preinscripción torneo, socios, amigos, nuevo jugador, etc.
 *
 * Uso (PowerShell, una vez por sesión):
 *   $env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content .\ruta\service-account.json -Raw
 *   node scripts/enable-public-registrations.js
 *
 * O con GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON.
 */

const admin = require('firebase-admin');

const PROJECT_ID = 'cdsanabriacf2026';
const DOC_PATH = 'sanabria_config/sitePublicMode';

function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(raw)),
      projectId: PROJECT_ID
    });
    return admin;
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
    return admin;
  }
  throw new Error(
    'Falta FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS.\n' +
      'Copia el JSON de cuenta de servicio desde Firebase Console → Configuración → Cuentas de servicio.'
  );
}

async function main() {
  const db = initAdmin().firestore();
  const ref = db.doc(DOC_PATH);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : {};

  await ref.set(
    {
      appScope: 'cdsanabriacf',
      actionsDisabled: false,
      message: String(prev.message || '').trim() || 'Estamos actualizando la web del club.',
      updatedAt: new Date().toISOString(),
      updatedBy: 'deploy-cmd-enable-public-registrations'
    },
    { merge: true }
  );

  console.log('');
  console.log('OK — Modo actualización DESACTIVADO en Firestore.');
  console.log('   Preinscripción torneo F7: ABIERTA');
  console.log('   También reabiertos: socios, amigos, nuevo jugador, tienda/eventos.');
  console.log('');
}

main().catch(function (err) {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
