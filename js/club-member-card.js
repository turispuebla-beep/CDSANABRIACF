/**
 * Carnet virtual de socio — CD Sanabria CF
 * Solo el socio logueado ve/descarga SU carnet (sesión currentSocio).
 * Admin: vista desde panel con sesión currentAdmin.
 */
(function (global) {
  'use strict';

  const CLUB_NAME = 'CD Sanabria CF';
  const ESCUDO_SRC = 'assets/escudo-192.png';
  let libsLoading = null;

  /** Ruta absoluta en file:// (vista previa local); relativa en http(s). */
  function resolveEscudoSrc() {
    try {
      if (typeof location !== 'undefined' && location.href) {
        return new URL(ESCUDO_SRC, location.href).href;
      }
    } catch (_) {}
    return ESCUDO_SRC;
  }

  /** crossorigin rompe la carga del escudo con protocolo file:// */
  function escudoCrossOriginAttr() {
    try {
      if (typeof location !== 'undefined' && location.protocol === 'file:') return '';
    } catch (_) {}
    return ' crossorigin="anonymous"';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 'hombre' | 'mujer' | null */
  function normalizeSexo(m) {
    if (!m) return null;
    const raw = String(m.sexo || m.genero || m.gender || '')
      .trim()
      .toLowerCase();
    if (!raw) return null;
    if (['mujer', 'f', 'femenino', 'female', 'fem'].includes(raw)) return 'mujer';
    if (['hombre', 'm', 'masculino', 'male', 'masc'].includes(raw)) return 'hombre';
    return null;
  }

  function stripHonorificPrefix(fullName) {
    return String(fullName || '')
      .trim()
      .replace(/^(dña\.?|doña|d\.?|don|sr\.?|sra\.?|srta\.?)\s+/i, '')
      .trim();
  }

  /** Nombre completo en carnet: D. / Dña. según sexo del socio. */
  function formatCardDisplayName(m) {
    const base =
      [m.nombre || m.name, m.apellidos || m.surname].filter(Boolean).join(' ').trim() ||
      stripHonorificPrefix(m.nombreCompleto || m.fullName || '') ||
      'Socio/a';
    const clean = stripHonorificPrefix(base);
    const sexo = normalizeSexo(m);
    if (sexo === 'mujer') return 'Dña. ' + clean;
    if (sexo === 'hombre') return 'D. ' + clean;
    return clean;
  }

  function getSessionSocio() {
    try {
      return JSON.parse(localStorage.getItem('currentSocio') || 'null');
    } catch (_) {
      return null;
    }
  }

  function getSessionAdmin() {
    try {
      const a = JSON.parse(localStorage.getItem('currentAdmin') || 'null');
      return a && a.email ? a : null;
    } catch (_) {
      return null;
    }
  }

  /** Datos del socio en sesión — nunca otro id/email. */
  function resolveMemberForCurrentSocio() {
    const session = getSessionSocio();
    if (!session || !session.id || !session.email) return null;
    const sid = String(session.id);
    const semail = String(session.email).trim().toLowerCase();
    let full = null;
    try {
      const list = JSON.parse(localStorage.getItem('clubMembers') || '[]');
      full = list.find(function (m) {
        return String(m.id) === sid && String(m.email || '').trim().toLowerCase() === semail;
      });
    } catch (_) {}
    const m = full ? Object.assign({}, full, session) : Object.assign({}, session);
    m.nombre = m.nombre || m.name || session.nombre || '';
    m.apellidos = m.apellidos || m.surname || session.apellidos || '';
    m.dni = m.dni || session.dni || '';
    m.numeroSocio = m.numeroSocio != null ? m.numeroSocio : m.memberNumber;
    m.estado = m.estado || m.status || session.estado;
    m.status = m.status || m.estado;
    m.socioDeHonor = m.socioDeHonor === true || session.socioDeHonor === true;
    m.numeroSocioHonor = m.numeroSocioHonor != null ? m.numeroSocioHonor : session.numeroSocioHonor;
    m.sexo = m.sexo || session.sexo || m.genero || session.genero || '';
    return m;
  }

  function isActiveMember(m) {
    const st = String(m.status || m.estado || '').toLowerCase();
    return ['active', 'activo', 'activa'].includes(st);
  }

  function hasDefinitiveNumber(m) {
    const CMN = global.ClubMemberNumbers;
    if (CMN) {
      if (CMN.isSocioDeHonor(m) && CMN.getHonorNumber(m) != null) return true;
      const r = CMN.getRegularNumber(m);
      if (r != null && r >= CMN.REGULAR_MIN) return true;
    }
    const raw = m.numeroSocio != null ? m.numeroSocio : m.memberNumber;
    if (raw == null || raw === '') return false;
    if (String(raw).toUpperCase().startsWith('SOC')) return false;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1;
  }

  function getEligibility(m) {
    if (!m) return { ok: false, reason: 'Debes iniciar sesión como socio/a.' };
    if (!isActiveMember(m)) {
      return {
        ok: false,
        reason: 'Tu carnet estará disponible cuando tu alta esté activa (pago confirmado o validación del club).'
      };
    }
    if (!hasDefinitiveNumber(m)) {
      return {
        ok: false,
        reason: 'Aún no tienes número de socio definitivo. Si acabas de registrarte, espera a que se valide el pago.'
      };
    }
    return { ok: true };
  }

  function buildCardPayload(m) {
    const CMN = global.ClubMemberNumbers;
    const honor = CMN && CMN.isSocioDeHonor(m);
    const honorNum = honor && CMN ? CMN.getHonorNumber(m) : null;
    let numLabel = '—';
    if (honor && honorNum != null) {
      numLabel = 'SOCIO DE HONOR · N.º SOC. ' + CMN.padSocNum(honorNum);
    } else if (CMN) {
      const r = CMN.getRegularNumber(m) || CMN.getDisplayNumber(m);
      numLabel = r != null ? 'N.º SOC. ' + CMN.padSocNum(r) : '—';
    } else {
      const raw = m.numeroSocio || m.memberNumber;
      numLabel = raw && !String(raw).startsWith('SOC') ? 'N.º SOC. ' + String(raw).padStart(6, '0') : '—';
    }
    const nombre = formatCardDisplayName(m);
    return {
      nombre: nombre,
      dni: String(m.dni || '—').trim() || '—',
      numLabel: numLabel,
      honor: !!honor,
      temporada: new Date().getFullYear() + '–' + (new Date().getFullYear() + 1)
    };
  }

  function cardMarkup(payload, cardId) {
    const id = cardId || 'cdsanMemberCardCanvas';
    const honorBadge = payload.honor
      ? '<div class="cdsan-card-honor">🏅 SOCIO DE HONOR</div>'
      : '';
    return (
      '<div id="' +
      id +
      '" class="cdsan-member-card" role="img" aria-label="Carnet de socio CD Sanabria CF">' +
      '<div class="cdsan-card-band" aria-hidden="true"></div>' +
      '<div class="cdsan-card-inner">' +
      '<div class="cdsan-card-top">' +
      '<div class="cdsan-card-escudo-wrap">' +
      '<img class="cdsan-card-escudo" src="' +
      escapeHtml(resolveEscudoSrc()) +
      '" alt="Escudo ' +
      escapeHtml(CLUB_NAME) +
      '"' +
      escudoCrossOriginAttr() +
      ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
      '<div class="cdsan-card-escudo-fallback" style="display:none">⚽</div>' +
      '</div>' +
      '<div class="cdsan-card-club">' +
      '<div class="cdsan-card-club-name">' +
      escapeHtml(CLUB_NAME) +
      '</div>' +
      '<div class="cdsan-card-club-sub">Carnet de socio/a</div>' +
      '</div>' +
      '</div>' +
      honorBadge +
      '<div class="cdsan-card-name">' +
      escapeHtml(payload.nombre) +
      '</div>' +
      '<div class="cdsan-card-dni">DNI / NIF: ' +
      escapeHtml(payload.dni) +
      '</div>' +
      '<div class="cdsan-card-num">' +
      escapeHtml(payload.numLabel) +
      '</div>' +
      '<div class="cdsan-card-footer">Temporada ' +
      escapeHtml(payload.temporada) +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  function injectStyles() {
    if (document.getElementById('cdsan-member-card-styles')) return;
    const style = document.createElement('style');
    style.id = 'cdsan-member-card-styles';
    style.textContent =
      '.cdsan-member-card{position:relative;width:430px;max-width:100%;height:270px;border-radius:16px;overflow:hidden;' +
      'background:#dc2626;box-shadow:0 12px 32px rgba(0,0,0,.25);font-family:system-ui,-apple-system,Segoe UI,sans-serif}' +
      '.cdsan-card-band{position:absolute;left:0;bottom:0;width:200%;height:22%;background:#fff;' +
      'transform:rotate(-32deg);transform-origin:0% 100%;opacity:.98;pointer-events:none;z-index:1}' +
      '.cdsan-card-inner{position:relative;z-index:2;height:100%;padding:18px 20px;box-sizing:border-box;' +
      'display:flex;flex-direction:column;color:#fff}' +
      '.cdsan-card-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:8px}' +
      '.cdsan-card-escudo-wrap{width:64px;height:64px;flex-shrink:0}' +
      '.cdsan-card-escudo{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))}' +
      '.cdsan-card-escudo-fallback{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.15);' +
      'align-items:center;justify-content:center;font-size:2rem}' +
      '.cdsan-card-club{flex:1;text-align:right}' +
      '.cdsan-card-club-name{font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;line-height:1.2;color:#0f172a}' +
      '.cdsan-card-club-sub{font-size:.65rem;color:#334155;margin-top:2px;opacity:1}' +
      '.cdsan-card-honor{align-self:flex-start;background:#fef3c7;color:#92400e;font-size:.68rem;font-weight:800;' +
      'padding:3px 10px;border-radius:999px;margin-bottom:6px;letter-spacing:.03em}' +
      '.cdsan-card-name{font-size:1.15rem;font-weight:800;line-height:1.2;margin-top:auto;color:#0f172a;text-shadow:none}' +
      '.cdsan-card-dni{font-size:.78rem;color:#1e293b;margin-top:6px;opacity:1}' +
      '.cdsan-card-num{font-size:1rem;font-weight:800;margin-top:8px;letter-spacing:.02em;color:#0f172a}' +
      '.cdsan-card-footer{font-size:.62rem;color:#475569;margin-top:auto;padding-top:6px;opacity:1}' +
      '#cdsanCardModalOverlay{position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:10050;' +
      'display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}' +
      '#cdsanCardModalBox{background:#fff;border-radius:16px;padding:20px;max-width:480px;width:100%;' +
      'max-height:95vh;overflow-y:auto;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.3)}' +
      '.cdsan-card-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:16px}' +
      '.cdsan-card-btn{padding:10px 18px;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem}' +
      '.cdsan-card-btn--jpg{background:#059669;color:#fff}.cdsan-card-btn--pdf{background:#1e3a8a;color:#fff}' +
      '.cdsan-card-btn--close{background:#6b7280;color:#fff}' +
      '.cdsan-carnet-inline-wrap{margin:16px auto;max-width:430px}' +
      '.cdsan-carnet-unavailable{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;' +
      'padding:12px;border-radius:10px;font-size:.9rem;margin:12px 0}';
    document.head.appendChild(style);
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('No se pudo cargar ' + url));
      };
      document.head.appendChild(s);
    });
  }

  function loadExportLibs() {
    if (global.html2canvas && global.jspdf && global.jspdf.jsPDF) {
      return Promise.resolve();
    }
    if (libsLoading) return libsLoading;
    libsLoading = loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
      .then(function () {
        return loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
      });
    return libsLoading;
  }

  function captureCardCanvas(cardEl) {
    return loadExportLibs().then(function () {
      return global.html2canvas(cardEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#dc2626',
        logging: false
      });
    });
  }

  function downloadJpg(cardEl, fileBase) {
    return captureCardCanvas(cardEl).then(function (canvas) {
      const link = document.createElement('a');
      link.download = (fileBase || 'carnet-socio') + '.jpg';
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.click();
    });
  }

  function downloadPdf(cardEl, fileBase) {
    return captureCardCanvas(cardEl).then(function (canvas) {
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const jsPDF = global.jspdf.jsPDF;
      const w = 85.6;
      const h = 53.98;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [h, w] });
      pdf.addImage(img, 'JPEG', 0, 0, w, h);
      pdf.save((fileBase || 'carnet-socio') + '.pdf');
    });
  }

  function fileBaseFromPayload(payload) {
    const slug = payload.nombre
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40);
    return 'carnet-' + (slug || 'socio');
  }

  function closeModal() {
    const el = document.getElementById('cdsanCardModalOverlay');
    if (el) el.remove();
  }

  function showCardModal(memberOrPayload, options) {
    injectStyles();
    options = options || {};
    const m = memberOrPayload;
    const payload = m.nombre != null && m.numLabel != null ? m : buildCardPayload(m);
    const cardId = 'cdsanMemberCardExport';
    closeModal();
    const overlay = document.createElement('div');
    overlay.id = 'cdsanCardModalOverlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    const adminNote = options.adminPreview
      ? '<p style="font-size:.8rem;color:#64748b;margin:0 0 10px">Vista administrador (solo consulta)</p>'
      : '';
    overlay.innerHTML =
      '<div id="cdsanCardModalBox" role="dialog" aria-labelledby="cdsanCardModalTitle">' +
      '<h2 id="cdsanCardModalTitle" style="margin:0 0 12px;color:#1e3a8a;font-size:1.15rem">🎫 Carnet de socio/a</h2>' +
      adminNote +
      '<div class="cdsan-carnet-inline-wrap">' +
      cardMarkup(payload, cardId) +
      '</div>' +
      '<div class="cdsan-card-actions">' +
      '<button type="button" class="cdsan-card-btn cdsan-card-btn--jpg" id="cdsanBtnJpg">⬇️ Descargar JPG</button>' +
      '<button type="button" class="cdsan-card-btn cdsan-card-btn--pdf" id="cdsanBtnPdf">⬇️ Descargar PDF</button>' +
      '<button type="button" class="cdsan-card-btn cdsan-card-btn--close" id="cdsanBtnClose">Cerrar</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    const cardEl = document.getElementById(cardId);
    const base = fileBaseFromPayload(payload);
    document.getElementById('cdsanBtnClose').onclick = closeModal;
    document.getElementById('cdsanBtnJpg').onclick = function () {
      const btn = this;
      btn.disabled = true;
      downloadJpg(cardEl, base)
        .catch(function (e) {
          alert('No se pudo generar el JPG: ' + (e.message || e));
        })
        .finally(function () {
          btn.disabled = false;
        });
    };
    document.getElementById('cdsanBtnPdf').onclick = function () {
      const btn = this;
      btn.disabled = true;
      downloadPdf(cardEl, base)
        .catch(function (e) {
          alert('No se pudo generar el PDF: ' + (e.message || e));
        })
        .finally(function () {
          btn.disabled = false;
        });
    };
  }

  function openForCurrentSession() {
    const m = resolveMemberForCurrentSocio();
    const elig = getEligibility(m);
    if (!elig.ok) return { ok: false, message: elig.reason };
    showCardModal(m, { adminPreview: false });
    return { ok: true };
  }

  function openForAdminMember(member) {
    if (!getSessionAdmin()) return { ok: false, message: 'Sesión de administrador no activa.' };
    if (!member || !member.id) return { ok: false, message: 'Socio no válido.' };
    const elig = getEligibility(member);
    if (!elig.ok) {
      return { ok: false, message: 'Este socio aún no puede tener carnet: ' + elig.reason };
    }
    showCardModal(member, { adminPreview: true });
    return { ok: true };
  }

  function renderInlineCardHtml() {
    const m = resolveMemberForCurrentSocio();
    const elig = getEligibility(m);
    if (!elig.ok) {
      return (
        '<div class="cdsan-carnet-unavailable">🎫 <strong>Mi carnet:</strong> ' + escapeHtml(elig.reason) + '</div>'
      );
    }
    injectStyles();
    return (
      '<div class="cdsan-carnet-inline-wrap" style="margin:16px auto">' +
      cardMarkup(buildCardPayload(m), 'cdsanMemberCardInline') +
      '<div class="cdsan-card-actions" style="margin-top:12px">' +
      '<button type="button" class="cdsan-card-btn cdsan-card-btn--jpg" onclick="memberCardGenerator.openForCurrentSession()">🎫 Ver carnet grande</button>' +
      '<button type="button" class="cdsan-card-btn cdsan-card-btn--jpg" onclick="memberCardGenerator.downloadJpgCurrent()">⬇️ JPG</button>' +
      '<button type="button" class="cdsan-card-btn cdsan-card-btn--pdf" onclick="memberCardGenerator.downloadPdfCurrent()">⬇️ PDF</button>' +
      '</div></div>'
    );
  }

  function downloadJpgCurrent() {
    const m = resolveMemberForCurrentSocio();
    const elig = getEligibility(m);
    if (!elig.ok) {
      alert(elig.reason);
      return;
    }
    injectStyles();
    let wrap = document.getElementById('cdsanCardHiddenExport');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'cdsanCardHiddenExport';
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
      document.body.appendChild(wrap);
    }
    const payload = buildCardPayload(m);
    wrap.innerHTML = cardMarkup(payload, 'cdsanMemberCardHidden');
    const cardEl = document.getElementById('cdsanMemberCardHidden');
    downloadJpg(cardEl, fileBaseFromPayload(payload)).catch(function (e) {
      alert('No se pudo descargar: ' + (e.message || e));
    });
  }

  function downloadPdfCurrent() {
    const m = resolveMemberForCurrentSocio();
    const elig = getEligibility(m);
    if (!elig.ok) {
      alert(elig.reason);
      return;
    }
    injectStyles();
    let wrap = document.getElementById('cdsanCardHiddenExport');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'cdsanCardHiddenExport';
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
      document.body.appendChild(wrap);
    }
    const payload = buildCardPayload(m);
    wrap.innerHTML = cardMarkup(payload, 'cdsanMemberCardHidden');
    const cardEl = document.getElementById('cdsanMemberCardHidden');
    downloadPdf(cardEl, fileBaseFromPayload(payload)).catch(function (e) {
      alert('No se pudo descargar: ' + (e.message || e));
    });
  }

  /** Vista previa local (preview-carnet-socio.html) */
  function renderPreviewCard(containerId, memberData, cardDomId) {
    injectStyles();
    const m = memberData || {};
    const payload = buildCardPayload(m);
    const host = document.getElementById(containerId);
    if (!host) return;
    host.innerHTML = cardMarkup(payload, cardDomId || 'cdsanPreviewCard');
  }

  global.memberCardGenerator = {
    openForCurrentSession: openForCurrentSession,
    openForAdminMember: openForAdminMember,
    showCardModal: showCardModal,
    renderInlineCardHtml: renderInlineCardHtml,
    renderPreviewCard: renderPreviewCard,
    downloadJpgCurrent: downloadJpgCurrent,
    downloadPdfCurrent: downloadPdfCurrent,
    getEligibility: function () {
      return getEligibility(resolveMemberForCurrentSocio());
    },
    canShowCard: function () {
      return getEligibility(resolveMemberForCurrentSocio()).ok;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
