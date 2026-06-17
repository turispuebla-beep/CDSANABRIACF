'use strict';

/**
 * Crea usuario Authentication + documento sanabria_admins para organizador F7.
 * Uso:
 *   $env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content .\ruta\service-account.json -Raw
 *   node scripts/create-competition-organizer.js
 *
 * Opcional:
 *   ORGANIZER_EMAIL, ORGANIZER_PASSWORD, ORGANIZER_NAME
 */

const admin = require('firebase-admin');

const PROJECT_ID = 'cdsanabriacf2026';
const DEFAULT_EMAIL = 'cdsanabriafc+torneo@gmail.com';
const DEFAULT_NAME = 'Organizador Torneo F7';
const DEFAULT_PASSWORD = 'TorneoF7-2026-Sanabria';

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
    'Falta FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS. ' +
      'Copia el JSON de cuenta de servicio (Firebase Console → Configuración → Cuentas de servicio).'
  );
}

async function main() {
  const email = String(process.env.ORGANIZER_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
  const password = String(process.env.ORGANIZER_PASSWORD || DEFAULT_PASSWORD);
  const name = String(process.env.ORGANIZER_NAME || DEFAULT_NAME).trim();

  const adm = initAdmin();
  const auth = adm.auth();
  const db = adm.firestore();

  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log('Usuario ya existía en Authentication:', user.uid);
    await auth.updateUser(user.uid, { password, displayName: name, emailVerified: true });
    console.log('Contraseña y nombre actualizados.');
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true
    });
    console.log('Usuario creado en Authentication:', user.uid);
  }

  const doc = {
    appScope: 'cdsanabriacf',
    isAdmin: false,
    isSuperAdmin: false,
    role: 'competition_organizer',
    email,
    name,
    updatedAt: new Date().toISOString()
  };

  await db.collection('sanabria_admins').doc(user.uid).set(doc, { merge: true });
  console.log('Documento sanabria_admins/' + user.uid + ' guardado.');
  console.log('');
  console.log('=== ACCESO ORGANIZADOR TORNEO F7 ===');
  console.log('Email:    ', email);
  console.log('Password: ', password);
  console.log('UID:      ', user.uid);
  console.log('Panel:    Acceso administrador en la web → admin-panel.html (solo Competiciones)');
}

main().catch(function (err) {
  console.error('Error:', err.message || err);
  process.exit(1);
});
