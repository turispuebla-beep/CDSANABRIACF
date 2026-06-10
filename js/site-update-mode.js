/**
 * Modo actualización — la web se ve, pero registros/envíos públicos quedan bloqueados.
 * Config en Firestore: sanabria_config/sitePublicMode
 */
(function (global) {
  'use strict';

  const DOC_ID = 'sitePublicMode';
  const COLLECTION = 'sanabria_config';
  const APP_SCOPE = 'cdsanabriacf';
  const CACHE_KEY = 'clubSitePublicModeCache';

  const DEFAULT_MESSAGE =
    'Estamos actualizando la web del club. Puedes consultar la información, la tienda y el torneo, pero los registros e inscripciones están temporalmente desactivados. Disculpa las molestias.';

  /** Inactivo por defecto: tras subir, el admin activa ON en Firestore para sincronizar todos los dispositivos. */
  const DEFAULT_BOOT = {
    actionsDisabled: false,
    message: DEFAULT_MESSAGE,
    updatedAt: null,
    updatedBy: 'deploy-default-off'
  };

  let state = {
    active: false,
    message: DEFAULT_MESSAGE,
    updatedAt: null,
    updatedBy: 'deploy-default-off'
  };

  let unsubscribe = null;

  function readCache() {
    try {
      return JSON.parse(global.sessionStorage.getItem(CACHE_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      global.sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function applyState(data) {
    if (!data || typeof data !== 'object') return;
    state = {
      active: data.actionsDisabled === true,
      message: String(data.message || DEFAULT_MESSAGE).trim() || DEFAULT_MESSAGE,
      updatedAt: data.updatedAt || null,
      updatedBy: data.updatedBy || ''
    };
    writeCache({
      actionsDisabled: state.active,
      message: state.message,
      updatedAt: state.updatedAt
    });
    renderBanner();
    renderAdminControls();
    applyPublicFormsLock();
    global.dispatchEvent(new CustomEvent('siteUpdateModeChanged', { detail: getPublicState() }));
  }

  function getAdminSession() {
    if (global.AdminSession && global.AdminSession.getStoredAdminSession) {
      return global.AdminSession.getStoredAdminSession();
    }
    try {
      const raw = global.localStorage.getItem('currentAdmin') || global.localStorage.getItem('adminUser');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function canBypass() {
    return !!getAdminSession();
  }

  function isActive() {
    return state.active && !canBypass();
  }

  function getMessage() {
    return state.message || DEFAULT_MESSAGE;
  }

  function getPublicState() {
    return {
      active: state.active,
      effective: isActive(),
      message: getMessage(),
      updatedAt: state.updatedAt,
      updatedBy: state.updatedBy
    };
  }

  function notifyBlocked(customMessage) {
    global.alert('🛠️ ' + (customMessage || getMessage()));
  }

  /** Bloquea envíos y altas. allowViewTorneo: abrir modal torneo sin enviar. */
  function guard(action) {
    if (!isActive()) return true;
    if (action === 'view_tienda' || action === 'view_torneo') return true;
    notifyBlocked();
    return false;
  }

  const BLOCKED_FORM_IDS = ['sociosForm', 'amigosForm', 'nuevoJugadorForm', 'torneoPreinscripcionForm'];

  function lockFormElement(form, locked) {
    if (!form) return;
    form.querySelectorAll('input, select, textarea, button').forEach(function (el) {
      if (locked) {
        el.disabled = true;
        if (el.type !== 'button' && el.type !== 'submit') {
          el.readOnly = true;
          el.setAttribute('aria-readonly', 'true');
        }
      } else {
        el.disabled = false;
        el.readOnly = false;
        el.removeAttribute('aria-readonly');
      }
    });
  }

  function applyPublicFormsLock() {
    const locked = isActive();
    BLOCKED_FORM_IDS.forEach(function (id) {
      lockFormElement(global.document.getElementById(id), locked);
    });
    applyTorneoFormLock();
  }

  function bindGlobalPublicActionBlock() {
    if (global.document.documentElement.dataset.siteUpdateBound) return;
    global.document.documentElement.dataset.siteUpdateBound = '1';
    global.document.addEventListener(
      'submit',
      function (ev) {
        if (!isActive()) return;
        const form = ev.target;
        if (!form || form.tagName !== 'FORM') return;
        const id = form.id || '';
        if (BLOCKED_FORM_IDS.indexOf(id) >= 0) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          notifyBlocked();
        }
      },
      true
    );
  }

  /** Bloquea inscripción jugador (continue/finalize). Permite lookup y reset contraseña. */
  function isInscriptionFlowBlocked(flow, portalResetToken) {
    if (!isActive()) return false;
    if (portalResetToken) return false;
    if (flow === 'lookup') return false;
    return true;
  }

  function blockInscriptionPageIfNeeded(flow, portalResetToken) {
    if (!isInscriptionFlowBlocked(flow, portalResetToken)) return false;
    const wrap = global.document.getElementById('inscFormWrap');
    const closed = global.document.getElementById('inscClosedWrap');
    const msg = global.document.getElementById('inscClosedMsg');
    if (wrap) wrap.style.display = 'none';
    if (closed) closed.style.display = 'block';
    if (msg) msg.textContent = getMessage();
    return true;
  }

  function renderBanner() {
    const banner = global.document.getElementById('siteUpdateBanner');
    const text = global.document.getElementById('siteUpdateBannerText');
    if (!banner || !text) return;
    if (state.active) {
      text.textContent = getMessage();
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  function isAdminPanelPage() {
    try {
      return /admin-panel\.html/i.test(global.location.pathname || '');
    } catch (_) {
      return false;
    }
  }

  function renderAdminControls() {
    const wrap = global.document.getElementById('siteUpdateAdminWrap');
    const toggleBtn = global.document.getElementById('siteUpdateToggleBtn');
    const editBtn = global.document.getElementById('siteUpdateEditMsgBtn');
    const statusEl = global.document.getElementById('siteUpdateAdminStatus');
    if (!wrap || !toggleBtn) return;
    const admin = getAdminSession();
    wrap.hidden = isAdminPanelPage() ? false : !admin;
    if (!admin && !isAdminPanelPage()) return;
    toggleBtn.textContent = state.active ? 'Actualización: ON' : 'Actualización: OFF';
    toggleBtn.setAttribute('aria-pressed', state.active ? 'true' : 'false');
    toggleBtn.classList.toggle('is-on', state.active);
    if (editBtn) editBtn.hidden = !state.active;
    if (statusEl) {
      if (state.active) {
        statusEl.style.display = 'block';
        statusEl.textContent = 'Aviso actual para visitantes: «' + getMessage() + '»';
      } else {
        statusEl.style.display = 'none';
        statusEl.textContent = '';
      }
    }
  }

  function applyTorneoFormLock() {
    const form = global.document.getElementById('torneoPreinscripcionForm');
    const notice = global.document.getElementById('tpUpdateModeNotice');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const locked = isActive();
    if (notice) notice.hidden = !locked;
    if (form) {
      form.querySelectorAll('input, select, textarea, button').forEach(function (el) {
        if (el.type === 'submit' || el.closest('.tp-register-banner')) {
          el.disabled = locked;
        } else if (locked) {
          el.readOnly = true;
          el.setAttribute('aria-readonly', 'true');
        } else {
          el.readOnly = false;
          el.removeAttribute('aria-readonly');
          el.disabled = false;
        }
      });
    }
    if (submitBtn && locked) submitBtn.disabled = true;
  }

  async function persistToFirestore(payload) {
    if (!global.firebaseDb || global.firebaseDb.isSimulation) {
      applyState(payload);
      return { ok: true, localOnly: true };
    }
    if (!global.firebaseAuth || !global.firebaseAuth.currentUser) {
      throw new Error(
        isAdminPanelPage()
          ? 'Para cambiar el modo actualización, inicia sesión también en la web principal (Acceso → administrador) con el mismo correo, o recarga este panel tras entrar allí.'
          : 'Inicia sesión como administrador en la web principal para cambiar el modo actualización.'
      );
    }
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
    const admin = getAdminSession();
    await setDoc(
      doc(global.firebaseDb, COLLECTION, DOC_ID),
      {
        appScope: APP_SCOPE,
        actionsDisabled: !!payload.actionsDisabled,
        message: String(payload.message || DEFAULT_MESSAGE).trim() || DEFAULT_MESSAGE,
        updatedAt: new Date().toISOString(),
        updatedBy: (admin && admin.email) || global.firebaseAuth.currentUser.email || ''
      },
      { merge: true }
    );
    return { ok: true };
  }

  async function toggleActive() {
    const next = !state.active;
    const msg = next
      ? '¿Activar modo actualización? Los visitantes no podrán registrarse ni enviar inscripciones (excepto ver tienda y torneo).'
      : '¿Desactivar modo actualización y reabrir registros al público?';
    if (!global.confirm(msg)) return;
    try {
      await persistToFirestore({
        actionsDisabled: next,
        message: getMessage()
      });
      global.alert(next ? '✅ Modo actualización activado.' : '✅ Modo actualización desactivado.');
    } catch (err) {
      global.alert('❌ ' + (err.message || err));
    }
  }

  async function editMessage() {
    const next = global.prompt('Mensaje visible para los visitantes:', getMessage());
    if (next == null) return;
    const trimmed = String(next).trim();
    if (!trimmed) {
      global.alert('❌ El mensaje no puede estar vacío.');
      return;
    }
    try {
      await persistToFirestore({
        actionsDisabled: state.active,
        message: trimmed
      });
      global.alert('✅ Mensaje actualizado.');
    } catch (err) {
      global.alert('❌ ' + (err.message || err));
    }
  }

  function startFirestoreListener() {
    if (unsubscribe || !global.firebaseDb || global.firebaseDb.isSimulation) return;
    import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js')
      .then(function (mod) {
        if (unsubscribe) return;
        unsubscribe = mod.onSnapshot(
          mod.doc(global.firebaseDb, COLLECTION, DOC_ID),
          function (snap) {
            if (snap.exists()) applyState(snap.data());
            else applyState(DEFAULT_BOOT);
          },
          function (err) {
            console.warn('[SiteUpdateMode] listener:', err);
          }
        );
      })
      .catch(function () {});
  }

  function initDom() {
    renderBanner();
    renderAdminControls();
    applyPublicFormsLock();
    bindGlobalPublicActionBlock();

    const toggleBtn = global.document.getElementById('siteUpdateToggleBtn');
    const editBtn = global.document.getElementById('siteUpdateEditMsgBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleActive);
    if (editBtn) editBtn.addEventListener('click', editMessage);

    global.addEventListener('storage', function (ev) {
      if (ev.key === 'currentAdmin' || ev.key === 'adminUser') {
        renderBanner();
        renderAdminControls();
        applyPublicFormsLock();
      }
    });
  }

  const cached = readCache();
  if (cached && typeof cached.actionsDisabled === 'boolean') {
    applyState(cached);
  } else {
    applyState(DEFAULT_BOOT);
  }

  global.SiteUpdateMode = {
    DEFAULT_MESSAGE: DEFAULT_MESSAGE,
    isActive: isActive,
    isEnabledGlobally: function () {
      return state.active;
    },
    canBypass: canBypass,
    getMessage: getMessage,
    getPublicState: getPublicState,
    guard: guard,
    notifyBlocked: notifyBlocked,
    applyTorneoFormLock: applyTorneoFormLock,
    refreshUi: function () {
      renderBanner();
      renderAdminControls();
      applyPublicFormsLock();
    },
    applyPublicFormsLock: applyPublicFormsLock,
    isInscriptionFlowBlocked: isInscriptionFlowBlocked,
    blockInscriptionPageIfNeeded: blockInscriptionPageIfNeeded,
    toggleActive: toggleActive,
    editMessage: editMessage
  };

  global.addEventListener('DOMContentLoaded', initDom);
  global.addEventListener('firebaseReady', startFirestoreListener);

  if (global.firebaseDb && !global.firebaseDb.isSimulation) {
    startFirestoreListener();
  }
})(typeof window !== 'undefined' ? window : globalThis);
