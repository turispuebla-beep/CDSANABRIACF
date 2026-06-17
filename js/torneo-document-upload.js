/**
 * Lectura de documentos (PDF/imagen) para fichas torneo — base64 para Firestore/correo.
 */
(function (global) {
  'use strict';

  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  const MAX_FILES = 4;

  const TORNEO_DOC_LEGAL_TEXT =
    'El club puede solicitar documentación acreditativa de edad (DNI por ambas caras u otro documento válido) y su presentación física en cualquier momento, aunque ya se hubiera enviado por la web.';

  function allowedMime(mime) {
    const m = String(mime || '').toLowerCase();
    return (
      m === 'application/pdf' ||
      m === 'image/jpeg' ||
      m === 'image/jpg' ||
      m === 'image/png' ||
      m === 'image/webp'
    );
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('Archivo no válido'));
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        reject(new Error('«' + file.name + '» supera 4 MB.'));
        return;
      }
      if (!allowedMime(file.type)) {
        reject(new Error('Solo PDF o imagen (JPG, PNG, WEBP): «' + file.name + '»'));
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        const contentBase64 = comma >= 0 ? result.slice(comma + 1) : result;
        resolve({
          label: file.getAttribute && file.getAttribute('data-label') ? file.getAttribute('data-label') : file.name,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64: contentBase64,
          size: file.size
        });
      };
      reader.onerror = function () {
        reject(new Error('No se pudo leer «' + file.name + '»'));
      };
      reader.readAsDataURL(file);
    });
  }

  async function readLabeledInputs(inputs) {
    const list = Array.isArray(inputs) ? inputs : [];
    const out = [];
    for (let i = 0; i < list.length && out.length < MAX_FILES; i++) {
      const spec = list[i];
      const el = spec && spec.el;
      const file = el && el.files && el.files[0];
      if (!file) continue;
      const doc = await readFileAsBase64(file);
      doc.label = spec.label || doc.fileName;
      doc.id = spec.id || 'doc_' + (i + 1);
      out.push(doc);
    }
    return out;
  }

  function dataUrl(doc) {
    if (!doc || !doc.contentBase64) return '';
    const mime = doc.mimeType || 'application/octet-stream';
    return 'data:' + mime + ';base64,' + doc.contentBase64;
  }

  function isImageDoc(doc) {
    return String((doc && doc.mimeType) || '').toLowerCase().indexOf('image/') === 0;
  }

  global.TorneoDocumentUpload = {
    MAX_FILES: MAX_FILES,
    MAX_FILE_BYTES: MAX_FILE_BYTES,
    TORNEO_DOC_LEGAL_TEXT: TORNEO_DOC_LEGAL_TEXT,
    readLabeledInputs: readLabeledInputs,
    dataUrl: dataUrl,
    isImageDoc: isImageDoc
  };
})(typeof window !== 'undefined' ? window : globalThis);
