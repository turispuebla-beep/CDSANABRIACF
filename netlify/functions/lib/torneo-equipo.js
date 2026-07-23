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
const { isResponsibleOnlyCode } = require('./torneo-codes');

const {
  getTorneoFeeForRecord,
  getTorneoFeeForRecords,
  formatTorneoFeeEur,
  getTorneoInscriptionFeeEurLegacy
} = require('./torneo-pricing');

function getTorneoInscriptionFeeEur(record) {
  if (record && Array.isArray(record.categories) && record.categories.length) {
    return getTorneoFeeForRecord(record);
  }
  return getTorneoInscriptionFeeEurLegacy();
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

function fichaHasDocuments(ficha) {
  const data = ficha && ficha.data ? ficha.data : {};
  return Array.isArray(data.documents) && data.documents.length > 0;
}

function fichaDocumentsPending(ficha) {
  if (!ficha || String(ficha.status || '') !== 'enviada') return false;
  if (ficha.documentsPending === false) return false;
  return !fichaHasDocuments(ficha);
}

function fichaDataForPanel(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    name: data.name || '',
    surname: data.surname || '',
    dni: data.dni || '',
    dniType: data.dniType || 'espanol',
    birthDate: data.birthDate || '',
    email: data.email || '',
    phone: data.phone || '',
    isMinor: !!data.isMinor,
    age: data.age != null ? data.age : null,
    guardian: {
      name: data.guardianName || '',
      surname: data.guardianSurname || '',
      dni: data.guardianDni || '',
      dniType: data.guardianDniType || 'espanol',
      phone: data.guardianPhone || '',
      email: data.guardianEmail || ''
    },
    photoConsent: !!data.photoConsent,
    clubRulesAccepted: !!data.clubRulesAccepted
  };
}

function validateFichaSubmit(data, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const documentsOptional = options.documentsOptional === true;
  if (!data.name) throw new Error('Nombre del jugador/a obligatorio');
  if (!data.surname) throw new Error('Apellidos obligatorios');
  if (!data.dni) throw new Error('Documento de identidad obligatorio');
  if (!data.birthDate) throw new Error('Fecha de nacimiento obligatoria');
  if (!documentsOptional && (!Array.isArray(data.documents) || !data.documents.length)) {
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
  if (!code) throw new Error('Introduce el código de responsable o de equipo.');
  if (!email || !email.includes('@')) throw new Error('Introduce el email de contacto.');

  let record = await findTorneoPreinscripcionByAccessCode(code);

  if (!record && isResponsibleOnlyCode(code)) {
    const snap = await torneoPreinscripcionesRef().get();
    const siblings = [];
    snap.docs.forEach(function (doc) {
      const data = { id: doc.id, ...(doc.data() || {}) };
      if (!isActiveTorneoPreinscripcion(data)) return;
      if (String(data.contactEmail || '').trim().toLowerCase() !== email) return;
      siblings.push(data);
    });
    record = siblings.find(function (r) {
      return normalizeTorneoAccessCode(r.responsibleCode) === code;
    });
    if (!record) {
      throw new Error('Código de responsable no encontrado para este email. Revisa TP-Rxxx y el email de la preinscripción.');
    }
  }

  if (!record) throw new Error('Código no encontrado.');
  if (!record.accessCode) record = await ensureTorneoAccessCode(record.id);
  if (!record) throw new Error('No se pudo cargar el equipo.');
  if (record.panelEnabled === false) {
    throw new Error('El acceso al panel aún no está activo. Contacta con el club.');
  }
  if (String(record.contactEmail || '').trim().toLowerCase() !== email) {
    throw new Error('El email no coincide con el de la preinscripción.');
  }
  return { ...record, loginCode: code };
}

async function findTeamEntriesForRecord(record) {
  const email = String(record.contactEmail || '')
    .trim()
    .toLowerCase();
  if (!email) return [record];

  const snap = await torneoPreinscripcionesRef().get();
  const entries = [];
  snap.docs.forEach(function (doc) {
    const data = { id: doc.id, ...(doc.data() || {}) };
    if (!isActiveTorneoPreinscripcion(data)) return;
    if (String(data.contactEmail || '').trim().toLowerCase() !== email) return;
    entries.push(data);
  });

  entries.sort(function (a, b) {
    const ac = String(a.accessCode || '').localeCompare(String(b.accessCode || ''), 'es');
    if (ac !== 0) return ac;
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

/** Ya pagado online (tarjeta/Bizum) o marcado pagado. */
function isTorneoPaidOnlineOrSettled(record) {
  if (!record) return false;
  const st = String(record.plantillaStatus || '').toLowerCase();
  const payStatus = String(record.paymentStatus || '').toLowerCase();
  const method = String(record.paymentMethod || '').toLowerCase();
  if (st === 'pagada' || payStatus === 'paid') return true;
  if (method.indexOf('redsys') >= 0 && payStatus === 'paid') return true;
  return false;
}

/**
 * Plantilla enviada con transferencia/efectivo (o pago tarjeta abandonado)
 * y aún sin validar/pagar online → puede cambiar a tarjeta.
 */
function isTorneoOfflinePendingUnpaid(record) {
  if (!record || isTorneoPaidOnlineOrSettled(record)) return false;
  const st = String(record.plantillaStatus || '').toLowerCase();
  const method = String(record.paymentMethod || '').toLowerCase();
  const offline = String(record.offlinePaymentChannel || '').toLowerCase();
  const payStatus = String(record.paymentStatus || '').toLowerCase();

  if (method.indexOf('redsys') >= 0 && payStatus === 'paid') return false;

  if (st === 'pendiente_pago') return true;

  if (st === 'enviada_club') {
    if (payStatus === 'paid') return false;
    if (
      offline === 'efectivo' ||
      offline === 'transferencia' ||
      method === 'efectivo' ||
      method === 'cash' ||
      method === 'transferencia' ||
      method === 'transfer' ||
      payStatus === 'pending_validation' ||
      !method
    ) {
      return true;
    }
  }
  return false;
}

async function buildGroupedPanel(accessCode, contactEmail, activeAccessCodeOptional) {
  const record = await loadRecordByAccess(accessCode, contactEmail);
  const allRecords = await findTeamEntriesForRecord(record);
  const entries = allRecords.map(function (r) {
    return buildPanelPayload(r);
  });
  const loginCode = normalizeTorneoAccessCode(record.loginCode || accessCode);
  const activeCode = normalizeTorneoAccessCode(activeAccessCodeOptional || accessCode);
  let active =
    entries.find(function (e) {
      return normalizeTorneoAccessCode(e.accessCode) === activeCode;
    }) ||
    entries.find(function (e) {
      return e.id === record.id;
    }) ||
    entries[0];

  if (isResponsibleOnlyCode(loginCode)) {
    const pending = entries.find(function (e) {
      return !['enviada_club', 'pagada'].includes(String(e.plantillaStatus || ''));
    });
    active = pending || active;
  }

  const coachEntry =
    entries.find(function (e) {
      return e.coach && e.coach.complete;
    }) || active;

  const unpaidEntries = allRecords.filter(function (r) {
    const st = String(r.plantillaStatus || '').toLowerCase();
    return st !== 'enviada_club' && st !== 'pagada';
  });
  const offlinePendingRecords = allRecords.filter(isTorneoOfflinePendingUnpaid);
  const totalInscriptionFeeEur = getTorneoFeeForRecords(unpaidEntries);
  const changePayToCardFeeEur = getTorneoFeeForRecords(offlinePendingRecords);
  const responsibleCode =
    record.responsibleCode ||
    (allRecords.find(function (r) {
      return r.responsibleCode;
    }) || {}).responsibleCode ||
    '';

  return {
    ...active,
    activeAccessCode: active.accessCode,
    responsibleCode: responsibleCode,
    teamName: active.teamName || pickCanonicalTeamName(allRecords),
    responsibleEmail: String(record.contactEmail || '')
      .trim()
      .toLowerCase(),
    contactEmail: record.contactEmail,
    contactName: record.contactName,
    coach: coachEntry.coach,
    totalInscriptionFeeEur: totalInscriptionFeeEur,
    totalInscriptionFeeLabel: totalInscriptionFeeEur > 0 ? formatTorneoFeeEur(totalInscriptionFeeEur) : null,
    canChangePayToCard: offlinePendingRecords.length > 0,
    changePayToCardFeeEur: changePayToCardFeeEur,
    changePayToCardFeeLabel: changePayToCardFeeEur > 0 ? formatTorneoFeeEur(changePayToCardFeeEur) : null,
    teamEntries: entries.map(function (e) {
      const fee = getTorneoFeeForRecord(e);
      return {
        recordId: e.id,
        accessCode: e.accessCode,
        responsibleCode: e.responsibleCode || responsibleCode,
        teamName: e.teamName,
        categoryLabels: e.categoryLabels,
        categories: e.categories,
        town: e.town,
        playerCount: e.playerCount,
        plantillaStatus: e.plantillaStatus,
        plantillaRosterMode: e.plantillaRosterMode || '',
        fichasSubmitted: e.fichasSubmitted,
        fichasPending: e.fichasPending,
        documentsPendingCount: e.documentsPendingCount || 0,
        canFinalize: e.canFinalize,
        canChangePayToCard: !!e.canChangePayToCard,
        paymentMethod: e.paymentMethod || null,
        paymentStatus: e.paymentStatus || null,
        offlinePaymentChannel: e.offlinePaymentChannel || null,
        pendingPayMethodLabel: e.pendingPayMethodLabel || null,
        fichas: e.fichas,
        inscriptionFeeEur: fee,
        inscriptionFeeLabel: fee > 0 ? formatTorneoFeeEur(fee) : null
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

function mapFichaForPanel(f, base) {
  const pendingDocs = fichaDocumentsPending(f);
  return {
    id: f.id || '',
    label: fichaPublicLabel(f),
    inviteEmail: f.inviteEmail || '',
    status: f.status || 'pendiente',
    source: f.source || 'invite',
    slotIndex: f.slotIndex != null ? f.slotIndex : null,
    updatedAt: f.updatedAt || f.submittedAt || null,
    documentsComplete: !pendingDocs && String(f.status || '') === 'enviada',
    documentsPending: pendingDocs,
    inviteUrl:
      f.inviteToken && base ? base + '/torneo-jugador.html?invite=' + encodeURIComponent(f.inviteToken) : '',
    data: f.data ? fichaDataForPanel(f.data) : null
  };
}

function buildPanelPayload(record) {
  const fichas = Array.isArray(record.fichas) ? record.fichas : [];
  const submitted = fichas.filter((f) => String(f.status || '') === 'enviada').length;
  const docsPendingCount = fichas.filter((f) => fichaDocumentsPending(f)).length;
  const playerCount = parseInt(record.playerCount, 10) || 0;
  const fee = getTorneoInscriptionFeeEur(record);
  const base = siteUrl();
  const coach = normalizeCoach(record.coach || {});
  const offlinePending = isTorneoOfflinePendingUnpaid(record);
  const payMethod = String(record.paymentMethod || '').toLowerCase();
  const offlineCh = String(record.offlinePaymentChannel || '').toLowerCase();

  return {
    id: record.id || '',
    accessCode: record.accessCode || '',
    responsibleCode: record.responsibleCode || '',
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
    plantillaRosterMode: record.plantillaRosterMode || '',
    fichasCount: fichas.length,
    fichasSubmitted: submitted,
    fichasPending: Math.max(0, playerCount - submitted),
    documentsPendingCount: docsPendingCount,
    inscriptionFeeEur: fee,
    inscriptionFeeLabel: fee > 0 ? formatTorneoFeeEur(fee) : null,
    paymentMethod: record.paymentMethod || null,
    paymentStatus: record.paymentStatus || null,
    offlinePaymentChannel: record.offlinePaymentChannel || null,
    canChangePayToCard: offlinePending,
    pendingPayMethodLabel:
      offlineCh === 'efectivo' || payMethod === 'cash' || payMethod === 'efectivo'
        ? 'efectivo'
        : offlineCh === 'transferencia' || payMethod === 'transfer' || payMethod === 'transferencia'
          ? 'transferencia'
          : String(record.plantillaStatus || '').toLowerCase() === 'pendiente_pago'
            ? 'tarjeta (pendiente)'
            : offlinePending
              ? 'pendiente'
              : null,
    coach: {
      name: coach.name,
      surname: coach.surname,
      phone: coach.phone,
      dni: coach.dni || '',
      dniType: coach.dniType,
      documentCount: coach.documents.length,
      complete: coachIsComplete(record.coach || {})
    },
    fichas: fichas.map((f) => mapFichaForPanel(f, base)),
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
    const { sendTorneoPlayerInviteEmail, sendTorneoPlayerInviteClubNotify } = require('./member-email');
    const cats = Array.isArray(record.categoryLabels)
      ? record.categoryLabels
      : torneoCategoryLabels(record.categories);
    const r = await sendTorneoPlayerInviteEmail({
      inviteEmail,
      inviteUrl,
      teamName: record.teamName,
      eventName: record.eventName,
      contactName: record.contactName,
      label
    });
    emailSent = !!r.sent;
    await sendTorneoPlayerInviteClubNotify({
      inviteEmail,
      inviteUrl,
      label,
      teamName: record.teamName,
      eventName: record.eventName,
      accessCode: record.accessCode,
      responsibleCode: record.responsibleCode,
      categoryLabels: cats,
      contactName: record.contactName,
      contactEmail: record.contactEmail
    });
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
    source: fichas[ix].source || 'invite',
    documentsPending: false,
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
      accessCode: found.record.accessCode,
      responsibleCode: found.record.responsibleCode,
      categoryLabels: Array.isArray(found.record.categoryLabels)
        ? found.record.categoryLabels
        : torneoCategoryLabels(found.record.categories),
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
  const prevStatus = String(record.plantillaStatus || '').toLowerCase();
  const alreadyHadPlantilla =
    !!record.plantillaSentAt ||
    prevStatus === 'enviada_club' ||
    prevStatus === 'pagada' ||
    prevStatus === 'pendiente_pago';
  const patch = {
    plantillaStatus: 'enviada_club',
    plantillaSentAt: record.plantillaSentAt || now,
    updatedAt: now,
    paymentOrderId: paymentMeta && paymentMeta.orderId ? paymentMeta.orderId : record.paymentOrderId || null,
    paymentMethod: paymentMeta && paymentMeta.payMethod ? paymentMeta.payMethod : record.paymentMethod || null,
    inscriptionFeeEur:
      paymentMeta && paymentMeta.amountEur != null ? paymentMeta.amountEur : getTorneoInscriptionFeeEur(record)
  };
  if (paymentMeta && paymentMeta.inscripcionPremiosAceptados) {
    patch.inscripcionPremiosAceptados = true;
    patch.inscripcionPremiosAceptadosAt = paymentMeta.inscripcionPremiosAceptadosAt || now;
  }
  if (paymentMeta && paymentMeta.paymentStatus) {
    patch.paymentStatus = paymentMeta.paymentStatus;
    if (String(paymentMeta.paymentStatus).toLowerCase() === 'paid') {
      patch.plantillaStatus = 'pagada';
      patch.paymentValidatedAt = paymentMeta.paymentValidatedAt || now;
      patch.offlinePaymentChannel = null;
      if (paymentMeta.paymentValidatedPor) patch.paymentValidatedPor = paymentMeta.paymentValidatedPor;
      if (paymentMeta.paidByEmail) patch.paidByEmail = paymentMeta.paidByEmail;
      if (paymentMeta.paidByName) patch.paidByName = paymentMeta.paidByName;
    }
  }
  if (paymentMeta && paymentMeta.offlinePaymentChannel) {
    patch.offlinePaymentChannel = paymentMeta.offlinePaymentChannel;
  }
  if (paymentMeta && paymentMeta.paidByEmail) patch.paidByEmail = paymentMeta.paidByEmail;
  if (paymentMeta && paymentMeta.paidByName) patch.paidByName = paymentMeta.paidByName;
  await ref.set(patch, { merge: true });
  const merged = { ...record, ...patch };

  const skipPlantillaEmail =
    !!(paymentMeta && paymentMeta.skipPlantillaEmail) ||
    (String((paymentMeta && paymentMeta.paymentStatus) || '').toLowerCase() === 'paid' && alreadyHadPlantilla);

  if (!skipPlantillaEmail) {
    try {
      const { sendTorneoPlantillaCerradaEmails } = require('./member-email');
      const { hydrateRecordForEmail } = require('./torneo-document-store');
      const hydrated = await hydrateRecordForEmail(merged);
      await sendTorneoPlantillaCerradaEmails(hydrated);
    } catch (e) {
      console.warn('completeTorneoPlantilla email:', e.message || e);
    }
  }

  return merged;
}

async function prepareTorneoFinalize(accessCode, contactEmail) {
  const record = await loadRecordByAccess(accessCode, contactEmail);
  const siblings = await findTeamEntriesForRecord(record);
  const panels = siblings.map(function (r) {
    return buildPanelPayload(r);
  });
  const unpaidPanels = panels.filter(function (p) {
    return !['enviada_club', 'pagada'].includes(String(p.plantillaStatus || ''));
  });
  if (!unpaidPanels.length) {
    throw new Error('La inscripción ya fue enviada al club.');
  }
  const notReady = unpaidPanels.filter(function (p) {
    return !p.canFinalize;
  });
  if (notReady.length) {
    const names = notReady
      .map(function (p) {
        return p.teamName || p.accessCode;
      })
      .join(', ');
    throw new Error(
      'Completa el responsable técnico y todas las fichas de cada equipo antes de finalizar. Pendientes: ' + names
    );
  }
  const activePanel =
    panels.find(function (p) {
      return normalizeTorneoAccessCode(p.accessCode) === normalizeTorneoAccessCode(accessCode);
    }) || panels[0];
  const fee = getTorneoFeeForRecords(
    siblings.filter(function (r) {
      return !['enviada_club', 'pagada'].includes(String(r.plantillaStatus || ''));
    })
  );
  const unpaidRecords = siblings.filter(function (r) {
    return !['enviada_club', 'pagada'].includes(String(r.plantillaStatus || ''));
  });
  return { record, panel: activePanel, fee, unpaidRecords, unpaidPanels };
}

/** Pago online (tarjeta) cuando ya eligieron transferencia/efectivo o quedó pendiente_pago. */
async function prepareTorneoCardRepay(accessCode, contactEmail) {
  const record = await loadRecordByAccess(accessCode, contactEmail);
  const siblings = await findTeamEntriesForRecord(record);
  const repayRecords = siblings.filter(isTorneoOfflinePendingUnpaid);
  if (!repayRecords.length) {
    throw new Error(
      'No hay cuota pendiente para pagar con tarjeta. Si ya pagaste con tarjeta o Bizum, no hace falta volver a pagar.'
    );
  }
  const panels = repayRecords.map(function (r) {
    return buildPanelPayload(r);
  });
  const fee = getTorneoFeeForRecords(repayRecords);
  if (!(fee > 0)) {
    throw new Error('Cuota de inscripción no configurada. Contacta con el club.');
  }
  const activePanel =
    panels.find(function (p) {
      return normalizeTorneoAccessCode(p.accessCode) === normalizeTorneoAccessCode(accessCode);
    }) || panels[0];
  return {
    record,
    panel: activePanel,
    fee,
    unpaidRecords: repayRecords,
    unpaidPanels: panels
  };
}

async function saveTorneoPlantillaBatch(accessCode, contactEmail, playersRaw, activeAccessCodeOptional) {
  const activeCode = activeAccessCodeOptional || accessCode;
  const record = await loadRecordByAccess(activeCode, contactEmail);
  const st = String(record.plantillaStatus || '').toLowerCase();
  if (['enviada_club', 'pagada', 'pendiente_pago'].includes(st)) {
    throw new Error('La plantilla ya fue enviada al club. No se puede modificar.');
  }

  const playerCount = parseInt(record.playerCount, 10) || 0;
  const players = Array.isArray(playersRaw) ? playersRaw : [];
  if (playerCount < 1) throw new Error('Número de jugadores no definido en la preinscripción.');
  if (players.length !== playerCount) {
    throw new Error('Completa los datos de los ' + playerCount + ' jugadores indicados en la preinscripción.');
  }

  const existingFichas = Array.isArray(record.fichas) ? record.fichas : [];
  const now = new Date().toISOString();
  const fichas = [];
  const { saveTorneoDocumentRefs } = require('./torneo-document-store');

  for (let i = 0; i < players.length; i++) {
    const raw = players[i] && typeof players[i] === 'object' ? players[i] : {};
    const data = normalizeFichaSubmit(raw);
    validateFichaSubmit(data, { documentsOptional: true });

    const fichaId = String(raw.fichaId || raw.id || '').trim();
    const existing =
      (fichaId && existingFichas.find((f) => String(f.id) === fichaId)) ||
      existingFichas.find((f) => f.slotIndex === i) ||
      existingFichas[i];
    const id = existing && existing.id ? existing.id : newId('f');

    let documentRefs = [];
    let documentsPending = true;
    if (data.documents.length) {
      documentRefs = await saveTorneoDocumentRefs(record.id, id, data.documents);
      documentsPending = documentRefs.length === 0;
    } else if (existing && fichaHasDocuments(existing)) {
      documentRefs = existing.data.documents.filter(function (d) {
        return d && d.id;
      });
      documentsPending = documentRefs.length === 0;
    }

    const storedData = Object.assign({}, data, { documents: documentRefs });
    fichas.push({
      id: id,
      inviteToken: existing && existing.inviteToken ? existing.inviteToken : newInviteToken(),
      inviteEmail: data.email || (existing && existing.inviteEmail) || '',
      label: [data.name, data.surname].filter(Boolean).join(' ').trim() || 'Jugador/a ' + (i + 1),
      status: 'enviada',
      source: 'batch_responsable',
      slotIndex: i,
      documentsPending: documentsPending,
      createdAt: existing && existing.createdAt ? existing.createdAt : now,
      submittedAt: now,
      updatedAt: now,
      data: storedData
    });
  }

  const ref = torneoPreinscripcionesRef().doc(record.id);
  const patch = {
    fichas: fichas,
    plantillaRosterMode: 'batch',
    plantillaStatus: 'en_curso',
    plantillaBatchSavedAt: now,
    updatedAt: now
  };
  await ref.set(patch, { merge: true });
  const merged = Object.assign({}, record, patch);

  try {
    const { sendTorneoRosterBatchSavedEmails } = require('./member-email');
    await sendTorneoRosterBatchSavedEmails(merged);
  } catch (e) {
    console.warn('saveTorneoPlantillaBatch email:', e.message || e);
  }

  return buildGroupedPanel(accessCode, contactEmail, activeCode);
}

async function uploadTorneoFichaDocuments(accessCode, contactEmail, fichaId, documentsRaw, activeAccessCodeOptional) {
  const activeCode = activeAccessCodeOptional || accessCode;
  const record = await loadRecordByAccess(activeCode, contactEmail);
  const st = String(record.plantillaStatus || '').toLowerCase();
  if (['enviada_club', 'pagada'].includes(st)) {
    throw new Error('La inscripción ya fue cerrada. Contacta con el club para actualizar documentos.');
  }

  const fid = String(fichaId || '').trim();
  if (!fid) throw new Error('Jugador/a no indicado.');

  const fichas = Array.isArray(record.fichas) ? record.fichas.map((f) => Object.assign({}, f)) : [];
  const ix = fichas.findIndex((f) => String(f.id) === fid);
  if (ix < 0) throw new Error('Jugador/a no encontrado en la plantilla.');
  if (String(fichas[ix].status || '') !== 'enviada') {
    throw new Error('Primero guarda los datos del jugador/a en la plantilla.');
  }

  const docs = normalizeStoredDocuments(documentsRaw);
  if (!docs.length) {
    throw new Error('Sube al menos el DNI por el anverso u otro documento válido.');
  }

  const { saveTorneoDocumentRefs } = require('./torneo-document-store');
  const documentRefs = await saveTorneoDocumentRefs(record.id, fid, docs);
  if (!documentRefs.length) throw new Error('No se pudieron guardar los documentos.');

  const now = new Date().toISOString();
  const prevData = fichas[ix].data && typeof fichas[ix].data === 'object' ? fichas[ix].data : {};
  fichas[ix] = Object.assign({}, fichas[ix], {
    documentsPending: false,
    updatedAt: now,
    data: Object.assign({}, prevData, { documents: documentRefs })
  });

  const ref = torneoPreinscripcionesRef().doc(record.id);
  await ref.set({ fichas: fichas, updatedAt: now }, { merge: true });

  const playerName = [prevData.name, prevData.surname].filter(Boolean).join(' ').trim() || fichas[ix].label;

  try {
    const { sendTorneoFichaDocumentsUploadedEmail } = require('./member-email');
    await sendTorneoFichaDocumentsUploadedEmail({
      teamName: record.teamName,
      eventName: record.eventName,
      accessCode: record.accessCode,
      responsibleCode: record.responsibleCode,
      categoryLabels: Array.isArray(record.categoryLabels)
        ? record.categoryLabels
        : torneoCategoryLabels(record.categories),
      playerName: playerName,
      contactEmail: record.contactEmail,
      contactName: record.contactName,
      fichaData: fichas[ix].data,
      documents: docs
    });
  } catch (e) {
    console.warn('uploadTorneoFichaDocuments email:', e.message || e);
  }

  return buildGroupedPanel(accessCode, contactEmail, activeCode);
}

async function finalizeTorneoPlantillaOffline(accessCode, contactEmail, opts, activeAccessCodeOptional) {
  const payMethod = String((opts && opts.payMethod) || 'transferencia')
    .trim()
    .toLowerCase();
  const offlineMethods = ['transferencia', 'efectivo'];
  if (!offlineMethods.includes(payMethod)) {
    throw new Error('Forma de pago no válida.');
  }
  const { unpaidRecords } = await prepareTorneoFinalize(accessCode, contactEmail);
  const unpaidIds = unpaidRecords.map(function (r) {
    return r.id;
  });
  const acceptMeta = opts && typeof opts === 'object' ? opts : {};
  await recordInscripcionPremiosAcceptance(unpaidIds);
  const now = new Date().toISOString();
  for (let i = 0; i < unpaidRecords.length; i++) {
    await completeTorneoPlantilla(unpaidRecords[i].id, {
      amountEur: getTorneoInscriptionFeeEur(unpaidRecords[i]),
      payMethod: payMethod,
      paymentStatus: 'pending_validation',
      offlinePaymentChannel: payMethod,
      inscripcionPremiosAceptados: !!acceptMeta.inscripcionPremiosAceptados,
      inscripcionPremiosAceptadosAt: acceptMeta.inscripcionPremiosAceptadosAt || now,
      paidByEmail: unpaidRecords[i].contactEmail || '',
      paidByName: unpaidRecords[i].contactName || ''
    });
  }
  const activeCode = activeAccessCodeOptional || accessCode;
  return buildGroupedPanel(accessCode, contactEmail, activeCode);
}

async function recordInscripcionPremiosAcceptance(recordIds) {
  const ids = Array.isArray(recordIds) ? recordIds.filter(Boolean) : [];
  if (!ids.length) return;
  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i++) {
    await torneoPreinscripcionesRef()
      .doc(String(ids[i]))
      .set(
        {
          inscripcionPremiosAceptados: true,
          inscripcionPremiosAceptadosAt: now,
          updatedAt: now
        },
        { merge: true }
      );
  }
}

async function finalizeTorneoPlantillaFree(accessCode, contactEmail, acceptanceMeta) {
  const { fee, unpaidRecords } = await prepareTorneoFinalize(accessCode, contactEmail);
  if (fee > 0) {
    throw new Error('Esta inscripción requiere pago con tarjeta. Usa la opción de pago.');
  }
  const acceptMeta = acceptanceMeta && typeof acceptanceMeta === 'object' ? acceptanceMeta : {};
  const results = [];
  for (let i = 0; i < unpaidRecords.length; i++) {
    results.push(
      await completeTorneoPlantilla(unpaidRecords[i].id, {
        amountEur: 0,
        payMethod: 'gratis',
        inscripcionPremiosAceptados: !!acceptMeta.inscripcionPremiosAceptados,
        inscripcionPremiosAceptadosAt: acceptMeta.inscripcionPremiosAceptadosAt
      })
    );
  }
  return results[0];
}

async function completeTorneoTeamInscriptionPayment(payment) {
  const ids = Array.isArray(payment.torneoPreinscripcionIds)
    ? payment.torneoPreinscripcionIds.filter(Boolean)
    : [payment.torneoPreinscripcionId || payment.preinscripcionId].filter(Boolean);
  if (!ids.length) throw new Error('torneoPreinscripcionId ausente');
  const results = [];
  const payMethodLabel = payment.payMethod === 'bizum' ? 'redsys_bizum' : 'redsys_card';
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    let amountEur = payment.amountEur;
    let beforeSnap = null;
    try {
      beforeSnap = await torneoPreinscripcionesRef().doc(String(id)).get();
    } catch (_) {}
    if (ids.length > 1 && beforeSnap && beforeSnap.exists) {
      amountEur = getTorneoFeeForRecord({ id: beforeSnap.id, ...beforeSnap.data() });
    }
    const before = beforeSnap && beforeSnap.exists ? beforeSnap.data() || {} : {};
    const alreadySent =
      !!before.plantillaSentAt ||
      ['enviada_club', 'pagada', 'pendiente_pago'].includes(String(before.plantillaStatus || '').toLowerCase());
    results.push(
      await completeTorneoPlantilla(id, {
        orderId: payment.orderId,
        payMethod: payMethodLabel,
        amountEur: amountEur,
        paymentStatus: 'paid',
        skipPlantillaEmail: alreadySent || !!payment.changePayToCard,
        paymentValidatedPor: payment.changePayToCard
          ? 'Pasarela Redsys (cambio a tarjeta)'
          : 'Pasarela Redsys',
        paidByEmail: payment.customerEmail || before.contactEmail || '',
        paidByName: payment.contactName || before.contactName || ''
      })
    );
    try {
      const { sendTorneoPagoValidadoEmails } = require('./member-email');
      const paidRecord = results[results.length - 1];
      await sendTorneoPagoValidadoEmails(
        Object.assign({}, paidRecord, {
          paymentAuto: true,
          payMethod: payMethodLabel,
          paymentMethod: payMethodLabel,
          paymentOrderId: payment.orderId,
          orderId: payment.orderId,
          paymentValidatedAt: new Date().toISOString(),
          paymentValidatedPor: payment.changePayToCard
            ? 'Pasarela Redsys (cambio a tarjeta)'
            : 'Pasarela Redsys',
          contactName: payment.contactName || paidRecord.contactName,
          contactEmail: payment.customerEmail || paidRecord.contactEmail,
          paymentChangedByName: payment.contactName || paidRecord.contactName,
          paymentChangedByEmail: payment.customerEmail || paidRecord.contactEmail
        })
      );
    } catch (e) {
      console.warn('completeTorneoTeamInscriptionPayment email:', e.message || e);
    }
  }
  return results[0];
}

module.exports = {
  getTorneoInscriptionFeeEur,
  verifyTorneoEquipoAccess,
  saveTorneoCoach,
  createTorneoFichaInvite,
  saveTorneoPlantillaBatch,
  uploadTorneoFichaDocuments,
  getTorneoFichaByInvite,
  submitTorneoFichaByInvite,
  prepareTorneoFinalize,
  prepareTorneoCardRepay,
  finalizeTorneoPlantillaFree,
  finalizeTorneoPlantillaOffline,
  recordInscripcionPremiosAcceptance,
  completeTorneoTeamInscriptionPayment,
  buildPanelPayload,
  coachIsComplete,
  isTorneoOfflinePendingUnpaid
};
