'use strict';

const {
  ensureFirebaseAdmin,
  isNetlifyScheduledInvocation,
  verifyAdminRequest
} = require('./lib/admin-auth');
const { corsHeaders, jsonResponse } = require('./lib/http-cors');
const { APP_SCOPE, deliverClubPushNotification } = require('./lib/club-push-send');

function bearerToken(event) {
  const authHeader =
    (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function verifyCronSecret(event) {
  const secret = String(process.env.NETLIFY_CRON_SECRET || '').trim();
  if (!secret) return false;
  return bearerToken(event) === secret;
}

async function verifyScheduledRequest(event) {
  if (isNetlifyScheduledInvocation(event) || verifyCronSecret(event)) {
    return { ok: true, source: 'cron' };
  }
  return verifyAdminRequest(event);
}

function scheduledAtToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' }, origin);
  }

  const auth = await verifyScheduledRequest(event);
  if (!auth.ok) {
    return jsonResponse(auth.statusCode || 401, { ok: false, error: auth.error }, origin);
  }

  try {
    const adm = ensureFirebaseAdmin();
    const db = adm.firestore();
    const now = new Date();
    const snap = await db
      .collection('sanabria_notifications')
      .where('appScope', '==', APP_SCOPE)
      .where('deliveryStatus', '==', 'pending')
      .get();

    const due = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const when = scheduledAtToDate(data.scheduledAt);
      if (!when || when > now) return;
      due.push({ id: docSnap.id, ref: docSnap.ref, data });
    });

    let processed = 0;
    let sentTotal = 0;
    const errors = [];

    for (const item of due) {
      try {
        const message = { ...item.data, id: item.data.broadcastId || item.id };
        const pushResult = await deliverClubPushNotification(message);
        await item.ref.update({
          deliveryStatus: 'sent',
          status: 'sent',
          sentAt: new Date().toISOString(),
          pushSent: pushResult.sent || 0,
          pushFailed: pushResult.failed || 0,
          updatedAt: new Date().toISOString()
        });
        processed += 1;
        sentTotal += pushResult.sent || 0;
      } catch (err) {
        console.error('process-scheduled-notifications item', item.id, err);
        errors.push({ id: item.id, error: err.message || String(err) });
      }
    }

    return jsonResponse(200, {
      ok: true,
      due: due.length,
      processed,
      sentTotal,
      errors
    }, origin);
  } catch (err) {
    console.error('process-scheduled-notifications:', err);
    return jsonResponse(500, { ok: false, error: err.message || 'Error procesando recordatorios' }, origin);
  }
};
