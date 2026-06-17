'use strict';

const crypto = require('crypto');
const {
  torneoPreinscripcionesRef,
  torneoCategoryLabels,
  normalizeTorneoAccessCode,
  normalizeTorneoTeamName,
  isActiveTorneoPreinscripcion,
  findTorneoPreinscripcionByAccessCode,
  ensureTorneoAccessCode
} = require('./firestore-admin');

function getTorneoInscriptionFeeEur() {
  const n = parseFloat(String(process.env.TORNEO_INSCRIPTION_FEE_EUR || '0'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

function siteUrl() {
  return String(process.env.SITE_URL || '').replace(/\/$/, '');
}

function newId(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function newInviteToken() {
  return crypto.randomBytes(18).toString('hex');
}

function normalizeDniType(raw) {
  const v = String(raw || '').trim().toLowerCase();
  return v === 'extranjero' || v === 'foreign' || v === 'nie' || v === 'pasaporte' ? 'extranjero' : 'espanol';
}

const { normalizeStoredDocuments } = require('./torneo-email-docs');

function normalizeCoach(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    name: String(c.name || c.nombre || '').trim(),
    surname: String(c.surname || c.apellidos || '').trim(),
    phone: String(c.phone || c.telefono || '').trim(),
    dni: String(c.dni || '').trim().toUpperCase(),
    dniType: normalizeDniType(c.dniType || c.tipoDocumento),
    documents: normalizeStoredDocuments(c.documents)
  };
}

function coachIsComplete(coach) {
  const c = normalizeCoach(coach);
  return !!(c.name && c.surname && c.phone && c.dni && c.documents.length >= 1);
}

function ageFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function normalizeFichaSubmit(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const birthDate = String(d.birthDate || d.fechaNacimiento || '').trim();
  const age = ageFromBirthDate(birthDate);
  const isMinor = age != null && age < 18;
  const guardian = d.guardian && typeof d.guardian === 'object' ? d.guardian : {};
  return {
    name: String(d.name || d.nombre || '').trim(),
    surname: String(d.surname || d.apellidos || '').trim(),
    dni: String(d.dni || '').trim().toUpperCase(),
    dniType: normalizeDniType(d.dniType || d.tipoDocumento),
    birthDate,
    email: String(d.email || '').trim().toLowerCase(),
    phone: String(d.phone || d.telefono || '').trim(),
    isMinor: !!isMinor,
    guardianName: String(guardian.name || d.guardianName || '').trim(),
    guardianSurname: String(guardian.surname || d.guardianSurname || '').trim(),
    guardianDni: String(guardian.dni || d.guardianDni || '').trim().toUpperCase(),
    guardianDniType: normalizeDniType(guardian.dniType || d.guardianDniType),
    guardianPhone: String(guardian.phone || d.guardianPhone || '').trim(),
    guardianEmail: String(guardian.email || d.guardianEmail || '').trim().toLowerCase(),
    photoConsent: !!d.photoConsent,
    clubRulesAccepted: !!d.clubRulesAccepted,
    playerConsent: d.playerConsent !== false,
    age: age != null ? age : null,
    documents: normalizeStoredDocuments(d.documents)
  };
}

function validateFichaSubmit(data) {
  if (!data.name) throw new Error('Nombre del jugador/a obligatorio');
  if (!data.surname) throw new Error('Apellidos obligatorios');
  if (!data.dni) throw new Error('Documento de identidad obligatorio');
  if (!data.birthDate) throw new Error('Fecha de nacimiento obligatoria');
  if (!Array.isArray(data.documents) || !data.documents.length) {
    throw new Error('Sube al menos un documento acreditativo de edad (DNI anverso u otro válido).');
  }
  if (!data.clubRulesAccepted) throw new Error('Debes aceptar las normas del torneo y del club');
  if (!data.photoConsent) throw new Error('Debes indicar el consentimiento de imagen');
  if (data.isMinor) {
    if (!data.guardianName) throw new Error('Nombre del tutor/a obligatorio (menor de edad)');
    if (!data.guardianSurname) throw new Error('Apellidos del tutor/a obligatorios');
    if (!data.guardianDni) throw new Error('Documento del tutor/a obligatorio');
    if (!data.guardianPhone) throw new Error('Teléfono del tutor/a obligatorio');
  }
}

async function loadRecordByAccess(accessCode, contactEmail) {
  const code = normalizeTorneoAccessCode(accessCode);
  const email = String(contactEmail || '').trim().toLowerCase();
  if (!code) throw new Error('Introduce el código de equipo.');
  if (!email || !email.includes('@')) throw new Error('Introduce el email de contacto.');

  let record = await findTorneoPreinscripcionByAccessCode(code);
  if (!record) throw new Error('Código no encontrado.');
  if (!record.accessCode) record = await ensureTorneoAccessCode(record.id);
  if (!record) throw new Error('No se pudo cargar el equipo.');
  if (record.panelEnabled === false) {
    throw new Error('El acceso al panel aún no está activo. Contacta con el club.');
  }
  if (String(record.contactEmail || '').trim().toLowerCase() !== email) {
    throw new Error('El email no coincide con el de la preinscripción.');
  }
  return { ...record, accessCode: code };
}

async function findTeamEntriesForRecord(record) {
  const teamKey = normalizeTorneoTeamName(record.teamName);
  const email = String(record.contactEmail || '')
    .trim()
    .toLowerCase();
  if (!teamKey || !email) return [record];

  const snap = await torneoPreinscripcionesRef().get();
  const entries = [];
  snap.docs.forEach(function (doc) {
    const data = { id: doc.id, ...(doc.data() || {}) };
    if (!isActiveTorneoPreinscripcion(data)) return;
    if (normalizeTorneoTeamName(data.teamName) !== teamKey) return;
    if (String(data.contactEmail || '').trim().toLowerCase() !== email) return;
    entries.push(data);
  });

  entries.sort(function (a, b) {
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });

  return entries.length ? entries : [record];
}

function pickCanonicalTeamName(records) {
  if (!records.length) return '';
  const sorted = records.slice().sort(function (a, b) {
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
  return sorted[0].teamName || '';
}

async function buildGroupedPanel(accessCode, contactEmail, activeAccessCodeOptional) {
  const record = await loadRecordByAccess(accessCode, contactEmail);
  const allRecords = await findTeamEntriesForRecord(record);
  const entries = allRecords.map(function (r) {
    return buildPanelPayload(r);
  });
  const activeCode = normalizeTorneoAccessCode(activeAccessCodeOptional || accessCode);
  let active =
    entries.find(function (e) {
      return normalizeTorneoAccessCode(e.accessCode) === activeCode;
    }) ||
    entries.find(function (e) {
      return e.id === record.id;
    }) ||
    entries[0];

  const coachEntry =
    entries.find(function (e) {
      return e.coach && e.coach.complete;
    }) || active;

  return {
    ...active,
    activeAccessCode: active.accessCode,
    teamName: pickCanonicalTeamName(allRecords) || active.teamName,
    responsibleEmail: String(record.contactEmail || '')
      .trim()
      .toLowerCase(),
    contactEmail: record.contactEmail,
    contactName: record.contactName,
    coach: coachEntry.coach,
    teamEntries: entries.map(function (e) {
      return {
        recordId: e.id,
        accessCode: e.accessCode,
        categoryLabels: e.categoryLabels,
        categories: e.categories,
        town: e.town,
        playerCount: e.playerCount,
        plantillaStatus: e.plantillaStatus,
        fichasSubmitted: e.fichasSubmitted,
        fichasPending: e.fichasPending,
        canFinalize: e.canFinalize,
        fichas: e.fichas,
        inscriptionFeeEur: e.inscriptionFeeEur
      };
    }),
    entryCount: entries.length
  };
}

function maskDni(dni) {
  const s = String(dni || '').trim();
  if (s.length <= 4) return '****';
  return '***' + s.slice(-4);
}

function fichaPublicLabel(f) {
  if (f.data && (f.data.name || f.data.surname)) {
    return [f.data.name, f.data.surname].filter(Boolean).join(' ').trim();
  }
  return f.label || f.inviteEmail || 'Jugador/a';
}

function buildPanelPayload(record) {
  const fichas = Array.isArray(record.fichas) ? record.fichas : [];
  const submitted = fichas.filter((f) => String(f.status || '') === 'enviada').length;
  const playerCount = parseInt(record.playerCount, 10) || 0;
  const fee = getTorneoInscriptionFeeEur();
  const base = siteUrl();
  const coach = normalizeCoach(record.coach || {});

  return {
    id: record.id || '',
    accessCode: record.accessCode || '',
    eventName: record.eventName || 'Torneo Fútbol 7 — 2026',
    teamName: record.teamName || '',
    town: record.town || '',
    categories: Array.isArray(record.categories) ? record.categories : [],
    categoryLabels: Array.isArray(record.categoryLabels)
      ? record.categoryLabels
      : torneoCategoryLabels(record.categories),
    playerCount,
    contactName: record.contactName || '',
    contactEmail: record.contactEmail || '',
    plantillaStatus: record.plantillaStatus || 'pendiente',
    fichasCount: fichas.length,
    fichasSubmitted: submitted,
    fichasPending: Math.max(0, playerCount - submitted),
    inscriptionFeeEur: fee,
    inscriptionFeeLabel: fee > 0 ? fee.toFixed(2) + ' €' : null,
    coach: {
      name: coach.name,
      surname: coach.surname,
      phone: coach.phone,
      dni: coach.dni || '',
      dniType: coach.dniType,
      documentCount: coach.documents.length,
      complete: coachIsComplete(record.coach || {})
    },
    fichas: fichas.map((f) => ({
      id: f.id || '',
      label: fichaPublicLabel(f),
      inviteEmail: f.inviteEmail || '',
      status: f.status || 'pendiente',
      updatedAt: f.updatedAt || f.submittedAt || null,
      inviteUrl: f.inviteToken && base ? base + '/torneo-jugador.html?invite=' + encodeURIComponent(f.inviteToken) : ''
    })),
    canFinalize:
      coachIsComplete(record.coach) &&
      submitted >= playerCount &&
      playerCount > 0 &&
      !['enviada_club', 'pagada', 'pendiente_pago'].includes(String(record.plantillaStatus || '')),
    paymentOrderId: record.paymentOrderId || null
  };
}

async function verifyTorneoEquipoAccess(accessCode, contactEmail, activeAccessCodeOptional) {
  return buildGroupedPanel(accessCode, contactEmail, activeAccessCodeOptional);
}

async function saveTorneoCoach(accessCode, contactEmail, coachRaw, activeAccessCodeOptional) {
  const record = await loadRecordByAccess(accessCode, contactEmail);
  const coach = normalizeCoach(coachRaw);
  if (!coach.name || !coach.surname) throw new Error('Nombre y apellidos del responsable técnico obligatorios');
  if (!coach.phone) throw new Error('Teléfono del responsable técnico obligatorio');
  if (!coach.dni) throw new Error('DNI o documento del responsable técnico obligatorio');

  let documentRefs = [];
  if (coachRaw.keepDocuments && record.coach && Array.isArray(record.coach.documents) && record.coach.documents.length) {
    documentRefs = record.coach.documents.filter(function (d) {
      return d && d.id;
    });
  } else {
    if (!coach.documents.length) {
      throw new Error('Sube al menos un documento acreditativo (DNI anverso u otro válido).');
    }
    const { saveTorneoDocumentRefs } = require('./torneo-document-store');
    documentRefs = await saveTorneoDocumentRefs(record.id, 'coach', coach.documents);
  }
  if (!documentRefs.length) {
    throw new Error('Sube al menos un documento acreditativo (DNI anverso u otro válido).');
  }
  coach.documents = documentRefs;

  const siblings = await findTeamEntriesForRecord(record);
  const now = new Date().toISOString();
  for (let i = 0; i < siblings.length; i++) {
    const s = siblings[i];
    const ref = torneoPreinscripcionesRef().doc(s.id);
    const plantillaStatus =
      String(s.plantillaStatus || 'pendiente') === 'pendiente' ? 'en_curso' : s.plantillaStatus;
    await ref.set({ coach, plantillaStatus, updatedAt: now }, { merge: true });
  }

  const activeCode = activeAccessCodeOptional || accessCode;
  return buildGroupedPanel(accessCode, contactEmail, activeCode);
}

async function createTorneoFichaInvite(accessCode, contactEmail, inviteRaw, activeAccessCodeOptional) {
  const activeCode = activeAccessCodeOptional || accessCode;
  const record = await loadRecordByAccess(activeCode, contactEmail);
  const fichas = Array.isArray(record.fichas) ? [...record.fichas] : [];
  const playerCount = parseInt(record.playerCount, 10) || 0;
  if (playerCount < 1) throw new Error('Número de jugadores no definido en la preinscripción.');
  if (fichas.length >= playerCount) {
    throw new Error('Ya hay invitaciones para los ' + playerCount + ' jugadores indicados en la preinscripción.');
  }

  const inviteEmail = String((inviteRaw && inviteRaw.email) || '').trim().toLowerCase();
  const label = String((inviteRaw && inviteRaw.label) || '').trim() || 'Jugador/a ' + (fichas.length + 1);
  if (!inviteEmail || !inviteEmail.includes('@')) throw new Error('Email del jugador/a obligatorio para enviar la invitación.');

  const ficha = {
    id: newId('f'),
    inviteToken: newInviteToken(),
    inviteEmail,
    label,
    status: 'pendiente',
    createdAt: new Date().toISOString(),
    submittedAt: null,
    data: null
  };
  fichas.push(ficha);

  const ref = torneoPreinscripcionesRef().doc(record.id);
  await ref.set(
    {
      fichas,
      plantillaStatus: 'en_curso',
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  const inviteUrl = siteUrl() + '/torneo-jugador.html?invite=' + encodeURIComponent(ficha.inviteToken);
  let emailSent = false;
  try {
    const { sendTorneoPlayerInviteEmail } = require('./member-email');
    const r = await sendTorneoPlayerInviteEmail({
      inviteEmail,
      inviteUrl,
      teamName: record.teamName,
      eventName: record.eventName,
      contactName: record.contactName,
      label
    });
    emailSent = !!r.sent;
  } catch (e) {
    console.warn('createTorneoFichaInvite email:', e.message || e);
  }

  const snap = await ref.get();
  return {
    panel: await buildGroupedPanel(accessCode, contactEmail, activeCode),
    inviteUrl,
    emailSent,
    fichaId: ficha.id
  };
}

async function findRecordByInviteToken(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const snap = await torneoPreinscripcionesRef().get();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const fichas = Array.isArray(data.fichas) ? data.fichas : [];
    const ficha = fichas.find((f) => String(f.inviteToken || '') === t);
    if (ficha) {
      return { recordId: doc.id, record: { id: doc.id, ...data }, ficha };
    }
  }
  return null;
}

function buildInvitePublicPayload(found) {
  const { record, ficha } = found;
  const already = String(ficha.status || '') === 'enviada';
  return {
    fichaId: ficha.id,
    teamName: record.teamName || '',
    eventName: record.eventName || 'Torneo Fútbol 7 — 2026',
    categoryLabels: Array.isArray(record.categoryLabels)
      ? record.categoryLabels
      : torneoCategoryLabels(record.categories),
    label: ficha.label || 'Jugador/a',
    inviteEmail: ficha.inviteEmail || '',
    status: ficha.status || 'pendiente',
    alreadySubmitted: already,
    submittedData: already && ficha.data
      ? {
          name: ficha.data.name,
          surname: ficha.data.surname
        }
      : null
  };
}

async function getTorneoFichaByInvite(token) {
  const found = await findRecordByInviteToken(token);
  if (!found) throw new Error('Enlace no válido o caducado. Pide al responsable del equipo que reenvíe la invitación.');
  return buildInvitePublicPayload(found);
}

async function submitTorneoFichaByInvite(token, rawFicha) {
  const found = await findRecordByInviteToken(token);
  if (!found) throw new Error('Enlace no válido.');
  if (String(found.ficha.status || '') === 'enviada') {
    throw new Error('Esta ficha ya fue enviada.');
  }

  const data = normalizeFichaSubmit(rawFicha);
  validateFichaSubmit(data);
  const fullDocuments = data.documents.slice();

  const fichas = Array.isArray(found.record.fichas) ? found.record.fichas.map((f) => ({ ...f })) : [];
  const ix = fichas.findIndex((f) => String(f.id) === String(found.ficha.id));
  if (ix < 0) throw new Error('Ficha no encontrada.');

  const now = new Date().toISOString();
  const { saveTorneoDocumentRefs } = require('./torneo-document-store');
  const documentRefs = await saveTorneoDocumentRefs(found.recordId, found.ficha.id, fullDocuments);
  const storedData = { ...data, documents: documentRefs };

  fichas[ix] = {
    ...fichas[ix],
    status: 'enviada',
    submittedAt: now,
    updatedAt: now,
    label: [data.name, data.surname].filter(Boolean).join(' ').trim() || fichas[ix].label,
    data: storedData
  };

  const ref = torneoPreinscripcionesRef().doc(found.recordId);
  await ref.set({ fichas, plantillaStatus: 'en_curso', updatedAt: now }, { merge: true });

  try {
    const { sendTorneoFichaSubmittedEmails } = require('./member-email');
    await sendTorneoFichaSubmittedEmails({
      teamName: found.record.teamName,
      eventName: found.record.eventName,
      playerName: [data.name, data.surname].filter(Boolean).join(' '),
      contactEmail: found.record.contactEmail,
      contactName: found.record.contactName,
      fichaData: { ...data, documents: fullDocuments }
    });
  } catch (e) {
    console.warn('submitTorneoFicha email:', e.message || e);
  }

  return buildInvitePublicPayload({
    recordId: found.recordId,
    record: { ...found.record, fichas },
    ficha: fichas[ix]
  });
}

async function completeTorneoPlantilla(recordId, paymentMeta) {
  const ref = torneoPreinscripcionesRef().doc(String(recordId));
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Preinscripción no encontrada');
  const record = { id: snap.id, ...snap.data() };
  const now = new Date().toISOString();
  const patch = {
    plantillaStatus: 'enviada_club',
    plantillaSentAt: now,
    updatedAt: now,
    paymentOrderId: paymentMeta && paymentMeta.orderId ? paymentMeta.orderId : record.paymentOrderId || null,
    paymentMethod: paymentMeta && paymentMeta.payMethod ? paymentMeta.payMethod : record.paymentMethod || null,
    inscriptionFeeEur:
      paymentMeta && paymentMeta.amountEur != null ? paymentMeta.amountEur : getTorneoInscriptionFeeEur()
  };
  await ref.set(patch, { merge: true });
  const merged = { ...record, ...patch };

  try {
    const { sendTorneoPlantillaCerradaEmails } = require('./member-email');
    const { hydrateRecordForEmail } = require('./torneo-document-store');
    const hydrated = await hydrateRecordForEmail(merged);
    await sendTorneoPlantillaCerradaEmails(hydrated);
  } catch (e) {
    console.warn('completeTorneoPlantilla email:', e.message || e);
  }

  return merged;
}

async function prepareTorneoFinalize(accessCode, contactEmail) {
  const record = await loadRecordByAccess(accessCode, contactEmail);
  const panel = buildPanelPayload(record);
  if (!panel.canFinalize) {
    throw new Error(
      'Completa los datos del responsable técnico y todas las fichas de participantes antes de finalizar la inscripción.'
    );
  }
  const fee = getTorneoInscriptionFeeEur();
  return { record, panel, fee };
}

async function finalizeTorneoPlantillaFree(accessCode, contactEmail) {
  const { record, fee } = await prepareTorneoFinalize(accessCode, contactEmail);
  if (fee > 0) {
    throw new Error('Esta inscripción requiere pago con tarjeta. Usa la opción de pago.');
  }
  return completeTorneoPlantilla(record.id, { amountEur: 0, payMethod: 'gratis' });
}

async function completeTorneoTeamInscriptionPayment(payment) {
  const preinscripcionId = payment.torneoPreinscripcionId || payment.preinscripcionId;
  if (!preinscripcionId) throw new Error('torneoPreinscripcionId ausente');
  return completeTorneoPlantilla(preinscripcionId, {
    orderId: payment.orderId,
    payMethod: payment.payMethod === 'bizum' ? 'redsys_bizum' : 'redsys_card',
    amountEur: payment.amountEur
  });
}

module.exports = {
  getTorneoInscriptionFeeEur,
  verifyTorneoEquipoAccess,
  saveTorneoCoach,
  createTorneoFichaInvite,
  getTorneoFichaByInvite,
  submitTorneoFichaByInvite,
  prepareTorneoFinalize,
  finalizeTorneoPlantillaFree,
  completeTorneoTeamInscriptionPayment,
  buildPanelPayload,
  coachIsComplete
};
