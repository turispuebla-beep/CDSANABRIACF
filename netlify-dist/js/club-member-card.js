/**
 * Carnet virtual de socio — CD Sanabria CF
 * Plantilla: assets/CARNET DE SOCIO.jpg
 * Cara: datos + QR asistencia. Dorso: publicidad (p. ej. MAESTRE) 5 s en bucle.
 * Socio-jugador: «· JUGADOR» en Nº SOCIO. Honor (1–50): «HONORÍFICO» dorado bajo el nombre.
 */
(function (global) {
  'use strict';

  const CLUB_NAME = 'CD Sanabria CF';
  const CARNET_BG = 'assets/CARNET DE SOCIO.jpg';
  const CARNET_AD = 'assets/anunciantes/MAESTRE.JPG';
  const FLIP_BACK_MS = 5000;
  const FLIP_FRONT_MS = 9000;
  const QR_CDN = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';

  let libsLoading = null;
  let qrLibLoading = null;
  const flipTimers = {};

  function resolveAssetSrc(relPath) {
    try {
      if (typeof location !== 'undefined' && location.href) {
        return new URL(relPath, location.href).href;
      }
    } catch (_) {}
    return encodeURI(relPath);
  }

  function resolveCarnetBgSrc() {
    return resolveAssetSrc(CARNET_BG);
  }

  function resolveAdSrc() {
    return resolveAssetSrc(CARNET_AD);
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
    m.socioJugador = !!(m.socioJugador || m.isJugador || session.socioJugador || session.isJugador);
    m.isJugador = !!(m.isJugador || m.socioJugador);
    m.memberKind = m.memberKind || session.memberKind || '';
    m.playerId = m.playerId || session.playerId || null;
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
      const d = CMN.getDisplayNumber(m);
      if (d != null && d >= 1) return true;
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

  function isSocioJugadorMember(m) {
    if (!m) return false;
    if (m.socioJugador === true || m.isJugador === true) return true;
    const kind = String(m.memberKind || '').toLowerCase();
    if (kind === 'jugador' || kind === 'player') return true;
    if (m.playerId) return true;
    return false;
  }

  function isHonorMember(m) {
    const CMN = global.ClubMemberNumbers;
    if (CMN) {
      if (CMN.isSocioDeHonor(m)) return true;
      const h = CMN.getHonorNumber(m);
      if (h != null) return true;
      const n = CMN.getDisplayNumber(m);
      if (n != null && n >= CMN.HONOR_MIN && n <= CMN.HONOR_MAX) return true;
    }
    if (m && (m.socioDeHonor === true || m.membershipTier === 'honor')) return true;
    const raw =
      m &&
      (m.numeroSocioHonor != null ? m.numeroSocioHonor : m.numeroSocio != null ? m.numeroSocio : m.memberNumber);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 && n <= 50;
  }

  function resolveSeasonLabel(m) {
    if (m && (m.inscriptionSeasonSocio || m.inscriptionSeason || m.temporada || m.season)) {
      return String(m.inscriptionSeasonSocio || m.inscriptionSeason || m.temporada || m.season).trim();
    }
    try {
      if (global.ClubInscriptionConfig && typeof global.ClubInscriptionConfig.read === 'function') {
        const s = global.ClubInscriptionConfig.read();
        if (s && s.season) return String(s.season).trim();
      }
    } catch (_) {}
    const y = new Date().getFullYear();
    const month = new Date().getMonth();
    if (month >= 6) return y + '-' + (y + 1);
    return y - 1 + '-' + y;
  }

  function resolvePaddedSocNum(m) {
    const CMN = global.ClubMemberNumbers;
    if (CMN) {
      if (isHonorMember(m)) {
        const h = CMN.getHonorNumber(m);
        if (h != null) return CMN.padSocNum(h);
      }
      const r = CMN.getRegularNumber(m) || CMN.getDisplayNumber(m);
      if (r != null) return CMN.padSocNum(r);
    }
    const raw =
      m.numeroSocioHonor != null && isHonorMember(m)
        ? m.numeroSocioHonor
        : m.numeroSocio != null
          ? m.numeroSocio
          : m.memberNumber;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1) return String(n).padStart(6, '0');
    return '—';
  }

  function resolveMemberTipo(m) {
    if (isHonorMember(m)) return 'honorifico';
    if (isSocioJugadorMember(m)) return 'jugador';
    return 'socio';
  }

  function memberTipoLabel(tipo) {
    if (tipo === 'honorifico') return 'Socio de honor';
    if (tipo === 'jugador') return 'Socio-jugador';
    return 'Socio/a';
  }

  function toBase64Url(str) {
    try {
      const b64 = btoa(unescape(encodeURIComponent(str)));
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    } catch (_) {
      return '';
    }
  }

  function buildAttendancePayload(m, cardPayload) {
    return {
      v: 1,
      id: m && m.id ? String(m.id) : '',
      nombre: cardPayload.nombre,
      dni: cardPayload.dni,
      num: resolvePaddedSocNum(m || {}),
      tipo: cardPayload.tipo,
      tipoLabel: memberTipoLabel(cardPayload.tipo),
      temp: cardPayload.temporada,
      club: CLUB_NAME
    };
  }

  function buildAttendanceUrl(m, cardPayload) {
    const data = buildAttendancePayload(m, cardPayload);
    let base = 'https://www.cdsanabriacf.com/carnet-asistencia.html';
    try {
      if (typeof location !== 'undefined' && location.protocol && location.protocol !== 'file:') {
        const host = String(location.hostname || '').toLowerCase();
        // En local/preview usamos el mismo origen para poder probar sin subir.
        if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
          base = new URL('carnet-asistencia.html', location.origin + '/').href;
        } else if (host) {
          base = new URL('carnet-asistencia.html', location.origin + '/').href;
        }
      }
    } catch (_) {}

    // Query simple (más fiable al escanear que un base64 largo).
    const q = new URLSearchParams();
    q.set('nombre', data.nombre || '');
    q.set('dni', data.dni || '');
    q.set('num', data.num || '');
    q.set('tipo', data.tipo || 'socio');
    q.set('temp', data.temp || '');
    if (data.id) q.set('id', data.id);
    return base + '?' + q.toString();
  }

  function buildCardPayload(m) {
    const honor = isHonorMember(m);
    const jugador = isSocioJugadorMember(m);
    const padded = resolvePaddedSocNum(m);
    let numLabel = padded;
    if (jugador && !honor) {
      numLabel = padded !== '—' ? padded + ' · JUGADOR' : 'JUGADOR';
    }
    const tipo = resolveMemberTipo(m);
    const payload = {
      nombre: formatCardDisplayName(m),
      dni: String(m.dni || '—').trim() || '—',
      numLabel: numLabel,
      honor: !!honor,
      jugador: !!jugador && !honor,
      temporada: resolveSeasonLabel(m),
      tipo: tipo,
      tipoLabel: memberTipoLabel(tipo),
      memberId: m && m.id ? String(m.id) : ''
    };
    payload.qrUrl = buildAttendanceUrl(m, payload);
    return payload;
  }

  function cardMarkup(payload, cardId) {
    const id = cardId || 'cdsanMemberCardCanvas';
    const honorLine = payload.honor ? '<div class="cdsan-card-honor-tag">HONORÍFICO</div>' : '';
    const nameClass =
      'cdsan-card-field-value cdsan-card-field-name' +
      (payload.honor ? ' cdsan-card-field-name--honor' : '') +
      (String(payload.nombre || '').length > 28 ? ' cdsan-card-field-name--long' : '');
    const numClass =
      'cdsan-card-field-value cdsan-card-field-num' +
      (payload.jugador ? ' cdsan-card-field-num--jugador' : '');
    const qrUrl = escapeHtml(payload.qrUrl || '');

    return (
      '<div id="' +
      id +
      '" class="cdsan-card-scene" data-flip-root="1" aria-label="Carnet de socio CD Sanabria CF">' +
      '<div class="cdsan-card-flipper">' +
      '<div class="cdsan-card-face cdsan-card-front cdsan-member-card">' +
      '<img class="cdsan-card-bg" src="' +
      escapeHtml(resolveCarnetBgSrc()) +
      '" alt="" draggable="false">' +
      '<div class="cdsan-card-qr-wrap" title="QR control de asistencia">' +
      '<canvas class="cdsan-card-qr" width="72" height="72" data-qr-url="' +
      qrUrl +
      '"></canvas>' +
      '</div>' +
      '<div class="cdsan-card-fields">' +
      '<div class="cdsan-card-field cdsan-card-field--nombre">' +
      '<div class="' +
      nameClass +
      '">' +
      escapeHtml(payload.nombre) +
      '</div>' +
      honorLine +
      '</div>' +
      '<div class="cdsan-card-field cdsan-card-field--dni">' +
      '<div class="cdsan-card-field-value">' +
      escapeHtml(payload.dni) +
      '</div>' +
      '</div>' +
      '<div class="cdsan-card-field cdsan-card-field--num">' +
      '<div class="' +
      numClass +
      '">' +
      escapeHtml(payload.numLabel) +
      '</div>' +
      '</div>' +
      '<div class="cdsan-card-field cdsan-card-field--temp">' +
      '<div class="cdsan-card-field-value">' +
      escapeHtml(payload.temporada) +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="cdsan-card-face cdsan-card-back" aria-hidden="true">' +
      '<div class="cdsan-card-back-inner">' +
      '<img class="cdsan-card-ad" src="' +
      escapeHtml(resolveAdSrc()) +
      '" alt="Patrocinador Talleres I. Maestre" draggable="false">' +
      '<div class="cdsan-card-ad-meta">' +
      '<span class="cdsan-card-ad-club">' +
      escapeHtml(CLUB_NAME) +
      '</span>' +
      '<span class="cdsan-card-ad-tag">Patrocinador oficial</span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  function injectStyles() {
    if (document.getElementById('cdsan-member-card-styles')) {
      document.getElementById('cdsan-member-card-styles').remove();
    }
    const style = document.createElement('style');
    style.id = 'cdsan-member-card-styles';
    style.textContent =
      '.cdsan-card-scene{perspective:1200px;width:560px;max-width:100%;margin:0 auto}' +
      '.cdsan-card-flipper{position:relative;width:100%;aspect-ratio:16/10;transform-style:preserve-3d;' +
      'transition:transform .7s ease;border-radius:14px}' +
      '.cdsan-card-scene.is-flipped .cdsan-card-flipper{transform:rotateY(180deg)}' +
      '.cdsan-card-face{position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;' +
      '-webkit-backface-visibility:hidden;border-radius:14px;overflow:hidden}' +
      '.cdsan-card-front.cdsan-member-card{position:absolute;box-shadow:0 12px 32px rgba(0,0,0,.28);' +
      'font-family:Montserrat,system-ui,-apple-system,Segoe UI,sans-serif;background:#8b0000}' +
      '.cdsan-card-back{transform:rotateY(180deg);background:linear-gradient(160deg,#111827,#1f2937 55%,#7f1d1d);' +
      'box-shadow:0 12px 32px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center}' +
      '.cdsan-card-back-inner{width:100%;height:100%;padding:8% 7%;box-sizing:border-box;display:flex;' +
      'flex-direction:column;align-items:center;justify-content:center;gap:10px}' +
      '.cdsan-card-ad{max-width:88%;max-height:68%;width:auto;height:auto;object-fit:contain;' +
      'background:#fff;border-radius:10px;padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,.35)}' +
      '.cdsan-card-ad-meta{display:flex;flex-direction:column;align-items:center;gap:2px}' +
      '.cdsan-card-ad-club{color:#fecaca;font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}' +
      '.cdsan-card-ad-tag{color:#fff;font-size:.8rem;font-weight:700;opacity:.92}' +
      '.cdsan-card-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;' +
      'display:block;pointer-events:none;user-select:none;z-index:1}' +
      '.cdsan-card-qr-wrap{position:absolute;top:2.4%;left:2.6%;z-index:3;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(255,255,255,.94);border-radius:7px;padding:3px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.25)}' +
      '.cdsan-card-qr{width:44px;height:44px;display:block;border-radius:3px}' +
      '.cdsan-card-fields{position:absolute;left:2.2%;right:2.2%;bottom:3.8%;height:16.5%;' +
      'display:grid;grid-template-columns:1.35fr 0.95fr 1.05fr 0.9fr;gap:0;z-index:2;' +
      'align-items:end;padding:0 1.2% 0.4%;box-sizing:border-box}' +
      '.cdsan-card-field{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;' +
      'min-width:0;padding:0 4px 2px;box-sizing:border-box;text-align:center}' +
      '.cdsan-card-field-value{color:#fff;font-weight:800;font-size:clamp(0.62rem,1.55vw,0.92rem);' +
      'line-height:1.15;letter-spacing:.01em;text-shadow:0 1px 2px rgba(0,0,0,.35);' +
      'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.cdsan-card-field-name{font-size:clamp(0.55rem,1.35vw,0.82rem);white-space:normal;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;text-overflow:ellipsis;' +
      'overflow:hidden;line-height:1.12}' +
      '.cdsan-card-field-name--long{font-size:clamp(0.48rem,1.15vw,0.72rem)}' +
      '.cdsan-card-field-name--honor{margin-bottom:1px}' +
      '.cdsan-card-honor-tag{margin-top:2px;font-size:clamp(0.55rem,1.25vw,0.78rem);font-weight:900;' +
      'letter-spacing:.08em;color:#f0d060;text-shadow:0 0 1px #8a6a00,0 1px 2px rgba(0,0,0,.45);' +
      'line-height:1.1}' +
      '.cdsan-card-field-num--jugador{font-size:clamp(0.52rem,1.25vw,0.78rem);letter-spacing:.01em}' +
      '#cdsanCardModalOverlay{position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:10050;' +
      'display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}' +
      '#cdsanCardModalBox{background:#fff;border-radius:16px;padding:20px;max-width:620px;width:100%;' +
      'max-height:95vh;overflow-y:auto;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.3)}' +
      '.cdsan-card-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:16px}' +
      '.cdsan-card-btn{padding:10px 18px;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem}' +
      '.cdsan-card-btn--jpg{background:#059669;color:#fff}.cdsan-card-btn--pdf{background:#1e3a8a;color:#fff}' +
      '.cdsan-card-btn--close{background:#6b7280;color:#fff}' +
      '.cdsan-carnet-inline-wrap{margin:16px auto;max-width:560px}' +
      '.cdsan-carnet-unavailable{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;' +
      'padding:12px;border-radius:10px;font-size:.9rem;margin:12px 0}' +
      '@media (max-width:560px){.cdsan-card-fields{height:18%;bottom:3.2%}' +
      '.cdsan-card-qr{width:38px;height:38px}' +
      '.cdsan-card-field-value{font-size:clamp(0.48rem,2.6vw,0.72rem)}}' +
      '@media (prefers-reduced-motion:reduce){.cdsan-card-flipper{transition:none}}';
    document.head.appendChild(style);
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[src="' + url + '"]');
      if (existing && ((url.indexOf('qrcode') >= 0 && global.QRCode) || (url.indexOf('html2canvas') >= 0 && global.html2canvas))) {
        resolve();
        return;
      }
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
    libsLoading = loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js').then(
      function () {
        return loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
      }
    );
    return libsLoading;
  }

  function loadQrLib() {
    if (global.QRCode && typeof global.QRCode.toCanvas === 'function') {
      return Promise.resolve(global.QRCode);
    }
    if (qrLibLoading) return qrLibLoading;
    qrLibLoading = loadScript(QR_CDN).then(function () {
      return global.QRCode;
    });
    return qrLibLoading;
  }

  function stopFlipCycle(rootId) {
    const t = flipTimers[rootId];
    if (t) {
      if (t.timeout) clearTimeout(t.timeout);
      delete flipTimers[rootId];
    }
    const el = document.getElementById(rootId);
    if (el) el.classList.remove('is-flipped');
  }

  function startFlipCycle(rootId) {
    stopFlipCycle(rootId);
    const el = document.getElementById(rootId);
    if (!el || !el.getAttribute('data-flip-root')) return;
    try {
      if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (_) {}

    const state = { showingBack: false, timeout: null };
    flipTimers[rootId] = state;

    function tick() {
      const root = document.getElementById(rootId);
      if (!root || !flipTimers[rootId]) return;
      if (state.showingBack) {
        root.classList.remove('is-flipped');
        state.showingBack = false;
        state.timeout = setTimeout(tick, FLIP_FRONT_MS);
      } else {
        root.classList.add('is-flipped');
        state.showingBack = true;
        state.timeout = setTimeout(tick, FLIP_BACK_MS);
      }
    }

    // Primero cara frontal un momento, luego publicidad 5 s, y cicla.
    state.timeout = setTimeout(tick, 2500);
  }

  function paintQrFallback(canvas, url) {
    const api =
      'https://api.qrserver.com/v1/create-qr-code/?size=176x176&margin=8&data=' + encodeURIComponent(url);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = api;
  }

  function fillQrOnRoot(rootEl) {
    if (!rootEl) return Promise.resolve();
    const canvas = rootEl.querySelector('.cdsan-card-qr');
    if (!canvas) return Promise.resolve();
    const url = canvas.getAttribute('data-qr-url') || '';
    if (!url) return Promise.resolve();
    return loadQrLib()
      .then(function (QRCode) {
        if (!QRCode || typeof QRCode.toCanvas !== 'function') {
          paintQrFallback(canvas, url);
          return;
        }
        return QRCode.toCanvas(canvas, url, {
          width: canvas.width || 88,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#111827', light: '#ffffff' }
        });
      })
      .catch(function () {
        paintQrFallback(canvas, url);
      });
  }

  function hydrateCard(rootId) {
    const root = document.getElementById(rootId);
    if (!root) return;
    fillQrOnRoot(root);
    startFlipCycle(rootId);
  }

  function waitForCardBg(cardEl) {
    const img = cardEl && cardEl.querySelector('.cdsan-card-bg');
    if (!img) return Promise.resolve();
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(function (resolve) {
      const done = function () {
        resolve();
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 2500);
    });
  }

  function getExportTarget(cardRoot) {
    if (!cardRoot) return null;
    if (cardRoot.classList.contains('cdsan-card-scene')) {
      return cardRoot.querySelector('.cdsan-card-front') || cardRoot;
    }
    return cardRoot;
  }

  function captureCardCanvas(cardRoot) {
    const front = getExportTarget(cardRoot);
    if (cardRoot && cardRoot.classList) cardRoot.classList.remove('is-flipped');
    return loadExportLibs()
      .then(function () {
        return fillQrOnRoot(cardRoot);
      })
      .then(function () {
        return waitForCardBg(front);
      })
      .then(function () {
        return global.html2canvas(front, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#8b0000',
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
    const slug = String(payload.nombre || '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40);
    return 'carnet-' + (slug || 'socio');
  }

  function closeModal() {
    const card = document.getElementById('cdsanMemberCardExport');
    if (card) stopFlipCycle('cdsanMemberCardExport');
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
      '<p style="font-size:.8rem;color:#64748b;margin:0 0 10px">El carnet gira ~5 s para mostrar publicidad. El QR superior sirve para control de asistencia.</p>' +
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
    hydrateCard(cardId);
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
    const html =
      '<div class="cdsan-carnet-inline-wrap" style="margin:16px auto">' +
      cardMarkup(buildCardPayload(m), 'cdsanMemberCardInline') +
      '<div class="cdsan-card-actions" style="margin-top:12px">' +
      '<button type="button" class="cdsan-card-btn cdsan-card-btn--jpg" onclick="memberCardGenerator.openForCurrentSession()">👁️ Ver carnet grande</button>' +
      '<button type="button" class="cdsan-card-btn cdsan-card-btn--jpg" onclick="memberCardGenerator.downloadJpgCurrent()">⬇️ JPG</button>' +
      '<button type="button" class="cdsan-card-btn cdsan-card-btn--pdf" onclick="memberCardGenerator.downloadPdfCurrent()">⬇️ PDF</button>' +
      '</div></div>';
    setTimeout(function () {
      hydrateCard('cdsanMemberCardInline');
    }, 30);
    return html;
  }

  function ensureHiddenExportWrap() {
    let wrap = document.getElementById('cdsanCardHiddenExport');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'cdsanCardHiddenExport';
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function downloadJpgCurrent() {
    const m = resolveMemberForCurrentSocio();
    const elig = getEligibility(m);
    if (!elig.ok) {
      alert(elig.reason);
      return;
    }
    injectStyles();
    const wrap = ensureHiddenExportWrap();
    const payload = buildCardPayload(m);
    wrap.innerHTML = cardMarkup(payload, 'cdsanMemberCardHidden');
    const cardEl = document.getElementById('cdsanMemberCardHidden');
    fillQrOnRoot(cardEl).then(function () {
      return downloadJpg(cardEl, fileBaseFromPayload(payload));
    }).catch(function (e) {
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
    const wrap = ensureHiddenExportWrap();
    const payload = buildCardPayload(m);
    wrap.innerHTML = cardMarkup(payload, 'cdsanMemberCardHidden');
    const cardEl = document.getElementById('cdsanMemberCardHidden');
    fillQrOnRoot(cardEl).then(function () {
      return downloadPdf(cardEl, fileBaseFromPayload(payload));
    }).catch(function (e) {
      alert('No se pudo descargar: ' + (e.message || e));
    });
  }

  function renderPreviewCard(containerId, memberData, cardDomId) {
    injectStyles();
    const m = memberData || {};
    const payload = buildCardPayload(m);
    const host = document.getElementById(containerId);
    if (!host) return;
    const id = cardDomId || 'cdsanPreviewCard';
    host.innerHTML = cardMarkup(payload, id);
    hydrateCard(id);
  }

  global.memberCardGenerator = {
    openForCurrentSession: openForCurrentSession,
    openForAdminMember: openForAdminMember,
    showCardModal: showCardModal,
    renderInlineCardHtml: renderInlineCardHtml,
    renderPreviewCard: renderPreviewCard,
    downloadJpgCurrent: downloadJpgCurrent,
    downloadPdfCurrent: downloadPdfCurrent,
    buildCardPayload: buildCardPayload,
    buildAttendanceUrl: function (m) {
      return buildAttendanceUrl(m, buildCardPayload(m || {}));
    },
    getEligibility: function () {
      return getEligibility(resolveMemberForCurrentSocio());
    },
    canShowCard: function () {
      return getEligibility(resolveMemberForCurrentSocio()).ok;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
