/**
 * Acceso responsable de equipo — Torneo Fútbol 7.
 * Modal en index + sesión para torneo-equipo.html
 */
(function (global) {
  'use strict';

  const SESSION_KEY = 'cdsanTorneoEquipoSession';
  const API = '/.netlify/functions/torneo-equipo-access';

  function normalizeCode(raw) {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  function readSession() {
    try {
      const raw = global.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || (!data.accessCode && !data.responsibleCode) || !data.contactEmail) return null;
      if (data.expiresAt && Date.now() > data.expiresAt) {
        clearSession();
        return null;
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  function writeSession(accessCode, contactEmail, panel) {
    const resp =
      panel && panel.responsibleCode
        ? normalizeCode(panel.responsibleCode)
        : normalizeCode(accessCode);
    const activeAccessCode =
      panel && panel.activeAccessCode ? normalizeCode(panel.activeAccessCode) : normalizeCode(accessCode);
    const payload = {
      accessCode: resp,
      responsibleCode: resp,
      activeAccessCode: activeAccessCode,
      contactEmail: String(contactEmail || '')
        .trim()
        .toLowerCase(),
      panel: panel || null,
      savedAt: new Date().toISOString(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    };
    global.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    return payload;
  }

  function setActiveCategory(accessCode) {
    const session = readSession();
    if (!session || !session.panel) return null;
    const code = normalizeCode(accessCode);
    const entry = (session.panel.teamEntries || []).find(function (e) {
      return normalizeCode(e.accessCode) === code;
    });
    if (!entry) return session.panel;
    const merged = Object.assign({}, session.panel, entry, {
      activeAccessCode: entry.accessCode,
      teamEntries: session.panel.teamEntries,
      entryCount: session.panel.entryCount,
      teamName: session.panel.teamName,
      responsibleEmail: session.panel.responsibleEmail,
      contactEmail: session.panel.contactEmail,
      contactName: session.panel.contactName,
      eventName: session.panel.eventName,
      coach: session.panel.coach
    });
    writeSession(session.accessCode, session.contactEmail, merged);
    return merged;
  }

  function clearSession() {
    try {
      global.sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  function isLocalFile() {
    return global.location && global.location.protocol === 'file:';
  }

  async function verifyAccess(accessCode, contactEmail) {
    if (isLocalFile()) {
      throw new Error('El panel del responsable requiere la web publicada del club (no archivo local).');
    }
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessCode: normalizeCode(accessCode),
        contactEmail: String(contactEmail || '').trim().toLowerCase()
      })
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok || !data.panel) {
      throw new Error(data.error || 'No se pudo acceder al equipo.');
    }
    return data.panel;
  }

  async function loginAndSave(accessCode, contactEmail) {
    const panel = await verifyAccess(accessCode, contactEmail);
    writeSession(accessCode, contactEmail, panel);
    return panel;
  }

  function goToPanel() {
    global.location.href = 'torneo-equipo.html';
  }

  function goToTorneoView() {
    global.location.href = 'torneo-vista.html';
  }

  function showAccessChoice(panel) {
    const form = global.document.getElementById('treAccessForm');
    const choice = global.document.getElementById('treAccessChoice');
    const welcome = global.document.getElementById('treAccessChoiceWelcome');
    if (form) form.style.display = 'none';
    if (choice) choice.hidden = false;
    if (welcome && panel) {
      const name = panel.contactName || panel.teamName || '';
      welcome.textContent = name
        ? 'Acceso correcto, ' + name + '. ¿Qué quieres consultar?'
        : 'Acceso correcto. ¿Qué quieres consultar?';
    }
  }

  function resetAccessModal() {
    const form = global.document.getElementById('treAccessForm');
    const choice = global.document.getElementById('treAccessChoice');
    if (form) form.style.display = '';
    if (choice) choice.hidden = true;
  }

  function openAccessModal(prefillCode) {
    const modal = global.document.getElementById('torneoResponsableAccessModal');
    if (!modal) return;
    resetAccessModal();
    const codeInput = global.document.getElementById('treAccessCode');
    const emailInput = global.document.getElementById('treContactEmail');
    const errEl = global.document.getElementById('treAccessError');
    if (codeInput && prefillCode) codeInput.value = normalizeCode(prefillCode);
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    modal.style.display = 'block';
    if (codeInput && !String(codeInput.value || '').trim() && codeInput.focus) {
      codeInput.focus();
    } else if (emailInput && emailInput.focus) {
      emailInput.focus();
    }
  }

  function closeAccessModal() {
    const modal = global.document.getElementById('torneoResponsableAccessModal');
    if (modal) modal.style.display = 'none';
    resetAccessModal();
  }

  async function submitAccessModal(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    const codeInput = global.document.getElementById('treAccessCode');
    const emailInput = global.document.getElementById('treContactEmail');
    const errEl = global.document.getElementById('treAccessError');
    const btn = global.document.getElementById('treAccessSubmitBtn');
    const code = codeInput ? codeInput.value : '';
    const email = emailInput ? emailInput.value : '';

    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }

    if (!normalizeCode(code)) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = 'Introduce tu código de responsable (TP-R001) o de equipo (TP-R001-INF).';
      }
      return;
    }
    if (!String(email || '').includes('@')) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = 'Introduce el email de contacto de la preinscripción.';
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Comprobando…';
    }
    try {
      const panel = await loginAndSave(code, email);
      showAccessChoice(panel);
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudo acceder.';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Acceder a mi equipo';
      }
    }
  }

  function initFromUrl() {
    try {
      const params = new URLSearchParams(global.location.search || '');
      const code = params.get('equipo') || params.get('code') || params.get('torneo_equipo');
      if (!code) return;
      if (global.location.pathname && /torneo-equipo\.html$/i.test(global.location.pathname)) return;
      openAccessModal(code);
    } catch (_) {}
  }

  function plantillaStatusLabel(status) {
    const map = {
      pendiente: 'Pendiente de fichas',
      en_curso: 'En curso',
      pendiente_pago: 'Pendiente de pago',
      cerrada: 'Cerrada',
      enviada_club: 'Enviada al club',
      pagada: 'Pagada y enviada'
    };
    return map[String(status || '').trim()] || 'Pendiente';
  }

  global.TorneoResponsableAccess = {
    SESSION_KEY: SESSION_KEY,
    normalizeCode: normalizeCode,
    readSession: readSession,
    writeSession: writeSession,
    clearSession: clearSession,
    verifyAccess: verifyAccess,
    loginAndSave: loginAndSave,
    goToPanel: goToPanel,
    goToTorneoView: goToTorneoView,
    showAccessChoice: showAccessChoice,
    openAccessModal: openAccessModal,
    closeAccessModal: closeAccessModal,
    submitAccessModal: submitAccessModal,
    setActiveCategory: setActiveCategory,
    initFromUrl: initFromUrl,
    plantillaStatusLabel: plantillaStatusLabel
  };

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', initFromUrl);
  } else {
    initFromUrl();
  }
})(typeof window !== 'undefined' ? window : globalThis);
