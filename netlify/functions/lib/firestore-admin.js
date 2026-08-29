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

function friendsRef() {
  return initAdmin().collection('sanabria_friends');
}

function eventsRef() {
  return initAdmin().collection('sanabria_events');
}

function playersRef() {
  return initAdmin().collection('sanabria_players');
}

function applicationsRef() {
  return initAdmin().collection('sanabria_player_applications');
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

const membershipSeason = require('./membership-season');
const memberNumbers = require('./member-numbers');

function proximoCierreTemporadaIso() {
  return membershipSeason.proximoCierreTemporadaIso();
}

function settingsRef() {
  return initAdmin().collection('sanabria_config');
}

function ledgerRef() {
  return initAdmin().collection('sanabria_accounting_ledger');
}

function displayPersonName(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return [obj.nombre || obj.name, obj.apellidos || obj.surname].filter(Boolean).join(' ').trim();
}

function newLedgerId() {
  return 'L' + String(Date.now()) + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
}

function ledgerIdFromDedupe(key) {
  const s = String(key || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 110);
  return s ? 'led_' + s : newLedgerId();
}

async function findExistingLedgerRow(entry) {
  const key = String((entry && entry.dedupeKey) || '').trim();
  if (key) {
    const q = await ledgerRef().where('dedupeKey', '==', key).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  }
  const orderId = String((entry && entry.paymentOrderId) || '').trim();
  const category = String((entry && entry.category) || '').trim();
  if (orderId) {
    const q2 = await ledgerRef().where('paymentOrderId', '==', orderId).limit(20).get();
    for (const doc of q2.docs) {
      const d = doc.data() || {};
      if (category && String(d.category || '') !== category) continue;
      return { id: doc.id, ...d };
    }
  }
  return null;
}

/**
 * Ingreso/gasto en el libro (caja A banco / B efectivo). No duplica si ya hay dedupeKey o pedido.
 */
async function recordClubLedgerIncome(entry) {
  try {
    const amount = Number(entry && entry.signedAmount);
    if (!Number.isFinite(amount) || amount === 0) return { skipped: true, reason: 'importe' };
    const existing = await findExistingLedgerRow(entry);
    if (existing) return { skipped: true, row: existing };
    const id = String((entry && entry.id) || (entry && entry.dedupeKey ? ledgerIdFromDedupe(entry.dedupeKey) : newLedgerId()));
    const row = {
      id,
      createdAt: (entry && entry.createdAt) || new Date().toISOString(),
      bucket: entry && entry.bucket === 'B' ? 'B' : 'A',
      signedAmount: Math.round(amount * 100) / 100,
      concept: String((entry && entry.concept) || '').slice(0, 500),
      category: String((entry && entry.category) || 'otro').slice(0, 80),
      refType: (entry && entry.refType) || null,
      refId: entry && entry.refId != null ? String(entry.refId) : null,
      transferPairId: (entry && entry.transferPairId) || null,
      paymentOrderId: entry && entry.paymentOrderId ? String(entry.paymentOrderId) : null,
      paymentChannel: entry && entry.paymentChannel ? String(entry.paymentChannel).slice(0, 40) : null,
      dedupeKey: entry && entry.dedupeKey ? String(entry.dedupeKey).slice(0, 180) : null,
      source: (entry && entry.source) || 'auto',
      appScope: APP_SCOPE
    };
    await ledgerRef().doc(id).set(row, { merge: true });
    return { skipped: false, row };
  } catch (err) {
    console.warn('recordClubLedgerIncome:', err && err.message ? err.message : err);
    return { skipped: true, error: err && err.message ? err.message : String(err) };
  }
}

const DEFAULT_MEMBERSHIP_PRICING = { cuotaMenor: 10, cuotaMayor: 25, edadMaxMenor: 17 };

function parseMembershipPricingDoc(d) {
  if (!d || typeof d !== 'object') return null;
  return {
    cuotaMenor: Number(d.cuotaMenor) || DEFAULT_MEMBERSHIP_PRICING.cuotaMenor,
    cuotaMayor: Number(d.cuotaMayor) || DEFAULT_MEMBERSHIP_PRICING.cuotaMayor,
    edadMaxMenor: Number(d.edadMaxMenor) || DEFAULT_MEMBERSHIP_PRICING.edadMaxMenor
  };
}

/** Panel guarda en cfg_clubMembershipPricing; legacy clubMembershipPricing. */
async function readMembershipPricing() {
  const docIds = ['cfg_clubMembershipPricing', 'clubMembershipPricing'];
  for (let i = 0; i < docIds.length; i++) {
    try {
      const snap = await settingsRef().doc(docIds[i]).get();
      if (snap.exists) {
        const parsed = parseMembershipPricingDoc(snap.data());
        if (parsed) return parsed;
      }
    } catch (e) {
      console.warn('readMembershipPricing:', docIds[i], e.message);
    }
  }
  return { ...DEFAULT_MEMBERSHIP_PRICING };
}

function memberDocIsActive(data) {
  const st = String((data && data.status) || '').toLowerCase();
  if (st === 'active') return true;
  const est = String((data && data.estado) || '').toLowerCase();
  return !st && (est === 'activo' || est === 'activa');
}

/** Comprueba que el aviso al club corresponde a un registro real reciente. */
async function clubRecordExistsForNotify(opts) {
  const playerId = String(opts.playerId || '').trim();
  if (playerId) {
    const snap = await playersRef().doc(playerId).get();
    if (snap.exists) return true;
  }
  const email = String(opts.email || opts.requesterEmail || '').trim().toLowerCase();
  const dni = normalizeDni(opts.dni);
  if (email) {
    const mq = await membersRef().where('email', '==', email).limit(1).get();
    if (!mq.empty) return true;
    const fq = await friendsRef().where('email', '==', email).limit(1).get();
    if (!fq.empty) return true;
  }
  if (dni) {
    const mq = await membersRef().where('dni', '==', dni).limit(1).get();
    if (!mq.empty) return true;
    const fq = await friendsRef().where('dni', '==', dni).limit(1).get();
    if (!fq.empty) return true;
    const pq = await playersRef().where('dni', '==', dni).limit(1).get();
    if (!pq.empty) return true;
  }
  return false;
}

/**
 * Tras el cierre de temporada (31/05): activos → pendientes de renovación (una vez por cierre).
 */
async function applyAutomaticSeasonRenewal(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const closeYear = membershipSeason.getSeasonCloseYearToProcess(now);
  if (closeYear == null) {
    return { ok: true, skipped: true, reason: 'before_season_close' };
  }

  const renewalKey = membershipSeason.getCierreCuotaKey(closeYear);
  const seasonDocRef = settingsRef().doc('membershipSeason');
  const seasonSnap = await seasonDocRef.get();
  const prev = seasonSnap.exists ? seasonSnap.data() : {};
  if (!options.force && prev.lastAutoRenewalKey === renewalKey) {
    return { ok: true, skipped: true, reason: 'already_applied', renewalKey };
  }

  const anioRef = membershipSeason.getCuotaEdadReferenciaAnio(now);
  const pricing = await readMembershipPricing();
  const temporada = `${closeYear}-${anioRef}`;
  const refLabel = membershipSeason.cierreRefLabel(anioRef);
  const ts = now.toISOString();

  const [qActive, qLegacy] = await Promise.all([
    membersRef().where('status', '==', 'active').get(),
    membersRef().where('estado', '==', 'activo').get()
  ]);
  const seen = new Set();
  const docs = [];
  qActive.docs.forEach((d) => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      docs.push(d);
    }
  });
  qLegacy.docs.forEach((d) => {
    if (!seen.has(d.id) && memberDocIsActive(d.data())) {
      seen.add(d.id);
      docs.push(d);
    }
  });

  let updated = 0;
  const batchSize = 400;
  let batch = initAdmin().batch();
  let ops = 0;

  async function commitBatch() {
    if (ops === 0) return;
    await batch.commit();
    batch = initAdmin().batch();
    ops = 0;
  }

  for (const doc of docs) {
    const data = doc.data() || {};
    const cuota = membershipSeason.cuotaSegunMiembro(data, anioRef, pricing);
    batch.set(
      doc.ref,
      {
        status: 'pending_validation',
        estado: 'pendiente',
        pagado: false,
        pendingReason: 'renovacion',
        cuota,
        renovacionDesde: ts,
        fechaLimitePago: null,
        diasLimiteRenovacion: null,
        renovacionTemporada: temporada,
        cuotaReferenciaEdadCierre: refLabel,
        cuotaReferenciaEdad31Agosto: refLabel,
        lastModified: ts,
        updatedAt: ts,
        autoRenewalKey: renewalKey,
        appScope: APP_SCOPE
      },
      { merge: true }
    );
    updated++;
    ops++;
    if (ops >= batchSize) await commitBatch();
  }
  await commitBatch();

  const cfg = membershipSeason.getConfig();
  await seasonDocRef.set(
    {
      lastAutoRenewalKey: renewalKey,
      lastAutoRenewalAt: ts,
      closeMonth: cfg.closeMonth,
      closeDay: cfg.closeDay,
      paymentDeadlineDays: cfg.paymentDeadlineDays,
      firstCloseYear: cfg.firstCloseYear,
      membersUpdated: updated,
      appScope: APP_SCOPE
    },
    { merge: true }
  );

  return { ok: true, renewalKey, updated, anioRef, temporada };
}

/** Localiza el documento del socio por id, bundle de registro o email (sin mezclar socio-jugador del hijo). */
async function resolveMemberDoc(payment) {
  const memberId = payment.memberId ? String(payment.memberId).trim() : '';
  if (memberId) {
    const ref = membersRef().doc(memberId);
    const snap = await ref.get();
    if (snap.exists) return { ref, data: { id: snap.id, ...snap.data() } };
  }

  const bundleMember = payment.registrationBundle && payment.registrationBundle.member;
  if (bundleMember) {
    const patch = normalizeMemberRecordFields(bundleMember);
    const found = await findMemberDocForAdultSocioRegistration(patch);
    if (found) return found;
    return null;
  }

  const email = String(payment.customerEmail || '').trim().toLowerCase();
  if (!email) return null;
  const q = await membersRef().where('email', '==', email).limit(20).get();
  if (q.empty) return null;
  for (const doc of q.docs) {
    const data = doc.data();
    if (!data.socioJugador && !data.playerId) {
      return { ref: doc.ref, data: { id: doc.id, ...data } };
    }
  }
  const doc = q.docs[0];
  return { ref: doc.ref, data: { id: doc.id, ...doc.data() } };
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

async function friendExistsForEmail(email, friendId) {
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) return false;
  if (friendId) {
    const snap = await friendsRef().doc(String(friendId)).get();
    if (snap.exists && String(snap.data().email || '').toLowerCase() === norm) return true;
  }
  const q = await friendsRef().where('email', '==', norm).limit(1).get();
  return !q.empty;
}

async function listAllMembersData() {
  const snap = await membersRef().get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function activationPatchWithMemberNumber(existingData, activationFields) {
  const all = await listAllMembersData();
  const merged = { ...(existingData || {}), ...(activationFields || {}) };
  const numPatch = memberNumbers.memberNumberPatch(merged, all);
  return {
    patch: { ...(activationFields || {}), ...(numPatch || {}) },
    merged: numPatch ? { ...merged, ...numPatch } : merged
  };
}

/** Asigna n.º ≥ 51 a socios activos que solo tengan provisional SOC… (admin / recuperación). */
async function assignPendingRegularMemberNumbers(opts = {}) {
  const dryRun = opts.dryRun === true;
  const all = await listAllMembersData();
  const pending = all
    .filter((m) => memberNumbers.needsRegularMemberNumber(m))
    .sort((a, b) =>
      String(a.registrationDate || a.fechaRegistro || a.validatedDate || '').localeCompare(
        String(b.registrationDate || b.fechaRegistro || b.validatedDate || '')
      )
    );
  const assigned = [];
  let working = [...all];
  const now = new Date().toISOString();
  for (const m of pending) {
    const merged = { ...m };
    memberNumbers.assignNextRegularNumberIfNeeded(merged, working);
    const num = memberNumbers.getRegularNumber(merged);
    if (num == null) continue;
    const row = {
      id: m.id,
      memberNumber: num,
      numeroSocio: num,
      numeroSocioRegular: num
    };
    if (!dryRun) {
      await membersRef().doc(String(m.id)).set(
        {
          memberNumber: num,
          numeroSocio: num,
          numeroSocioRegular: num,
          membershipTier: 'regular',
          socioDeHonor: false,
          lastModified: now,
          updatedAt: now
        },
        { merge: true }
      );
      working = working.map((x) => (x.id === m.id ? { ...x, ...row } : x));
    }
    assigned.push(row);
  }
  return { ok: true, dryRun, assigned: assigned.length, members: assigned };
}

async function completeMembershipPayment(payment, redsysParams) {
  let resolved = await resolveMemberDoc(payment);
  if (!resolved && payment.registrationBundle && payment.registrationBundle.member) {
    const saved = await upsertMemberRegistrationRecord(payment.registrationBundle.member);
    resolved = { ref: membersRef().doc(saved.id), data: saved };
  }
  if (!resolved) {
    throw new Error('Socio no encontrado para activar el alta (memberId/email/registrationBundle)');
  }

  const now = new Date().toISOString();
  const authCode =
    redsysParams.Ds_AuthorisationCode ||
    redsysParams.DS_AUTHORISATIONCODE ||
    redsysParams.Ds_AuthorizationCode ||
    null;

  const { patch, merged } = await activationPatchWithMemberNumber(resolved.data, {
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
    cuotaVigenteHasta: proximoCierreTemporadaIso(),
    lastModified: now,
    updatedAt: now,
    activatedAt: now,
    activationSource: 'redsys_membership_fee',
    appScope: APP_SCOPE
  });
  await resolved.ref.set(patch, { merge: true });

  try {
    const memberId = String(resolved.ref.id);
    const name = displayPersonName(merged) || 'Socio';
    const cuotaAmt = Number(payment.amountEur != null ? payment.amountEur : merged.cuota);
    await recordClubLedgerIncome({
      bucket: 'A',
      signedAmount: cuotaAmt,
      concept: 'Cuota socio (pasarela): ' + name,
      category: 'cuota_socio',
      refType: 'member',
      refId: memberId,
      paymentOrderId: payment.orderId,
      paymentChannel: payment.payMethod === 'bizum' ? 'bizum' : 'tarjeta',
      dedupeKey: 'member:cuota_socio:' + memberId,
      source: 'redsys'
    });
  } catch (ledErr) {
    console.warn('Ledger cuota socio pasarela:', ledErr && ledErr.message ? ledErr.message : ledErr);
  }

  try {
    const { sendMemberPaymentConfirmedEmail } = require('./member-email');
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    const d = merged;
    const payCh = payment.payMethod === 'bizum' ? 'bizum' : 'tarjeta';
    const nombre = [d.nombre || d.name, d.apellidos || d.surname].filter(Boolean).join(' ').trim();
    await sendMemberPaymentConfirmedEmail({
      email: d.email || payment.customerEmail,
      nombre: d.nombre || d.name,
      apellidos: d.apellidos || d.surname,
      numeroSocio: d.numeroSocio || d.memberNumber
    });
    await sendClubAdminNotification({
      kind: 'socio_cuota_pagada',
      title: 'Cuota de socio pagada (pasarela)',
      subject: `Cuota socio pagada — ${payCh === 'bizum' ? 'Bizum' : 'Tarjeta'}`,
      paymentChannel: payCh,
      requesterEmail: d.email || payment.customerEmail,
      nombre: d.nombre || d.name,
      apellidos: d.apellidos || d.surname,
      dni: d.dni,
      sexo: d.sexo,
      fechaNacimiento: d.fechaNacimiento || d.birthDate,
      direccion: d.direccion || d.address,
      telefono: d.telefono || d.phone,
      email: d.email || payment.customerEmail,
      numeroSocio: d.numeroSocio || d.memberNumber,
      memberNumber: d.numeroSocio || d.memberNumber,
      fields: [
        { label: 'Cuota (€)', value: d.cuota != null ? d.cuota : payment.amountEur },
        { label: 'Estado', value: 'Activo (pago confirmado)' },
        { label: 'Pedido pasarela', value: payment.orderId }
      ]
    });
  } catch (mailErr) {
    console.warn('Email alta activa (pago):', mailErr.message || mailErr);
  }
}

/** Aviso cuando la pasarela rechaza o cancela el pago (ficha puede quedar pendiente). */
async function sendPaymentFailedNotification(payment) {
  if (!payment || payment.failedEmailSent) return { sent: false, reason: 'ya enviado' };
  const orderId = payment.orderId || payment.id;
  try {
    const { sendPaymentFailedEmail } = require('./member-email');
    const result = await sendPaymentFailedEmail({
      email: payment.customerEmail,
      customerEmail: payment.customerEmail,
      type: payment.type,
      amountEur: payment.amountEur
    });

    // Inscripción jugador: avisar al club del fallo (la ficha ya está pendiente en nube).
    if (payment.type === 'player_inscription') {
      const reg = payment.playerRegistration || {};
      const email = String(reg.email || payment.customerEmail || '').trim().toLowerCase();
      try {
        const { sendClubAdminNotification } = require('./club-admin-notify-email');
        await sendClubAdminNotification({
          kind: 'inscripcion_jugador',
          title: 'Pago tarjeta no completado — ficha pendiente',
          subject: 'Inscripción jugador — pago tarjeta fallido (pendiente)',
          paymentChannel: 'tarjeta',
          requesterEmail: email || payment.customerEmail,
          playerId: payment.playerId || reg.id,
          nombre: reg.name || reg.nombre,
          apellidos: reg.surname || reg.apellidos,
          dni: reg.dni,
          email: email || payment.customerEmail,
          telefono: reg.phone || reg.telefono,
          fields: [
            { label: 'Estado', value: 'Pendiente de pago (pago pasarela no confirmado)' },
            { label: 'Pedido', value: orderId || '—' },
            { label: 'Importe (€)', value: payment.amountEur != null ? payment.amountEur : '—' }
          ]
        });
      } catch (clubErr) {
        console.warn('Email club tras KO tarjeta:', clubErr.message || clubErr);
      }
    }

    if (result.sent && orderId) {
      await updatePayment(orderId, { failedEmailSent: true });
    }
    return result;
  } catch (err) {
    console.warn('Email pago KO:', err.message || err);
    return { sent: false, reason: err.message || String(err) };
  }
}

/** PayGold (enlace SMS/email): cuota activa socio; ropa/otros avisan al club. */
async function completePayGoldPayment(payment, redsysParams) {
  const category = String(payment.conceptCategory || 'other').toLowerCase();
  if (category === 'membership' || category === 'cuota' || category === 'socio') {
    await completeMembershipPayment(payment, redsysParams);
    return;
  }

  const { sendClubAdminNotification } = require('./club-admin-notify-email');
  const payCh = 'paygold';
  const concept = payment.conceptLabel || payment.description || 'Cobro PayGold';
  const fields = [
    { label: 'Concepto', value: concept },
    { label: 'Importe (€)', value: payment.amountEur },
    { label: 'Pedido', value: payment.orderId },
    { label: 'Canal', value: payment.paygoldChannel || payment.delivery || 'paygold' }
  ];

  const paygoldAmt = Number(payment.amountEur);
  if (Number.isFinite(paygoldAmt) && paygoldAmt > 0) {
    const isKit = category === 'kit' || category === 'ropa' || category === 'equipacion';
    await recordClubLedgerIncome({
      bucket: 'A',
      signedAmount: paygoldAmt,
      concept: 'PayGold: ' + concept,
      category: isKit ? 'equipacion' : 'paygold',
      refType: isKit ? 'player_kit' : 'paygold',
      refId: String(payment.playerId || payment.orderId || ''),
      paymentOrderId: payment.orderId,
      paymentChannel: 'paygold',
      dedupeKey: 'pay:' + String(payment.orderId) + ':' + (isKit ? 'equipacion' : 'paygold'),
      source: 'paygold'
    });
  }

  if (category === 'kit' || category === 'ropa' || category === 'equipacion') {
    await sendClubAdminNotification({
      kind: 'paygold_kit_paid',
      title: 'Equipación / ropa pagada (PayGold SMS)',
      subject: `Ropa pagada — PayGold — ${concept}`,
      paymentChannel: payCh,
      requesterEmail: payment.customerEmail,
      email: payment.customerEmail,
      telefono: payment.customerMobile,
      nombre: payment.buyerName,
      fields
    });
    return;
  }

  await sendClubAdminNotification({
    kind: 'paygold_custom_paid',
    title: 'Cobro PayGold confirmado',
    subject: `Cobro PayGold — ${concept}`,
    paymentChannel: payCh,
    requesterEmail: payment.customerEmail,
    email: payment.customerEmail,
    telefono: payment.customerMobile,
    nombre: payment.buyerName,
    fields
  });
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

  const holderForLedger = toAdd[0] || {};
  const eventTitleForLedger = event.title || event.name || 'Evento';
  const totalEurLedger =
    payment.amountEur != null
      ? payment.amountEur
      : registrationBundle && registrationBundle.totalEur != null
        ? registrationBundle.totalEur
        : toAdd.reduce(function (s, r) {
            return s + Number(r.appliedPrice || 0);
          }, 0);
  await recordClubLedgerIncome({
    bucket: event.revenueDestination === 'B' ? 'B' : 'A',
    signedAmount: totalEurLedger,
    concept:
      'Evento "' +
      eventTitleForLedger +
      '": ' +
      (displayPersonName(holderForLedger) || payment.customerEmail || holderForLedger.email || 'inscripción'),
    category: 'evento',
    refType: 'event',
    refId: String(eventId),
    paymentOrderId: payment.orderId,
    paymentChannel: payment.payMethod === 'bizum' ? 'bizum' : 'tarjeta',
    dedupeKey: 'event:' + String(eventId) + ':pay:' + String(payment.orderId || ''),
    source: 'redsys'
  });

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    const payCh = payment.payMethod === 'bizum' ? 'bizum' : 'tarjeta';
    const holder = toAdd[0] || {};
    const eventTitle = event.title || event.name || 'Evento';
    const guestCount = Math.max(0, toAdd.length - 1);
    const totalEur =
      payment.amountEur != null
        ? payment.amountEur
        : registrationBundle && registrationBundle.totalEur != null
          ? registrationBundle.totalEur
          : toAdd.reduce(function (s, r) {
              return s + Number(r.appliedPrice || 0);
            }, 0);
    await sendClubAdminNotification({
      kind: 'evento_inscripcion_pagada',
      title: 'Inscripción a evento pagada (pasarela)',
      subject: `Evento pagado — ${eventTitle}`,
      paymentChannel: payCh,
      requesterEmail: payment.customerEmail || holder.email,
      nombre: holder.nombre || holder.name,
      apellidos: holder.apellidos || holder.surname,
      dni: holder.dni,
      direccion: holder.direccion || holder.address,
      telefono: holder.telefono || holder.phone,
      email: payment.customerEmail || holder.email,
      numeroSocio: holder.numeroSocio || holder.memberNumber,
      memberNumber: holder.numeroSocio || holder.memberNumber,
      numeroAmigo: holder.numeroAmigo || holder.friendNumber,
      friendNumber: holder.numeroAmigo || holder.friendNumber,
      fields: [
        { label: 'Evento', value: eventTitle },
        { label: 'Plazas', value: String(toAdd.length) },
        { label: 'Invitados', value: String(guestCount) },
        { label: 'Importe (€)', value: totalEur },
        { label: 'Pedido pasarela', value: payment.orderId }
      ]
    });
    const { sendEventRegistrationConfirmedEmail } = require('./member-email');
    const eventTime = [event.startTime, event.endTime].filter(Boolean).join(' — ');
    await sendEventRegistrationConfirmedEmail({
      email: payment.customerEmail || holder.email,
      nombre: holder.nombre || holder.name,
      apellidos: holder.apellidos || holder.surname,
      eventTitle: eventTitle,
      eventDate: event.date,
      eventTime: eventTime,
      eventLocation: event.location,
      totalEur: totalEur,
      slots: toAdd.length,
      guestCount: guestCount,
      paymentChannel: payCh
    });
  } catch (mailErr) {
    console.warn('Email club evento pagado:', mailErr.message || mailErr);
  }
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
  return null;
}

/** Localiza ficha por DNI+temporada; si no hay DNI, por nombre+apellidos+temporada; email solo con nombre. */
async function findPlayerDocByIdentity(player) {
  const season = String(player.inscriptionSeason || player.temporada || '').trim();
  const dni = normalizeDni(player.dni);
  if (dni) {
    const byDni = await findPlayerDocByDniSeason(dni, season);
    if (byDni && playerDocMatchesIdentity(byDni.data, player)) return byDni;
  }
  const pn = normalizeNamePart(player.name || player.nombre);
  const ps = normalizeNamePart(player.surname || player.apellidos);
  if (pn && ps && season) {
    const qName = await playersRef().where('inscriptionSeason', '==', season).limit(50).get();
    for (const doc of qName.docs) {
      const data = doc.data();
      if (data.appScope && data.appScope !== APP_SCOPE) continue;
      if (playerDocMatchesIdentity(data, player)) {
        return { ref: doc.ref, data: { id: doc.id, ...data } };
      }
    }
  }
  const email = String(player.email || player.guardianEmail || '').trim().toLowerCase();
  if (email && season && pn && ps) {
    const q = await playersRef().where('email', '==', email).limit(25).get();
    for (const doc of q.docs) {
      const data = doc.data();
      if (data.appScope && data.appScope !== APP_SCOPE) continue;
      if (String(data.inscriptionSeason || data.temporada || '') !== season) continue;
      if (playerDocMatchesIdentity(data, player)) {
        return { ref: doc.ref, data: { id: doc.id, ...data } };
      }
    }
  }
  return null;
}

function playerInscriptionLinksSocioFromReg(reg) {
  if (!reg) return false;
  if (String(reg.registrationSource || '') === 'web_inscription') return true;
  if (reg.socioJugador || reg.isJugador) return true;
  const season = String(reg.inscriptionSeason || reg.temporada || '').trim();
  const hasName = !!String(reg.name || reg.nombre || '').trim();
  return !!(season && hasName);
}

async function resolveMemberForPlayerInscription(reg) {
  const linkedId = reg.linkedMemberId ? String(reg.linkedMemberId).trim() : '';
  if (linkedId && !linkedId.startsWith('MEMBER_')) {
    const ref = membersRef().doc(linkedId);
    const snap = await ref.get();
    if (snap.exists) return { ref, data: snap.data() };
  }
  const norm = normalizeDni(reg.dni);
  if (!norm) return null;
  const q = await membersRef().where('dni', '==', norm).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  return { ref: doc.ref, data: doc.data() };
}

/**
 * Inscripción jugador/a (web): activa ficha en sanabria_players y socio-jugador si aplica.
 * Evita duplicar por DNI + temporada.
 */
async function completePlayerInscription(payment, opts) {
  const skipNotify = !!(opts && opts.skipNotify);
  const reg = payment.playerRegistration;
  if (!reg || typeof reg !== 'object') {
    throw new Error('playerRegistration ausente');
  }

  const now = new Date().toISOString();
  const season = String(reg.inscriptionSeason || reg.temporada || '').trim();
  const dni = normalizeDni(reg.dni);
  const email = String(reg.email || payment.customerEmail || '').trim().toLowerCase();
  if (!dni && !email) throw new Error('Identificador ausente (DNI o email) en inscripción');

  const patch = {
    ...reg,
    dni: dni || '',
    email: email || String(reg.email || '').trim().toLowerCase(),
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
    socioJugador: playerInscriptionLinksSocioFromReg(reg)
  };

  const existing = await findPlayerDocByIdentity({ ...reg, dni, email, inscriptionSeason: season });
  let playerId;
  let memberId = null;
  if (existing) {
    playerId = existing.data.id;
    await existing.ref.set(patch, { merge: true });
  } else {
    const ref = playersRef().doc();
    playerId = ref.id;
    await ref.set({ ...patch, id: playerId, registrationDate: reg.registrationDate || now }, { merge: true });
  }

  if (playerInscriptionLinksSocioFromReg(reg)) {
    const playerForMember = { ...patch, id: playerId, linkedMemberId: reg.linkedMemberId || null };
    const existingMember = await findMemberDocForPlayerInscription(playerForMember);
    const cb = reg.chargeBreakdown || {};
    const cuotaSocio =
      Number(cb.socio) > 0
        ? Number(cb.socio)
        : Number(cb.total) > 0
          ? Number(cb.total)
          : null;
    const memberPatch = {
      isJugador: true,
      socioJugador: true,
      playerId,
      playerCategory: reg.category || reg.categoria,
      categoriaJugador: reg.category || reg.categoria,
      nombre: reg.name || reg.nombre,
      name: reg.name || reg.nombre,
      apellidos: reg.surname || reg.apellidos,
      surname: reg.surname || reg.apellidos,
      dni: dni || '',
      telefono: reg.phone || reg.telefono,
      phone: reg.phone || reg.telefono,
      email: email || String(reg.email || '').trim().toLowerCase(),
      domicilio: reg.domicilio || reg.address || '',
      localidad: reg.localidad || '',
      provincia: reg.provincia || 'Zamora',
      address: reg.address || reg.domicilio || '',
      direccion: reg.direccion || reg.address || '',
      birthDate: reg.birthDate || reg.fechaNacimiento,
      fechaNacimiento: reg.birthDate || reg.fechaNacimiento,
      guardianName: reg.guardianName || '',
      guardianDNI: normalizeDni(reg.guardianDNI || reg.guardianDni) || '',
      guardianPhone: reg.guardianPhone || '',
      guardianEmail: String(reg.guardianEmail || '').trim().toLowerCase(),
      guardianAddress: reg.guardianAddress || '',
      pagado: true,
      paymentStatus: 'paid',
      status: 'active',
      estado: 'activo',
      pendingReason: null,
      fechaLimitePago: null,
      paymentOrderId: payment.orderId,
      paymentDate: now,
      inscriptionSeasonSocio: season,
      inscriptionSeasonJugador: season,
      cuotaVigenteHasta: proximoCierreTemporadaIso(),
      cuotaSocioEnInscripcion: true,
      lastModified: now,
      updatedAt: now,
      validatedBy: 'redsys_auto',
      validatedDate: now,
      activationSource: 'redsys_player_inscription',
      registrationSource: 'web_inscription_socio_jugador',
      appScope: APP_SCOPE
    };
    if (cuotaSocio != null) memberPatch.cuota = cuotaSocio;
    const allMembers = await listAllMembersData();
    const memberBase = existingMember ? existingMember.data : {};
    const numPatch = memberNumbers.memberNumberPatch({ ...memberBase, ...memberPatch }, allMembers);
    if (numPatch) Object.assign(memberPatch, numPatch);
    if (existingMember) {
      memberId = existingMember.data.id;
      await existingMember.ref.set(memberPatch, { merge: true });
    } else {
      const ref = membersRef().doc();
      memberId = ref.id;
      const createPayload = {
        ...memberPatch,
        id: memberId,
        registrationDate: now
      };
      if (!numPatch) {
        createPayload.numeroSocio = 'SOC' + String(Date.now()).slice(-6);
      }
      await ref.set(createPayload, { merge: true });
    }
    await playersRef().doc(String(playerId)).set(
      { linkedMemberId: memberId, updatedAt: now },
      { merge: true }
    );
  }

  let savedMemberData = null;
  if (memberId) {
    const memberSnap = await membersRef()
      .doc(String(memberId))
      .get()
      .catch(() => null);
    if (memberSnap && memberSnap.exists) {
      savedMemberData = { id: memberSnap.id, ...memberSnap.data() };
    }
  }

  const playerSnapNotify = await playersRef().doc(String(playerId)).get();
  const savedPlayerNotify = playerSnapNotify.exists
    ? { id: playerId, ...playerSnapNotify.data() }
    : { ...reg, id: playerId };

  try {
    const cb = (reg && reg.chargeBreakdown) || {};
    const name = displayPersonName(reg) || displayPersonName(savedPlayerNotify) || 'Jugador/a';
    const ch = payment.payMethod === 'bizum' ? 'bizum' : 'tarjeta';
    const socioAmt = Number(cb.socio) > 0 ? Number(cb.socio) : 0;
    const fichaAmt = Number(cb.ficha) > 0 ? Number(cb.ficha) : 0;
    const kitAmt = Number(cb.kit) > 0 ? Number(cb.kit) : 0;
    const fallbackAmt = Number(cb.total != null ? cb.total : payment.amountEur);
    if (socioAmt > 0) {
      const socioRef = memberId ? String(memberId) : String(playerId);
      await recordClubLedgerIncome({
        bucket: 'A',
        signedAmount: socioAmt,
        concept: 'Cuota socio (inscripción jugador, pasarela): ' + name,
        category: 'cuota_socio',
        refType: memberId ? 'member' : 'player',
        refId: socioRef,
        paymentOrderId: payment.orderId,
        paymentChannel: ch,
        dedupeKey: (memberId ? 'member:cuota_socio:' : 'player:cuota_socio:') + socioRef,
        source: 'redsys'
      });
    }
    if (fichaAmt > 0) {
      await recordClubLedgerIncome({
        bucket: 'A',
        signedAmount: fichaAmt,
        concept: 'Ficha jugador (pasarela): ' + name,
        category: 'ficha_jugador',
        refType: 'player',
        refId: String(playerId),
        paymentOrderId: payment.orderId,
        paymentChannel: ch,
        dedupeKey: 'player:ficha_jugador:' + String(playerId),
        source: 'redsys'
      });
    }
    if (kitAmt > 0) {
      await recordClubLedgerIncome({
        bucket: 'A',
        signedAmount: kitAmt,
        concept: 'Equipación (inscripción, pasarela): ' + name,
        category: 'equipacion',
        refType: 'player_kit',
        refId: String(playerId),
        paymentOrderId: payment.orderId,
        paymentChannel: ch,
        dedupeKey: 'player:equipacion:' + String(playerId) + ':' + String(payment.orderId || ''),
        source: 'redsys'
      });
    }
    if (socioAmt <= 0 && fichaAmt <= 0 && kitAmt <= 0 && Number.isFinite(fallbackAmt) && fallbackAmt > 0) {
      await recordClubLedgerIncome({
        bucket: 'A',
        signedAmount: fallbackAmt,
        concept: 'Inscripción jugador (pasarela): ' + name,
        category: 'ficha_jugador',
        refType: 'player',
        refId: String(playerId),
        paymentOrderId: payment.orderId,
        paymentChannel: ch,
        dedupeKey: 'player:ficha_jugador:' + String(playerId),
        source: 'redsys'
      });
    }
  } catch (ledErr) {
    console.warn('Ledger inscripción jugador pasarela:', ledErr && ledErr.message ? ledErr.message : ledErr);
  }

  try {
    if (skipNotify) return;
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    const { buildPlayerInscriptionNotifyFields, formatKitSummary } = require('./player-inscription-notify-fields');
    const payCh = payment.payMethod === 'bizum' ? 'bizum' : 'tarjeta';
    const total = reg.chargeBreakdown && reg.chargeBreakdown.total != null ? reg.chargeBreakdown.total : reg.totalCharge;
    const regForNotify = {
      ...savedPlayerNotify,
      numeroSocio: savedMemberData && (savedMemberData.numeroSocio || savedMemberData.memberNumber),
      memberNumber: savedMemberData && (savedMemberData.memberNumber || savedMemberData.numeroSocio),
      linkedMemberId: savedMemberData && savedMemberData.id
    };
    const notifyFields = buildPlayerInscriptionNotifyFields(regForNotify, {
      orderId: payment.orderId,
      paid: true
    });
    await sendClubAdminNotification({
      kind: 'inscripcion_jugador_pagada',
      title: 'Inscripción jugador/a pagada (pasarela)',
      subject: `Inscripción pagada — ${payCh === 'bizum' ? 'Bizum' : 'Tarjeta'}`,
      paymentChannel: payCh,
      requesterEmail: reg.email || payment.customerEmail,
      playerId,
      nombre: reg.name || reg.nombre,
      apellidos: reg.surname || reg.apellidos,
      dni: reg.dni,
      fechaNacimiento: reg.birthDate || reg.fechaNacimiento,
      direccion: reg.domicilio || reg.address,
      localidad: reg.localidad,
      provincia: reg.provincia,
      telefono: reg.phone || reg.telefono,
      email: reg.email || payment.customerEmail,
      numeroSocio: regForNotify.numeroSocio || regForNotify.memberNumber,
      memberNumber: regForNotify.memberNumber || regForNotify.numeroSocio,
      fields: notifyFields
    });
    const { sendPlayerInscriptionPaymentConfirmedEmail } = require('./member-email');
    await sendPlayerInscriptionPaymentConfirmedEmail({
      email: reg.email || payment.customerEmail,
      guardianEmail: reg.guardianEmail,
      dni: reg.dni,
      playerId,
      nombre: reg.name || reg.nombre,
      apellidos: reg.surname || reg.apellidos,
      season,
      inscriptionSeason: season,
      category: reg.category || reg.categoria,
      totalEur: total,
      paymentChannel: payCh,
      kitSummary: formatKitSummary(reg),
      fields: notifyFields
    });
  } catch (mailErr) {
    console.warn('Email club inscripción pagada:', mailErr.message || mailErr);
  }
}

/** Compra adicional de equipación (solo ropa) — socio-jugador logueado, tarjeta/Bizum. */
async function completePlayerKitPurchase(payment) {
  const kitPayload = payment.playerKitOrder || payment.playerRegistration;
  if (!kitPayload || typeof kitPayload !== 'object') {
    throw new Error('playerKitOrder ausente');
  }
  const playerId = payment.playerId || kitPayload.id;
  if (!playerId) throw new Error('playerId ausente');

  const now = new Date().toISOString();
  const newItems = Array.isArray(kitPayload.kitOrder)
    ? kitPayload.kitOrder
    : kitPayload.kit && Array.isArray(kitPayload.kit.items)
      ? kitPayload.kit.items
      : [];
  if (!newItems.length) throw new Error('Pedido de ropa vacío');

  const ref = playersRef().doc(String(playerId));
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Jugador no encontrado');
  const existing = snap.data();

  const totalEur =
    kitPayload.chargeBreakdown && kitPayload.chargeBreakdown.total != null
      ? Number(kitPayload.chargeBreakdown.total)
      : Number(payment.amountEur);

  const purchase = {
    orderId: payment.orderId,
    items: newItems,
    totalEur: totalEur,
    paidAt: now,
    payMethod: payment.payMethod === 'bizum' ? 'redsys_bizum' : 'redsys_card'
  };

  const prevKit = Array.isArray(existing.kitOrder) ? existing.kitOrder : [];
  const mergedKit = prevKit.concat(newItems);
  const kitPurchases = Array.isArray(existing.kitPurchases)
    ? existing.kitPurchases.concat([purchase])
    : [purchase];

  await ref.set(
    {
      kitOrder: mergedKit,
      kit: { ...(existing.kit || {}), items: mergedKit },
      kitPurchases,
      lastKitPurchaseAt: now,
      lastKitPurchaseOrderId: payment.orderId,
      updatedAt: now
    },
    { merge: true }
  );

  try {
    const kitName = displayPersonName(existing) || displayPersonName(kitPayload) || 'Jugador/a';
    await recordClubLedgerIncome({
      bucket: 'A',
      signedAmount: totalEur,
      concept: 'Equipación (pasarela): ' + kitName,
      category: 'equipacion',
      refType: 'player_kit',
      refId: String(playerId),
      paymentOrderId: payment.orderId,
      paymentChannel: payment.payMethod === 'bizum' ? 'bizum' : 'tarjeta',
      dedupeKey: 'player:equipacion:' + String(playerId) + ':' + String(payment.orderId || ''),
      source: 'redsys'
    });
  } catch (ledErr) {
    console.warn('Ledger equipación pasarela:', ledErr && ledErr.message ? ledErr.message : ledErr);
  }

  const regForNotify = {
    id: playerId,
    ...existing,
    ...kitPayload,
    kitOrder: newItems,
    kit: { items: newItems },
    chargeBreakdown: kitPayload.chargeBreakdown || { kit: totalEur, ficha: 0, socio: 0, total: totalEur }
  };

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    const { buildPlayerInscriptionNotifyFields, formatKitSummary } = require('./player-inscription-notify-fields');
    const payCh = payment.payMethod === 'bizum' ? 'bizum' : 'tarjeta';
    await sendClubAdminNotification({
      kind: 'player_kit_pagada',
      title: 'Compra equipación jugador/a (pasarela)',
      subject: `Equipación pagada — ${payCh === 'bizum' ? 'Bizum' : 'Tarjeta'}`,
      paymentChannel: payCh,
      requesterEmail: regForNotify.email || payment.customerEmail,
      nombre: regForNotify.name || regForNotify.nombre,
      apellidos: regForNotify.surname || regForNotify.apellidos,
      dni: regForNotify.dni,
      fechaNacimiento: regForNotify.birthDate || regForNotify.fechaNacimiento,
      direccion: regForNotify.domicilio || regForNotify.address,
      localidad: regForNotify.localidad,
      provincia: regForNotify.provincia,
      telefono: regForNotify.phone || regForNotify.telefono,
      email: regForNotify.email || payment.customerEmail,
      numeroSocio: regForNotify.numeroSocio || regForNotify.memberNumber,
      memberNumber: regForNotify.numeroSocio || regForNotify.memberNumber,
      fields: buildPlayerInscriptionNotifyFields(regForNotify, {
        orderId: payment.orderId,
        paymentNote: 'Compra equipación (solo ropa, socio-jugador)'
      })
    });
    const { sendPlayerKitPurchaseConfirmedEmail } = require('./member-email');
    await sendPlayerKitPurchaseConfirmedEmail({
      email: regForNotify.email || payment.customerEmail,
      guardianEmail: regForNotify.guardianEmail,
      nombre: regForNotify.name || regForNotify.nombre,
      apellidos: regForNotify.surname || regForNotify.apellidos,
      season: regForNotify.inscriptionSeason || regForNotify.temporada,
      category: regForNotify.category || regForNotify.categoria,
      totalEur: totalEur,
      paymentChannel: payCh,
      kitSummary: formatKitSummary({ kitOrder: newItems })
    });
  } catch (mailErr) {
    console.warn('Email equipación pagada:', mailErr.message || mailErr);
  }

  return { id: playerId, ...existing, kitOrder: mergedKit, kitPurchases };
}

async function findApplicationByDniSeason(dni, email, season) {
  const s = String(season || '').trim();
  const n = normalizeDni(dni);
  const em = String(email || '').trim().toLowerCase();
  if (n) {
    const q = await applicationsRef()
      .where('appScope', '==', APP_SCOPE)
      .where('season', '==', s)
      .where('dni', '==', n)
      .limit(1)
      .get();
    if (!q.empty) return { id: q.docs[0].id, ...q.docs[0].data() };
  }
  if (em) {
    const q2 = await applicationsRef()
      .where('appScope', '==', APP_SCOPE)
      .where('season', '==', s)
      .where('email', '==', em)
      .limit(1)
      .get();
    if (!q2.empty) return { id: q2.docs[0].id, ...q2.docs[0].data() };
  }
  return null;
}

async function createPlayerApplication(data) {
  const now = new Date().toISOString();
  const ref = applicationsRef().doc();
  const doc = {
    ...data,
    appScope: APP_SCOPE,
    status: data.status || 'pending_review',
    submittedAt: now,
    updatedAt: now
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

async function approvePlayerApplication(applicationId, adminMeta) {
  const ref = applicationsRef().doc(String(applicationId));
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Solicitud no encontrada');
  const app = snap.data();
  if (app.status === 'approved') {
    return { application: { id: snap.id, ...app }, playerId: app.playerId };
  }

  const now = new Date().toISOString();
  const season = app.season;
  const dni = normalizeDni(app.dni);

  let playerId = app.playerId || null;
  let playerRef = null;
  if (playerId) {
    playerRef = playersRef().doc(playerId);
    const ps = await playerRef.get();
    if (!ps.exists) playerRef = null;
  }
  if (!playerRef && dni) {
    const pq = await playersRef()
      .where('appScope', '==', APP_SCOPE)
      .where('dni', '==', dni)
      .where('inscriptionSeason', '==', season)
      .limit(1)
      .get();
    if (!pq.empty) {
      playerRef = pq.docs[0].ref;
      playerId = pq.docs[0].id;
    }
  }
  if (!playerRef) {
    playerRef = playersRef().doc();
    playerId = playerRef.id;
  }

  const playerPatch = {
    appScope: APP_SCOPE,
    name: app.name,
    nombre: app.name,
    surname: app.surname,
    apellidos: app.surname,
    dni: dni,
    email: String(app.email || '').toLowerCase(),
    phone: app.phone,
    telefono: app.phone,
    address: app.address || '',
    direccion: app.address || '',
    birthDate: app.birthDate,
    fechaNacimiento: app.birthDate,
    category: app.category || '',
    categoria: app.category || '',
    guardianName: app.guardianName || '',
    guardianSurname: app.guardianSurname || '',
    guardianDNI: app.guardianDni || app.guardianDNI || '',
    guardianDni: app.guardianDni || app.guardianDNI || '',
    guardianPhone: app.guardianPhone || '',
    guardianEmail: app.guardianEmail || '',
    guardianAddress: app.guardianAddress || '',
    inscriptionSeason: season,
    temporada: season,
    inscriptionStatus: 'approved_for_inscription',
    status: 'pending_validation',
    estado: 'pendiente',
    paymentStatus: 'pending',
    inscriptionPaid: false,
    registrationSource: 'player_application',
    applicationId: snap.id,
    playerConsent: true,
    photoConsent: true,
    clubRulesAcceptedAt: now,
    approvedAt: now,
    approvedBy: adminMeta?.validatedBy || 'admin',
    updatedAt: now
  };
  if (app.portalPasswordHash) {
    playerPatch.portalPasswordHash = app.portalPasswordHash;
    playerPatch.portalPasswordSetAt = app.portalPasswordSetAt || now;
  }

  await playerRef.set(
    {
      ...playerPatch,
      id: playerId,
      createdAt: playerPatch.createdAt || now
    },
    { merge: true }
  );

  await ref.set(
    {
      status: 'approved',
      playerId: playerId,
      reviewedAt: now,
      reviewedBy: adminMeta?.validatedBy || 'admin',
      updatedAt: now
    },
    { merge: true }
  );

  let emailSent = false;
  let emailTo = '';
  let emailError = '';
  try {
    const { sendPlayerApplicationApprovedEmail } = require('./member-email');
    const mail = await sendPlayerApplicationApprovedEmail({
      email: app.email,
      guardianEmail: app.guardianEmail,
      nombre: app.name,
      name: app.name,
      apellidos: app.surname,
      surname: app.surname,
      season: app.season
    });
    emailSent = !!mail.sent;
    emailTo =
      mail.to ||
      String(app.email || app.guardianEmail || '')
        .trim()
        .toLowerCase();
    if (!mail.sent) emailError = mail.reason || 'no enviado';
  } catch (mailErr) {
    emailError = mailErr.message || String(mailErr);
    console.warn('Email solicitud jugador aceptada:', mailErr);
  }

  return {
    application: { id: snap.id, ...app, status: 'approved', playerId },
    playerId,
    emailSent,
    emailTo,
    emailError
  };
}

async function rejectPlayerApplication(applicationId, adminMeta) {
  const ref = applicationsRef().doc(String(applicationId));
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Solicitud no encontrada');
  const now = new Date().toISOString();
  await ref.set(
    {
      status: 'rejected',
      reviewedAt: now,
      reviewedBy: adminMeta?.validatedBy || 'admin',
      rejectReason: String(adminMeta?.reason || '').trim(),
      updatedAt: now
    },
    { merge: true }
  );
  return { id: snap.id, ...snap.data(), status: 'rejected' };
}

const crypto = require('crypto');

const PORTAL_RESETS = 'sanabria_player_portal_resets';
const RESET_TTL_MS = 60 * 60 * 1000;

function hashPortalPassword(plain) {
  return crypto.createHash('sha256').update(String(plain || ''), 'utf8').digest('hex');
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function playerPortalEmails(player) {
  const main = normalizeEmail(player.email);
  return main ? [main] : [];
}

function emailMatchesPlayer(player, email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  return normalizeEmail(player.email) === e;
}

function normalizeNamePart(v) {
  return String(v || '').trim().toLowerCase();
}

function playerDocMatchesIdentity(data, player) {
  if (!data || !player) return false;
  const playerDni = normalizeDni(player.dni);
  const dataDni = normalizeDni(data.dni);
  if (playerDni && dataDni && playerDni !== dataDni) return false;
  const pn = normalizeNamePart(player.name || player.nombre);
  const ps = normalizeNamePart(player.surname || player.apellidos);
  const dn = normalizeNamePart(data.name || data.nombre);
  const ds = normalizeNamePart(data.surname || data.apellidos);
  if (pn && ps && dn && ds && (dn !== pn || ds !== ps)) return false;
  if (playerDni && dataDni && playerDni === dataDni) return true;
  return !!(pn && ps && dn === pn && ds === ps);
}

async function findPlayerForPortalLookup(dni, name, surname, season) {
  const norm = normalizeDni(dni);
  const seasonStr = String(season || '').trim();
  const nm = normalizeNamePart(name);
  const sn = normalizeNamePart(surname);

  if (norm) {
    const found = await findPlayerDocByDniSeason(norm, seasonStr);
    if (found) return found;
  }

  if (!nm || !sn) return null;
  const q = await playersRef().where('appScope', '==', APP_SCOPE).limit(500).get();
  for (const doc of q.docs) {
    const data = doc.data();
    if (seasonStr && String(data.inscriptionSeason || data.temporada || '') !== seasonStr) continue;
    const pn = normalizeNamePart(data.name || data.nombre);
    const ps = normalizeNamePart(data.surname || data.apellidos);
    if (pn === nm && ps === sn) {
      return { ref: doc.ref, data: { id: doc.id, ...data } };
    }
  }
  return null;
}

function sanitizePlayerForPortal(data) {
  if (!data) return null;
  return {
    id: data.id,
    name: data.name || data.nombre || '',
    nombre: data.name || data.nombre || '',
    surname: data.surname || data.apellidos || '',
    apellidos: data.surname || data.apellidos || '',
    dni: data.dni || '',
    email: data.email || '',
    phone: data.phone || data.telefono || '',
    telefono: data.phone || data.telefono || '',
    address: data.address || data.direccion || '',
    direccion: data.address || data.direccion || '',
    birthDate: data.birthDate || data.fechaNacimiento || '',
    fechaNacimiento: data.birthDate || data.fechaNacimiento || '',
    category: data.category || data.categoria || '',
    categoria: data.category || data.categoria || '',
    position: data.position || data.posicion || '',
    posicion: data.position || data.posicion || '',
    weightKg: data.weightKg != null ? data.weightKg : null,
    heightCm: data.heightCm != null ? data.heightCm : null,
    guardianName: data.guardianName || '',
    guardianDNI: data.guardianDNI || data.guardianDni || '',
    guardianPhone: data.guardianPhone || '',
    guardianEmail: data.guardianEmail || '',
    guardianAddress: data.guardianAddress || '',
    inscriptionSeason: data.inscriptionSeason || data.temporada || '',
    inscriptionStatus: data.inscriptionStatus || '',
    applicationId: data.applicationId || null,
    status: data.status || '',
    paymentStatus: data.paymentStatus || '',
    inscriptionPaid: !!data.inscriptionPaid
  };
}

async function setPlayerPortalPasswordHash(playerId, passwordHash) {
  const ref = playersRef().doc(String(playerId));
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Ficha no encontrada');
  const now = new Date().toISOString();
  await ref.set(
    {
      portalPasswordHash: String(passwordHash || ''),
      portalPasswordSetAt: now,
      updatedAt: now
    },
    { merge: true }
  );
  return { ok: true };
}

async function verifyPlayerPortalLogin(dni, password, season, name, surname) {
  const found = await findPlayerForPortalLookup(dni, name, surname, season);
  if (!found) return { ok: false, error: 'not_found' };
  const hash = String(found.data.portalPasswordHash || found.data.passwordHash || '').trim();
  if (!hash) return { ok: false, error: 'no_password', playerId: found.data.id };
  const computed = hashPortalPassword(password);
  if (computed !== hash) return { ok: false, error: 'bad_password' };
  return { ok: true, player: sanitizePlayerForPortal(found.data) };
}

async function setupPlayerPortalPassword(dni, email, password, season) {
  const found = await findPlayerForPortalLookup(dni, '', '', season);
  if (!found) return { ok: false, error: 'not_found' };
  const existing = String(found.data.portalPasswordHash || '').trim();
  if (existing) return { ok: false, error: 'already_set' };
  if (!emailMatchesPlayer(found.data, email)) {
    return { ok: false, error: 'email_mismatch' };
  }
  const hash = hashPortalPassword(password);
  await setPlayerPortalPasswordHash(found.data.id, hash);
  return { ok: true, player: sanitizePlayerForPortal(found.data) };
}

async function createPlayerPortalResetToken(playerId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = new Date(now + RESET_TTL_MS).toISOString();
  await initAdmin()
    .collection(PORTAL_RESETS)
    .doc(token)
    .set({
      playerId: String(playerId),
      appScope: APP_SCOPE,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      used: false
    });
  return token;
}

async function resetPlayerPortalPasswordWithToken(token, password) {
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'invalid_token' };
  const resetRef = initAdmin().collection(PORTAL_RESETS).doc(t);
  const snap = await resetRef.get();
  if (!snap.exists) return { ok: false, error: 'invalid_token' };
  const data = snap.data();
  if (data.used) return { ok: false, error: 'invalid_token' };
  if (new Date(data.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: 'expired' };
  }
  const hash = hashPortalPassword(password);
  await setPlayerPortalPasswordHash(data.playerId, hash);
  await resetRef.set({ used: true, usedAt: new Date().toISOString() }, { merge: true });
  const playerSnap = await playersRef().doc(String(data.playerId)).get();
  if (!playerSnap.exists) return { ok: true };
  return { ok: true, player: sanitizePlayerForPortal({ id: playerSnap.id, ...playerSnap.data() }) };
}

async function checkPlayerPortalAccess(dni, name, surname, season) {
  const found = await findPlayerForPortalLookup(dni, name, surname, season);
  if (!found) return { ok: false, error: 'not_found' };
  const p = found.data;
  const hasPortalPassword = !!String(p.portalPasswordHash || '').trim();
  const approved =
    String(p.inscriptionStatus || '').toLowerCase() === 'approved_for_inscription';
  const hintEmail = playerPortalEmails(p)[0] || '';
  const maskedEmail = hintEmail
    ? hintEmail.replace(/^(.{1,2})[^@]*(@.*)$/, '$1***$2')
    : '';
  return {
    ok: true,
    playerId: p.id,
    hasPortalPassword,
    clubApproved: approved,
    maskedEmail
  };
}

function isPlayerInscriptionPaid(p) {
  if (!p) return false;
  return (
    !!p.inscriptionPaid ||
    String(p.paymentStatus || '').toLowerCase() === 'paid' ||
    String(p.inscriptionStatus || '').toLowerCase() === 'paid'
  );
}

function isPlayerProfileReadOnly(p) {
  if (!p) return true;
  const st = String(p.status || p.estado || '').toLowerCase();
  const ins = String(p.inscriptionStatus || '').toLowerCase();
  return st === 'rejected' || st === 'inactive' || st === 'baja' || ins === 'rejected';
}

function sanitizePlayerForPortalEdit(data) {
  if (!data) return null;
  const base = sanitizePlayerForPortal(data);
  if (!base) return null;
  return {
    ...base,
    domicilio: data.domicilio || data.address || data.direccion || '',
    localidad: data.localidad || data.town || '',
    provincia: data.provincia || data.province || 'Zamora',
    bloodGroup: data.bloodGroup || '',
    injuries: data.injuries || '',
    injuriesYear: data.injuriesYear || '',
    allergyIllness: data.allergyIllness || '',
    observations: data.observations || '',
    guardianDomicilio: data.guardianDomicilio || '',
    guardianLocalidad: data.guardianLocalidad || '',
    guardianProvincia: data.guardianProvincia || 'Zamora',
    guardianSameDomicilio: data.guardianSameDomicilio !== false,
    playerUpdatedBySelfAt: data.playerUpdatedBySelfAt || null,
    inscriptionPaid: isPlayerInscriptionPaid(data),
    profileReadOnly: isPlayerProfileReadOnly(data)
  };
}

function profileDiffValue(obj, key) {
  if (!obj) return '';
  if (key === 'phone') return String(obj.phone || obj.telefono || '').trim();
  if (key === 'name') return String(obj.name || obj.nombre || '').trim();
  if (key === 'surname') return String(obj.surname || obj.apellidos || '').trim();
  if (key === 'birthDate') return String(obj.birthDate || obj.fechaNacimiento || '').trim();
  if (key === 'category') return String(obj.category || obj.categoria || '').trim();
  if (key === 'dni') return String(obj.dni || '').trim();
  return String(obj[key] == null ? '' : obj[key]).trim();
}

function computePlayerProfileDiff(before, after) {
  const pairs = [
    ['name', 'Nombre'],
    ['surname', 'Apellidos'],
    ['dni', 'DNI'],
    ['email', 'Email'],
    ['phone', 'Teléfono'],
    ['domicilio', 'Domicilio'],
    ['localidad', 'Localidad'],
    ['provincia', 'Provincia'],
    ['birthDate', 'Fecha nacimiento'],
    ['category', 'Categoría'],
    ['position', 'Posición'],
    ['bloodGroup', 'Grupo sanguíneo'],
    ['allergyIllness', 'Alergias / enfermedad'],
    ['injuries', 'Lesiones'],
    ['observations', 'Observaciones'],
    ['guardianName', 'Tutor/a'],
    ['guardianDNI', 'DNI tutor/a'],
    ['guardianPhone', 'Tel. tutor/a'],
    ['guardianEmail', 'Email tutor/a']
  ];
  const changes = [];
  pairs.forEach(function (pair) {
    const key = pair[0];
    const label = pair[1];
    const b = profileDiffValue(before, key);
    const a = profileDiffValue(after, key);
    if (b !== a) {
      changes.push({ label: label, before: b || '—', after: a || '—' });
    }
  });
  return changes;
}

function buildPortalProfilePatch(existing, incoming, paid) {
  const src = incoming && typeof incoming === 'object' ? incoming : {};
  const out = {};
  const allowAlways = [
    'phone',
    'telefono',
    'email',
    'domicilio',
    'localidad',
    'provincia',
    'address',
    'direccion',
    'bloodGroup',
    'allergyIllness',
    'injuries',
    'injuriesYear',
    'observations',
    'position',
    'posicion',
    'weightKg',
    'heightCm',
    'guardianName',
    'guardianPhone',
    'guardianEmail',
    'guardianDomicilio',
    'guardianLocalidad',
    'guardianProvincia',
    'guardianAddress',
    'guardianSameDomicilio'
  ];
  const allowIfNotPaid = [
    'name',
    'nombre',
    'surname',
    'apellidos',
    'dni',
    'birthDate',
    'fechaNacimiento',
    'category',
    'categoria',
    'guardianDNI',
    'guardianDni'
  ];
  allowAlways.forEach(function (k) {
    if (src[k] !== undefined) out[k] = src[k];
  });
  if (!paid) {
    allowIfNotPaid.forEach(function (k) {
      if (src[k] !== undefined) out[k] = src[k];
    });
  }
  return out;
}

async function verifyPlayerPortalLoginById(playerId, password) {
  const snap = await playersRef().doc(String(playerId)).get();
  if (!snap.exists) return { ok: false, error: 'not_found' };
  const data = { id: snap.id, ...snap.data() };
  const hash = String(data.portalPasswordHash || data.passwordHash || '').trim();
  if (!hash) return { ok: false, error: 'no_password' };
  if (hashPortalPassword(password) !== hash) return { ok: false, error: 'bad_password' };
  return { ok: true, player: data };
}

async function loginPlayerForProfileEdit(dni, password, season, name, surname) {
  const result = await verifyPlayerPortalLogin(dni, password, season, name, surname);
  if (!result.ok) return result;
  const snap = await playersRef().doc(String(result.player.id)).get();
  if (!snap.exists) return { ok: false, error: 'not_found' };
  return {
    ok: true,
    player: sanitizePlayerForPortalEdit({ id: snap.id, ...snap.data() })
  };
}

async function changePlayerPortalPassword(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const currentPassword = String(o.currentPassword || '');
  const newPassword = String(o.newPassword || '');
  const playerId = String(o.playerId || '').trim();
  if (newPassword.length < 6) return { ok: false, error: 'weak_password' };

  let auth;
  if (playerId) {
    auth = await verifyPlayerPortalLoginById(playerId, currentPassword);
  } else {
    auth = await verifyPlayerPortalLogin(
      o.dni,
      currentPassword,
      o.season,
      o.name || o.nombre,
      o.surname || o.apellidos
    );
  }
  if (!auth.ok) return auth;

  const id = String(auth.player.id);
  const newHash = hashPortalPassword(newPassword);
  await setPlayerPortalPasswordHash(id, newHash);

  const snap = await playersRef().doc(id).get();
  const playerData = snap.exists ? { id: snap.id, ...snap.data() } : auth.player;
  const linkedId = playerData.linkedMemberId ? String(playerData.linkedMemberId).trim() : '';
  if (linkedId && !linkedId.startsWith('MEMBER_')) {
    await membersRef().doc(linkedId).set(
      {
        portalPasswordHash: newHash,
        passwordHash: newHash,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } else if (playerInscriptionLinksSocioFromReg(playerData)) {
    await upsertMemberSocioJugadorFromPlayer(Object.assign({}, playerData, { portalPasswordHash: newHash }));
  }

  const playerSnap = await playersRef().doc(id).get();
  if (!playerSnap.exists) return { ok: true };
  return {
    ok: true,
    player: sanitizePlayerForPortalEdit({ id: playerSnap.id, ...playerSnap.data() })
  };
}

async function updatePlayerProfileByPortal(opts) {
  const playerId = String(opts.playerId || '').trim();
  const password = String(opts.password || '');
  const season = String(opts.season || '').trim();
  let auth;
  if (playerId) {
    auth = await verifyPlayerPortalLoginById(playerId, password);
  } else {
    auth = await verifyPlayerPortalLogin(
      opts.dni,
      password,
      season,
      opts.name || opts.nombre,
      opts.surname || opts.apellidos
    );
  }
  if (!auth.ok) return auth;

  const id = String(auth.player.id || playerId);
  const ref = playersRef().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'not_found' };
  const existing = { id: snap.id, ...snap.data() };

  if (isPlayerProfileReadOnly(existing)) {
    return { ok: false, error: 'profile_locked' };
  }

  const paid = isPlayerInscriptionPaid(existing);
  const patch = buildPortalProfilePatch(existing, opts.incoming || {}, paid);
  const mergedPreview = Object.assign({}, existing, patch);
  const diff = computePlayerProfileDiff(existing, mergedPreview);
  if (!diff.length) return { ok: false, error: 'sin_cambios' };

  const now = new Date().toISOString();
  const logEntry = { at: now, by: 'jugador_portal', changes: diff };
  const merged = normalizePlayerRecordFields(
    Object.assign({}, existing, patch, {
      playerUpdatedBySelfAt: now,
      playerChangeLog: []
        .concat(Array.isArray(existing.playerChangeLog) ? existing.playerChangeLog : [])
        .concat([logEntry])
        .slice(-25)
    })
  );

  await ref.set(merged, { merge: true });

  let savedMember = null;
  if (playerInscriptionLinksSocioFromReg(merged)) {
    savedMember = await upsertMemberSocioJugadorFromPlayer(Object.assign({}, merged, { id }));
    if (savedMember && savedMember.id) {
      await ref.set({ linkedMemberId: savedMember.id, updatedAt: now }, { merge: true });
      merged.linkedMemberId = savedMember.id;
    }
  }

  const playerOut = sanitizePlayerForPortalEdit(Object.assign({}, merged, { id }));
  return { ok: true, player: playerOut, diff: diff, member: savedMember, paid: paid };
}

function normalizePlayerCategoryId(cat) {
  const c = String(cat || '').trim().toLowerCase();
  if (c === 'prebenajmin' || c === 'prebenjamin') return 'prebenjamin';
  if (c === 'juvenile' || c === 'juvenil') return 'juvenil';
  if (c === 'aficionado' || c === 'senior') return 'senior';
  return c;
}

function normalizePlayerRecordFields(raw) {
  const p = raw && typeof raw === 'object' ? { ...raw } : {};
  const name = String(p.name || p.nombre || '').trim();
  const surname = String(p.surname || p.apellidos || '').trim();
  const phone = String(p.phone || p.telefono || '').trim();
  const address = String(p.address || p.direccion || '').trim();
  const birthDate = String(p.birthDate || p.fechaNacimiento || '').trim();
  const category = normalizePlayerCategoryId(
    p.category || p.categoria || p.playerCategory || p.categoriaJugador || ''
  );
  const gDni = normalizeDni(p.guardianDNI || p.guardianDni);
  delete p.password;
  delete p.pass;
  delete p.plainPassword;
  delete p.portalPassword;
  return {
    ...p,
    appScope: APP_SCOPE,
    name,
    nombre: name,
    surname,
    apellidos: surname,
    phone,
    telefono: phone,
    address,
    direccion: address,
    birthDate,
    fechaNacimiento: birthDate,
    category,
    categoria: category,
    playerCategory: String(p.playerCategory || p.categoriaJugador || category || '').trim() || category,
    categoriaJugador: String(p.categoriaJugador || p.playerCategory || category || '').trim() || category,
    dni: normalizeDni(p.dni),
    email: String(p.email || '').trim().toLowerCase(),
    guardianDNI: gDni,
    guardianDni: gDni,
    guardianEmail: String(p.guardianEmail || '').trim().toLowerCase(),
    updatedAt: new Date().toISOString()
  };
}

function resolveSocioCuotaFromPlayer(reg) {
  const cb = reg.chargeBreakdown || {};
  const socioLine = Number(cb.socio);
  if (Number.isFinite(socioLine) && socioLine > 0) return socioLine;
  const total = Number(cb.total);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function isPlayerInscriptionPaid(player) {
  if (!player) return false;
  if (player.inscriptionPaid === true || player.pagado === true) return true;
  if (String(player.paymentStatus || '').toLowerCase() === 'paid') return true;
  if (String(player.inscriptionStatus || '').toLowerCase() === 'paid') return true;
  const method = String(player.paymentMethod || '').toLowerCase();
  if (method.indexOf('redsys') >= 0 && String(player.status || '').toLowerCase() === 'active') {
    return true;
  }
  if (String(player.status || '').toLowerCase() === 'active' && player.validatedDate) {
    const ins = String(player.inscriptionStatus || '').toLowerCase();
    if (
      ins !== 'pending_payment' &&
      ins !== 'pending_transfer' &&
      ins !== 'pending_cash' &&
      ins !== 'pending_tpv'
    ) {
      return true;
    }
  }
  return false;
}

function applyMemberPaymentStateFromPlayerRecord(member, player) {
  const paid = isPlayerInscriptionPaid(player);
  const cuota = resolveSocioCuotaFromPlayer(player);
  if (cuota != null) member.cuota = cuota;

  if (paid) {
    member.pagado = true;
    member.paymentStatus = 'paid';
    member.status = 'active';
    member.estado = 'activo';
    member.pendingReason = null;
    member.fechaLimitePago = null;
    member.validatedDate = player.validatedDate || new Date().toISOString();
    member.validatedBy = player.validatedBy || 'inscripcion_jugador';
    if (player.paymentOrderId) member.paymentOrderId = player.paymentOrderId;
    if (!member.cuotaVigenteHasta) {
      member.cuotaVigenteHasta = proximoCierreTemporadaIso();
    }
    member.inscriptionSeasonSocio = player.inscriptionSeason || player.temporada;
    return;
  }

  member.pagado = false;
  member.paymentStatus = 'pending';
  member.status = 'pending_validation';
  member.estado = 'pendiente';
  member.pendingReason =
    player.pendingReason || player.offlinePaymentChannel || 'inscripcion_jugador_pendiente';
  if (player.paymentMethod) member.paymentMethod = player.paymentMethod;
  if (player.offlinePaymentChannel) member.offlinePaymentChannel = player.offlinePaymentChannel;
  member.inscriptionSeasonSocio = player.inscriptionSeason || player.temporada;
}

function memberDocMatchesSocioJugadorPlayer(data, player) {
  if (!data || !player) return false;
  if (!(data.socioJugador || data.isJugador || data.playerId)) return false;

  const playerId = String(player.id || '').trim();
  if (playerId && data.playerId && String(data.playerId) === playerId) return true;

  const linkedId = String(player.linkedMemberId || '').trim();
  if (linkedId && String(data.id) === linkedId) return true;

  const pn = normalizeNamePart(player.name || player.nombre);
  const ps = normalizeNamePart(player.surname || player.apellidos);
  const mn = normalizeNamePart(data.name || data.nombre);
  const ms = normalizeNamePart(data.surname || data.apellidos);
  if (!pn || !ps || mn !== pn || ms !== ps) return false;

  const playerDni = normalizeDni(player.dni);
  const memberDni = normalizeDni(data.dni);
  if (playerDni && memberDni && playerDni !== memberDni) return false;

  return true;
}

function memberDocMatchesAdultSocioReg(data, member) {
  const mn = normalizeNamePart(data.name || data.nombre);
  const ms = normalizeNamePart(data.surname || data.apellidos);
  const pn = normalizeNamePart(member.name || member.nombre);
  const ps = normalizeNamePart(member.surname || member.apellidos);
  if (pn && ps && mn === pn && ms === ps) return true;
  const dniA = normalizeDni(data.dni);
  const dniB = normalizeDni(member.dni);
  return !!(dniA && dniB && dniA === dniB);
}

async function findMemberDocForPlayerInscription(player) {
  const linkedId = player.linkedMemberId ? String(player.linkedMemberId).trim() : '';
  if (linkedId && !linkedId.startsWith('MEMBER_')) {
    const ref = membersRef().doc(linkedId);
    const snap = await ref.get();
    if (snap.exists) {
      const data = { id: snap.id, ...snap.data() };
      if (memberDocMatchesSocioJugadorPlayer(data, player)) {
        return { ref, data };
      }
    }
  }
  const dni = normalizeDni(player.dni);
  if (dni) {
    const q = await membersRef().where('dni', '==', dni).limit(10).get();
    for (const doc of q.docs) {
      const data = { id: doc.id, ...doc.data() };
      if (memberDocMatchesSocioJugadorPlayer(data, player)) {
        return { ref: doc.ref, data };
      }
    }
  }
  const playerId = player.id ? String(player.id).trim() : '';
  if (playerId && !playerId.startsWith('PLAYER_')) {
    const q2 = await membersRef().where('playerId', '==', playerId).limit(5).get();
    for (const doc of q2.docs) {
      const data = { id: doc.id, ...doc.data() };
      if (memberDocMatchesSocioJugadorPlayer(data, player)) {
        return { ref: doc.ref, data };
      }
    }
  }
  const email = String(player.email || player.guardianEmail || '').trim().toLowerCase();
  if (email) {
    const q3 = await membersRef().where('email', '==', email).limit(15).get();
    for (const doc of q3.docs) {
      const data = { id: doc.id, ...doc.data() };
      if (memberDocMatchesSocioJugadorPlayer(data, player)) {
        return { ref: doc.ref, data };
      }
    }
  }
  return null;
}

async function findMemberDocForAdultSocioRegistration(member) {
  const dni = normalizeDni(member.dni);
  if (dni) {
    const q = await membersRef().where('dni', '==', dni).limit(10).get();
    for (const doc of q.docs) {
      const data = { id: doc.id, ...doc.data() };
      if (memberDocMatchesAdultSocioReg(data, member)) return { ref: doc.ref, data };
    }
  }
  const email = String(member.email || '').trim().toLowerCase();
  if (email) {
    const q2 = await membersRef().where('email', '==', email).limit(15).get();
    for (const doc of q2.docs) {
      const data = { id: doc.id, ...doc.data() };
      if (data.socioJugador && data.playerId && !memberDocMatchesAdultSocioReg(data, member)) {
        continue;
      }
      if (memberDocMatchesAdultSocioReg(data, member)) {
        return { ref: doc.ref, data };
      }
      if (!data.socioJugador && !data.playerId) {
        return { ref: doc.ref, data };
      }
    }
  }
  return null;
}

async function upsertMemberSocioJugadorFromPlayer(player) {
  if (!playerInscriptionLinksSocioFromReg(player)) return null;

  const now = new Date().toISOString();
  const playerDni = normalizeDni(player.dni);
  const existing = await findMemberDocForPlayerInscription(player);

  const memberPatch = {
    isJugador: true,
    socioJugador: true,
    playerId: player.id,
    playerCategory: player.category || player.categoria,
    categoriaJugador: player.category || player.categoria,
    nombre: player.name || player.nombre,
    name: player.name || player.nombre,
    apellidos: player.surname || player.apellidos,
    surname: player.surname || player.apellidos,
    dni: playerDni || '',
    telefono: player.phone || player.telefono || '',
    phone: player.phone || player.telefono || '',
    email: String(player.email || player.guardianEmail || '').trim().toLowerCase(),
    domicilio: player.domicilio || player.address || '',
    localidad: player.localidad || '',
    provincia: player.provincia || 'Zamora',
    address: player.address || player.domicilio || '',
    direccion: player.direccion || player.address || '',
    birthDate: player.birthDate || player.fechaNacimiento,
    fechaNacimiento: player.birthDate || player.fechaNacimiento,
    guardianName: player.guardianName || '',
    guardianDNI: normalizeDni(player.guardianDNI || player.guardianDni) || '',
    guardianPhone: player.guardianPhone || '',
    guardianEmail: String(player.guardianEmail || '').trim().toLowerCase(),
    guardianAddress: player.guardianAddress || '',
    inscriptionSeasonSocio: player.inscriptionSeason || player.temporada,
    inscriptionSeasonJugador: player.inscriptionSeason || player.temporada,
    registrationSource: 'web_inscription_socio_jugador',
    cuotaSocioEnInscripcion: true,
    appScope: APP_SCOPE,
    lastModified: now,
    updatedAt: now
  };
  if (player.portalPasswordHash) {
    memberPatch.passwordHash = player.portalPasswordHash;
    memberPatch.portalPasswordHash = player.portalPasswordHash;
  }
  applyMemberPaymentStateFromPlayerRecord(memberPatch, player);
  if (memberNumbers.memberIsActive(memberPatch)) {
    const allMembers = await listAllMembersData();
    const numPatch = memberNumbers.memberNumberPatch(
      { ...(existing ? existing.data : {}), ...memberPatch },
      allMembers
    );
    if (numPatch) Object.assign(memberPatch, numPatch);
  }

  let memberId;
  if (existing) {
    memberId = existing.data.id;
    await existing.ref.set(memberPatch, { merge: true });
  } else {
    const ref = membersRef().doc();
    memberId = ref.id;
    const createPayload = {
      ...memberPatch,
      id: memberId,
      registrationDate: now
    };
    if (!memberPatch.memberNumber && !memberNumbers.getRegularNumber(memberPatch)) {
      createPayload.numeroSocio = 'SOC' + String(Date.now()).slice(-6);
      createPayload.memberNumber = null;
    }
    await ref.set(createPayload, { merge: true });
  }
  const snap = await membersRef().doc(String(memberId)).get();
  return { id: memberId, ...(snap.exists ? snap.data() : memberPatch) };
}

/** Reaplica inscripción pagada desde el pedido Redsys (hermanos / fichas mezcladas). */
async function repairPlayerInscriptionFromPaymentOrder(orderId) {
  const oid = String(orderId || '').trim();
  if (!oid) throw new Error('orderId requerido');
  const payment = await getPayment(oid);
  if (!payment) throw new Error('Pago no encontrado: ' + oid);
  if (payment.type !== 'player_inscription') {
    throw new Error('El pedido no es inscripción de jugador/a: ' + oid);
  }
  if (String(payment.status || '').toLowerCase() !== 'paid') {
    throw new Error('El pedido no está pagado: ' + oid);
  }
  await completePlayerInscription(payment, { skipNotify: true });
  const reg = payment.playerRegistration || {};
  const dni = normalizeDni(reg.dni);
  const season = String(reg.inscriptionSeason || reg.temporada || '').trim();
  const playerDoc = dni && season ? await findPlayerDocByDniSeason(dni, season) : null;
  let memberDoc = null;
  if (playerDoc) {
    memberDoc = await findMemberDocForPlayerInscription({
      ...reg,
      id: playerDoc.data.id,
      dni,
      inscriptionSeason: season
    });
  }
  return {
    ok: true,
    orderId: oid,
    playerId: playerDoc ? playerDoc.data.id : null,
    memberId: memberDoc ? memberDoc.data.id : null,
    numeroSocio: memberDoc ? memberDoc.data.numeroSocio || memberDoc.data.memberNumber : null,
    nombre: reg.name || reg.nombre,
    apellidos: reg.surname || reg.apellidos,
    dni: reg.dni || ''
  };
}

async function repairPlayerInscriptionsFromPaymentOrders(orderIds) {
  const list = Array.isArray(orderIds) ? orderIds : [];
  const results = [];
  for (const oid of list) {
    results.push(await repairPlayerInscriptionFromPaymentOrder(oid));
  }
  return { ok: true, repaired: results.length, results };
}

/** Recupera alta de socio desde pedido Redsys (pagado → activa; pendiente con bundle → ficha pending). */
async function repairMembershipFromPaymentOrder(orderId) {
  const oid = String(orderId || '').trim();
  if (!oid) throw new Error('orderId requerido');
  const payment = await getPayment(oid);
  if (!payment) throw new Error('Pago no encontrado: ' + oid);
  if (payment.type !== 'membership_fee') {
    throw new Error('El pedido no es cuota de socio/a: ' + oid);
  }
  const status = String(payment.status || '').toLowerCase();
  const bundleMember =
    payment.registrationBundle && payment.registrationBundle.member
      ? payment.registrationBundle.member
      : null;

  if (status === 'paid') {
    await completeMembershipPayment(payment, {});
  } else if (bundleMember) {
    const saved = await upsertMemberRegistrationRecord({
      ...bundleMember,
      email: bundleMember.email || payment.customerEmail,
      status: 'pending_validation',
      estado: 'pendiente',
      pagado: false,
      pendingReason: 'nueva_alta',
      registrationSource: bundleMember.registrationSource || 'web_modal_socio'
    });
    if (saved && saved.id) {
      await paymentsRef().doc(oid).set({ memberId: saved.id, updatedAt: new Date().toISOString() }, { merge: true });
    }
  } else {
    throw new Error('Pedido sin datos de socio (registrationBundle) y no pagado: ' + oid);
  }

  const resolved = await resolveMemberDoc({
    ...payment,
    memberId: payment.memberId,
    customerEmail: payment.customerEmail,
    registrationBundle: payment.registrationBundle
  });
  const d = resolved ? resolved.data : null;
  return {
    ok: true,
    orderId: oid,
    status,
    memberId: d ? d.id : null,
    nombre: d ? d.nombre || d.name : bundleMember && (bundleMember.nombre || bundleMember.name),
    apellidos: d ? d.apellidos || d.surname : bundleMember && (bundleMember.apellidos || bundleMember.surname),
    email: d ? d.email : (bundleMember && bundleMember.email) || payment.customerEmail,
    numeroSocio: d ? d.numeroSocio || d.memberNumber : null,
    memberStatus: d ? d.status || d.estado : null
  };
}

async function repairMembershipsFromPaymentOrders(orderIds) {
  const list = Array.isArray(orderIds) ? orderIds : [];
  const results = [];
  for (const oid of list) {
    try {
      results.push(await repairMembershipFromPaymentOrder(oid));
    } catch (err) {
      results.push({ ok: false, orderId: String(oid), error: err.message || String(err) });
    }
  }
  return { ok: true, repaired: results.filter((r) => r.ok).length, results };
}

function kitItemsFromPlayerRecord(record) {
  if (!record || typeof record !== 'object') return [];
  if (Array.isArray(record.kitOrder) && record.kitOrder.length) return record.kitOrder;
  if (record.kit && Array.isArray(record.kit.items) && record.kit.items.length) return record.kit.items;
  return [];
}

function mergePlayerKitPreserveOnServer(existingData, patch) {
  const out = { ...patch };
  const existingItems = kitItemsFromPlayerRecord(existingData || {});
  const patchItems = kitItemsFromPlayerRecord(patch || {});
  const patchTs = patch && patch.kitOrderUpdatedAt ? new Date(patch.kitOrderUpdatedAt).getTime() : 0;
  const existingTs =
    existingData && existingData.kitOrderUpdatedAt ? new Date(existingData.kitOrderUpdatedAt).getTime() : 0;
  if (patchItems.length > 0) return out;
  if (patchTs && patchTs >= existingTs) return out;
  if (existingItems.length === 0) return out;
  out.kitOrder = existingData.kitOrder;
  out.kit = existingData.kit;
  const flatKitIds = [
    'train_kit',
    'tracksuit',
    'train_jacket',
    'cazadora',
    'train_shirt',
    'train_shorts',
    'match_shirt',
    'match_shorts'
  ];
  flatKitIds.forEach(function (id) {
    const k = 'kit_' + id;
    if (existingData[k] != null && out[k] == null) out[k] = existingData[k];
  });
  if (Array.isArray(existingData.kitItemsPaid)) out.kitItemsPaid = existingData.kitItemsPaid;
  if (typeof existingData.kitPaidEur === 'number') out.kitPaidEur = existingData.kitPaidEur;
  if (existingData.kitPaymentStatus != null) out.kitPaymentStatus = existingData.kitPaymentStatus;
  if (existingData.kitPaymentMethod != null) out.kitPaymentMethod = existingData.kitPaymentMethod;
  if (existingData.kitOrderUpdatedAt) out.kitOrderUpdatedAt = existingData.kitOrderUpdatedAt;
  if (existingData.kitOrderUpdatedBy) out.kitOrderUpdatedBy = existingData.kitOrderUpdatedBy;
  const cb = { ...(out.chargeBreakdown || {}) };
  const exCb = existingData.chargeBreakdown || {};
  if (exCb.kit != null && Number(exCb.kit) > 0 && (cb.kit == null || Number(cb.kit) <= 0)) {
    cb.kit = Number(exCb.kit);
  }
  if (cb.kit != null || cb.socio != null || cb.ficha != null) {
    cb.total = Math.round((Number(cb.socio || 0) + Number(cb.ficha || 0) + Number(cb.kit || 0)) * 100) / 100;
    out.chargeBreakdown = cb;
  }
  return out;
}

async function upsertPlayerInscriptionRecord(player) {
  const patch = normalizePlayerRecordFields(player);
  const dni = patch.dni;
  const email = patch.email;
  const season = String(patch.inscriptionSeason || patch.temporada || patch.season || '').trim();
  if (!dni && !email) throw new Error('Identificador ausente (DNI o email) en inscripción');
  if (!season) throw new Error('Temporada ausente en inscripción');
  patch.inscriptionSeason = season;
  patch.temporada = season;

  const existing = await findPlayerDocByIdentity(patch);
  let playerId;
  let mergedPatch = patch;
  if (existing) {
    playerId = existing.data.id;
    mergedPatch = mergePlayerKitPreserveOnServer(existing.data, patch);
    await existing.ref.set(mergedPatch, { merge: true });
  } else {
    const ref = playersRef().doc();
    playerId = ref.id;
    await ref.set(
      {
        ...patch,
        id: playerId,
        registrationDate: patch.registrationDate || patch.updatedAt
      },
      { merge: true }
    );
  }
  const playerSnap = await playersRef().doc(String(playerId)).get();
  const savedPlayer = { id: playerId, ...(playerSnap.exists ? playerSnap.data() : patch) };

  let savedMember = null;
  if (playerInscriptionLinksSocioFromReg(savedPlayer)) {
    savedMember = await upsertMemberSocioJugadorFromPlayer({ ...savedPlayer, id: playerId });
    if (savedMember && savedMember.id) {
      await playersRef().doc(String(playerId)).set(
        { linkedMemberId: savedMember.id, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      savedPlayer.linkedMemberId = savedMember.id;
    }
  }

  return { player: savedPlayer, member: savedMember };
}

function normalizeMemberRecordFields(raw) {
  const m = raw && typeof raw === 'object' ? { ...raw } : {};
  const name = String(m.name || m.nombre || '').trim();
  const surname = String(m.surname || m.apellidos || '').trim();
  const phone = String(m.phone || m.telefono || '').trim();
  const address = String(m.address || m.direccion || '').trim();
  delete m.password;
  delete m.pass;
  delete m.plainPassword;
  delete m.portalPassword;
  const now = new Date().toISOString();
  const statusRaw = String(m.status || m.estado || '').trim().toLowerCase();
  const pendingReason = String(m.pendingReason || '').toLowerCase();
  const reg = m.registrationDate || m.fechaRegistro || now;
  const isActive = statusRaw === 'active' || statusRaw === 'activo';
  const isExpired =
    statusRaw === 'expired' || statusRaw === 'expirado' || statusRaw === 'caducado';
  const isPending =
    !isActive &&
    !isExpired &&
    (statusRaw === 'pending_validation' ||
      statusRaw === 'pendiente' ||
      statusRaw === 'pending' ||
      statusRaw === 'pending_new' ||
      statusRaw === 'nueva_alta' ||
      !statusRaw);
  const status = isActive ? 'active' : isExpired ? 'expired' : 'pending_validation';
  const estado = isActive ? 'activo' : isExpired ? 'caducado' : 'pendiente';
  const isRenovacion = pendingReason === 'renovacion';
  let fechaLimitePago = m.fechaLimitePago || m.fechaVencimiento || null;
  if (isPending && !isRenovacion && !fechaLimitePago) {
    fechaLimitePago = membershipSeason.paymentDeadlineIsoFromRegistration(reg);
  }
  if (isRenovacion) fechaLimitePago = null;
  const pr = isRenovacion ? 'renovacion' : isPending ? 'nueva_alta' : m.pendingReason || null;
  const isSocioJugador = !!(
    m.socioJugador === true ||
    m.isJugador === true ||
    m.playerId ||
    m.memberKind === 'jugador' ||
    m.memberKind === 'player'
  );
  return {
    ...m,
    appScope: APP_SCOPE,
    name,
    nombre: name,
    surname,
    apellidos: surname,
    phone,
    telefono: phone,
    address,
    direccion: address,
    email: String(m.email || '').trim().toLowerCase(),
    dni: normalizeDni(m.dni),
    guardianEmail: String(m.guardianEmail || '').trim().toLowerCase(),
    status,
    estado,
    pendingReason: isPending ? pr : m.pendingReason || null,
    fechaLimitePago: isPending ? fechaLimitePago : m.fechaLimitePago || null,
    fechaVencimiento: m.fechaVencimiento || fechaLimitePago || null,
    socioJugador: isSocioJugador,
    isJugador: isSocioJugador ? true : !!m.isJugador,
    playerId: isSocioJugador ? m.playerId || null : null,
    memberKind: isSocioJugador ? 'jugador' : 'normal',
    updatedAt: now
  };
}

async function findMemberDocByIdentity(member) {
  const dni = normalizeDni(member.dni);
  if (dni) {
    const q = await membersRef().where('dni', '==', dni).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      return { ref: doc.ref, data: { id: doc.id, ...doc.data() } };
    }
  }
  const email = String(member.email || '').trim().toLowerCase();
  if (email) {
    const q = await membersRef().where('email', '==', email).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      return { ref: doc.ref, data: { id: doc.id, ...doc.data() } };
    }
  }
  return null;
}

/** Alta/actualización de socio desde la web (registro público o socio-jugador). */
async function upsertMemberRegistrationRecord(member) {
  const patch = normalizeMemberRecordFields(member);
  const email = patch.email;
  if (!email) throw new Error('Email ausente en alta de socio');

  const forcedJugador = !!(
    patch.socioJugador ||
    patch.isJugador ||
    patch.playerId ||
    patch.memberKind === 'jugador' ||
    patch.memberKind === 'player' ||
    String(patch.registrationSource || '').indexOf('jugador') >= 0 ||
    String(patch.registrationSource || '').indexOf('inscription') >= 0
  );
  if (forcedJugador) {
    patch.socioJugador = true;
    patch.isJugador = true;
    patch.memberKind = 'jugador';
  } else {
    patch.socioJugador = false;
    patch.isJugador = false;
    patch.playerId = null;
    patch.memberKind = 'normal';
  }

  const existing = await findMemberDocForAdultSocioRegistration(patch);
  let memberId;
  if (existing) {
    memberId = existing.data.id;
    await existing.ref.set(patch, { merge: true });
  } else {
    const ref = membersRef().doc();
    memberId = ref.id;
    const now = patch.updatedAt || new Date().toISOString();
    await ref.set(
      {
        ...patch,
        id: memberId,
        registrationDate: patch.registrationDate || patch.fechaRegistro || now,
        fechaRegistro: patch.fechaRegistro || patch.registrationDate || now
      },
      { merge: true }
    );
  }
  const snap = await membersRef().doc(String(memberId)).get();
  return { id: memberId, ...(snap.exists ? snap.data() : patch) };
}

function normalizeFriendRecordFields(raw) {
  const f = raw && typeof raw === 'object' ? { ...raw } : {};
  const nombre = String(f.nombre || f.name || '').trim();
  const apellidos = String(f.apellidos || f.surname || '').trim();
  const telefono = String(f.telefono || f.phone || '').trim();
  delete f.password;
  delete f.pass;
  delete f.plainPassword;
  delete f.portalPassword;
  const status = String(f.status || f.estado || 'active').trim() || 'active';
  const estado = String(f.estado || (status === 'active' ? 'activo' : f.estado) || 'activo').trim() || 'activo';
  const numeroAmigoRaw = String(f.numeroAmigo || f.friendNumber || '').trim();
  return {
    ...f,
    appScope: APP_SCOPE,
    nombre,
    name: nombre,
    apellidos,
    surname: apellidos,
    telefono,
    phone: telefono,
    email: String(f.email || '').trim().toLowerCase(),
    dni: normalizeDni(f.dni),
    numeroAmigo: numeroAmigoRaw || undefined,
    friendNumber: numeroAmigoRaw || undefined,
    status,
    estado,
    updatedAt: new Date().toISOString()
  };
}

async function findFriendDocByIdentity(friend) {
  const dni = normalizeDni(friend.dni);
  if (dni) {
    const q = await friendsRef().where('dni', '==', dni).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      return { ref: doc.ref, data: { id: doc.id, ...doc.data() } };
    }
  }
  const email = String(friend.email || '').trim().toLowerCase();
  if (email) {
    const q = await friendsRef().where('email', '==', email).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      return { ref: doc.ref, data: { id: doc.id, ...doc.data() } };
    }
  }
  return null;
}

/** Alta/actualización de amigo del club desde la web pública. */
async function upsertFriendRegistrationRecord(friend) {
  const patch = normalizeFriendRecordFields(friend);
  const email = patch.email;
  const dni = patch.dni;
  if (!email) throw new Error('Email ausente en alta de amigo/a');
  if (!dni) throw new Error('DNI ausente en alta de amigo/a');
  if (!patch.nombre || !patch.apellidos) {
    throw new Error('Nombre y apellidos obligatorios en alta de amigo/a');
  }

  if (!patch.numeroAmigo && !patch.friendNumber) {
    const provisional = 'AMIG' + String(Date.now()).slice(-6);
    patch.numeroAmigo = provisional;
    patch.friendNumber = provisional;
  }

  const existing = await findFriendDocByIdentity(patch);
  let friendId;
  if (existing) {
    friendId = existing.data.id;
    await existing.ref.set(patch, { merge: true });
  } else {
    const ref = friendsRef().doc();
    friendId = ref.id;
    const now = patch.updatedAt || new Date().toISOString();
    await ref.set(
      {
        ...patch,
        id: friendId,
        fechaRegistro: patch.fechaRegistro || patch.registrationDate || now,
        registrationDate: patch.registrationDate || patch.fechaRegistro || now
      },
      { merge: true }
    );
  }
  const snap = await friendsRef().doc(String(friendId)).get();
  return { id: friendId, ...(snap.exists ? snap.data() : patch) };
}

function torneoPreinscripcionesRef() {
  return initAdmin().collection('sanabria_torneo_preinscripciones');
}

const TORNEO_CATEGORY_LABELS = {
  prebenjamin: 'Prebenjamín (Chupetines)',
  benjamin: 'Benjamín',
  alevin: 'Alevín',
  infantil: 'Infantil',
  cadete: 'Cadete',
  juvenil: 'Juvenil',
  senior: 'Senior',
  aficionado: 'Aficionado'
};

function torneoCategoryLabels(ids) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => TORNEO_CATEGORY_LABELS[String(id || '').trim().toLowerCase()] || String(id || '').trim())
    .filter(Boolean);
}

function normalizeTorneoAccessCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function generateTorneoAccessCode(seed) {
  const year = new Date().getFullYear();
  const base = String(seed || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const suffix = (base.slice(-4) || Math.random().toString(36).slice(2, 6)).toUpperCase().padStart(4, '0').slice(-4);
  return `TP-${year}-${suffix}`;
}

function normalizeTorneoPreinscripcionFields(raw) {
  const d = raw && typeof raw === 'object' ? { ...raw } : {};
  const categories = Array.isArray(d.categories)
    ? d.categories.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const playerCount = parseInt(d.playerCount, 10);
  const now = new Date().toISOString();
  const premiosOk = d.premiosAceptados === true || d.premiosAceptados === 'true';
  return {
    eventName: String(d.eventName || 'Torneo Fútbol 7 — 2026').trim(),
    teamName: String(d.teamName || '').trim(),
    playerCount: Number.isFinite(playerCount) && playerCount > 0 ? playerCount : 0,
    town: String(d.town || '').trim(),
    categories,
    categoryLabels: torneoCategoryLabels(categories),
    contactName: String(d.contactName || '').trim(),
    contactEmail: String(d.contactEmail || '').trim().toLowerCase(),
    contactPhone: String(d.contactPhone || '').trim(),
    premiosAceptados: premiosOk,
    premiosAceptadosAt: premiosOk ? String(d.premiosAceptadosAt || now).trim() : null,
    status: String(d.status || 'preinscripcion_enviada').trim(),
    source: String(d.source || 'web').trim(),
    localId: d.localId ? String(d.localId) : null,
    accessCode: d.accessCode ? normalizeTorneoAccessCode(d.accessCode) : '',
    plantillaStatus: String(d.plantillaStatus || 'pendiente').trim(),
    fichas: Array.isArray(d.fichas) ? d.fichas : [],
    coach: d.coach && typeof d.coach === 'object' ? d.coach : null,
    panelEnabled: d.panelEnabled !== false,
    appScope: APP_SCOPE,
    createdAt: d.createdAt || now,
    updatedAt: now
  };
}

function buildTorneoEquipoPanelPayload(record) {
  const r = record && typeof record === 'object' ? record : {};
  const fichas = Array.isArray(r.fichas) ? r.fichas : [];
  const submitted = fichas.filter((f) => String(f.status || '') === 'enviada').length;
  const playerCount = parseInt(r.playerCount, 10) || 0;
  return {
    id: r.id || '',
    accessCode: r.accessCode || '',
    eventName: r.eventName || 'Torneo Fútbol 7 — 2026',
    teamName: r.teamName || '',
    town: r.town || '',
    categories: Array.isArray(r.categories) ? r.categories : [],
    categoryLabels: Array.isArray(r.categoryLabels) ? r.categoryLabels : torneoCategoryLabels(r.categories),
    playerCount,
    contactName: r.contactName || '',
    contactEmail: r.contactEmail || '',
    plantillaStatus: r.plantillaStatus || 'pendiente',
    fichasCount: fichas.length,
    fichasSubmitted: submitted,
    fichasPending: Math.max(0, playerCount - submitted),
    fichas: fichas.map((f) => ({
      id: f.id || '',
      label: f.label || f.playerName || 'Jugador/a',
      status: f.status || 'pendiente',
      updatedAt: f.updatedAt || null
    }))
  };
}

async function listActiveTorneoPreinscripciones() {
  const snap = await torneoPreinscripcionesRef().get();
  const out = [];
  snap.forEach(function (doc) {
    const row = { id: doc.id, ...(doc.data() || {}) };
    if (isActiveTorneoPreinscripcion(row)) out.push(row);
  });
  return out;
}

async function findTorneoPreinscripcionByAccessCode(accessCode) {
  const code = normalizeTorneoAccessCode(accessCode);
  if (!code) return null;
  const snap = await torneoPreinscripcionesRef().where('accessCode', '==', code).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return null;
}

async function ensureTorneoAccessCode(recordId) {
  const ref = torneoPreinscripcionesRef().doc(String(recordId));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (data.accessCode) return { id: snap.id, ...data };
  const accessCode = generateTorneoAccessCode(snap.id);
  const updatedAt = new Date().toISOString();
  await ref.set({ accessCode, updatedAt }, { merge: true });
  const next = await ref.get();
  return { id: snap.id, ...(next.exists ? next.data() : { accessCode }) };
}

/** Verifica código + email del responsable y devuelve datos del panel. */
async function verifyTorneoEquipoAccess(accessCode, contactEmail) {
  const code = normalizeTorneoAccessCode(accessCode);
  const email = String(contactEmail || '')
    .trim()
    .toLowerCase();
  if (!code) throw new Error('Introduce el código de equipo.');
  if (!email || !email.includes('@')) throw new Error('Introduce el email de contacto de la preinscripción.');

  let record = await findTorneoPreinscripcionByAccessCode(code);
  if (!record) throw new Error('Código no encontrado. Comprueba que lo has escrito bien o contacta con el club.');

  if (!record.accessCode) {
    record = await ensureTorneoAccessCode(record.id);
  }
  if (!record) throw new Error('No se pudo cargar el equipo.');

  if (record.panelEnabled === false) {
    throw new Error('El acceso al panel aún no está activo. El club lo habilitará tras revisar tu preinscripción.');
  }

  const recordEmail = String(record.contactEmail || '')
    .trim()
    .toLowerCase();
  if (recordEmail !== email) {
    throw new Error('El email no coincide con el de la preinscripción. Usa el mismo email que indicaste al inscribir el equipo.');
  }

  return buildTorneoEquipoPanelPayload({ ...record, accessCode: code });
}

function normalizeTorneoTeamName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isActiveTorneoPreinscripcion(record) {
  const st = String((record && record.status) || 'preinscripcion_enviada')
    .trim()
    .toLowerCase();
  return st !== 'descartada' && st !== 'eliminada' && st !== 'cancelada';
}

async function findDuplicateTorneoPreinscripcion(patch) {
  const teamKey = normalizeTorneoTeamName(patch.teamName);
  const newCats = new Set(
    (Array.isArray(patch.categories) ? patch.categories : []).map((c) => String(c || '').trim().toLowerCase())
  );
  if (!teamKey || !newCats.size) return null;

  const snap = await torneoPreinscripcionesRef().get();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (!isActiveTorneoPreinscripcion(d)) continue;
    if (normalizeTorneoTeamName(d.teamName) !== teamKey) continue;
    const existing = Array.isArray(d.categories) ? d.categories : [];
    const overlap = existing.some((c) => newCats.has(String(c || '').trim().toLowerCase()));
    if (overlap) return { id: doc.id, ...d };
  }
  return null;
}

/** Preinscripción torneo F7 desde la web pública. */
async function createTorneoPreinscripcionRecord(raw) {
  const patch = normalizeTorneoPreinscripcionFields(raw);
  if (!patch.teamName) throw new Error('Nombre del equipo obligatorio');
  if (!patch.playerCount) throw new Error('Número de jugadores obligatorio');
  if (!patch.town) throw new Error('Población obligatoria');
  if (!patch.categories.length) throw new Error('Selecciona al menos una categoría');
  if (!patch.contactName) throw new Error('Nombre de contacto obligatorio');
  if (!patch.contactEmail || !patch.contactEmail.includes('@')) {
    throw new Error('Email de contacto no válido');
  }
  if (!patch.contactPhone) throw new Error('Teléfono de contacto obligatorio');
  if (String(patch.source || 'web') === 'web' && !patch.premiosAceptados) {
    throw new Error('Debes leer y aceptar los términos sobre premios.');
  }

  const duplicate = await findDuplicateTorneoPreinscripcion(patch);
  if (duplicate) {
    const dupCats = torneoCategoryLabels(
      (Array.isArray(patch.categories) ? patch.categories : []).filter(function (c) {
        const key = String(c || '').trim().toLowerCase();
        return (Array.isArray(duplicate.categories) ? duplicate.categories : []).some(function (x) {
          return String(x || '').trim().toLowerCase() === key;
        });
      })
    );
    throw new Error(
      'Ya hay un equipo inscrito con el mismo nombre en ' +
        (dupCats.length ? dupCats.join(', ') : 'esa categoría') +
        '. Añade una variante al nombre (p. ej. «Leones A», «Leones B») para identificarlo en el calendario. Puedes usar el mismo nombre en otra categoría distinta.'
    );
  }

  const { getTorneoFeeForRecord } = require('./torneo-pricing');
  const { assignCodesForNewPreinscripcion } = require('./torneo-codes');
  patch.estimatedFeeEur = getTorneoFeeForRecord(patch);
  patch.teamKey = normalizeTorneoTeamName(patch.teamName);

  const allActive = await listActiveTorneoPreinscripciones();
  const existingForEmail = allActive.filter(function (r) {
    return String(r.contactEmail || '').trim().toLowerCase() === patch.contactEmail;
  });
  const codes = assignCodesForNewPreinscripcion(patch, existingForEmail, allActive);
  patch.responsibleCode = codes.responsibleCode;
  patch.accessCode = codes.accessCode;

  const ref = torneoPreinscripcionesRef().doc();
  const id = ref.id;
  await ref.set(
    {
      ...patch,
      id,
      plantillaStatus: 'pendiente',
      fichas: [],
      panelEnabled: true,
      isNewResponsible: codes.isNewResponsible
    },
    { merge: true }
  );
  const snap = await ref.get();
  return { id, ...(snap.exists ? snap.data() : patch), isNewResponsible: codes.isNewResponsible };
}

function coachesRef() {
  return initAdmin().collection('sanabria_coaches');
}

function normalizeCoachRecordFields(raw) {
  const c = raw && typeof raw === 'object' ? { ...raw } : {};
  const name = String(c.name || c.nombre || '').trim();
  const surname = String(c.surname || c.apellidos || '').trim();
  const phone = String(c.phone || c.telefono || '').trim();
  delete c.password;
  delete c.pass;
  delete c.plainPassword;
  delete c.portalPassword;
  const patch = {
    ...c,
    appScope: APP_SCOPE,
    name,
    nombre: name,
    surname,
    apellidos: surname,
    phone,
    telefono: phone,
    email: String(c.email || '').trim().toLowerCase(),
    dni: normalizeDni(c.dni),
    team: String(c.team || '').trim(),
    license: String(c.license || c.licencia || '').trim(),
    status: String(c.status || 'pending').trim(),
    updatedAt: new Date().toISOString()
  };
  if (c.passwordHash) patch.passwordHash = String(c.passwordHash);
  return patch;
}

async function findCoachDocByIdentity(coach) {
  const email = String(coach.email || '').trim().toLowerCase();
  if (email) {
    const q = await coachesRef().where('email', '==', email).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      return { ref: doc.ref, data: { id: doc.id, ...doc.data() } };
    }
  }
  const dni = normalizeDni(coach.dni);
  if (dni) {
    const q = await coachesRef().where('dni', '==', dni).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      return { ref: doc.ref, data: { id: doc.id, ...doc.data() } };
    }
  }
  const coachId = coach.id ? String(coach.id).trim() : '';
  if (coachId && !coachId.startsWith('COACH_') && !/^\d{12,}$/.test(coachId)) {
    const snap = await coachesRef().doc(coachId).get();
    if (snap.exists) return { ref: snap.ref, data: { id: snap.id, ...snap.data() } };
  }
  return null;
}

/** Alta/actualización de entrenador (panel admin — clave asignada por el club, solo hash). */
async function upsertCoachRecord(coach) {
  const patch = normalizeCoachRecordFields(coach);
  if (!patch.email) throw new Error('Email ausente en alta de entrenador');

  const existing = await findCoachDocByIdentity(patch);
  let coachId;
  if (existing) {
    coachId = existing.data.id;
    await existing.ref.set(patch, { merge: true });
  } else {
    if (!patch.passwordHash) {
      throw new Error('passwordHash obligatorio al crear entrenador');
    }
    const ref = coachesRef().doc();
    coachId = ref.id;
    const now = patch.updatedAt || new Date().toISOString();
    await ref.set(
      {
        ...patch,
        id: coachId,
        registrationDate: patch.registrationDate || now,
        registrationSource: patch.registrationSource || 'admin_panel'
      },
      { merge: true }
    );
  }
  const snap = await coachesRef().doc(String(coachId)).get();
  return { id: coachId, ...(snap.exists ? snap.data() : patch) };
}

async function deleteCoachRecord(coachId) {
  const id = String(coachId || '').trim();
  if (!id) throw new Error('ID de entrenador ausente');
  await coachesRef().doc(id).delete();
  return { deleted: true, id };
}

async function deleteMemberRecord(memberId, identity) {
  const deletedIds = new Set();
  const id = String(memberId || '').trim();
  const ident = identity && typeof identity === 'object' ? identity : {};

  if (id) {
    const ref = membersRef().doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() || {};
      await ref.delete();
      deletedIds.add(id);
      if (!ident.email && data.email) ident.email = data.email;
      if (!ident.dni && data.dni) ident.dni = data.dni;
    }
  }

  const email = String(ident.email || '').trim().toLowerCase();
  const dniNorm = normalizeDni(ident.dni);
  const dniVariants = [];
  if (dniNorm) {
    dniVariants.push(dniNorm);
    const lower = String(ident.dni || '').trim().toLowerCase();
    if (lower && lower !== dniNorm.toLowerCase()) dniVariants.push(lower);
    if (dniNorm.toLowerCase() !== dniNorm) dniVariants.push(dniNorm.toLowerCase());
  }

  if (email) {
    const q = await membersRef().where('email', '==', email).get();
    for (const docSnap of q.docs) {
      if (!deletedIds.has(docSnap.id)) {
        await docSnap.ref.delete();
        deletedIds.add(docSnap.id);
      }
    }
  }

  for (const dniVal of dniVariants) {
    const q = await membersRef().where('dni', '==', dniVal).get();
    for (const docSnap of q.docs) {
      if (!deletedIds.has(docSnap.id)) {
        await docSnap.ref.delete();
        deletedIds.add(docSnap.id);
      }
    }
  }

  if (deletedIds.size === 0) {
    throw new Error('No se encontró el socio en la nube (ID, email o DNI)');
  }
  return { deleted: true, ids: [...deletedIds] };
}

async function deletePlayerRecord(playerId, identity) {
  const deletedIds = new Set();
  const id = String(playerId || '').trim();
  const ident = identity && typeof identity === 'object' ? identity : {};
  const allowNotFound = ident.allowNotFound === true;

  function isTestPlayerData(d) {
    const data = d || {};
    const dni = normalizeDni(data.dni);
    if (dni === '88888888T' || dni === '88888888X') return true;
    if (data.testRunId || data.registrationSource === 'automated_test') return true;
    const name = String(data.name || data.nombre || '').trim().toLowerCase();
    const surname = String(data.surname || data.apellidos || '').trim().toLowerCase();
    if (name === 'diag' && surname === 'test') return true;
    const email = String(data.email || '').trim().toLowerCase();
    if (email.endsWith('@example.invalid')) return true;
    return false;
  }

  if (id && !id.startsWith('PLAYER_') && !id.startsWith('PENDING_')) {
    const ref = playersRef().doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.delete();
      deletedIds.add(id);
      const data = snap.data() || {};
      if (!ident.dni && data.dni) ident.dni = data.dni;
      if (!ident.email && data.email) ident.email = data.email;
      if (!ident.name && (data.name || data.nombre)) ident.name = data.name || data.nombre;
      if (!ident.surname && (data.surname || data.apellidos)) ident.surname = data.surname || data.apellidos;
      if (!ident.season && (data.inscriptionSeason || data.temporada)) {
        ident.season = data.inscriptionSeason || data.temporada;
      }
    }
  }

  const name = String(ident.name || '').trim().toLowerCase();
  const surname = String(ident.surname || '').trim().toLowerCase();
  const season = String(ident.season || ident.inscriptionSeason || '').trim();
  const isTestIdentity =
    normalizeDni(ident.dni) === '88888888T' ||
    normalizeDni(ident.dni) === '88888888X' ||
    (name === 'diag' && surname === 'test');
  if (name && surname) {
    const q = await playersRef().where('appScope', '==', APP_SCOPE).get();
    for (const docSnap of q.docs) {
      if (deletedIds.has(docSnap.id)) continue;
      const d = docSnap.data() || {};
      const pn = String(d.name || d.nombre || '').trim().toLowerCase();
      const ps = String(d.surname || d.apellidos || '').trim().toLowerCase();
      if (pn === name && ps === surname) {
        const docSeason = String(d.inscriptionSeason || d.temporada || '').trim();
        if (isTestIdentity || isTestPlayerData(d) || !season || !docSeason || docSeason === season) {
          await docSnap.ref.delete();
          deletedIds.add(docSnap.id);
        }
      }
    }
  }

  if (isTestIdentity || ident.purgeTestRecords) {
    const qTest = await playersRef().where('appScope', '==', APP_SCOPE).get();
    for (const docSnap of qTest.docs) {
      if (deletedIds.has(docSnap.id)) continue;
      if (isTestPlayerData(docSnap.data() || {})) {
        await docSnap.ref.delete();
        deletedIds.add(docSnap.id);
      }
    }
  }

  const dni = normalizeDni(ident.dni);
  if (dni) {
    const q2 = await playersRef().where('dni', '==', dni).get();
    for (const docSnap of q2.docs) {
      if (!deletedIds.has(docSnap.id)) {
        await docSnap.ref.delete();
        deletedIds.add(docSnap.id);
      }
    }
  }

  if (deletedIds.size === 0) {
    if (allowNotFound) return { deleted: false, ids: [] };
    throw new Error('No se encontró el jugador en la nube (ID, nombre o DNI)');
  }
  return { deleted: true, ids: [...deletedIds] };
}

async function deleteFriendRecord(friendId) {
  const id = String(friendId || '').trim();
  if (!id) throw new Error('ID de amigo ausente');
  await friendsRef().doc(id).delete();
  return { deleted: true, id };
}

module.exports = {
  savePendingPayment,
  getPayment,
  updatePayment,
  completeMembershipPayment,
  completePayGoldPayment,
  completeEventPayment,
  completePlayerInscription,
  completePlayerKitPurchase,
  sendPaymentFailedNotification,
  memberExistsForEmail,
  friendExistsForEmail,
  clubRecordExistsForNotify,
  applicationsRef,
  normalizeDni,
  findApplicationByDniSeason,
  createPlayerApplication,
  approvePlayerApplication,
  rejectPlayerApplication,
  hashPortalPassword,
  findPlayerForPortalLookup,
  emailMatchesPlayer,
  playerPortalEmails,
  sanitizePlayerForPortal,
  setPlayerPortalPasswordHash,
  verifyPlayerPortalLogin,
  setupPlayerPortalPassword,
  createPlayerPortalResetToken,
  resetPlayerPortalPasswordWithToken,
  checkPlayerPortalAccess,
  isPlayerInscriptionPaid,
  isPlayerProfileReadOnly,
  sanitizePlayerForPortalEdit,
  computePlayerProfileDiff,
  loginPlayerForProfileEdit,
  changePlayerPortalPassword,
  updatePlayerProfileByPortal,
  normalizePlayerRecordFields,
  upsertPlayerInscriptionRecord,
  assignPendingRegularMemberNumbers,
  repairPlayerInscriptionFromPaymentOrder,
  repairPlayerInscriptionsFromPaymentOrders,
  repairMembershipFromPaymentOrder,
  repairMembershipsFromPaymentOrders,
  listAllMembersData,
  upsertMemberSocioJugadorFromPlayer,
  findPlayerDocByIdentity,
  normalizeMemberRecordFields,
  upsertMemberRegistrationRecord,
  applyAutomaticSeasonRenewal,
  findMemberDocByIdentity,
  normalizeFriendRecordFields,
  upsertFriendRegistrationRecord,
  findFriendDocByIdentity,
  torneoPreinscripcionesRef,
  torneoCategoryLabels,
  generateTorneoAccessCode,
  normalizeTorneoAccessCode,
  normalizeTorneoTeamName,
  isActiveTorneoPreinscripcion,
  findTorneoPreinscripcionByAccessCode,
  ensureTorneoAccessCode,
  verifyTorneoEquipoAccess,
  buildTorneoEquipoPanelPayload,
  createTorneoPreinscripcionRecord,
  coachesRef,
  normalizeCoachRecordFields,
  findCoachDocByIdentity,
  upsertCoachRecord,
  deleteCoachRecord,
  deleteMemberRecord,
  deleteFriendRecord,
  deletePlayerRecord,
  recordClubLedgerIncome
};
