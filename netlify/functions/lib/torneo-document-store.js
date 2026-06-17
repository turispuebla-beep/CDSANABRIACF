'use strict';

const { normalizeStoredDocuments } = require('./torneo-email-docs');

let adminDb = null;

function getDb() {
  if (adminDb) return adminDb;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no configurado');
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  adminDb = admin.firestore();
  return adminDb;
}

function torneoDocumentsRef() {
  return getDb().collection('sanabria_torneo_documents');
}

function newDocId() {
  return 'td_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function isDocumentRef(item) {
  return item && item.id && !item.contentBase64;
}

async function deleteOwnerDocuments(recordId, ownerKey) {
  const snap = await torneoDocumentsRef()
    .where('appScope', '==', 'cdsanabriacf')
    .where('preinscripcionId', '==', String(recordId))
    .where('ownerKey', '==', String(ownerKey))
    .get();
  if (snap.empty) return;
  const batch = getDb().batch();
  snap.docs.forEach(function (doc) {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

async function saveTorneoDocumentRefs(recordId, ownerKey, documents) {
  const normalized = normalizeStoredDocuments(documents);
  if (!normalized.length) return [];
  await deleteOwnerDocuments(recordId, ownerKey);
  const batch = getDb().batch();
  const refs = [];
  normalized.forEach(function (d) {
    const docId = newDocId();
    const ref = torneoDocumentsRef().doc(docId);
    batch.set(ref, {
      appScope: 'cdsanabriacf',
      preinscripcionId: String(recordId),
      ownerKey: String(ownerKey),
      label: d.label,
      fileName: d.fileName,
      mimeType: d.mimeType,
      contentBase64: d.contentBase64,
      createdAt: new Date().toISOString()
    });
    refs.push({
      id: docId,
      label: d.label,
      fileName: d.fileName,
      mimeType: d.mimeType
    });
  });
  await batch.commit();
  return refs;
}

async function fetchDocumentById(docId) {
  const snap = await torneoDocumentsRef().doc(String(docId)).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return {
    id: snap.id,
    label: data.label,
    fileName: data.fileName,
    mimeType: data.mimeType,
    contentBase64: data.contentBase64
  };
}

async function hydrateDocumentList(list) {
  const items = Array.isArray(list) ? list : [];
  if (!items.length) return [];
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.contentBase64) {
      out.push(item);
      continue;
    }
    if (item && item.id) {
      const full = await fetchDocumentById(item.id);
      if (full) out.push(full);
    }
  }
  return out;
}

async function loadRecordDocuments(recordId) {
  const snap = await torneoDocumentsRef()
    .where('appScope', '==', 'cdsanabriacf')
    .where('preinscripcionId', '==', String(recordId))
    .get();
  const byOwner = {};
  snap.docs.forEach(function (doc) {
    const data = doc.data() || {};
    const key = String(data.ownerKey || '');
    if (!byOwner[key]) byOwner[key] = [];
    byOwner[key].push({
      id: doc.id,
      label: data.label,
      fileName: data.fileName,
      mimeType: data.mimeType,
      contentBase64: data.contentBase64
    });
  });
  return byOwner;
}

async function hydrateRecordForEmail(record) {
  const docsByOwner = await loadRecordDocuments(record.id);
  const coach = record.coach && typeof record.coach === 'object' ? { ...record.coach } : {};
  coach.documents = docsByOwner.coach || (await hydrateDocumentList(coach.documents));
  const fichas = Array.isArray(record.fichas)
    ? record.fichas.map(function (f) {
        if (!f || !f.data) return f;
        const ownerKey = String(f.id || '');
        const docs = docsByOwner[ownerKey] || [];
        return {
          ...f,
          data: {
            ...f.data,
            documents: docs.length ? docs : f.data.documents
          }
        };
      })
    : [];
  return { ...record, coach, fichas };
}

module.exports = {
  saveTorneoDocumentRefs,
  hydrateDocumentList,
  loadRecordDocuments,
  hydrateRecordForEmail,
  isDocumentRef
};
