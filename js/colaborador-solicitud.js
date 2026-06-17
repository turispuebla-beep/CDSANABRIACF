/**
 * Solicitud de colaboradores / publicidad — envío al club por correo (Netlify).
 * Configurable desde admin → Publicidad → Formulario colaboradores.
 */
(function (global) {
  'use strict';

  const CONFIG_KEY = 'clubColaboradorFormConfig';
  const SUBMISSIONS_KEY = 'clubColaboradorSolicitudes';
  const MAX_FILES = 2;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;

  const INTERES_COLABORADOR_SVC = {
    id: 'interes_colaborador',
    label: 'Estoy interesado en ser colaborador/anunciante',
    defaultPrice: '',
    noPrice: true
  };

  const DEFAULT_CONFIG = {
    modalTitle: 'Solicitud de colaboración publicitaria',
    modalIntro:
      'Completa el formulario para solicitar colaboración con el CD Sanabria CF. Al enviar, el club recibirá tus datos y archivos adjuntos por correo.',
    services: [
      { id: 'renovacion', label: 'Renovación', defaultPrice: '50,00 €' },
      INTERES_COLABORADOR_SVC
    ]
  };

  const MASK_PUBLIC_SERVICE_PRICES = false;

  function publicDisplayPrice(price) {
    if (MASK_PUBLIC_SERVICE_PRICES) return '00,00 €';
    return price ? String(price) : '—';
  }

  function serviceShowsPrice(svc) {
    if (!svc) return false;
    if (svc.noPrice || String(svc.id || '') === 'interes_colaborador') return false;
    return !!String(svc.defaultPrice || '').trim();
  }

  function normalizePublicServices(services) {
    const list = Array.isArray(services) ? services : [];
    const renov = list.find(function (s) {
      return String(s.id || '') === 'renovacion';
    });
    return [
      {
        id: 'renovacion',
        label: 'Renovación',
        defaultPrice: String((renov && renov.defaultPrice) || '50,00 €').trim() || '50,00 €'
      },
      {
        id: INTERES_COLABORADOR_SVC.id,
        label: INTERES_COLABORADOR_SVC.label,
        defaultPrice: '',
        noPrice: true
      }
    ];
  }

  function readConfig() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(CONFIG_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return cloneConfig(DEFAULT_CONFIG);
      const services = normalizePublicServices(
        Array.isArray(raw.services) && raw.services.length ? raw.services : DEFAULT_CONFIG.services
      );
      return {
        modalTitle: raw.modalTitle || DEFAULT_CONFIG.modalTitle,
        modalIntro: raw.modalIntro || DEFAULT_CONFIG.modalIntro,
        services: services
          .map(function (s, i) {
            return {
              id: String(s.id || 'svc_' + i).trim() || 'svc_' + i,
              label: String(s.label || '').trim() || 'Opción ' + (i + 1),
              defaultPrice: String(s.defaultPrice != null ? s.defaultPrice : '').trim()
            };
          })
          .filter(function (s) {
            return s.label;
          })
      };
    } catch (_) {
      return cloneConfig(DEFAULT_CONFIG);
    }
  }

  function cloneConfig(cfg) {
    return {
      modalTitle: cfg.modalTitle,
      modalIntro: cfg.modalIntro,
      services: (cfg.services || []).map(function (s) {
        return { id: s.id, label: s.label, defaultPrice: s.defaultPrice };
      })
    };
  }

  function saveConfig(cfg) {
    const payload = cloneConfig(cfg || DEFAULT_CONFIG);
    payload.services = normalizePublicServices(payload.services);
    payload.lastModified = new Date().toISOString();
    global.localStorage.setItem(CONFIG_KEY, JSON.stringify(payload));
    if (typeof global.syncLocalSettingsBlobToFirebase === 'function') {
      global.syncLocalSettingsBlobToFirebase(CONFIG_KEY).catch(function () {});
    }
    return payload;
  }

  function getClubNotifyEmail() {
    if (global.ClubMailto && global.ClubMailto.getClubNotifyEmail) {
      return global.ClubMailto.getClubNotifyEmail();
    }
    if (global.ClubContactDefaults && global.ClubContactDefaults.getNotifyEmail) {
      return global.ClubContactDefaults.getNotifyEmail();
    }
    if (global.PlayerApplication && global.PlayerApplication.getClubNotifyEmail) {
      return global.PlayerApplication.getClubNotifyEmail();
    }
    return (
      (global.ClubContactDefaults && global.ClubContactDefaults.CLUB_EMAIL_NOTIFY) ||
      'cdsanabriafc@gmail.com'
    );
  }

  function buildMailtoUrl(to, cc, subject, body) {
    if (global.ClubMailto && global.ClubMailto.buildMailtoUrl) {
      return global.ClubMailto.buildMailtoUrl(to, cc, subject, body);
    }
    const addr = String(to || '').trim();
    if (!addr || !addr.includes('@')) return '';
    const q = [];
    if (cc && String(cc).includes('@')) q.push('cc=' + encodeURIComponent(String(cc).trim()));
    if (subject) q.push('subject=' + encodeURIComponent(subject));
    if (body) q.push('body=' + encodeURIComponent(body));
    return 'mailto:' + encodeURIComponent(addr) + (q.length ? '?' + q.join('&') : '');
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || '');
        const ix = result.indexOf(',');
        resolve(ix >= 0 ? result.slice(ix + 1) : result);
      };
      reader.onerror = function () {
        reject(new Error('No se pudo leer el archivo «' + (file.name || 'adjunto') + '».'));
      };
      reader.readAsDataURL(file);
    });
  }

  async function collectFilesFromInput(fileInput) {
    const files = [];
    if (!fileInput || !fileInput.files) return files;
    for (let i = 0; i < fileInput.files.length && files.length < MAX_FILES; i++) {
      const f = fileInput.files[i];
      if (!f) continue;
      const name = String(f.name || '').toLowerCase();
      const okType =
        f.type === 'application/pdf' ||
        f.type === 'image/jpeg' ||
        f.type === 'image/jpg' ||
        f.type === 'image/pjpeg' ||
        /\.(pdf|jpe?g)$/i.test(name);
      if (!okType) {
        throw new Error('Solo se permiten archivos PDF o JPG/JPEG: ' + (f.name || 'archivo'));
      }
      if (f.size > MAX_FILE_BYTES) {
        throw new Error('El archivo «' + f.name + '» supera 5 MB.');
      }
      const contentBase64 = await readFileAsBase64(f);
      files.push({
        name: f.name,
        filename: f.name,
        size: f.size,
        type: f.type || (name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        contentBase64: contentBase64
      });
    }
    return files;
  }

  function normalizeSocialUrl(raw, network) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    const handle = s.replace(/^@/, '').replace(/^\//, '');
    if (!handle) return '';
    if (network === 'facebook') {
      if (/facebook\.com|fb\.com/i.test(s)) return 'https://' + s.replace(/^\/\//, '');
      return 'https://www.facebook.com/' + handle;
    }
    if (network === 'instagram') {
      if (/instagram\.com/i.test(s)) return 'https://' + s.replace(/^\/\//, '');
      return 'https://www.instagram.com/' + handle;
    }
    return s;
  }

  function normalizeWebsiteUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    return 'https://' + s.replace(/^\/\//, '');
  }

  function validateWebsiteUrl(raw) {
    const normalized = normalizeWebsiteUrl(raw);
    if (!normalized) return { ok: true, value: '' };
    try {
      const u = new URL(normalized);
      if (!/^https?:$/i.test(u.protocol)) {
        return { ok: false, error: 'Indica una página web válida (http o https).' };
      }
      if (!u.hostname || !u.hostname.includes('.')) {
        return { ok: false, error: 'Indica una página web válida.' };
      }
      return { ok: true, value: normalized };
    } catch (_) {
      return { ok: false, error: 'Indica una página web válida.' };
    }
  }

  function validateSocialUrl(raw, network, label) {
    const normalized = normalizeSocialUrl(raw, network);
    if (!normalized) return { ok: true, value: '' };
    try {
      const u = new URL(normalized);
      const host = u.hostname.toLowerCase();
      if (network === 'facebook' && host.indexOf('facebook.com') < 0 && host.indexOf('fb.com') < 0) {
        return { ok: false, error: 'Indica un enlace de Facebook válido.' };
      }
      if (network === 'instagram' && host.indexOf('instagram.com') < 0) {
        return { ok: false, error: 'Indica un enlace de Instagram válido.' };
      }
      return { ok: true, value: normalized };
    } catch (_) {
      return { ok: false, error: 'Indica un enlace de ' + label + ' válido.' };
    }
  }

  function validate(data) {
    if (!data.companyName) return 'Indica el nombre comercial de la empresa.';
    if (!data.legalName) return 'Indica la razón social.';
    if (!data.contactName) return 'Indica la persona de contacto.';
    if (!data.contactEmail || !String(data.contactEmail).includes('@')) {
      return 'Indica un email de contacto válido.';
    }
    if (!data.contactPhone) return 'Indica un teléfono de contacto.';
    if (data.socialError) return data.socialError;
    if (!data.selectedServices || !data.selectedServices.length) {
      return 'Marca al menos un servicio de publicidad que te interese.';
    }
    return null;
  }

  function formatServiceLine(s) {
    if (!s || !s.label) return '';
    if (s.noPrice || !String(s.price || '').trim()) return '☑ ' + s.label;
    return '☑ ' + s.label + ' — Precio ref.: ' + s.price;
  }

  function formatServiceNotifyValue(s) {
    if (!s || !s.label) return '';
    if (s.noPrice || !String(s.price || '').trim()) return s.label;
    return s.label + ' — ' + s.price;
  }

  function formatMailBody(data) {
    const serviceLines = (data.selectedServices || []).map(formatServiceLine).filter(Boolean);
    const fileLines = [];
    if (data.files && data.files.length) {
      data.files.forEach(function (f) {
        fileLines.push('• ' + f.name + ' (' + formatFileSize(f.size) + ') — adjunto en el correo al club');
      });
    }

    if (global.ClubMailto && global.ClubMailto.formatStructuredEmail) {
      const sections = [
        {
          heading: 'DATOS DE LA EMPRESA',
          fields: [
            { label: 'Nombre comercial', value: data.companyName },
            { label: 'Razón social', value: data.legalName }
          ]
        },
        {
          heading: 'PERSONA DE CONTACTO',
          fields: [
            { label: 'Nombre', value: data.contactName },
            { label: 'Email', value: data.contactEmail },
            { label: 'Teléfono', value: data.contactPhone }
          ]
        }
      ];
      if (data.website) sections[1].fields.push({ label: 'Página web', value: data.website });
      if (data.facebook) sections[1].fields.push({ label: 'Facebook', value: data.facebook });
      if (data.instagram) sections[1].fields.push({ label: 'Instagram', value: data.instagram });
      sections.push({
        heading: 'SERVICIOS SOLICITADOS',
        lines: serviceLines.length ? serviceLines : ['(Ninguno marcado)']
      });
      if (fileLines.length) {
        sections.push({
          heading: 'ARCHIVOS ADJUNTOS',
          lines: fileLines
        });
      }
      return global.ClubMailto.formatStructuredEmail({
        title: 'SOLICITUD COLABORADOR / PUBLICIDAD',
        sections: sections,
        footerLines: ['Solicitud enviada desde la web del club.'],
        requesterEmail: data.contactEmail
      });
    }

    const lines = [
      '══════════════════════════════════════════',
      '  SOLICITUD COLABORADOR / PUBLICIDAD',
      '  CD Sanabria CF',
      '══════════════════════════════════════════',
      '',
      '── DATOS DE LA EMPRESA ──',
      'Nombre comercial: ' + (data.companyName || ''),
      'Razón social:     ' + (data.legalName || ''),
      '',
      '── PERSONA DE CONTACTO ──',
      'Nombre:    ' + (data.contactName || ''),
      'Email:     ' + (data.contactEmail || ''),
      'Teléfono:  ' + (data.contactPhone || '')
    ];
    if (data.website) lines.push('Página web: ' + data.website);
    if (data.facebook) lines.push('Facebook:  ' + data.facebook);
    if (data.instagram) lines.push('Instagram: ' + data.instagram);
    lines.push('', '── SERVICIOS SOLICITADOS ──');
    serviceLines.forEach(function (ln) {
      lines.push(ln);
    });
    if (fileLines.length) {
      lines.push('', '── ARCHIVOS ADJUNTOS ──');
      fileLines.forEach(function (ln) {
        lines.push(ln);
      });
    }
    lines.push(
      '',
      '── NOTAS ──',
      'Solicitud enviada desde la web del club.',
      'Fecha: ' + new Date().toLocaleString('es-ES'),
      '',
      '══════════════════════════════════════════'
    );
    return lines.join('\r\n');
  }

  function saveSubmission(data) {
    try {
      const list = JSON.parse(global.localStorage.getItem(SUBMISSIONS_KEY) || '[]');
      list.push({
        id: 'colab_' + Date.now(),
        createdAt: new Date().toISOString(),
        companyName: data.companyName,
        legalName: data.legalName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        website: data.website || '',
        facebook: data.facebook || '',
        instagram: data.instagram || '',
        selectedServices: data.selectedServices || [],
        services: (data.selectedServices || []).map(function (s) {
          return s.label;
        }),
        fileNames: (data.files || []).map(function (f) {
          return f.name;
        })
      });
      global.localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(list.slice(-100)));
    } catch (_) {}
  }

  async function collectFormData(formEl) {
    const cfg = readConfig();
    const selectedServices = [];
    cfg.services.forEach(function (svc) {
      const cb = formEl.querySelector('#colab_svc_' + svc.id);
      if (cb && cb.checked) {
        selectedServices.push({
          id: svc.id,
          label: svc.label,
          price: serviceShowsPrice(svc) ? publicDisplayPrice(svc.defaultPrice) : '',
          noPrice: !serviceShowsPrice(svc)
        });
      }
    });

    const websiteCheck = validateWebsiteUrl((formEl.querySelector('#colabWebsite') || {}).value);
    const facebookCheck = validateSocialUrl(
      (formEl.querySelector('#colabFacebook') || {}).value,
      'facebook',
      'Facebook'
    );
    const instagramCheck = validateSocialUrl(
      (formEl.querySelector('#colabInstagram') || {}).value,
      'instagram',
      'Instagram'
    );
    if (!websiteCheck.ok) {
      return { socialError: websiteCheck.error, selectedServices: selectedServices, files: [] };
    }
    if (!facebookCheck.ok) {
      return { socialError: facebookCheck.error, selectedServices: selectedServices, files: [] };
    }
    if (!instagramCheck.ok) {
      return { socialError: instagramCheck.error, selectedServices: selectedServices, files: [] };
    }

    const fileInput = formEl.querySelector('#colabFiles');
    const files = await collectFilesFromInput(fileInput);

    return {
      companyName: (formEl.querySelector('#colabCompanyName') || {}).value.trim(),
      legalName: (formEl.querySelector('#colabLegalName') || {}).value.trim(),
      contactName: (formEl.querySelector('#colabContactName') || {}).value.trim(),
      contactEmail: (formEl.querySelector('#colabContactEmail') || {}).value.trim(),
      contactPhone: (formEl.querySelector('#colabContactPhone') || {}).value.trim(),
      website: websiteCheck.value,
      facebook: facebookCheck.value,
      instagram: instagramCheck.value,
      selectedServices: selectedServices,
      files: files
    };
  }

  function renderServiceOptions(container) {
    if (!container) return;
    const cfg = readConfig();
    if (!cfg.services.length) {
      container.innerHTML = '<p style="color:#64748b;margin:0;">No hay opciones configuradas. Contacta con el club.</p>';
      return;
    }
    container.innerHTML = cfg.services
      .map(function (svc) {
        const showPrice = serviceShowsPrice(svc);
        const price = showPrice ? escapeHtml(publicDisplayPrice(svc.defaultPrice)) : '';
        const defaultChecked = String(svc.id || '') === 'renovacion' ? ' checked' : '';
        const rowClass =
          'colab-service-row' + (showPrice ? '' : ' colab-service-row--no-price');
        return (
          '<label class="' +
          rowClass +
          '">' +
          '<input type="checkbox" id="colab_svc_' +
          escapeAttr(svc.id) +
          '" name="colabService" value="' +
          escapeAttr(svc.id) +
          '"' +
          defaultChecked +
          '>' +
          '<span class="colab-service-label">' +
          escapeHtml(svc.label) +
          '</span>' +
          (showPrice
            ? '<span class="colab-service-price" aria-label="Precio de referencia">' + price + '</span>'
            : '') +
          '</label>'
        );
      })
      .join('');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return String(s || '').replace(/"/g, '&quot;');
  }

  async function notifyClubViaServer(data) {
    if (!global.CdsanClubEmail || !global.CdsanClubEmail.sendClubAdminNotify) {
      return { sent: false };
    }
    const fields = [
      { label: 'Nombre comercial', value: data.companyName },
      { label: 'Razón social', value: data.legalName },
      { label: 'Contacto', value: data.contactName },
      { label: 'Email', value: data.contactEmail },
      { label: 'Teléfono', value: data.contactPhone }
    ];
    if (data.website) fields.push({ label: 'Página web', value: data.website });
    if (data.facebook) fields.push({ label: 'Facebook', value: data.facebook });
    if (data.instagram) fields.push({ label: 'Instagram', value: data.instagram });
    (data.selectedServices || []).forEach(function (s) {
      fields.push({ label: 'Servicio', value: formatServiceNotifyValue(s) });
    });
    (data.files || []).forEach(function (f) {
      fields.push({ label: 'Archivo adjunto', value: f.name + ' (' + formatFileSize(f.size) + ')' });
    });
    try {
      const res = await global.CdsanClubEmail.sendClubAdminNotify({
        kind: 'colaborador_publicidad',
        title: 'Solicitud colaborador / publicidad',
        subject: 'Solicitud colaborador/publicidad — ' + (data.companyName || data.legalName || 'Empresa'),
        paymentChannel: 'consulta',
        requesterEmail: data.contactEmail,
        fields: fields,
        attachments: (data.files || []).map(function (f) {
          return {
            filename: f.filename || f.name,
            type: f.type,
            contentBase64: f.contentBase64
          };
        })
      });
      return { sent: !!(res && res.ok !== false && res.sent !== false) };
    } catch (e) {
      console.warn('Colaborador notify:', e);
      return { sent: false };
    }
  }

  async function submitFromForm(formEl) {
    if (!formEl) throw new Error('Formulario no encontrado.');
    const data = await collectFormData(formEl);
    const err = validate(data);
    if (err) throw new Error(err);

    saveSubmission(data);

    const subject =
      'Solicitud colaborador/publicidad — ' + (data.companyName || data.legalName || 'Empresa');
    const body = formatMailBody(data);
    const mailto =
      global.ClubMailto && global.ClubMailto.buildNotifyClubMailto
        ? global.ClubMailto.buildNotifyClubMailto({
            subject: subject,
            requesterEmail: data.contactEmail,
            body: body
          })
        : buildMailtoUrl(getClubNotifyEmail(), data.contactEmail, subject, body);
    if (!mailto) throw new Error('Email del club no configurado.');

    return { data: data, mailtoUrl: mailto };
  }

  function readSubmissions() {
    try {
      return JSON.parse(global.localStorage.getItem(SUBMISSIONS_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function buildPreviewSample() {
    const cfg = readConfig();
    const services = (cfg.services || []).map(function (s) {
      const showPrice = serviceShowsPrice(s);
      return {
        id: s.id,
        label: s.label,
        price: showPrice ? publicDisplayPrice(s.defaultPrice) : '',
        noPrice: !showPrice
      };
    });
    if (!services.length) {
      services.push({ id: 'renovacion', label: 'Renovación', price: '50,00 €', noPrice: false });
      services.push({
        id: 'interes_colaborador',
        label: INTERES_COLABORADOR_SVC.label,
        price: '',
        noPrice: true
      });
    }
    return {
      companyName: 'Empresa Ejemplo S.L.',
      legalName: 'Empresa Ejemplo Publicidad S.L.',
      contactName: 'María García',
      contactEmail: 'contacto@empresa-ejemplo.es',
      contactPhone: '600 000 000',
      website: 'https://www.empresa-ejemplo.es',
      facebook: 'https://www.facebook.com/empresa-ejemplo',
      instagram: 'https://www.instagram.com/empresa_ejemplo',
      selectedServices: services,
      files: [
        { name: 'catalogo-publicidad.pdf', size: 245760 },
        { name: 'logo-empresa.jpg', size: 98304 }
      ]
    };
  }

  function openMailto(url) {
    if (global.ClubMailto && global.ClubMailto.openMailto) {
      return global.ClubMailto.openMailto(url);
    }
    if (!url) return false;
    global.location.href = url;
    return true;
  }

  global.ColaboradorSolicitud = {
    CONFIG_KEY: CONFIG_KEY,
    SUBMISSIONS_KEY: SUBMISSIONS_KEY,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    normalizeSocialUrl: normalizeSocialUrl,
    normalizeWebsiteUrl: normalizeWebsiteUrl,
    validateWebsiteUrl: validateWebsiteUrl,
    validateSocialUrl: validateSocialUrl,
    readConfig: readConfig,
    saveConfig: saveConfig,
    readSubmissions: readSubmissions,
    buildPreviewSample: buildPreviewSample,
    renderServiceOptions: renderServiceOptions,
    validate: validate,
    formatMailBody: formatMailBody,
    formatServiceLine: formatServiceLine,
    notifyClubViaServer: notifyClubViaServer,
    submitFromForm: submitFromForm,
    openMailto: openMailto,
    getClubNotifyEmail: getClubNotifyEmail
  };

  global.addEventListener('settingsBlobUpdated', function () {
    const box = global.document && global.document.getElementById('colabServicesBox');
    if (box) renderServiceOptions(box);
  });
})(typeof window !== 'undefined' ? window : globalThis);
