/**
 * Rol organizador de competiciones — solo pestaña Competiciones en el panel admin.
 */
(function (global) {
  'use strict';

  const ORGANIZER_ROLE = 'competition_organizer';
  const ORGANIZER_TAB = 'competiciones';
  const FULL_ADMIN_ROLES = ['admin', 'super_admin'];

  function getStoredSession() {
    try {
      if (global.AdminSession && typeof global.AdminSession.getStoredAdminSession === 'function') {
        const stored = global.AdminSession.getStoredAdminSession();
        if (stored && stored.email) return stored;
      }
      return JSON.parse(global.localStorage.getItem('currentAdmin') || global.localStorage.getItem('adminUser') || '{}');
    } catch (_) {
      return {};
    }
  }

  function isCompetitionOrganizer(session) {
    const s = session || getStoredSession();
    return String(s.role || '').trim() === ORGANIZER_ROLE;
  }

  function isFullClubAdmin(session) {
    const s = session || getStoredSession();
    if (s.isSuperAdmin === true) return true;
    const role = String(s.role || '').trim();
    if (FULL_ADMIN_ROLES.indexOf(role) >= 0) return true;
    if (s.isAdmin === true && role !== ORGANIZER_ROLE) return true;
    return false;
  }

  function hasCompetitionManagementAccess(session) {
    return isFullClubAdmin(session) || isCompetitionOrganizer(session);
  }

  function canAccessAdminTab(tabName, session) {
    const tab = String(tabName || '').trim();
    if (!tab) return false;
    if (isFullClubAdmin(session)) return true;
    if (isCompetitionOrganizer(session)) return tab === ORGANIZER_TAB;
    return false;
  }

  function guardTabAccess(tabName) {
    if (canAccessAdminTab(tabName)) return true;
    if (global.alert) {
      global.alert('🔒 Tu cuenta solo puede gestionar la pestaña Competiciones.');
    }
    return false;
  }

  function roleLabel(session) {
    const s = session || getStoredSession();
    if (isCompetitionOrganizer(s)) return 'Organizador/a de competiciones';
    if (s.isSuperAdmin || s.role === 'super_admin') return 'Super administrador/a';
    if (s.role === 'admin' || s.isAdmin) return 'Administrador/a del club';
    return 'Usuario del panel';
  }

  function activateOrganizerCompeticionesTab() {
    if (!global.document) return;
    const tabs = global.document.querySelectorAll('.tab-content');
    tabs.forEach(function (tab) {
      tab.style.display = tab.id === ORGANIZER_TAB ? 'block' : 'none';
      tab.classList.toggle('active', tab.id === ORGANIZER_TAB);
    });
    const navButtons = global.document.querySelectorAll('.nav-tab');
    navButtons.forEach(function (btn) {
      const onclick = btn.getAttribute('onclick') || '';
      const isComp = onclick.indexOf("'" + ORGANIZER_TAB + "'") >= 0;
      btn.classList.toggle('active', isComp);
    });
  }

  function applyNavRestrictions() {
    if (!isCompetitionOrganizer()) return;
    if (global.document && global.document.documentElement) {
      global.document.documentElement.classList.remove('admin-organizer-pending');
    }
    if (global.document && global.document.body) {
      global.document.body.classList.add('admin-organizer-mode');
    }
    const tabs = global.document ? global.document.querySelectorAll('.nav-tab') : [];
    tabs.forEach(function (btn) {
      const onclick = btn.getAttribute('onclick') || '';
      const isComp = onclick.indexOf("'" + ORGANIZER_TAB + "'") >= 0;
      btn.style.display = isComp ? '' : 'none';
    });
    const notifWrap = global.document && global.document.querySelector('.admin-notif-wrap');
    if (notifWrap) notifWrap.style.display = 'none';
    const renewalBanner = global.document && global.document.getElementById('cuotaRenewalBanner');
    if (renewalBanner) renewalBanner.style.display = 'none';
    const renewalReminder = global.document && global.document.getElementById('cuotaRenewalReminderBanner');
    if (renewalReminder) renewalReminder.style.display = 'none';
    activateOrganizerCompeticionesTab();
    const info = global.document && global.document.getElementById('currentAdminInfo');
    if (info) {
      const s = getStoredSession();
      info.textContent =
        '🏆 ' + (s.name || 'Organizador/a') + ' · Solo competiciones (campeonatos F7)';
    }
  }

  function applyCompetitionTabChrome() {
    if (!isCompetitionOrganizer()) return;
    global.document.querySelectorAll('[data-admin-only="true"]').forEach(function (el) {
      el.style.display = 'none';
    });
    const root = global.document.getElementById('competiciones');
    if (!root || root.querySelector('.organizer-f7-banner')) return;
    const banner = global.document.createElement('div');
    banner.className = 'organizer-f7-banner';
    banner.innerHTML =
      '<h3>🏆 Panel organizador — Torneo Fútbol 7</h3>' +
      '<p>Gestiona el campeonato completo: equipos, cuadro, resultados y calendario en <strong>varios campos</strong>.</p>' +
      '<ul>' +
      '<li><strong>Campos:</strong> en cada competición, «Varios campos» o «Por categorías» + listado de campos (uno por línea).</li>' +
      '<li><strong>Programación:</strong> líneas <code>Categoría | Campo | Hora</code> o calendario <strong>paralelo por campos</strong> para repartir partidos.</li>' +
      '<li><strong>Partidos:</strong> actas, goles, tarjetas y replanificación de pendientes según el modo elegido.</li>' +
      '<li><strong>Preinscripciones:</strong> listado del torneo más abajo; importa equipos al cuadro (validación solo administradores).</li>' +
      '</ul>';
    root.insertBefore(banner, root.firstChild);
  }

  function isOrganizerFirestoreDoc(data) {
    const d = data && typeof data === 'object' ? data : {};
    return d.appScope === 'cdsanabriacf' && String(d.role || '').trim() === ORGANIZER_ROLE;
  }

  function isAllowedFirestoreAdminDoc(data) {
    if (!data || data.appScope !== 'cdsanabriacf') return false;
    if (data.isAdmin === true || data.isSuperAdmin === true) return true;
    const role = String(data.role || '').trim();
    return FULL_ADMIN_ROLES.indexOf(role) >= 0 || role === ORGANIZER_ROLE;
  }

  global.AdminOrganizerAccess = {
    ORGANIZER_ROLE: ORGANIZER_ROLE,
    ORGANIZER_TAB: ORGANIZER_TAB,
    getStoredSession: getStoredSession,
    isCompetitionOrganizer: isCompetitionOrganizer,
    isFullClubAdmin: isFullClubAdmin,
    hasCompetitionManagementAccess: hasCompetitionManagementAccess,
    canAccessAdminTab: canAccessAdminTab,
    guardTabAccess: guardTabAccess,
    roleLabel: roleLabel,
    applyNavRestrictions: applyNavRestrictions,
    activateOrganizerCompeticionesTab: activateOrganizerCompeticionesTab,
    applyCompetitionTabChrome: applyCompetitionTabChrome,
    isOrganizerFirestoreDoc: isOrganizerFirestoreDoc,
    isAllowedFirestoreAdminDoc: isAllowedFirestoreAdminDoc
  };
})(typeof window !== 'undefined' ? window : globalThis);
