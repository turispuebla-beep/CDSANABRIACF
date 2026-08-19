'use strict';

const { ensureFirebaseAdmin } = require('./admin-auth');

const APP_SCOPE = 'cdsanabriacf';
const FCM_BATCH = 500;
const CLUB_ESCUDO_PATH = '/assets/escudo-192.png';

function normalizeTeamKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenMatchesAudience(tokenDoc, targetRoles, targetTeams) {
  const role = String(tokenDoc.userRole || 'guest').toLowerCase() || 'guest';
  let tokenRoles = Array.isArray(tokenDoc.userRoles)
    ? tokenDoc.userRoles.map(function (r) {
        return String(r || '').toLowerCase();
      }).filter(Boolean)
    : [];
  if (!tokenRoles.length) tokenRoles = [role];
  if (tokenRoles.indexOf('guest') < 0 && !tokenDoc.email && !tokenDoc.authUid) {
    tokenRoles.push('guest');
  }
  const roles = Array.isArray(targetRoles) && targetRoles.length ? targetRoles : ['all'];
  const wantsEveryone = roles.indexOf('all') >= 0;
  const roleOk =
    wantsEveryone ||
    tokenRoles.some(function (r) {
      return roles.indexOf(r) >= 0;
    });
  if (!roleOk) return false;

  const teams = Array.isArray(targetTeams) ? targetTeams.filter(Boolean) : [];
  if (!teams.length || teams.indexOf('all') >= 0) return true;

  const userTeams = Array.isArray(tokenDoc.teams) ? tokenDoc.teams.map(normalizeTeamKey) : [];
  if (!userTeams.length) return false;

  const wanted = teams.map(normalizeTeamKey);
  return userTeams.some((t) => wanted.includes(t));
}

function buildAbsoluteAssetUrl(siteUrl, imagePath) {
  const base = String(siteUrl || '').replace(/\/$/, '');
  const path = String(imagePath || CLUB_ESCUDO_PATH).trim();
  if (/^https?:\/\//i.test(path)) return path;
  return base + (path.startsWith('/') ? path : '/' + path);
}

function buildNotificationOpenUrl(siteUrl, broadcastId) {
  const base = String(siteUrl || '').replace(/\/$/, '');
  const id = encodeURIComponent(String(broadcastId || '').trim());
  return id ? base + '/?notif=' + id : base + '/';
}

async function sendPushBatch(messaging, tokens, payload) {
  if (!tokens.length) return { success: 0, failure: 0 };
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body
    },
    data: {
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
      url: payload.url,
      notifId: payload.notifId,
      urgent: payload.urgent ? '1' : '0',
      tag: payload.tag
    },
    webpush: {
      headers: {
        Urgency: payload.urgent ? 'high' : 'normal',
        TTL: '86400'
      },
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        badge: payload.icon,
        tag: payload.tag,
        vibrate: [200, 100, 200],
        requireInteraction: !!payload.urgent,
        renotify: true
      },
      fcmOptions: {
        link: payload.url
      }
    }
  });
  return {
    success: response.successCount,
    failure: response.failureCount
  };
}

async function collectTokensForMessage(message) {
  const adm = ensureFirebaseAdmin();
  const db = adm.firestore();
  const snap = await db.collection('sanabria_fcm_tokens').where('appScope', '==', APP_SCOPE).get();
  const targetRoles = Array.isArray(message.targetRoles) ? message.targetRoles : ['all'];
  const targetTeams = Array.isArray(message.targetTeams) ? message.targetTeams : [];
  const tokens = [];
  let registered = 0;

  snap.forEach((doc) => {
    const data = doc.data() || {};
    registered += 1;
    const token = String(data.fcmToken || '').trim();
    if (!token) return;
    if (data.wantsPush === false) return;
    if (!tokenMatchesAudience(data, targetRoles, targetTeams)) return;
    tokens.push(token);
  });

  return { tokens: [...new Set(tokens)], registered: registered };
}

async function deliverClubPushNotification(message, options) {
  const opts = options || {};
  const siteUrl = String(opts.siteUrl || process.env.SITE_URL || 'https://www.cdsanabriacf.com').replace(/\/$/, '');
  const title = String(message.title || '').trim();
  const body = String(message.content || message.message || message.body || '').trim();
  const broadcastId = String(message.broadcastId || message.clientMessageId || message.id || '').trim();
  const urgent =
    message.priority === 'high' ||
    message.type === 'urgent' ||
    opts.urgent === true;

  if (!title || !body) {
    throw new Error('Título y contenido obligatorios para push');
  }

  const collected = await collectTokensForMessage(message);
  const tokens = collected.tokens || [];
  if (!tokens.length) {
    return {
      sent: 0,
      failed: 0,
      devices: 0,
      registered: collected.registered || 0,
      message: 'Sin dispositivos con notificaciones activas para este filtro.'
    };
  }

  const icon = buildAbsoluteAssetUrl(siteUrl, CLUB_ESCUDO_PATH);
  const payload = {
    title,
    body,
    icon,
    url: buildNotificationOpenUrl(siteUrl, broadcastId),
    notifId: broadcastId,
    urgent,
    tag: broadcastId || 'cdsanabriacf-push'
  };

  const adm = ensureFirebaseAdmin();
  const messaging = adm.messaging();
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tokens.length; i += FCM_BATCH) {
    const batch = tokens.slice(i, i + FCM_BATCH);
    const result = await sendPushBatch(messaging, batch, payload);
    sent += result.success;
    failed += result.failure;
  }

  return {
    sent,
    failed,
    devices: tokens.length,
    registered: collected.registered || tokens.length,
    message: 'Push enviado a ' + sent + ' dispositivo(s).'
  };
}

module.exports = {
  APP_SCOPE,
  CLUB_ESCUDO_PATH,
  buildNotificationOpenUrl,
  deliverClubPushNotification,
  collectTokensForMessage
};
