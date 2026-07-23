/**
 * Subida de adjuntos (JPG/PNG/PDF) para avisos del club — la nube Storage.
 */
(function (global) {
  'use strict';

  const MAX_BYTES = 12 * 1024 * 1024;
  const ALLOWED = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf'
  };

  function safeExt(file) {
    const mime = String(file.type || '').toLowerCase();
    if (ALLOWED[mime]) return ALLOWED[mime];
    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.png')) return 'png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
    return null;
  }

  async function uploadNotificationAttachment(file, broadcastId) {
    if (!file || !broadcastId) {
      throw new Error('Archivo o identificador de aviso no válido');
    }
    if (file.size > MAX_BYTES) {
      throw new Error('El archivo supera el límite de 12 MB');
    }

    const ext = safeExt(file);
    if (!ext) {
      throw new Error('Solo se permiten archivos JPG, PNG o PDF');
    }

    const storage = global.firebaseStorage;
    if (!storage || storage.isSimulation) {
      throw new Error('Almacenamiento en la nube no disponible. Inicia sesión como administrador.');
    }

    const auth = global.firebaseAuth;
    if (!auth || !auth.currentUser) {
      throw new Error('Debes tener sesión de administrador activa en la nube para subir archivos.');
    }

    const { ref, uploadBytes, getDownloadURL } = await import(
      'https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js'
    );

    const path = 'cdsanabriacf/notifications/' + broadcastId + '/attachment.' + ext;
    const storageRef = ref(storage, path);
    const contentType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';

    await uploadBytes(storageRef, file, { contentType: contentType });
    const url = await getDownloadURL(storageRef);

    return {
      url: url,
      contentType: contentType,
      name: file.name || ('adjunto.' + ext),
      ext: ext
    };
  }

  function bindAttachmentPreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) {
        preview.innerHTML = '';
        preview.style.display = 'none';
        return;
      }
      const ext = safeExt(file);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      preview.style.display = 'block';
      preview.innerHTML =
        '<strong>Adjunto:</strong> ' +
        file.name +
        ' (' +
        sizeMb +
        ' MB) — ' +
        (ext === 'pdf' ? 'PDF' : 'Imagen');
    });
  }

  global.ClubNotificationUpload = {
    upload: uploadNotificationAttachment,
    bindPreview: bindAttachmentPreview
  };
})(typeof window !== 'undefined' ? window : this);
