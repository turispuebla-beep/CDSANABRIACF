'use strict';

const APP_SCOPE = 'cdsanabriacf';

let db = null;

function initAdmin() {
  if (db) return db;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no configurado en Netlify');
  const cred = JSON.parse(raw);
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  db = admin.firestore();
  return db;
}

function paymentsRef() {
  return initAdmin().collection('sanabria_payments');
}

function membersRef() {
  return initAdmin().collection('sanabria_members');
}

function eventsRef() {
  return initAdmin().collection('sanabria_events');
}

function playersRef() {
  return initAdmin().collection('sanabria_players');
}

function normalizeDni(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

async function savePendingPayment(orderId, data) {
  const doc = {
    ...data,
    appScope: APP_SCOPE,
    orderId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await paymentsRef().doc(orderId).set(doc, { merge: true });
  return doc;
}

async function getPayment(orderId) {
  const snap = await paymentsRef().doc(orderId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

async function updatePayment(orderId, patch) {
  await paymentsRef().doc(orderId).set(
    { ...patch, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

function proximoCierreTemporada31AgostoIso() {
  const now = new Date();
  let y = now.getFullYear();
  let aug31 = new Date(y, 7, 31, 23, 59, 59, 999);
  if (now > aug31) aug31 = new Date(y + 1, 7, 31, 23, 59, 59, 999);
  return aug31.toISOString();
}

/** Localiza el documento del socio por id de pedido o, en su defecto, por email. */
async function resolveMemberDoc(payment) {
  const memberId = payment.memberId ? String(payment.memberId).trim() : '';
  if (memberId) {
    const ref = membersRef().doc(memberId);
    const snap = await ref.get();
    if (snap.exists) return { ref, data: snap.data() };
  }
  const email = String(payment.customerEmail || '').trim().toLowerCase();
  if (!email) return null;
  const q = await membersRef().where('email', '==', email).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  return { ref: doc.ref, data: doc.data() };
}

/**
 * Pago de cuota correcto (Redsys): marca pagado y activa el alta al instante
 * (equivalente a validación manual del admin para transferencia/efectivo).
 */
async function memberExistsForEmail(email, memberId) {
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) return false;
  if (memberId) {
    const snap = await membersRef().doc(String(memberId)).get();
    if (snap.exists && String(snap.data().email || '').toLowerCase() === norm) return true;
  }
  const q = await membersRef().where('email', '==', norm).limit(1).get();
  return !q.empty;
}

async function completeMembershipPayment(payment, redsysParams) {
  const resolved = await resolveMemberDoc(payment);
  if (!resolved) {
    throw new Error('Socio no encontrado para activar el alta (memberId/email)');
  }

  const now = new Date().toISOString();
  const authCode =
    redsysParams.Ds_AuthorisationCode ||
    redsysParams.DS_AUTHORISATIONCODE ||
    redsysParams.Ds_AuthorizationCode ||
    null;

  await resolved.ref.set(
    {
      pagado: true,
      paymentStatus: 'paid',
      paymentOrderId: payment.orderId,
      paymentDate: now,
      paymentMethod: payment.payMethod === 'bizum' ? 'redsys_bizum' : 'redsys_caja_rural',
      redsysAuthCode: authCode,
      status: 'active',
      estado: 'activo',
      pendingReason: null,
      fechaLimitePago: null,
      fechaVencimiento: null,
      validatedBy: 'redsys_auto',
      validatedDate: now,
      cuotaVigenteHasta: proximoCierreTemporada31AgostoIso(),
      lastModified: now,
      updatedAt: now,
      activatedAt: now,
      activationSource: 'redsys_membership_fee',
      appScope: APP_SCOPE
    },
    { merge: true }
  );

  try {
    const { sendMemberPaymentConfirmedEmail } = require('./member-email');
    const d = resolved.data;
    await sendMemberPaymentConfirmedEmail({
      email: d.email || payment.customerEmail,
      nombre: d.nombre || d.name,
      apellidos: d.apellidos || d.surname,
      numeroSocio: d.numeroSocio || d.memberNumber
    });
  } catch (mailErr) {
    console.warn('Email alta activa (pago):', mailErr.message || mailErr);
  }
}

async function completeEventPayment(payment) {
  const { eventId, participant, registrationBundle, guests } = payment;
  if (!eventId) throw new Error('eventId ausente');
  const ref = eventsRef().doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Evento no encontrado');
  const event = snap.data();
  const participants = Array.isArray(event.participants) ? [...event.participants] : [];

  let toAdd = [];
  if (registrationBundle && registrationBundle.holder) {
    toAdd = [registrationBundle.holder, ...(Array.isArray(registrationBundle.guests) ? registrationBundle.guests : [])];
  } else if (participant) {
    toAdd = [participant, ...(Array.isArray(guests) ? guests : [])];
  }
  if (!toAdd.length) throw new Error('participant o registrationBundle ausente');

  const now = new Date().toISOString();
  toAdd.forEach((rec) => {
    const isGuest = !!rec.isGuest;
    const exists = participants.some((p) => {
      if (isGuest) {
        return (
          rec.id &&
          p.id &&
          String(p.id) === String(rec.id)
        );
      }
      if (p.email && rec.email) {
        return String(p.email).toLowerCase() === String(rec.email).toLowerCase();
      }
      return rec.id && p.id && String(p.id) === String(rec.id);
    });
    if (!exists) {
      participants.push({
        ...rec,
        paidOnline: true,
        paymentMethod: payment.payMethod === 'bizum' ? 'redsys_bizum' : 'redsys_card',
        paymentOrderId: payment.orderId,
        paidAt: now
      });
    }
  });

  await ref.set(
    { participants, registeredMembers: participants, updatedAt: now },
    { merge: true }
  );
}

async function findPlayerDocByDniSeason(dni, season) {
  const norm = normalizeDni(dni);
  if (!norm) return null;
  const q = await playersRef().where('dni', '==', norm).limit(20).get();
  if (q.empty) return null;
  const seasonStr = String(season || '').trim();
  for (const doc of q.docs) {
    const data = doc.data();
    if (String(data.inscriptionSeason || data.temporada || '') === seasonStr) {
      return { ref: doc.ref, data: { id: doc.id, ...data } };
    }
  }
  return { ref: q.docs[0].ref, data: { id: q.docs[0].id, ...q.docs[0].data() } };
}

/**
 * Inscripción jugador/a (web): activa ficha en sanabria_players y socio-jugador si aplica.
 * Evita duplicar por DNI + temporada.
 */
async function completePlayerInscription(payment) {
  const reg = payment.playerRegistration;
  if (!reg || typeof reg !== 'object') {
    throw new Error('playerRegistration ausente');
  }

  const now = new Date().toISOString();
  const season = String(reg.inscriptionSeason || reg.temporada || '').trim();
  const dni = normalizeDni(reg.dni);
  if (!dni) throw new Error('DNI ausente en inscripción');

  const patch = {
    ...reg,
    dni,
    inscriptionSeason: season,
    temporada: season,
    inscriptionStatus: 'paid',
    status: 'active',
    estado: 'activo',
    paymentStatus: 'paid',
    inscriptionPaid: true,
    paymentMethod: payment.payMethod === 'bizum' ? 'redsys_bizum' : 'redsys_caja_rural',
    paymentOrderId: payment.orderId,
    paidAt: now,
    validatedDate: now,
    validatedBy: 'redsys_auto',
    updatedAt: now,
    appScope: APP_SCOPE,
    isJugador: true,
    socioJugador: !!reg.paySocioSelected
  };

  const existing = await findPlayerDocByDniSeason(dni, season);
  let playerId;
  if (existing) {
    playerId = existing.data.id;
    await existing.ref.set(patch, { merge: true });
  } else {
    const ref = playersRef().doc();
    playerId = ref.id;
    await ref.set({ ...patch, id: playerId, registrationDate: reg.registrationDate || now }, { merge: true });
  }

  if (reg.paySocioSelected) {
    const resolved = await resolveMemberDoc({
      memberId: reg.linkedMemberId || null,
      customerEmail: reg.email || payment.customerEmail
    });
    const memberPatch = {
      isJugador: true,
      socioJugador: true,
      playerId,
      playerCategory: reg.category || reg.categoria,
      nombre: reg.name || reg.nombre,
      name: reg.name || reg.nombre,
      apellidos: reg.surname || reg.apellidos,
      surname: reg.surname || reg.apellidos,
      dni,
      telefono: reg.phone || reg.telefono,
      phone: reg.phone || reg.telefono,
      email: String(reg.email || payment.customerEmail || '').toLowerCase(),
      pagado: true,
      paymentStatus: 'paid',
      status: 'active',
      estado: 'activo',
      paymentOrderId: payment.orderId,
      paymentDate: now,
      inscriptionSeasonSocio: season,
      cuotaVigenteHasta: proximoCierreTemporada31AgostoIso(),
      lastModified: now,
      updatedAt: now,
      validatedBy: 'redsys_auto',
      validatedDate: now,
      activationSource: 'redsys_player_inscription',
      appScope: APP_SCOPE
    };
    if (resolved) {
      await resolved.ref.set(memberPatch, { merge: true });
    } else {
      const ref = membersRef().doc();
      await ref.set(
        {
          ...memberPatch,
          id: ref.id,
          numeroSocio: 'SOC' + String(Date.now()).slice(-6),
          registrationDate: now,
          registrationSource: 'web_inscription_socio_jugador'
        },
        { merge: true }
      );
    }
  }
}

module.exports = {
  savePendingPayment,
  getPayment,
  updatePayment,
  completeMembershipPayment,
  completeEventPayment,
  completePlayerInscription,
  memberExistsForEmail
};
