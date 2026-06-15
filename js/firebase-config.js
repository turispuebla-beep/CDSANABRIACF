/**
 * ðŸ”¥ CONFIGURACIÃ“N FIREBASE - CDSANABRIACF
 * ConfiguraciÃ³n completa para Firebase con el proyecto mejorado
 */

// ðŸ”¥ ConfiguraciÃ³n Firebase para CDSANABRIACF2026 - CREDENCIALES REALES
const firebaseConfig = {
  apiKey: "AIzaSyBlCY7mDrT7edTo79Gy4aVJbWPnFDevbro",
  authDomain: "cdsanabriacf2026.firebaseapp.com",
  projectId: "cdsanabriacf2026",
  storageBucket: "cdsanabriacf2026.firebasestorage.app",
  messagingSenderId: "452462278881",
  appId: "1:452462278881:web:51a6452bd360265de4dfa0"
};

// ðŸ“ INSTRUCCIONES PARA CONFIGURAR FIREBASE:
// 1. Ve a https://console.firebase.google.com
// 2. Crea un nuevo proyecto llamado "CDSANABRIACF2026" con ID "cdsanabriacf2026"
// 3. Habilita Authentication, Firestore Database, Cloud Messaging
// 4. Ve a Project Settings > General > Your apps
// 5. Agrega una app web y copia la configuraciÃ³n aquÃ­
// 6. Reemplaza todos los valores de arriba con los reales

// ðŸš€ Inicializar Firebase (SDK 10.12.x: Firestore con caché persistente en IndexedDB)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js';
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentSingleTabManager,
  CACHE_SIZE_UNLIMITED,
  setDoc,
  doc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import {
  getAuth,
  connectAuthEmulator,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging.js';

// Inicializar Firebase para CDSANABRIACF2026
let app, db, auth, storage;

try {
  app = initializeApp(firebaseConfig);
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      })
    });
    console.log('Firebase CDSANABRIACF2026: Firestore con caché persistente local (IndexedDB)');
  } catch (persistErr) {
    console.warn('Firestore: caché persistente no disponible, usando instancia estándar:', persistErr);
    db = getFirestore(app);
  }
  auth = getAuth(app);
  storage = getStorage(app);
  console.log('Firebase CDSANABRIACF2026 configurado correctamente');
} catch (error) {
  console.error('âŒ Error inicializando Firebase:', error);
  // Fallback a modo simulaciÃ³n
  app = { isSimulation: true };
  db = { isSimulation: true };
  auth = { isSimulation: true };
  storage = { isSimulation: true };
  console.log('ðŸ”¥ Firebase en modo simulaciÃ³n - usando persistencia local robusta');
}

// Inicializar Cloud Messaging (para notificaciones push)
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.warn('âš ï¸ Cloud Messaging no disponible:', error);
}

// ðŸ“Š Estructura de la Base de Datos Firestore - CD SANABRIA CF
// CD Sanabria CF — Firebase cdsanabriacf2026, appScope cdsanabriacf, colecciones sanabria_*
const DB_COLLECTIONS = {
  // Usuarios SOLO de Sanabria (NO compartido)
  USERS: 'sanabria_users',
  ADMINS: 'sanabria_admins',
  
  // Datos del club CD SANABRIA CF
  MEMBERS: 'sanabria_members',        // Socios del club
  PLAYERS: 'sanabria_players',        // Jugadores
  PLAYER_APPLICATIONS: 'sanabria_player_applications', // Solicitudes nuevo jugador
  TORNEO_PREINSCRIPTIONS: 'sanabria_torneo_preinscripciones', // Preinscripciones torneo F7
  COACHES: 'sanabria_coaches',        // Entrenadores
  BOARD: 'sanabria_board',            // Directiva
  TEAMS: 'sanabria_teams',            // Equipos
  FRIENDS: 'sanabria_friends',        // Amigos del club
  
  // Contenido CD SANABRIA CF
  EVENTS: 'sanabria_events',          // Eventos y actividades
  MATCHES: 'sanabria_matches',        // Encuentros/partidos
  CALENDAR: 'sanabria_calendar_events', // Calendario interno
  NEWS: 'sanabria_news',              // Noticias
  DOCUMENTS: 'sanabria_documents',    // Documentos oficiales
  MEDIA: 'sanabria_media',            // Fotos y videos
  COMPETITIONS: 'sanabria_competitions', // Competiciones
  ADS: 'sanabria_ads',                // Publicidad/anuncios
  LEDGER: 'sanabria_accounting_ledger', // Asientos contables (A/B)
  
  // Sistema SOLO Sanabria
  NOTIFICATIONS: 'sanabria_notifications',  // Notificaciones Push
  FCM_TOKENS: 'sanabria_fcm_tokens',        // Tokens de dispositivos
  AUDIT_LOGS: 'sanabria_audit_logs',        // Logs de auditorÃ­a
  SETTINGS: 'sanabria_config',              // Configuraciones
  STATS: 'sanabria_statistics',             // EstadÃ­sticas
  PAYMENTS: 'sanabria_payments'             // Pagos TPV / PayGold
};

const APP_SCOPE = 'cdsanabriacf';

function normalizeCollectionName(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return name;
  const aliases = {
    users: DB_COLLECTIONS.USERS,
    admins: DB_COLLECTIONS.ADMINS,
    members: DB_COLLECTIONS.MEMBERS,
    friends: DB_COLLECTIONS.FRIENDS,
    players: DB_COLLECTIONS.PLAYERS,
    player_applications: DB_COLLECTIONS.PLAYER_APPLICATIONS,
    clubPlayerApplications: DB_COLLECTIONS.PLAYER_APPLICATIONS,
    torneo_preinscripciones: DB_COLLECTIONS.TORNEO_PREINSCRIPTIONS,
    clubTorneoPreinscripciones: DB_COLLECTIONS.TORNEO_PREINSCRIPTIONS,
    coaches: DB_COLLECTIONS.COACHES,
    board: DB_COLLECTIONS.BOARD,
    directiva: DB_COLLECTIONS.BOARD,
    clubboard: DB_COLLECTIONS.BOARD,
    teams: DB_COLLECTIONS.TEAMS,
    events: DB_COLLECTIONS.EVENTS,
    clubcalendarevents: DB_COLLECTIONS.CALENDAR,
    calendarevents: DB_COLLECTIONS.CALENDAR,
    encuentros: DB_COLLECTIONS.MATCHES,
    competitions: DB_COLLECTIONS.COMPETITIONS,
    competiciones: DB_COLLECTIONS.COMPETITIONS,
    ledger: DB_COLLECTIONS.LEDGER,
    accountingledger: DB_COLLECTIONS.LEDGER,
    clubaccountingledger: DB_COLLECTIONS.LEDGER,
    news: DB_COLLECTIONS.NEWS,
    documents: DB_COLLECTIONS.DOCUMENTS,
    media: DB_COLLECTIONS.MEDIA,
    ads: DB_COLLECTIONS.ADS,
    clubpublicidad: DB_COLLECTIONS.ADS,
    publicidad: DB_COLLECTIONS.ADS,
    anuncios: DB_COLLECTIONS.ADS,
    notifications: DB_COLLECTIONS.NOTIFICATIONS,
    pushmessages: DB_COLLECTIONS.NOTIFICATIONS,
    club_notifications: DB_COLLECTIONS.NOTIFICATIONS,
    settings: DB_COLLECTIONS.SETTINGS,
    config: DB_COLLECTIONS.SETTINGS,
    clubsettings: DB_COLLECTIONS.SETTINGS,
    clubthemesettings: DB_COLLECTIONS.SETTINGS,
    clubcontactinfo: DB_COLLECTIONS.SETTINGS,
    cdsanabriacfsettings: DB_COLLECTIONS.SETTINGS,
    teamsettings: DB_COLLECTIONS.SETTINGS,
    teamadmins: DB_COLLECTIONS.ADMINS,
    cdsanabriacfteamadmins: DB_COLLECTIONS.ADMINS,
    audit_logs: DB_COLLECTIONS.AUDIT_LOGS,
    payments: DB_COLLECTIONS.PAYMENTS,
    sanabria_payments: DB_COLLECTIONS.PAYMENTS
  };
  return aliases[name] || name;
}

function sanitizePayload(value, options = {}) {
  const stripPwd = options.keepPassword !== true;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizePayload(v, options));
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((k) => {
      if (stripPwd && (k === 'password' || k === 'pass' || k === 'plainPassword')) return;
      const v = value[k];
      if (typeof v === 'undefined') return;
      if (v === 'undefined') return;
      out[k] = sanitizePayload(v, options);
    });
    return out;
  }
  return value;
}

/** Convierte Timestamp de Firestore o fechas raras a ISO string para localStorage/JSON */
function firestoreDateToIso(val) {
  if (val == null || val === '') return null;
  try {
    if (typeof val.toDate === 'function') {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
  } catch (e) {}
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    const ms = val.seconds * 1000 + (typeof val.nanoseconds === 'number' ? val.nanoseconds / 1e6 : 0);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fecha calendario YYYY-MM-DD (hora local) desde string o Timestamp Firestore */
function toYYYYMMDD(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val.trim())) return val.trim().slice(0, 10);
  const iso = firestoreDateToIso(val);
  if (!iso) return null;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * Unifica evento del panel (EN) y documentos legacy (ES) + Timestamps.
 * Garantiza date, title, name, status para index.html / calendario público.
 */
function normalizeClubEventDocForLocal(docId, data) {
  const d = data && typeof data === 'object' ? { ...data } : {};
  const dateYmd = toYYYYMMDD(d.date) || toYYYYMMDD(d.fecha);
  const titleStr = (d.title || d.name || d.titulo || d.nombre || 'Evento').toString().trim() || 'Evento';
  const descStr = (d.description ?? d.descripcion ?? '').toString();
  const raw = (d.status || d.estado || 'upcoming').toString().toLowerCase();
  const statusMap = {
    activo: 'upcoming',
    active: 'upcoming',
    pendiente: 'upcoming',
    finalizado: 'finalizado',
    finished: 'finalizado',
    cancelado: 'cancelado',
    canceled: 'cancelado',
    upcoming: 'upcoming'
  };
  const st = statusMap[raw] || (['upcoming', 'finalizado', 'cancelado'].includes(raw) ? raw : 'upcoming');
  const dateOut = dateYmd || (typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d.date) ? d.date.slice(0, 10) : d.date) || '';

  return {
    ...d,
    id: docId,
    title: d.title || titleStr,
    name: d.name || d.title || titleStr,
    titulo: d.titulo || titleStr,
    date: dateOut,
    fecha: d.fecha || dateYmd || dateOut,
    description: descStr,
    descripcion: d.descripcion != null && d.descripcion !== '' ? d.descripcion : descStr,
    status: d.status || st,
    estado: d.estado || (st === 'upcoming' ? 'activo' : st)
  };
}

/** Normaliza partido/encuentro: campo fecha YYYY-MM-DD para filtros y calendario */
function normalizeMatchDocForLocal(docId, data) {
  const d = data && typeof data === 'object' ? { ...data, id: docId } : { id: docId };
  const raw = d.fecha ?? d.date ?? d.matchDate ?? null;
  const key = toYYYYMMDD(raw) || (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null);
  if (key) {
    d.fecha = key;
    if (!d.date) d.date = key;
  }
  return d;
}

async function fetchEventsAndEncuentrosToLocalStorage() {
  try {
    const events = await getDocuments('events');
    if (Array.isArray(events) && events.length > 0) {
      const normalized = events.map((e) => normalizeClubEventDocForLocal(String(e.id), e));
      localStorage.setItem('clubEvents', JSON.stringify(normalized));
      localStorage.setItem('events', JSON.stringify(normalized));
      localStorage.setItem('allEvents', JSON.stringify(normalized));
      console.log(`✅ Eventos → localStorage (${normalized.length})`);
      window.dispatchEvent(new CustomEvent('eventsUpdated', { detail: normalized }));
    }
    const matches = await getDocuments('encuentros');
    if (Array.isArray(matches) && matches.length > 0) {
      const normalizedM = matches.map((m) => normalizeMatchDocForLocal(String(m.id), m));
      localStorage.setItem('encuentros', JSON.stringify(normalizedM));
      console.log(`✅ Encuentros → localStorage (${normalizedM.length})`);
      window.dispatchEvent(new CustomEvent('matchesUpdated', { detail: normalizedM }));
    }
  } catch (err) {
    console.warn('fetchEventsAndEncuentrosToLocalStorage:', err);
  }
}

function withScope(data) {
  const cleaned = sanitizePayload(data);
  return {
    ...cleaned,
    appScope: APP_SCOPE
  };
}

/** Incluye contraseÃ±a solo al escribir socios/amigos (sanabria_members / sanabria_friends). */
function withScopeForCollection(collectionName, data) {
  const cleaned = sanitizePayload(data, { keepPassword: false });
  return {
    ...cleaned,
    appScope: APP_SCOPE
  };
}

function normalizeIdentityValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeIdentityFields(collectionName, data = {}) {
  const resolved = normalizeCollectionName(collectionName);
  if (resolved !== DB_COLLECTIONS.MEMBERS && resolved !== DB_COLLECTIONS.FRIENDS) {
    return data;
  }
  const next = { ...data };
  if (Object.prototype.hasOwnProperty.call(next, 'dni')) {
    next.dni = normalizeIdentityValue(next.dni);
  }
  if (Object.prototype.hasOwnProperty.call(next, 'email')) {
    next.email = normalizeIdentityValue(next.email);
  }
  return next;
}

function shouldCheckDuplicates(collectionName) {
  const resolved = normalizeCollectionName(collectionName);
  return resolved === DB_COLLECTIONS.MEMBERS || resolved === DB_COLLECTIONS.FRIENDS;
}

async function findDuplicateDocId(collectionName, data) {
  const resolved = normalizeCollectionName(collectionName);
  if (!shouldCheckDuplicates(resolved)) return null;

  const dni = normalizeIdentityValue(data?.dni);
  const email = normalizeIdentityValue(data?.email);
  if (!dni && !email) return null;

  // Modo simulaciÃ³n/localStorage
  if (db.isSimulation) {
    const localList = readLocalCollection(resolved);
    const found = localList.find((item) => {
      const itemDni = normalizeIdentityValue(item?.dni);
      const itemEmail = normalizeIdentityValue(item?.email);
      const sameScope = !item?.appScope || item.appScope === APP_SCOPE;
      return sameScope && ((dni && itemDni === dni) || (email && itemEmail === email));
    });
    return found?.id ? String(found.id) : null;
  }

  // Firebase real
  if (dni) {
    const byDni = await getDocs(query(
      collection(db, resolved),
      where('appScope', '==', APP_SCOPE),
      where('dni', '==', dni),
      limit(1)
    ));
    if (!byDni.empty) return byDni.docs[0].id;
  }
  if (email) {
    const byEmail = await getDocs(query(
      collection(db, resolved),
      where('appScope', '==', APP_SCOPE),
      where('email', '==', email),
      limit(1)
    ));
    if (!byEmail.empty) return byEmail.docs[0].id;
  }
  return null;
}

function readLocalCollection(collectionName) {
  try {
    const raw = localStorage.getItem(collectionName);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function writeLocalCollection(collectionName, list) {
  try {
    localStorage.setItem(collectionName, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (error) {
    console.warn(`âš ï¸ No se pudo guardar cache local de ${collectionName}:`, error);
  }
}

/** Mantiene alineadas todas las claves locales de socios (web + panel + listeners). */
function syncClubMembersLocal(members) {
  const list = Array.isArray(members) ? members : [];
  const json = JSON.stringify(list);
  ['clubMembers', 'members', 'socios', 'allMembers'].forEach((k) => {
    try { localStorage.setItem(k, json); } catch (_) {}
  });
}

/** Mantiene alineadas todas las claves locales de amigos. */
function syncClubFriendsLocal(friends) {
  const list = Array.isArray(friends) ? friends : [];
  const json = JSON.stringify(list);
  ['clubFriends', 'friends', 'amigos', 'allFriends'].forEach((k) => {
    try { localStorage.setItem(k, json); } catch (_) {}
  });
}

function syncClubPlayersLocal(players) {
  const list = Array.isArray(players) ? players : [];
  const json = JSON.stringify(list);
  ['clubPlayers', 'players', 'jugadores'].forEach((k) => {
    try { localStorage.setItem(k, json); } catch (_) {}
  });
}

function syncClubCoachesLocal(coaches) {
  const list = Array.isArray(coaches) ? coaches : [];
  const json = JSON.stringify(list);
  ['clubCoaches', 'coaches', 'entrenadores'].forEach((k) => {
    try { localStorage.setItem(k, json); } catch (_) {}
  });
}

function syncClubBoardLocal(board) {
  const list = Array.isArray(board) ? board : [];
  const json = JSON.stringify(list);
  ['clubBoard', 'board', 'directiva'].forEach((k) => {
    try { localStorage.setItem(k, json); } catch (_) {}
  });
}

function mirrorLocalUpsert(collectionName, docId, data) {
  const scoped = withScopeForCollection(collectionName, data || {});
  const current = readLocalCollection(collectionName);
  const id = String(docId || scoped.id || Date.now());
  const idx = current.findIndex(d => String(d?.id) === id);
  const nextDoc = {
    ...(idx >= 0 ? current[idx] : {}),
    ...scoped,
    id
  };
  if (!nextDoc.createdAt) {
    nextDoc.createdAt = new Date().toISOString();
  }
  nextDoc.updatedAt = new Date().toISOString();

  if (idx >= 0) current[idx] = nextDoc;
  else current.push(nextDoc);
  writeLocalCollection(collectionName, current);
}

function mirrorLocalDelete(collectionName, docId) {
  const current = readLocalCollection(collectionName);
  const id = String(docId || '');
  const next = current.filter(d => String(d?.id) !== id);
  writeLocalCollection(collectionName, next);
}

function stableDocIdFromItem(item, index = 0) {
  const rawId = item?.id != null ? String(item.id).trim() : '';
  if (rawId && !rawId.startsWith('MEMBER_') && !rawId.startsWith('PLAYER_') && !rawId.startsWith('PENDING_')) {
    return rawId.replace(/[^\w.-]/g, '_').slice(0, 120);
  }
  const candidate =
    item?.id ??
    item?.uid ??
    item?.numeroSocio ??
    item?.dni ??
    item?.email ??
    item?.telefono ??
    `row_${index}`;
  return String(candidate).replace(/[^\w.-]/g, '_').slice(0, 120) || `row_${index}`;
}

const LOCAL_KEY_TO_COLLECTION = {
  clubMembers: DB_COLLECTIONS.MEMBERS,
  members: DB_COLLECTIONS.MEMBERS,
  socios: DB_COLLECTIONS.MEMBERS,
  clubFriends: DB_COLLECTIONS.FRIENDS,
  friends: DB_COLLECTIONS.FRIENDS,
  amigos: DB_COLLECTIONS.FRIENDS,
  clubPlayers: DB_COLLECTIONS.PLAYERS,
  players: DB_COLLECTIONS.PLAYERS,
  jugadores: DB_COLLECTIONS.PLAYERS,
  clubPlayerApplications: DB_COLLECTIONS.PLAYER_APPLICATIONS,
  player_applications: DB_COLLECTIONS.PLAYER_APPLICATIONS,
  clubCoaches: DB_COLLECTIONS.COACHES,
  coaches: DB_COLLECTIONS.COACHES,
  entrenadores: DB_COLLECTIONS.COACHES,
  clubBoard: DB_COLLECTIONS.BOARD,
  board: DB_COLLECTIONS.BOARD,
  directiva: DB_COLLECTIONS.BOARD,
  clubTeams: DB_COLLECTIONS.TEAMS,
  teams: DB_COLLECTIONS.TEAMS,
  equipos: DB_COLLECTIONS.TEAMS,
  clubEvents: DB_COLLECTIONS.EVENTS,
  events: DB_COLLECTIONS.EVENTS,
  encuentros: DB_COLLECTIONS.MATCHES,
  clubCalendarEvents: DB_COLLECTIONS.CALENDAR,
  calendarEvents: DB_COLLECTIONS.CALENDAR,
  clubCompetitions: DB_COLLECTIONS.COMPETITIONS,
  competitions: DB_COLLECTIONS.COMPETITIONS,
  teamAdmins: DB_COLLECTIONS.ADMINS,
  cdsanabriacfTeamAdmins: DB_COLLECTIONS.ADMINS,
  clubNotifications: DB_COLLECTIONS.NOTIFICATIONS,
  notifications: DB_COLLECTIONS.NOTIFICATIONS,
  clubDocuments: DB_COLLECTIONS.DOCUMENTS,
  documents: DB_COLLECTIONS.DOCUMENTS,
  clubMedia: DB_COLLECTIONS.MEDIA,
  media: DB_COLLECTIONS.MEDIA,
  clubPublicidad: DB_COLLECTIONS.ADS,
  publicidad: DB_COLLECTIONS.ADS,
  ads: DB_COLLECTIONS.ADS,
  anuncios: DB_COLLECTIONS.ADS,
  pushMessages: DB_COLLECTIONS.NOTIFICATIONS,
  clubConfig: DB_COLLECTIONS.SETTINGS,
  settings: DB_COLLECTIONS.SETTINGS,
  config: DB_COLLECTIONS.SETTINGS,
  clubSettings: DB_COLLECTIONS.SETTINGS,
  clubThemeSettings: DB_COLLECTIONS.SETTINGS,
  clubContactInfo: DB_COLLECTIONS.SETTINGS,
  cdsanabriacfSettings: DB_COLLECTIONS.SETTINGS,
  teamSettings: DB_COLLECTIONS.SETTINGS,
  clubStats: DB_COLLECTIONS.STATS,
  statistics: DB_COLLECTIONS.STATS,
  clubMembershipPricing: DB_COLLECTIONS.SETTINGS,
  clubPlayerInscriptionSettings: DB_COLLECTIONS.SETTINGS,
  clubPlayerExportSettings: DB_COLLECTIONS.SETTINGS,
  clubColaboradorFormConfig: DB_COLLECTIONS.SETTINGS,
  clubAccountingLedger: DB_COLLECTIONS.LEDGER
};

/** Tras leer Firestore, copia la lista a las claves localStorage que usa el panel (clubMembers, clubBoard, …). */
function mirrorResolvedFirestoreListToLegacyKeys(resolvedCollection, documents) {
  if (
    resolvedCollection === DB_COLLECTIONS.LEDGER
    || resolvedCollection === DB_COLLECTIONS.SETTINGS
    || resolvedCollection === DB_COLLECTIONS.STATS
  ) {
    return;
  }
  const list = Array.isArray(documents)
    ? documents.filter((d) => !d.appScope || d.appScope === APP_SCOPE)
    : [];
  const json = JSON.stringify(list);
  try {
    Object.keys(LOCAL_KEY_TO_COLLECTION).forEach((clubKey) => {
      if (LOCAL_KEY_TO_COLLECTION[clubKey] === resolvedCollection) {
        localStorage.setItem(clubKey, json);
      }
    });
    if (resolvedCollection === DB_COLLECTIONS.MEMBERS) {
      localStorage.setItem('allMembers', json);
    }
    if (resolvedCollection === DB_COLLECTIONS.FRIENDS) {
      localStorage.setItem('allFriends', json);
    }
    if (resolvedCollection === DB_COLLECTIONS.EVENTS) {
      localStorage.setItem('allEvents', json);
    }
  } catch (e) {
    console.warn('mirrorResolvedFirestoreListToLegacyKeys', resolvedCollection, e);
  }
}

function normalizeMemberForFirestoreSync(item) {
  const m = item && typeof item === 'object' ? { ...item } : {};
  const nombre = String(m.nombre || m.name || '').trim();
  const apellidos = String(m.apellidos || m.surname || '').trim();
  const email = String(m.email || '').trim().toLowerCase();
  const dni = String(m.dni || '').trim();
  const telefono = String(m.telefono || m.phone || '').trim();
  return normalizeIdentityFields(DB_COLLECTIONS.MEMBERS, {
    ...m,
    nombre,
    name: nombre,
    apellidos,
    surname: apellidos,
    email,
    dni,
    telefono,
    phone: telefono
  });
}

function normalizeFriendForFirestoreSync(item) {
  const f = item && typeof item === 'object' ? { ...item } : {};
  const nombre = String(f.nombre || f.name || '').trim();
  const apellidos = String(f.apellidos || f.surname || '').trim();
  const email = String(f.email || '').trim().toLowerCase();
  const dni = String(f.dni || '').trim();
  const telefono = String(f.telefono || f.phone || '').trim();
  return normalizeIdentityFields(DB_COLLECTIONS.FRIENDS, {
    ...f,
    nombre,
    name: nombre,
    apellidos,
    surname: apellidos,
    email,
    dni,
    telefono,
    phone: telefono
  });
}

function prepareItemForFirestoreSync(targetCollection, item, index) {
  let row = item && typeof item === 'object' ? { ...item } : {};
  if (targetCollection === DB_COLLECTIONS.MEMBERS) {
    row = normalizeMemberForFirestoreSync(row);
  } else if (targetCollection === DB_COLLECTIONS.FRIENDS) {
    row = normalizeFriendForFirestoreSync(row);
  }
  const id = stableDocIdFromItem(row, index);
  return { id, row };
}

async function syncLocalArrayKeyToFirebase(localKey) {
  try {
    const targetCollection = LOCAL_KEY_TO_COLLECTION[String(localKey || '').trim()];
    if (!targetCollection) return { synced: 0, failed: 0, skipped: true };
    const list = readLocalCollection(localKey);
    if (!Array.isArray(list)) return { synced: 0, failed: 0 };

    if (db.isSimulation) {
      return { synced: list.length, failed: 0, simulated: true };
    }

    let synced = 0;
    let failed = 0;
    const errors = [];
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      if (!item || typeof item !== 'object') continue;
      const prepared = prepareItemForFirestoreSync(targetCollection, item, i);
      try {
        await setDoc(
          doc(db, targetCollection, prepared.id),
          withScopeForCollection(targetCollection, {
            ...prepared.row,
            id: prepared.id,
            updatedAt: new Date().toISOString()
          }),
          { merge: true }
        );
        synced += 1;
      } catch (itemErr) {
        failed += 1;
        if (errors.length < 3) {
          errors.push(String(itemErr?.message || itemErr));
        }
      }
    }
    return { synced, failed, errors };
  } catch (error) {
    console.error(`âŒ Error sincronizando clave local "${localKey}" con Firebase:`, error);
    return { synced: 0, failed: 0, error: String(error?.message || error) };
  }
}

/** Claves de localStorage que guardan un objeto JSON (no array) y deben ir a Firestore como un documento fijo. */
const LOCAL_OBJECT_BLOB_KEYS = new Set([
  'teamSettings',
  'cdsanabriacfSettings',
  'clubSettings',
  'clubThemeSettings',
  'clubContactInfo',
  'clubConfig',
  'settings',
  'config',
  'clubStats',
  'statistics',
  'clubMembershipPricing',
  'clubPlayerInscriptionSettings',
  'clubPlayerExportSettings',
  'clubColaboradorFormConfig'
]);

/**
 * Sincroniza objetos de configuración/estadísticas (localStorage → Firestore).
 * Usa id de documento estable cfg_<clave> y campo localStorageKey para reconstruir al leer.
 */
async function syncLocalSettingsBlobToFirebase(localKey) {
  try {
    const k = String(localKey || '').trim();
    if (!LOCAL_OBJECT_BLOB_KEYS.has(k)) {
      return { synced: 0, skipped: true };
    }

    const targetCollection = LOCAL_KEY_TO_COLLECTION[k];
    if (!targetCollection) {
      return { synced: 0, skipped: true };
    }

    const raw = localStorage.getItem(k);
    if (!raw) {
      return { synced: 0 };
    }

    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (_) {
      return { synced: 0, error: 'invalid_json' };
    }

    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { synced: 0, skipped: true };
    }

    if (db.isSimulation) {
      return { synced: 1, simulated: true };
    }

    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
    const docId = `cfg_${k}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

    await setDoc(
      doc(db, targetCollection, docId),
      withScopeForCollection(targetCollection, {
        ...obj,
        id: docId,
        localStorageKey: k,
        updatedAt: new Date().toISOString()
      }),
      { merge: true }
    );

    return { synced: 1 };
  } catch (error) {
    console.error(`Error sincronizando objeto local "${localKey}" con Firebase:`, error);
    return { synced: 0, error: String(error?.message || error) };
  }
}

function applyRemoteConfigDocToLocalStorage(docSnap) {
  try {
    const d = docSnap.data() || {};
    const lk = d.localStorageKey;
    if (!lk || typeof lk !== 'string') {
      return;
    }
    const payload = { ...d };
    delete payload.appScope;
    delete payload.updatedAt;
    delete payload.createdAt;
    delete payload.localStorageKey;
    if (payload.id && String(payload.id).startsWith('cfg_')) {
      delete payload.id;
    }
    const nat =
      typeof window !== 'undefined' && typeof window.__CDSAN_NATIVE_SET_ITEM === 'function'
        ? window.__CDSAN_NATIVE_SET_ITEM
        : Storage.prototype.setItem;
    nat.call(localStorage, lk, JSON.stringify(payload));
  } catch (error) {
    console.warn('No se pudo aplicar documento de configuración a localStorage:', error);
  }
}

// ðŸ”§ Funciones de ConfiguraciÃ³n

// Configurar autenticaciÃ³n
function setupAuth() {
  console.log('ðŸ” Configurando autenticaciÃ³n Firebase...');

  if (auth && auth.isSimulation) {
    console.log('Auth en modo simulación: sin Firebase Auth');
    return;
  }

  // Configurar persistencia
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn('âš ï¸ No se pudo establecer persistencia local:', error);
  });
  
  // Escuchar cambios de autenticaciÃ³n
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('âœ… Usuario autenticado:', user.email);
      
      // Actualizar permission manager
      if (window.permissionManager) {
        window.permissionManager.setCurrentUser({
          email: user.email,
          uid: user.uid,
          role: 'member' // Se actualizarÃ¡ con datos de Firestore
        });
      }
      
    } else {
      console.log('ðŸ‘¤ Usuario no autenticado');
      
      // Limpiar permission manager
      if (window.permissionManager) {
        window.permissionManager.logout();
      }
    }
  });
}

// Configurar Cloud Messaging
async function setupMessaging() {
  if (!messaging) return;
  
  try {
    console.log('ðŸ”” Configurando notificaciones push...');
    
    // Solicitar permisos
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Obtener token FCM
      // âœ… VAPID Key configurada
      const VAPID_KEY = 'BK6QOHZGAPCgqsDEtjGfIST2F5G0t6ICn7Gn-nZksTEwqxd6A8w9yb7YNlHqQimbhqmrRWigHTy1DIAXfbN0LFQ';
      
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY
      });
      
      console.log('✅ Token FCM obtenido correctamente');
      
      // Guardar token en Firestore
      await saveUserToken(token);
      
      // Escuchar mensajes en primer plano
      onMessage(messaging, (payload) => {
        console.log('ðŸ”” Mensaje recibido:', payload);
        
        // Mostrar notificaciÃ³n personalizada
        showCustomNotification(payload);
      });
      
    } else {
      console.log('âŒ Permisos de notificaciÃ³n denegados');
    }
    
  } catch (error) {
    console.error('âŒ Error configurando messaging:', error);
  }
}

// Guardar token del usuario en Firestore
async function saveUserToken(token) {
  try {
    const user = auth.currentUser;
    if (user) {
      await setDoc(doc(db, DB_COLLECTIONS.USERS, user.uid), {
        fcmToken: token,
        lastTokenUpdate: new Date().toISOString()
      }, { merge: true });
      
      console.log('âœ… Token guardado en Firestore');
    }
  } catch (error) {
    console.error('âŒ Error guardando token:', error);
  }
}

// Mostrar notificaciÃ³n personalizada
function showCustomNotification(payload) {
  const { title, body, icon, data } = payload.notification || {};
  
  // Crear notificaciÃ³n del sistema
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title || 'CDSANABRIACF', {
      body: body || 'Nueva notificaciÃ³n del club',
      icon: icon || '/images/icon-192x192.png',
      badge: '/images/badge-72x72.png',
      tag: 'cdsanabriacf-notification',
      data: data || {},
      vibrate: [200, 100, 200],
      requireInteraction: false
    });
  }
  
  // Mostrar tambiÃ©n en la interfaz
  if (window.showNotification) {
    window.showNotification(body || 'Nueva notificaciÃ³n', 'info');
  }
}

// ðŸ“Š Funciones de Base de Datos

// Crear documento en Firestore
async function createDocument(collectionKey, data) {
  try {
    const collectionName = normalizeCollectionName(collectionKey);
    const normalizedData = normalizeIdentityFields(collectionName, data || {});
    if (!db.isSimulation && auth && auth.currentUser) {
      if (!normalizedData.authUid) normalizedData.authUid = auth.currentUser.uid;
      if (!normalizedData.uid) normalizedData.uid = auth.currentUser.uid;
    }
    const duplicateDocId = await findDuplicateDocId(collectionName, normalizedData);
    if (db.isSimulation) {
      // Usar persistencia local en modo simulaciÃ³n
      if (duplicateDocId) {
        const updatePayload = {
          ...withScopeForCollection(collectionName, normalizedData),
          updatedAt: new Date().toISOString()
        };
        mirrorLocalUpsert(collectionName, duplicateDocId, updatePayload);
        console.log(`â™»ï¸ Documento duplicado detectado en ${collectionName}; actualizado:`, duplicateDocId);
        return duplicateDocId;
      }

      if (window.persistenceManager) {
        const docId = await window.persistenceManager.addRecord(collectionName, withScopeForCollection(collectionName, normalizedData));
        console.log('âœ… Documento creado localmente:', docId);
        return docId;
      } else {
        // Fallback a localStorage
        const timestamp = new Date().toISOString();
        const docId = Date.now() + Math.random();
        const document = {
          id: docId,
          ...withScopeForCollection(collectionName, normalizedData),
          createdAt: timestamp,
          updatedAt: timestamp
        };
        
        const existingData = JSON.parse(localStorage.getItem(collectionName) || '[]');
        existingData.push(document);
        localStorage.setItem(collectionName, JSON.stringify(existingData));
        
        console.log('âœ… Documento creado en localStorage:', docId);
        return docId;
      }
    } else {
      // Firebase real - CDSANABRIACF2026
      if (duplicateDocId) {
        await updateDoc(doc(db, collectionName, duplicateDocId), {
          ...withScopeForCollection(collectionName, normalizedData),
          updatedAt: serverTimestamp()
        });
        mirrorLocalUpsert(collectionName, duplicateDocId, normalizedData);
        console.log(`â™»ï¸ Documento duplicado detectado en ${collectionName}; actualizado:`, duplicateDocId);
        return duplicateDocId;
      }

      const payload = {
        ...withScopeForCollection(collectionName, normalizedData),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, collectionName), payload);
      // Espejo local siempre (aunque haya Firebase): respaldo y soporte offline de lectura.
      mirrorLocalUpsert(collectionName, docRef.id, normalizedData);
      
      console.log('âœ… Documento creado en Firebase CDSANABRIACF2026:', docRef.id);
      return docRef.id;
    }
    
  } catch (error) {
    console.error('âŒ Error creando documento:', error);
    throw error;
  }
}

// Obtener documentos de una colecciÃ³n (modo simulaciÃ³n)
async function getDocuments(collectionName, filters = []) {
  try {
    const resolvedCollection = normalizeCollectionName(collectionName);
    if (db.isSimulation) {
      // Usar persistencia local en modo simulaciÃ³n
      if (window.persistenceManager) {
        const documents = await window.persistenceManager.getFromStore(resolvedCollection);
        const scoped = documents.filter(d => !d.appScope || d.appScope === APP_SCOPE);
        console.log(`âœ… Obtenidos ${scoped.length} documentos de ${resolvedCollection} (local)`);
        return scoped;
      } else {
        // Fallback a localStorage
        const data = localStorage.getItem(resolvedCollection);
        const documents = data ? JSON.parse(data) : [];
        let scopedDocuments = documents.filter(d => !d.appScope || d.appScope === APP_SCOPE);
        
        // Aplicar filtros bÃ¡sicos
        let filteredDocuments = scopedDocuments;
        filters.forEach(filter => {
          filteredDocuments = filteredDocuments.filter(doc => {
            switch (filter.operator) {
              case '==':
                return doc[filter.field] === filter.value;
              case '!=':
                return doc[filter.field] !== filter.value;
              default:
                return true;
            }
          });
        });
        
        console.log(`âœ… Obtenidos ${filteredDocuments.length} documentos de ${collectionName} (localStorage)`);
        return filteredDocuments;
      }
    } else {
      // Firebase real - CDSANABRIACF2026
      let q = query(collection(db, resolvedCollection), where('appScope', '==', APP_SCOPE));
      
      // Aplicar filtros
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
      
      const querySnapshot = await getDocs(q);
      const documents = [];
      
      querySnapshot.forEach((doc) => {
        documents.push({
          id: doc.id,
          ...doc.data()
        });
      });
      // Mantener cache local del mismo Ã¡mbito para respaldo.
      const scopedDocs = documents.filter(d => !d.appScope || d.appScope === APP_SCOPE);
      writeLocalCollection(resolvedCollection, scopedDocs);
      mirrorResolvedFirestoreListToLegacyKeys(resolvedCollection, scopedDocs);

      console.log(`âœ… Obtenidos ${documents.length} documentos de ${resolvedCollection} (Firebase CDSANABRIACF2026)`);
      return documents;
    }
    
  } catch (error) {
    console.error('âŒ Error obteniendo documentos:', error);
    return [];
  }
}

// Actualizar documento
async function updateDocument(collectionName, docId, data) {
  try {
    const resolvedCollection = normalizeCollectionName(collectionName);
    await updateDoc(doc(db, resolvedCollection, docId), {
      ...withScopeForCollection(resolvedCollection, data),
      updatedAt: serverTimestamp()
    });
    mirrorLocalUpsert(resolvedCollection, docId, data);
    
    console.log('âœ… Documento actualizado:', docId);
    
  } catch (error) {
    console.error('âŒ Error actualizando documento:', error);
    throw error;
  }
}

// Eliminar documento (solo administradores)
async function deleteDocument(collectionName, docId, userRole) {
  try {
    const resolvedCollection = normalizeCollectionName(collectionName);
    // Validar permisos
    if (!['super_admin', 'admin'].includes(userRole)) {
      throw new Error('No tienes permisos para eliminar documentos');
    }
    
    await deleteDoc(doc(db, resolvedCollection, docId));
    mirrorLocalDelete(resolvedCollection, docId);
    
    console.log('âœ… Documento eliminado:', docId);
    
    // Log de auditorÃ­a
    await createDocument(DB_COLLECTIONS.AUDIT_LOGS, {
      action: 'DELETE_DOCUMENT',
      collection: resolvedCollection,
      documentId: docId,
      userRole,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('âŒ Error eliminando documento:', error);
    throw error;
  }
}

// ðŸ”„ SincronizaciÃ³n con sistema local

// Sincronizar datos locales con Firebase
async function syncWithFirebase() {
  try {
    console.log('ðŸ”„ Sincronizando con Firebase...');
    
    // Obtener datos locales no sincronizados
    if (window.persistenceManager) {
      const unsyncedRecords = await window.persistenceManager.getUnsyncedRecords();
      
      // Enviar cada registro a Firebase
      for (const record of unsyncedRecords) {
        try {
          await createDocument(record.store, record.data);
          
          // Marcar como sincronizado localmente
          await window.persistenceManager.markAsSynced([record]);
          
        } catch (error) {
          console.error(`âŒ Error sincronizando ${record.store}:`, error);
        }
      }
    }
    
    console.log('âœ… SincronizaciÃ³n con Firebase completada');
    
  } catch (error) {
    console.error('âŒ Error en sincronizaciÃ³n:', error);
  }
}

// Obtener datos de Firebase y actualizar local
async function syncFromFirebase() {
  try {
    console.log('ðŸ“¥ Obteniendo datos de Firebase...');
    
    // Sincronizar cada colecciÃ³n
    const collections = [
      DB_COLLECTIONS.MEMBERS,
      DB_COLLECTIONS.PLAYERS,
      DB_COLLECTIONS.COACHES,
      DB_COLLECTIONS.TEAMS,
      DB_COLLECTIONS.EVENTS,
      DB_COLLECTIONS.FRIENDS,
      DB_COLLECTIONS.MATCHES,
      DB_COLLECTIONS.CALENDAR,
      DB_COLLECTIONS.BOARD,
      DB_COLLECTIONS.COMPETITIONS
    ];
    
    for (const collectionName of collections) {
      try {
        const documents = await getDocuments(collectionName);
        
        // Actualizar datos locales
        if (window.persistenceManager) {
          await window.persistenceManager.saveToStore(collectionName, documents);
        }
        
        console.log(`âœ… Sincronizados ${documents.length} documentos de ${collectionName}`);
        
      } catch (error) {
        console.error(`âŒ Error sincronizando ${collectionName}:`, error);
      }
    }

    await fetchEventsAndEncuentrosToLocalStorage();

    try {
      window.dispatchEvent(new CustomEvent('panelDataSynced'));
    } catch (_) {}
  } catch (error) {
    console.error('âŒ Error obteniendo datos de Firebase:', error);
  }
}

// ðŸ”„ SincronizaciÃ³n en tiempo real con Firebase
let realtimeListeners = {};

async function firebaseUserIsClubAdmin() {
  if (db.isSimulation || !auth || auth.isSimulation || !auth.currentUser) {
    return false;
  }
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
    const snap = await getDoc(doc(db, DB_COLLECTIONS.ADMINS, auth.currentUser.uid));
    if (!snap.exists()) return false;
    const d = snap.data() || {};
    return (
      d.appScope === APP_SCOPE
      && (d.isAdmin === true || d.isSuperAdmin === true || d.role === 'admin' || d.role === 'super_admin')
    );
  } catch (e) {
    console.warn('firebaseUserIsClubAdmin:', e);
    return false;
  }
}

// Configurar listeners en tiempo real para sincronizaciÃ³n mÃ³vil-web
async function setupRealtimeSync() {
  if (db.isSimulation) {
    console.log('âš ï¸ Modo simulaciÃ³n - sincronizaciÃ³n en tiempo real no disponible');
    return;
  }

  try {
    console.log('ðŸ”„ Configurando sincronizaciÃ³n en tiempo real...');
    
    const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
    
    // Listener para socios (members) - SINCRONIZACIÃ“N EN TIEMPO REAL - SANABRIA
    const isAdminUser = await firebaseUserIsClubAdmin();
    let membersListener = null;
    let friendsListener = null;
    if (isAdminUser) {
    membersListener = onSnapshot(collection(db, 'sanabria_members'), (snapshot) => {
      const members = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const fechaIso =
          firestoreDateToIso(data.fechaRegistro) ||
          firestoreDateToIso(data.registrationDate) ||
          firestoreDateToIso(data.createdAt) ||
          new Date().toISOString();
        const nombre = (data.nombre || data.name || '').toString().trim();
        const apellidos = (data.apellidos || data.surname || '').toString().trim();
        const row = {
          id: doc.id,
          ...data,
          nombre,
          apellidos,
          name: data.name || nombre,
          surname: data.surname || apellidos,
          email: data.email || '',
          telefono: (data.telefono || data.phone || '').toString(),
          dni: data.dni || '',
          numeroSocio: data.numeroSocio != null ? data.numeroSocio : data.memberNumber,
          estado: data.estado || data.status || 'pendiente',
          fechaRegistro: fechaIso,
          registrationDate: fechaIso
        };
        if (typeof window.applyClubRoleFlagsToMember === 'function') {
          window.applyClubRoleFlagsToMember(row);
        }
        members.push(row);
      });
      
      if (typeof window.syncClubMembersLocal === 'function') {
        window.syncClubMembersLocal(members);
      } else {
      // Actualizar localStorage en TODAS las claves para compatibilidad
      localStorage.setItem('clubMembers', JSON.stringify(members));
      localStorage.setItem('members', JSON.stringify(members));
      localStorage.setItem('socios', JSON.stringify(members));
      localStorage.setItem('allMembers', JSON.stringify(members));
      }
      
      console.log('ðŸ”„ Socios actualizados en tiempo real:', members.length);
      
      // Notificar a la UI si hay funciÃ³n de actualizaciÃ³n
      if (window.updateMembersList) {
        window.updateMembersList(members);
      }
      if (typeof window.updateDatabaseStats === 'function') {
        try { window.updateDatabaseStats(); } catch (_) {}
      }
      
      // Disparar evento personalizado para otras partes de la app
      window.dispatchEvent(new CustomEvent('membersUpdated', { detail: members }));
    }, (err) => console.warn('Listener socios:', err && err.message ? err.message : err));
    
    // Listener para amigos (friends) - SINCRONIZACIÃ“N EN TIEMPO REAL - SANABRIA
    friendsListener = onSnapshot(collection(db, 'sanabria_friends'), (snapshot) => {
      const friends = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        friends.push({
          id: doc.id,
          ...data,
          // Asegurar campos requeridos
          nombre: data.nombre || 'Sin nombre',
          apellidos: data.apellidos || 'Sin apellidos',
          email: data.email || '',
          telefono: data.telefono || 'Sin telÃ©fono',
          dni: data.dni || 'Sin DNI',
          estado: data.estado || 'activo',
          fechaRegistro: data.fechaRegistro || new Date().toISOString()
        });
      });
      
      // Actualizar localStorage en TODAS las claves para compatibilidad
      localStorage.setItem('clubFriends', JSON.stringify(friends));
      localStorage.setItem('friends', JSON.stringify(friends));
      localStorage.setItem('amigos', JSON.stringify(friends));
      localStorage.setItem('allFriends', JSON.stringify(friends));
      
      console.log('ðŸ”„ Amigos actualizados en tiempo real:', friends.length);
      
      // Notificar a la UI si hay funciÃ³n de actualizaciÃ³n
      if (window.updateFriendsList) {
        window.updateFriendsList(friends);
      }
      if (typeof window.updateDatabaseStats === 'function') {
        try { window.updateDatabaseStats(); } catch (_) {}
      }
      
      // Disparar evento personalizado para otras partes de la app
      window.dispatchEvent(new CustomEvent('friendsUpdated', { detail: friends }));
    }, (err) => console.warn('Listener amigos:', err && err.message ? err.message : err));
    } else {
      console.log('Sincronizacion socios/amigos en tiempo real: solo con sesion admin Firebase');
    }
    
    function stripSensitivePlayerFields(data, adminUser) {
      const row = { ...(data || {}) };
      if (!adminUser) {
        delete row.portalPasswordHash;
        delete row.passwordHash;
        delete row.password;
        delete row.plainPassword;
      }
      return row;
    }

    function stripSensitiveCoachFields(data, adminUser) {
      const row = { ...(data || {}) };
      if (!adminUser) {
        delete row.passwordHash;
        delete row.password;
        delete row.plainPassword;
      }
      return row;
    }

    const playersListener = onSnapshot(collection(db, 'sanabria_players'), (snapshot) => {
      const players = [];
      snapshot.forEach((doc) => {
        players.push({
          id: doc.id,
          ...stripSensitivePlayerFields(doc.data(), isAdminUser)
        });
      });
      
      localStorage.setItem('clubPlayers', JSON.stringify(players));
      localStorage.setItem('players', JSON.stringify(players));
      localStorage.setItem('jugadores', JSON.stringify(players));
      
      console.log('ðŸ”„ Jugadores actualizados en tiempo real:', players.length);
      
      if (window.updatePlayersList) {
        window.updatePlayersList(players);
      }
      if (typeof window.updateDatabaseStats === 'function') {
        try { window.updateDatabaseStats(); } catch (_) {}
      }
    });

    const applicationsListener = onSnapshot(collection(db, DB_COLLECTIONS.PLAYER_APPLICATIONS), (snapshot) => {
      const applications = [];
      snapshot.forEach((docSnap) => {
        applications.push({ id: docSnap.id, ...docSnap.data() });
      });
      localStorage.setItem('clubPlayerApplications', JSON.stringify(applications));
      if (window.renderPlayerApplicationsAdmin) {
        try {
          window.renderPlayerApplicationsAdmin(applications);
        } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent('playerApplicationsUpdated', { detail: applications }));
    }, (err) => console.warn('Listener solicitudes jugador:', err && err.message ? err.message : err));
    
    // Listener para equipos (teams) - SANABRIA
    const teamsListener = onSnapshot(collection(db, 'sanabria_teams'), (snapshot) => {
      const teams = [];
      snapshot.forEach((doc) => {
        teams.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      localStorage.setItem('clubTeams', JSON.stringify(teams));
      localStorage.setItem('teams', JSON.stringify(teams));
      
      console.log('ðŸ”„ Equipos actualizados en tiempo real:', teams.length);
      
      if (window.updateTeamsList) {
        window.updateTeamsList(teams);
      }
      if (typeof window.updateDatabaseStats === 'function') {
        try { window.updateDatabaseStats(); } catch (_) {}
      }
    });
    
    // Listener para eventos (events) - SINCRONIZACIÃ“N EN TIEMPO REAL - SANABRIA
    const eventsListener = onSnapshot(collection(db, 'sanabria_events'), (snapshot) => {
      const events = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        events.push(normalizeClubEventDocForLocal(doc.id, { id: doc.id, ...data }));
      });
      
      localStorage.setItem('clubEvents', JSON.stringify(events));
      localStorage.setItem('events', JSON.stringify(events));
      localStorage.setItem('allEvents', JSON.stringify(events));
      
      console.log('ðŸ”„ Eventos actualizados en tiempo real:', events.length);
      
      if (window.updateEventsList) {
        window.updateEventsList(events);
      }
      
      // Disparar evento personalizado
      window.dispatchEvent(new CustomEvent('eventsUpdated', { detail: events }));
      if (typeof window.updateDatabaseStats === 'function') {
        try { window.updateDatabaseStats(); } catch (_) {}
      }
    });

    // Listener para encuentros (matches) - SANABRIA
    const matchesListener = onSnapshot(collection(db, 'sanabria_matches'), (snapshot) => {
      const matches = [];
      snapshot.forEach((doc) => {
        matches.push(normalizeMatchDocForLocal(doc.id, doc.data()));
      });

      localStorage.setItem('encuentros', JSON.stringify(matches));
      window.dispatchEvent(new CustomEvent('matchesUpdated', { detail: matches }));
      if (typeof window.updateDatabaseStats === 'function') {
        try { window.updateDatabaseStats(); } catch (_) {}
      }
    });

    // Listener para calendario (calendar events) - SANABRIA
    const calendarListener = onSnapshot(collection(db, 'sanabria_calendar_events'), (snapshot) => {
      const calendarEvents = [];
      snapshot.forEach((doc) => {
        calendarEvents.push({
          id: doc.id,
          ...doc.data()
        });
      });

      localStorage.setItem('clubCalendarEvents', JSON.stringify(calendarEvents));
      localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
      window.dispatchEvent(new CustomEvent('calendarUpdated', { detail: calendarEvents }));
    });
    
    // Listener para entrenadores (coaches) - SINCRONIZACIÃ“N EN TIEMPO REAL - SANABRIA
    const coachesListener = onSnapshot(collection(db, 'sanabria_coaches'), (snapshot) => {
      const coaches = [];
      snapshot.forEach((doc) => {
        const data = stripSensitiveCoachFields(doc.data(), isAdminUser);
        coaches.push({
          id: doc.id,
          ...data,
          // Asegurar campos requeridos
          nombre: data.nombre || 'Sin nombre',
          apellidos: data.apellidos || 'Sin apellidos',
          email: data.email || '',
          telefono: data.telefono || 'Sin telÃ©fono',
          especialidad: data.especialidad || 'General',
          estado: data.estado || 'activo'
        });
      });
      
      localStorage.setItem('clubCoaches', JSON.stringify(coaches));
      localStorage.setItem('coaches', JSON.stringify(coaches));
      localStorage.setItem('entrenadores', JSON.stringify(coaches));
      localStorage.setItem('allCoaches', JSON.stringify(coaches));
      
      console.log('ðŸ”„ Entrenadores actualizados en tiempo real:', coaches.length);
      
      if (window.updateCoachesList) {
        window.updateCoachesList(coaches);
      }
      
      // Disparar evento personalizado
      window.dispatchEvent(new CustomEvent('coachesUpdated', { detail: coaches }));
      if (typeof window.updateDatabaseStats === 'function') {
        try { window.updateDatabaseStats(); } catch (_) {}
      }
    });

    // Listener para competiciones (competitions) - SANABRIA
    const competitionsListener = onSnapshot(collection(db, 'sanabria_competitions'), (snapshot) => {
      const competitions = [];
      snapshot.forEach((doc) => {
        competitions.push({
          ...doc.data(),
          firebaseDocId: doc.id,
          id: doc.id
        });
      });

      localStorage.setItem('clubCompetitions', JSON.stringify(competitions));
      localStorage.setItem('competitions', JSON.stringify(competitions));
      window.dispatchEvent(new CustomEvent('competitionsUpdated', { detail: competitions }));
    });

    // Directiva (board) — mismo flujo que socios/amigos para multi-dispositivo
    const boardListener = onSnapshot(collection(db, DB_COLLECTIONS.BOARD), (snapshot) => {
      const board = [];
      snapshot.forEach((doc) => {
        board.push({
          id: doc.id,
          ...doc.data()
        });
      });

      localStorage.setItem('clubBoard', JSON.stringify(board));
      localStorage.setItem('board', JSON.stringify(board));

      console.log('ðŸ”„ Directiva actualizada en tiempo real:', board.length);

      if (window.updateBoardList) {
        window.updateBoardList(board);
      }
      window.dispatchEvent(new CustomEvent('boardUpdated', { detail: board }));
      if (typeof window.updateDatabaseStats === 'function') {
        try { window.updateDatabaseStats(); } catch (_) {}
      }
    });

    // Objetos de configuración (teamSettings, cdsanabriacfSettings, etc.) en sanabria_config / sanabria_stats
    const settingsBlobListener = onSnapshot(collection(db, DB_COLLECTIONS.SETTINGS), (snapshot) => {
      snapshot.forEach((docSnap) => {
        if (!String(docSnap.id).startsWith('cfg_')) return;
        applyRemoteConfigDocToLocalStorage(docSnap);
      });
      window.dispatchEvent(new CustomEvent('settingsBlobUpdated'));
    });

    const statsBlobListener = onSnapshot(collection(db, DB_COLLECTIONS.STATS), (snapshot) => {
      snapshot.forEach((docSnap) => {
        if (!String(docSnap.id).startsWith('cfg_')) return;
        applyRemoteConfigDocToLocalStorage(docSnap);
      });
      window.dispatchEvent(new CustomEvent('settingsBlobUpdated'));
    });

    // Galería multimedia (documentos por ítem)
    const mediaListener = onSnapshot(collection(db, DB_COLLECTIONS.MEDIA), (snapshot) => {
      const media = [];
      snapshot.forEach((d) => {
        media.push({
          id: d.id,
          ...d.data()
        });
      });
      const nat =
        typeof window !== 'undefined' && typeof window.__CDSAN_NATIVE_SET_ITEM === 'function'
          ? window.__CDSAN_NATIVE_SET_ITEM
          : Storage.prototype.setItem;
      try {
        nat.call(localStorage, 'clubMedia', JSON.stringify(media));
        nat.call(localStorage, 'media', JSON.stringify(media));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('clubMediaUpdated', { detail: media }));
    });
    
    // Guardar referencias de listeners para poder desconectarlos
    realtimeListeners = {
      members: membersListener,
      friends: friendsListener,
      players: playersListener,
      teams: teamsListener,
      events: eventsListener,
      matches: matchesListener,
      calendar: calendarListener,
      coaches: coachesListener,
      competitions: competitionsListener,
      board: boardListener,
      settingsBlobs: settingsBlobListener,
      statsBlobs: statsBlobListener,
      media: mediaListener
    };
    
    console.log('âœ… SincronizaciÃ³n en tiempo real configurada correctamente');
    
  } catch (error) {
    console.error('âŒ Error configurando sincronizaciÃ³n en tiempo real:', error);
  }
}

// Desconectar listeners en tiempo real
function disconnectRealtimeSync() {
  Object.values(realtimeListeners).forEach(unsubscribe => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });
  realtimeListeners = {};
  console.log('ðŸ”„ Listeners de tiempo real desconectados');
}

/** Normaliza email para comparar cuentas club (socios/amigos). */
function clubAuthEmailNorm(v) {
  return String(v || '').trim().toLowerCase();
}

function mergeLegacyLocalRemote(localKey, email, remoteList) {
  const em = clubAuthEmailNorm(email);
  let locals = [];
  try {
    if (typeof localStorage !== 'undefined') {
      locals = JSON.parse(localStorage.getItem(localKey) || '[]');
    }
  } catch (_) {}
  if (!Array.isArray(locals)) locals = [];
  if (!Array.isArray(remoteList)) remoteList = [];
  const loc = locals.find((x) => clubAuthEmailNorm(x?.email) === em);
  const rem = remoteList.find((x) => clubAuthEmailNorm(x?.email) === em);
  if (!loc && !rem) return null;
  const id = rem?.id || loc?.id;
  const merged = { ...(rem || {}), ...(loc || {}), id };
  delete merged.password;
  delete merged.pass;
  delete merged.plainPassword;
  return merged;
}

async function verifyLegacyLocalPassword(localKey, merged, pwd) {
  if (!merged || !pwd) return false;
  const em = clubAuthEmailNorm(merged.email);
  let list = [];
  try {
    if (typeof localStorage !== 'undefined') {
      list = JSON.parse(localStorage.getItem(localKey) || '[]');
    }
  } catch (_) {}
  const loc = Array.isArray(list) ? list.find((x) => clubAuthEmailNorm(x?.email) === em) : null;
  if (loc?.passwordHash && typeof window.verifyClubAccessKey === 'function') {
    return window.verifyClubAccessKey(pwd, loc.passwordHash);
  }
  if (loc?.password && loc.password === pwd) {
    if (typeof window.hashClubAccessKey === 'function' && loc.id != null) {
      const ix = list.findIndex((x) => x.id === loc.id);
      if (ix >= 0) {
        list[ix] = { ...list[ix], passwordHash: await window.hashClubAccessKey(pwd) };
        delete list[ix].password;
        localStorage.setItem(localKey, JSON.stringify(list));
      }
    }
    return true;
  }
  return false;
}

function stripPasswordFromLocalMirror(localKey, merged, authUid) {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(localKey);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    const em = clubAuthEmailNorm(merged.email);
    const ix = list.findIndex(
      (x) => (merged.id && String(x.id) === String(merged.id)) || clubAuthEmailNorm(x?.email) === em
    );
    if (ix < 0) return;
    const next = { ...list[ix] };
    delete next.password;
    if (authUid) next.authUid = authUid;
    list[ix] = next;
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch (e) {
    console.warn('stripPasswordFromLocalMirror:', e);
  }
}

async function resolveMemberProfileAfterLogin(collectionKey, uid, email) {
  const remoteList = await getDocuments(collectionKey);
  const em = clubAuthEmailNorm(email);
  const byUid = remoteList.find((d) => d.authUid === uid);
  if (byUid) return byUid;
  return remoteList.find((d) => clubAuthEmailNorm(d.email) === em) || null;
}

/**
 * Login socio o amigo: Firebase Auth + migración automática si solo existía contraseña en local.
 */
async function loginClubIdentity({ collectionKey, localKey, email, password }) {
  const em = String(email).trim();
  const pwd = String(password);
  if (!em || !pwd) {
    const err = new Error('Introduce email y contraseña');
    err.code = 'auth/missing';
    throw err;
  }

  if (auth.isSimulation || db.isSimulation) {
    const list = JSON.parse(
      (typeof localStorage !== 'undefined' && localStorage.getItem(localKey)) || '[]'
    );
    let row = null;
    for (const candidate of list) {
      if (clubAuthEmailNorm(candidate.email) !== clubAuthEmailNorm(em)) continue;
      if (candidate.passwordHash && typeof window.verifyClubAccessKey === 'function') {
        if (await window.verifyClubAccessKey(pwd, candidate.passwordHash)) {
          row = candidate;
          break;
        }
      } else if (candidate.password && candidate.password === pwd) {
        row = { ...candidate };
        if (typeof window.hashClubAccessKey === 'function') {
          row.passwordHash = await window.hashClubAccessKey(pwd);
        }
        delete row.password;
        const ix = list.findIndex((x) => x.id === candidate.id);
        if (ix >= 0) {
          list[ix] = row;
          localStorage.setItem(localKey, JSON.stringify(list));
        }
        break;
      }
    }
    if (!row) {
      const err = new Error('Credenciales incorrectas');
      err.code = 'auth/invalid-credential';
      throw err;
    }
    const safe = { ...row };
    delete safe.password;
    return { uid: null, profile: safe, simulation: true };
  }

  const remoteList = await getDocuments(collectionKey);
  let userCred;

  try {
    userCred = await signInWithEmailAndPassword(auth, em, pwd);
  } catch (e) {
    const merged = mergeLegacyLocalRemote(localKey, em, remoteList);
    const legacyOk = await verifyLegacyLocalPassword(localKey, merged, pwd);
    if (!merged || !legacyOk) {
      const err = new Error('Credenciales incorrectas');
      err.code = 'auth/invalid-credential';
      throw err;
    }
    try {
      userCred = await createUserWithEmailAndPassword(auth, em, pwd);
    } catch (e2) {
      if (e2?.code === 'auth/email-already-in-use') {
        const err = new Error(
          'Ya existe una cuenta con este correo. Si no recuerdas la contraseña, usa «¿Olvidaste tu contraseña?» o contacta con el club.'
        );
        err.code = 'auth/email-already-in-use';
        throw err;
      }
      throw e2;
    }
    const uid = userCred.user.uid;
    const fireId = merged.id ? String(merged.id) : null;
    if (fireId && !db.isSimulation) {
      try {
        await updateDoc(doc(db, normalizeCollectionName(collectionKey), fireId), {
          authUid: uid,
          updatedAt: serverTimestamp()
        });
      } catch (upErr) {
        console.warn('No se pudo vincular authUid en Firestore:', upErr);
      }
    }
    stripPasswordFromLocalMirror(localKey, merged, uid);
    try {
      mirrorLocalUpsert(normalizeCollectionName(collectionKey), fireId || uid, {
        ...merged,
        authUid: uid,
        password: undefined
      });
    } catch (_) {}
  }

  const uid = userCred.user.uid;
  let profile = await resolveMemberProfileAfterLogin(collectionKey, uid, em);
  if (!profile) {
    profile = { email: clubAuthEmailNorm(em), authUid: uid };
  }
  return { uid, profile, simulation: false };
}

async function registerClubEmailOnly(email, password) {
  const em = String(email).trim();
  if (auth.isSimulation || db.isSimulation) {
    return { uid: null, simulation: true };
  }
  const cr = await createUserWithEmailAndPassword(auth, em, password);
  return { uid: cr.user.uid, simulation: false };
}

async function signOutClubSessionIfMatches(session) {
  if (auth.isSimulation || db.isSimulation) return;
  try {
    const u = auth.currentUser;
    if (!u || !session) return;
    const sid = session.authUid || session.uid;
    if (sid && u.uid === sid) {
      await signOut(auth);
      return;
    }
    if (session.email && u.email && clubAuthEmailNorm(u.email) === clubAuthEmailNorm(session.email)) {
      await signOut(auth);
    }
  } catch (e) {
    console.warn('signOutClubSessionIfMatches:', e);
  }
}

async function clubMemberChangePassword(session, currentPwd, newPwd) {
  if (auth.isSimulation || db.isSimulation) {
    const err = new Error('Modo local');
    err.code = 'simulation';
    throw err;
  }
  const u = auth.currentUser;
  if (!u || !session?.email) {
    const err = new Error('Sesión Firebase no activa');
    err.code = 'auth/no-user';
    throw err;
  }
  if (session.authUid && u.uid !== session.authUid) {
    const err = new Error('Sesión no coincide');
    err.code = 'auth/mismatch';
    throw err;
  }
  const emailForCred = u.email || String(session.email || '').trim();
  const cred = EmailAuthProvider.credential(emailForCred, String(currentPwd));
  await reauthenticateWithCredential(u, cred);
  await updatePassword(u, String(newPwd));
}

async function clubSendPasswordReset(email) {
  if (auth.isSimulation || db.isSimulation) {
    const err = new Error('No disponible en modo simulación');
    err.code = 'simulation';
    throw err;
  }
  await sendPasswordResetEmail(auth, String(email).trim());
}

window.cdsanClubAuth = {
  loginMember: loginClubIdentity,
  registerEmail: registerClubEmailOnly,
  signOutIfMatches: signOutClubSessionIfMatches,
  changePassword: clubMemberChangePassword,
  sendPasswordReset: clubSendPasswordReset,
  clubAuthEmailNorm
};

// ðŸš€ InicializaciÃ³n automÃ¡tica
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ðŸ”¥ Inicializando Firebase para CDSANABRIACF...');
  
  try {
    // Configurar servicios
    setupAuth();
    await setupMessaging();
    
    // Configurar sincronizaciÃ³n en tiempo real
    await setupRealtimeSync();

    await fetchEventsAndEncuentrosToLocalStorage();
    
    // SincronizaciÃ³n inicial
    setTimeout(async () => {
      await syncFromFirebase();
      await syncWithFirebase();
    }, 2000);
    
    console.log('âœ… Firebase configurado correctamente con sincronizaciÃ³n en tiempo real');

    if (typeof window.sanitizeClubLocalCredentials === 'function') {
      window.sanitizeClubLocalCredentials().catch((e) => console.warn('sanitizeClubLocalCredentials:', e));
    }
    
  } catch (error) {
    console.error('âŒ Error inicializando Firebase:', error);
  }
});

// ðŸ“¡ Exportar para uso global
window.firebaseApp = app;
window.firebaseDb = db;
window.firebaseAuth = auth;
window.firebaseStorage = storage;
window.firebaseMessaging = messaging;
window.firebaseConfig = firebaseConfig;

window.DB_COLLECTIONS = DB_COLLECTIONS;
window.createDocument = createDocument;
window.getDocuments = getDocuments;
window.updateDocument = updateDocument;
window.withScopeForCollection = withScopeForCollection;
window.deleteDocument = deleteDocument;
window.syncWithFirebase = syncWithFirebase;
window.syncFromFirebase = syncFromFirebase;
window.fetchEventsAndEncuentrosToLocalStorage = fetchEventsAndEncuentrosToLocalStorage;
window.setupRealtimeSync = setupRealtimeSync;
window.disconnectRealtimeSync = disconnectRealtimeSync;
window.syncLocalArrayKeyToFirebase = syncLocalArrayKeyToFirebase;
window.syncLocalSettingsBlobToFirebase = syncLocalSettingsBlobToFirebase;
window.firebaseUserIsClubAdmin = firebaseUserIsClubAdmin;
window.syncClubMembersLocal = syncClubMembersLocal;
window.syncClubFriendsLocal = syncClubFriendsLocal;
window.syncClubPlayersLocal = syncClubPlayersLocal;
window.syncClubCoachesLocal = syncClubCoachesLocal;
window.syncClubBoardLocal = syncClubBoardLocal;

// Compatibilidad con index.html legado (usa window.cdsanabriacfFirebase.*)
window.cdsanabriacfFirebase = {
  isInitialized: true,
  useLocalStorageFallback: !!db.isSimulation,
  async checkConnectivity() {
    return {
      firebaseReady: !db.isSimulation,
      authReady: !auth.isSimulation,
      online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true
    };
  },
  async getSocios() {
    return getDocuments('members');
  },
  async getAmigos() {
    return getDocuments('friends');
  },
  async addSocio(data) {
    const id = await createDocument('members', data);
    return { id, ...withScopeForCollection(DB_COLLECTIONS.MEMBERS, data) };
  },
  async addAmigo(data) {
    const id = await createDocument('friends', data);
    return { id, ...withScopeForCollection(DB_COLLECTIONS.FRIENDS, data) };
  },
  async getSocioByEmailOrDNI(email, dni) {
    const socios = await getDocuments('members');
    const em = String(email || '').trim().toLowerCase();
    const dn = String(dni || '').trim().toLowerCase();
    return socios.find(s => String(s.email || '').trim().toLowerCase() === em || String(s.dni || '').trim().toLowerCase() === dn) || null;
  },
  async getEstadisticas() {
    const [socios, amigos, jugadores, entrenadores, equipos, eventos] = await Promise.all([
      getDocuments('members'),
      getDocuments('friends'),
      getDocuments('players'),
      getDocuments('coaches'),
      getDocuments('teams'),
      getDocuments('events')
    ]);
    return {
      socios: socios.length,
      amigos: amigos.length,
      jugadores: jugadores.length,
      entrenadores: entrenadores.length,
      equipos: equipos.length,
      eventos: eventos.length
    };
  }
};

console.log('ðŸ”¥ ConfiguraciÃ³n Firebase cargada - Sistema integrado con persistencia local');

if (typeof window !== 'undefined') {
  window.dispatchEvent(new CustomEvent('firebaseReady'));
}

