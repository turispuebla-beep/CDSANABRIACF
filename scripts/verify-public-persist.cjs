/**
 * Prueba segura de persistencia pública → Firebase (vía Netlify Functions).
 *
 * Crea registros claramente ficticios (emails @example.invalid, testRunId).
 * Guarda IDs en scripts/.verify-public-persist-manifest.json para borrarlos después.
 *
 * Uso:
 *   1. Desactiva el modo actualización en la web (Actualización: OFF).
 *   2. node scripts/verify-public-persist.cjs --run
 *   3. node scripts/verify-public-persist.cjs --cleanup
 *
 * Opciones:
 *   --run              Ejecuta las 4 pruebas (socio, amigo, inscripción, solicitud).
 *   --cleanup          Borra solo los IDs del último manifiesto (requiere credenciales).
 *   --check-mode       Solo comprueba si el modo actualización bloquea registros.
 *   --base-url URL     Por defecto https://www.cdsanabriacf.com
 *
 * Credenciales para --cleanup (una de las dos):
 *   - Variable FIREBASE_SERVICE_ACCOUNT_JSON (JSON en una línea)
 *   - firebase login + firebase CLI en PATH (fallback por consulta testRunId)
 *
 * Para empezar de cero (borra TODOS socios/jugadores/solicitudes, no solo prueba):
 *   powershell -File scripts/reset-socios-jugadores.ps1
 *   (no borra amigos; usa --cleanup o borra sanabria_friends manualmente)
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MANIFEST_PATH = path.join(__dirname, '.verify-public-persist-manifest.json');
const DEFAULT_BASE = 'https://www.cdsanabriacf.com';
const PROJECT_ID = 'cdsanabriacf2026';

function parseArgs(argv) {
  const args = { run: false, cleanup: false, checkMode: false, baseUrl: DEFAULT_BASE };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run') args.run = true;
    else if (a === '--cleanup') args.cleanup = true;
    else if (a === '--check-mode') args.checkMode = true;
    else if (a === '--base-url' && argv[i + 1]) {
      args.baseUrl = String(argv[++i]).replace(/\/$/, '');
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    }
  }
  return args;
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function activeSeason() {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 5) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function buildTestBundle() {
  const ts = Date.now();
  const runId = `CDSAN_TEST_${ts}`;
  const season = activeSeason();
  const tag = String(ts).slice(-8);
  return {
    runId,
    season,
    member: {
      nombre: 'Prueba',
      apellidos: 'Socio Automatizado',
      name: 'Prueba',
      surname: 'Socio Automatizado',
      email: `cdsanabriacf-socio+${tag}@example.invalid`,
      dni: `T${tag}S`,
      telefono: '600000001',
      appScope: 'cdsanabriacf',
      registrationSource: 'automated_test',
      testRunId: runId,
      status: 'pending_validation',
      estado: 'pendiente'
    },
    friend: {
      nombre: 'Prueba',
      apellidos: 'Amigo Automatizado',
      name: 'Prueba',
      surname: 'Amigo Automatizado',
      email: `cdsanabriacf-amigo+${tag}@example.invalid`,
      dni: `T${tag}A`,
      telefono: '600000002',
      appScope: 'cdsanabriacf',
      registrationSource: 'automated_test',
      testRunId: runId,
      status: 'active',
      estado: 'activo'
    },
    player: {
      nombre: 'Prueba',
      apellidos: 'Jugador Automatizado',
      name: 'Prueba',
      surname: 'Jugador Automatizado',
      email: `cdsanabriacf-jugador+${tag}@example.invalid`,
      dni: `T${tag}J`,
      telefono: '600000003',
      birthDate: '2010-06-15',
      fechaNacimiento: '2010-06-15',
      category: 'alevin',
      categoria: 'alevin',
      inscriptionSeason: season,
      temporada: season,
      registrationSource: 'web_inscription',
      appScope: 'cdsanabriacf',
      testRunId: runId,
      inscriptionStatus: 'pending'
    },
    application: {
      season,
      name: 'Prueba',
      surname: 'Solicitud Automatizada',
      email: `cdsanabriacf-solicitud+${tag}@example.invalid`,
      phone: '600000004',
      birthDate: '2012-04-20',
      dni: `T${tag}P`,
      category: 'alevin',
      address: 'Calle Ficticia 1, Puebla de Sanabria',
      commitmentAccepted: true,
      clubRulesAccepted: true,
      portalPasswordHash: sha256('Test1234!'),
      isMinor: true,
      guardianName: 'Tutor',
      guardianSurname: 'Prueba',
      guardianDni: '12345678Z',
      guardianPhone: '600000005',
      guardianEmail: `cdsanabriacf-tutor+${tag}@example.invalid`,
      testRunId: runId
    }
  };
}

async function postJson(baseUrl, fnPath, body) {
  const url = `${baseUrl}/.netlify/functions/${fnPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, url };
}

async function checkUpdateMode(baseUrl) {
  const probe = await postJson(baseUrl, 'submit-member-registration', {});
  if (probe.status === 503 && probe.json.code === 'site_update_mode') {
    return { blocked: true, message: probe.json.error || 'Modo actualización activo' };
  }
  if (probe.status === 400 && /ausentes/i.test(String(probe.json.error || ''))) {
    return { blocked: false, message: 'Registros públicos abiertos (endpoint responde)' };
  }
  if (probe.status === 500 && /FIREBASE_SERVICE_ACCOUNT/i.test(String(probe.json.error || ''))) {
    return { blocked: true, message: 'FIREBASE_SERVICE_ACCOUNT_JSON no configurada en Netlify' };
  }
  return { blocked: false, message: `Respuesta probe: HTTP ${probe.status}` };
}

function saveManifest(data) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function printHelp() {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 24).join('\n'));
}

async function runTests(baseUrl) {
  const mode = await checkUpdateMode(baseUrl);
  console.log('\n=== Modo actualización ===');
  console.log(mode.blocked ? `⛔ BLOQUEADO: ${mode.message}` : `✅ OK: ${mode.message}`);
  if (mode.blocked) {
    console.log('\nDesactiva «Actualización: OFF» en la web antes de continuar.');
    process.exit(2);
  }

  const bundle = buildTestBundle();
  console.log('\n=== Prueba persistencia pública ===');
  console.log(`Base: ${baseUrl}`);
  console.log(`testRunId: ${bundle.runId}`);
  console.log(`Emails: @example.invalid (no reales)\n`);

  const results = {};
  const steps = [
    {
      key: 'member',
      fn: 'submit-member-registration',
      body: { member: bundle.member },
      pickId: (j) => j.memberId || (j.member && j.member.id)
    },
    {
      key: 'friend',
      fn: 'submit-friend-registration',
      body: { friend: bundle.friend },
      pickId: (j) => j.friendId || (j.friend && j.friend.id)
    },
    {
      key: 'player',
      fn: 'submit-player-inscription',
      body: { player: bundle.player },
      pickId: (j) => j.playerId || (j.player && j.player.id)
    },
    {
      key: 'application',
      fn: 'submit-player-application',
      body: bundle.application,
      pickId: (j) => (j.application && j.application.id) || j.applicationId
    }
  ];

  let failed = 0;
  for (const step of steps) {
    const res = await postJson(baseUrl, step.fn, step.body);
    const ok = res.status >= 200 && res.status < 300 && res.json.ok;
    const id = ok ? step.pickId(res.json) : null;
    results[step.key] = { ok, status: res.status, id, error: res.json.error || null, code: res.json.code || null };
    console.log(`${ok ? '✅' : '❌'} ${step.key.padEnd(12)} HTTP ${res.status}  id=${id || '—'}`);
    if (!ok) {
      failed++;
      console.log(`   → ${res.json.error || 'sin detalle'}${res.json.code ? ` (${res.json.code})` : ''}`);
    }
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    baseUrl,
    testRunId: bundle.runId,
    season: bundle.season,
    projectId: PROJECT_ID,
    records: {
      members: results.member.id ? [results.member.id] : [],
      friends: results.friend.id ? [results.friend.id] : [],
      players: results.player.id ? [results.player.id] : [],
      player_applications: results.application.id ? [results.application.id] : []
    },
    emails: {
      member: bundle.member.email,
      friend: bundle.friend.email,
      player: bundle.player.email,
      application: bundle.application.email
    },
    results
  };

  saveManifest(manifest);
  console.log(`\nManifiesto: ${MANIFEST_PATH}`);

  if (failed === 0) {
    console.log('\n✅ Las 4 pruebas guardaron en Firebase. Para borrar solo estos registros:');
    console.log('   node scripts/verify-public-persist.cjs --cleanup');
  } else {
    console.log(`\n⚠️ ${failed} prueba(s) fallaron. Revisa el manifiesto y Netlify/Firebase.`);
    process.exit(1);
  }
}

function initFirebaseAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return admin.firestore();
}

async function deleteDoc(db, collection, id) {
  if (!id) return { skipped: true };
  await db.collection(collection).doc(String(id)).delete();
  return { deleted: true, collection, id };
}

async function cleanupByTestRunId(db, testRunId) {
  const cols = ['sanabria_members', 'sanabria_friends', 'sanabria_players', 'sanabria_player_applications'];
  const deleted = [];
  for (const col of cols) {
    const snap = await db.collection(col).where('testRunId', '==', testRunId).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
      deleted.push({ collection: col, id: doc.id });
    }
  }
  return deleted;
}

async function cleanupManifest() {
  const manifest = loadManifest();
  if (!manifest) {
    console.error('No hay manifiesto. Ejecuta antes: node scripts/verify-public-persist.cjs --run');
    process.exit(1);
  }

  console.log('\n=== Limpieza registros de prueba ===');
  console.log(`testRunId: ${manifest.testRunId}`);
  console.log(`Creado: ${manifest.createdAt}\n`);

  const db = initFirebaseAdmin();
  if (db) {
    const map = {
      members: 'sanabria_members',
      friends: 'sanabria_friends',
      players: 'sanabria_players',
      player_applications: 'sanabria_player_applications'
    };
    let count = 0;
    for (const [key, col] of Object.entries(map)) {
      const ids = manifest.records[key] || [];
      for (const id of ids) {
        await deleteDoc(db, col, id);
        console.log(`🗑️  ${col}/${id}`);
        count++;
      }
    }
    const extra = await cleanupByTestRunId(db, manifest.testRunId);
    for (const row of extra) {
      if (!(manifest.records[row.collection.replace('sanabria_', '')] || []).includes(row.id)) {
        console.log(`🗑️  ${row.collection}/${row.id} (por testRunId)`);
        count++;
      }
    }
    console.log(`\n✅ Borrados ${count} documento(s).`);
    fs.unlinkSync(MANIFEST_PATH);
    console.log('Manifiesto eliminado.');
    return;
  }

  console.log('FIREBASE_SERVICE_ACCOUNT_JSON no está en el entorno.');
  console.log('Alternativa: firebase login y borrar por testRunId con CLI...\n');

  const map = {
    members: 'sanabria_members',
    friends: 'sanabria_friends',
    players: 'sanabria_players',
    player_applications: 'sanabria_player_applications'
  };
  let any = false;
  for (const [key, col] of Object.entries(map)) {
    const ids = manifest.records[key] || [];
    for (const id of ids) {
      any = true;
      const cmd = spawnSync(
        'firebase',
        ['firestore:delete', `${col}/${id}`, '--force', '--project', PROJECT_ID],
        { stdio: 'inherit', shell: true }
      );
      if (cmd.status !== 0) {
        console.error(`No se pudo borrar ${col}/${id}. ¿firebase login?`);
        process.exit(1);
      }
    }
  }
  if (!any) {
    console.log('No hay IDs en el manifiesto.');
  } else {
    fs.unlinkSync(MANIFEST_PATH);
    console.log('\n✅ Limpieza por manifiesto completada.');
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.run && !args.cleanup && !args.checkMode)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  if (args.checkMode) {
    const mode = await checkUpdateMode(args.baseUrl);
    console.log(mode.blocked ? `⛔ ${mode.message}` : `✅ ${mode.message}`);
    process.exit(mode.blocked ? 2 : 0);
  }
  if (args.cleanup) {
    await cleanupManifest();
    return;
  }
  if (args.run) {
    await runTests(args.baseUrl);
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
