'use strict';

const { escapeHtml } = require('./club-email');

const DOC_LEGAL_TEXT =
  'El club puede solicitar documentación acreditativa de edad (DNI por ambas caras u otro documento válido) y su presentación física en cualquier momento, aunque ya se hubiera enviado por la web.';

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

function normalizeStoredDocuments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 6)
    .map(function (d, i) {
      const b64 = String((d && d.contentBase64) || '').replace(/^data:[^;]+;base64,/, '');
      if (!b64 || b64.length > 2.8 * 1024 * 1024) return null;
      return {
        id: String((d && d.id) || 'doc_' + i),
        label: String((d && d.label) || (d && d.fileName) || 'Documento').trim(),
        fileName: String((d && d.fileName) || 'documento').slice(0, 120),
        mimeType: String((d && d.mimeType) || 'application/octet-stream').slice(0, 80),
        contentBase64: b64
      };
    })
    .filter(Boolean);
}

function documentsToAttachments(documents, prefix) {
  const pre = prefix ? String(prefix).replace(/[^\w.-]+/g, '_') + '_' : '';
  return normalizeStoredDocuments(documents).map(function (d, i) {
    return {
      filename: (pre + (d.fileName || 'doc_' + (i + 1))).slice(0, 180),
      contentBase64: d.contentBase64,
      type: d.mimeType
    };
  });
}

function documentsHtmlPreview(documents) {
  const docs = normalizeStoredDocuments(documents);
  if (!docs.length) return '<p style="color:#64748b;font-size:0.9rem;">Sin documentos adjuntos en la ficha.</p>';
  return docs
    .map(function (d) {
      const isImg = String(d.mimeType || '').toLowerCase().indexOf('image/') === 0;
      if (isImg) {
        return (
          '<div style="margin:10px 0;">' +
          '<p style="margin:0 0 6px;font-weight:600;">' +
          escapeHtml(d.label || d.fileName) +
          '</p>' +
          '<img src="data:' +
          escapeHtml(d.mimeType) +
          ';base64,' +
          d.contentBase64 +
          '" alt="' +
          escapeHtml(d.label || '') +
          '" style="max-width:100%;max-height:220px;border:1px solid #e2e8f0;border-radius:8px;">' +
          '</div>'
        );
      }
      return (
        '<p style="margin:6px 0;">📎 <strong>' +
        escapeHtml(d.label || d.fileName) +
        '</strong> (PDF/documento en adjuntos del correo)</p>'
      );
    })
    .join('');
}

function fichaDataToFields(data) {
  const d = data && typeof data === 'object' ? data : {};
  const age = d.age != null ? d.age : ageFromBirthDate(d.birthDate);
  const fields = [
    { label: 'Nombre', value: d.name },
    { label: 'Apellidos', value: d.surname },
    { label: 'Documento', value: d.dni },
    { label: 'Tipo documento', value: d.dniType },
    { label: 'Fecha nacimiento', value: d.birthDate },
    { label: 'Edad', value: age != null ? age + ' años' : '—' },
    { label: 'Email', value: d.email },
    { label: 'Teléfono', value: d.phone },
    { label: 'Menor de edad', value: d.isMinor ? 'Sí' : 'No' }
  ];
  if (d.isMinor) {
    fields.push(
      { label: 'Tutor/a', value: [d.guardianName, d.guardianSurname].filter(Boolean).join(' ') },
      { label: 'Doc. tutor/a', value: d.guardianDni },
      { label: 'Tel. tutor/a', value: d.guardianPhone },
      { label: 'Email tutor/a', value: d.guardianEmail }
    );
  }
  fields.push(
    { label: 'Consentimiento imagen', value: d.photoConsent ? 'Sí' : 'No' },
    { label: 'Normas aceptadas', value: d.clubRulesAccepted ? 'Sí' : 'No' }
  );
  return fields;
}

function coachToFields(coach) {
  const c = coach && typeof coach === 'object' ? coach : {};
  return [
    { label: 'Responsable técnico (torneo)', value: [c.name, c.surname].filter(Boolean).join(' ') },
    { label: 'Documento', value: c.dni },
    { label: 'Tipo documento', value: c.dniType },
    { label: 'Teléfono', value: c.phone }
  ];
}

function collectFichaAttachments(fichaData) {
  return documentsToAttachments(fichaData && fichaData.documents, 'jugador');
}

function collectRecordAttachments(record) {
  const all = [];
  if (record && record.coach && record.coach.documents) {
    all.push.apply(all, documentsToAttachments(record.coach.documents, 'entrenador'));
  }
  const fichas = Array.isArray(record && record.fichas) ? record.fichas : [];
  fichas.forEach(function (f, idx) {
    if (f && f.data && f.data.documents) {
      const name = [f.data.name, f.data.surname].filter(Boolean).join('_') || 'jugador_' + (idx + 1);
      all.push.apply(all, documentsToAttachments(f.data.documents, name));
    }
  });
  return all.slice(0, 40);
}

module.exports = {
  DOC_LEGAL_TEXT,
  normalizeStoredDocuments,
  documentsToAttachments,
  documentsHtmlPreview,
  fichaDataToFields,
  coachToFields,
  collectFichaAttachments,
  collectRecordAttachments,
  ageFromBirthDate
};
