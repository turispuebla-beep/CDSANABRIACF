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
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    const d = resolved.data;
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
  return { ref: q.docs[0].ref, data: { id: q.docs[0].id, ...q.docs[0].data() } };
}

/** Localiza ficha por DNI+temporada o, en menores sin DNI, por email+temporada. */
async function findPlayerDocByIdentity(player) {
  const season = String(player.inscriptionSeason || player.temporada || '').trim();
  const dni = normalizeDni(player.dni);
  if (dni) {
    const byDni = await findPlayerDocByDniSeason(dni, season);
    if (byDni) return byDni;
  }
  const email = String(player.email || '').trim().toLowerCase();
  if (email && season) {
    const q = await playersRef().where('email', '==', email).limit(25).get();
    for (const doc of q.docs) {
      const data = doc.data();
      if (data.appScope && data.appScope !== APP_SCOPE) continue;
      if (String(data.inscriptionSeason || data.temporada || '') === season) {
        return { ref: doc.ref, data: { id: doc.id, ...data } };
      }
    }
  }
  return null;
}

function playerInscriptionLinksSocioFromReg(reg) {
  return String(reg.registrationSource || '') === 'web_inscription';
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
    socioJugador: playerInscriptionLinksSocioFromReg(reg)
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

  if (playerInscriptionLinksSocioFromReg(reg)) {
    const resolved = await resolveMemberForPlayerInscription({ ...reg, linkedMemberId: reg.linkedMemberId });
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
      dni,
      telefono: reg.phone || reg.telefono,
      phone: reg.phone || reg.telefono,
      email: String(reg.email || payment.customerEmail || '').toLowerCase(),
      domicilio: reg.domicilio || reg.address || '',
      localidad: reg.localidad || '',
      provincia: reg.provincia || 'Zamora',
      address: reg.address || reg.domicilio || '',
      direccion: reg.direccion || reg.address || '',
      birthDate: reg.birthDate || reg.fechaNacimiento,
      fechaNacimiento: reg.birthDate || reg.fechaNacimiento,
      guardianName: reg.guardianName || '',
      guardianDNI: reg.guardianDNI || '',
      guardianPhone: reg.guardianPhone || '',
      guardianEmail: reg.guardianEmail || '',
      guardianAddress: reg.guardianAddress || '',
      pagado: true,
      paymentStatus: 'paid',
      status: 'active',
      estado: 'activo',
      paymentOrderId: payment.orderId,
      paymentDate: now,
      inscriptionSeasonSocio: season,
      inscriptionSeasonJugador: season,
      cuotaVigenteHasta: proximoCierreTemporada31AgostoIso(),
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
    if (resolved) {
      await resolved.ref.set(memberPatch, { merge: true });
    } else {
      const ref = membersRef().doc();
      await ref.set(
        {
          ...memberPatch,
          id: ref.id,
          numeroSocio: 'SOC' + String(Date.now()).slice(-6),
          registrationDate: now
        },
        { merge: true }
      );
    }
  }

  try {
    const { sendClubAdminNotification } = require('./club-admin-notify-email');
    const payCh = payment.payMethod === 'bizum' ? 'bizum' : 'tarjeta';
    const kit = reg.kit && reg.kit.items ? reg.kit.items : reg.kitOrder || [];
    const kitTxt = Array.isArray(kit)
      ? kit.map((k) => `${k.garment || k.prenda || ''} ${k.size || k.talla || ''}`.trim()).filter(Boolean).join('; ')
      : '—';
    const total = reg.chargeBreakdown && reg.chargeBreakdown.total != null ? reg.chargeBreakdown.total : reg.totalCharge;
    await sendClubAdminNotification({
      kind: 'inscripcion_jugador_pagada',
      title: 'Inscripción jugador/a pagada (pasarela)',
      subject: `Inscripción pagada — ${payCh === 'bizum' ? 'Bizum' : 'Tarjeta'}`,
      paymentChannel: payCh,
      requesterEmail: reg.email || payment.customerEmail,
      nombre: reg.name || reg.nombre,
      apellidos: reg.surname || reg.apellidos,
      dni: reg.dni,
      fechaNacimiento: reg.birthDate || reg.fechaNacimiento,
      direccion: reg.domicilio || reg.address,
      localidad: reg.localidad,
      provincia: reg.provincia,
      telefono: reg.phone || reg.telefono,
      email: reg.email || payment.customerEmail,
      numeroSocio: reg.numeroSocio || reg.memberNumber,
      memberNumber: reg.numeroSocio || reg.memberNumber,
      fields: [
        { label: 'ID ficha', value: reg.id || '—' },
        { label: 'Temporada', value: season },
        { label: 'Categoría', value: reg.category || reg.categoria },
        { label: 'Ropa entreno', value: kitTxt || '—' },
        { label: 'Importe total (€)', value: total },
        { label: 'Pedido pasarela', value: payment.orderId }
      ]
    });
  } catch (mailErr) {
    console.warn('Email club inscripción pagada:', mailErr.message || mailErr);
  }
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
  const emails = [];
  const main = normalizeEmail(player.email);
  const guardian = normalizeEmail(player.guardianEmail);
  if (main) emails.push(main);
  if (guardian && guardian !== main) emails.push(guardian);
  return emails;
}

function emailMatchesPlayer(player, email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  return playerPortalEmails(player).includes(e);
}

function normalizeNamePart(v) {
  return String(v || '').trim().toLowerCase();
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

function normalizePlayerRecordFields(raw) {
  const p = raw && typeof raw === 'object' ? { ...raw } : {};
  const name = String(p.name || p.nombre || '').trim();
  const surname = String(p.surname || p.apellidos || '').trim();
  const phone = String(p.phone || p.telefono || '').trim();
  const address = String(p.address || p.direccion || '').trim();
  const birthDate = String(p.birthDate || p.fechaNacimiento || '').trim();
  const category = String(p.category || p.categoria || '').trim();
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

function applyMemberPaymentStateFromPlayerRecord(member, player) {
  const paid =
    !!player.inscriptionPaid ||
    String(player.paymentStatus || '').toLowerCase() === 'paid' ||
    String(player.inscriptionStatus || '').toLowerCase() === 'paid';
  const cuota = resolveSocioCuotaFromPlayer(player);
  if (cuota != null) member.cuota = cuota;

  if (paid) {
    member.pagado = true;
    member.paymentStatus = 'paid';
    member.status = 'active';
    member.estado = 'activo';
    member.pendingReason = null;
    member.validatedDate = player.validatedDate || new Date().toISOString();
    member.validatedBy = player.validatedBy || 'inscripcion_jugador';
    if (player.paymentOrderId) member.paymentOrderId = player.paymentOrderId;
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

async function findMemberDocForPlayerInscription(player) {
  const linkedId = player.linkedMemberId ? String(player.linkedMemberId).trim() : '';
  if (linkedId && !linkedId.startsWith('MEMBER_')) {
    const ref = membersRef().doc(linkedId);
    const snap = await ref.get();
    if (snap.exists) return { ref, data: { id: snap.id, ...snap.data() } };
  }
  const dni = normalizeDni(player.dni);
  if (dni) {
    const q = await membersRef().where('dni', '==', dni).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      return { ref: doc.ref, data: { id: doc.id, ...doc.data() } };
    }
  }
  const playerId = player.id ? String(player.id).trim() : '';
  if (playerId && !playerId.startsWith('PLAYER_')) {
    const q2 = await membersRef().where('playerId', '==', playerId).limit(1).get();
    if (!q2.empty) {
      const doc = q2.docs[0];
      return { ref: doc.ref, data: { id: doc.id, ...doc.data() } };
    }
  }
  const email = String(player.email || '').trim().toLowerCase();
  if (email) {
    const q3 = await membersRef().where('email', '==', email).limit(5).get();
    for (const doc of q3.docs) {
      const data = doc.data();
      if (data.socioJugador || data.isJugador) {
        return { ref: doc.ref, data: { id: doc.id, ...data } };
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
    email: String(player.email || '').trim().toLowerCase(),
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

  let memberId;
  if (existing) {
    memberId = existing.data.id;
    await existing.ref.set(memberPatch, { merge: true });
  } else {
    const ref = membersRef().doc();
    memberId = ref.id;
    await ref.set(
      {
        ...memberPatch,
        id: memberId,
        numeroSocio: 'SOC' + String(Date.now()).slice(-6),
        memberNumber: null,
        registrationDate: now
      },
      { merge: true }
    );
  }
  const snap = await membersRef().doc(String(memberId)).get();
  return { id: memberId, ...(snap.exists ? snap.data() : memberPatch) };
}

async function upsertPlayerInscriptionRecord(player) {
  const patch = normalizePlayerRecordFields(player);
  const dni = patch.dni;
  const email = patch.email;
  const season = String(patch.inscriptionSeason || patch.temporada || '').trim();
  if (!dni && !email) throw new Error('Identificador ausente (DNI o email) en inscripción');
  if (!season) throw new Error('Temporada ausente en inscripción');

  const existing = await findPlayerDocByIdentity(patch);
  let playerId;
  if (existing) {
    playerId = existing.data.id;
    await existing.ref.set(patch, { merge: true });
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
    updatedAt: new Date().toISOString()
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

  const existing = await findMemberDocByIdentity(patch);
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

module.exports = {
  savePendingPayment,
  getPayment,
  updatePayment,
  completeMembershipPayment,
  completeEventPayment,
  completePlayerInscription,
  memberExistsForEmail,
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
  normalizePlayerRecordFields,
  upsertPlayerInscriptionRecord,
  upsertMemberSocioJugadorFromPlayer,
  findPlayerDocByIdentity,
  normalizeMemberRecordFields,
  upsertMemberRegistrationRecord,
  findMemberDocByIdentity,
  normalizeFriendRecordFields,
  upsertFriendRegistrationRecord,
  findFriendDocByIdentity,
  coachesRef,
  normalizeCoachRecordFields,
  findCoachDocByIdentity,
  upsertCoachRecord,
  deleteCoachRecord
};
