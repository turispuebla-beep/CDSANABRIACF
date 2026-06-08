/**
 * Datos de contacto del club — valores por defecto y sincronización localStorage.
 *
 * Buzón único: cdsanabriacf@gmail.com (web, modales, SMTP y avisos).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubContactInfo';

  const CLUB_EMAIL = 'cdsanabriacf@gmail.com';

  const LEGACY_CLUB_EMAILS = [
    'cdsanabriafc@gmail.com',
    'cdsanabriacf*@gmail.com',
    'cdsanabriacf@gmail.com'
  ];

  const DEFAULT_CLUB_CONTACT_INFO = {
    email: CLUB_EMAIL,
    phone: '+34 600 000 000',
    address: 'Crta. de El Pinar, s/n, 49300 Puebla de Sanabria, Zamora',
    website: 'https://www.cdsanabriacf.com',
    whatsapp: '+34 600 000 000',
    hours: 'Lunes a Viernes: 9:00 - 18:00',
    teamId: 'CDSANABRIACF'
  };

  function readRaw() {
    try {
      return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function normalizeClubEmail(raw) {
    const em = String(raw || '').trim().toLowerCase();
    if (!em || !em.includes('@')) return CLUB_EMAIL;
    if (LEGACY_CLUB_EMAILS.indexOf(em) >= 0 || em.indexOf('cdsanabriacf') >= 0) {
      return CLUB_EMAIL;
    }
    return String(raw).trim();
  }

  /** Asegura clubContactInfo en localStorage (email del club por defecto). */
  function ensureClubContactInfo() {
    const current = readRaw();
    const merged = Object.assign({}, DEFAULT_CLUB_CONTACT_INFO, current || {});
    merged.email = normalizeClubEmail(merged.email);
    if (!merged.address) merged.address = DEFAULT_CLUB_CONTACT_INFO.address;
    if (!merged.website) merged.website = DEFAULT_CLUB_CONTACT_INFO.website;
    merged.lastModified = new Date().toISOString();
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  function getPublicEmail() {
    const c = ensureClubContactInfo();
    return String(c.email || CLUB_EMAIL).trim();
  }

  function getNotifyEmail() {
    return CLUB_EMAIL;
  }

  function applyEmailToNodes(selector, email) {
    if (!global.document) return;
    global.document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = email;
      if (el.tagName === 'A') {
        el.href = 'mailto:' + email;
      }
    });
  }

  /** Actualiza correo del club en la web (.club-email-public y .club-email-notify). */
  function refreshClubEmailDisplays() {
    const email = getPublicEmail();
    applyEmailToNodes('.club-email-public', email);
    applyEmailToNodes('.club-email-notify', email);
    const contactEmail = global.document.getElementById('contactEmail');
    if (contactEmail) contactEmail.textContent = email;
    return { public: email, notify: email };
  }

  function applyToAdminForm(contactInfo) {
    const c = contactInfo || ensureClubContactInfo();
    const set = function (id, val) {
      const el = global.document && global.document.getElementById(id);
      if (el) el.value = val != null ? String(val) : '';
    };
    set('clubEmail', c.email);
    set('clubPhone', c.phone);
    set('clubAddress', c.address);
    set('clubWebsite', c.website);
    set('clubWhatsApp', c.whatsapp);
    set('clubHours', c.hours);
    return c;
  }

  global.ClubContactDefaults = {
    STORAGE_KEY: STORAGE_KEY,
    CLUB_EMAIL: CLUB_EMAIL,
    CLUB_EMAIL_PUBLIC: CLUB_EMAIL,
    CLUB_EMAIL_NOTIFY: CLUB_EMAIL,
    CLUB_EMAIL_CANONICAL: CLUB_EMAIL,
    DEFAULT_CLUB_CONTACT_INFO: DEFAULT_CLUB_CONTACT_INFO,
    ensureClubContactInfo: ensureClubContactInfo,
    getPublicEmail: getPublicEmail,
    getNotifyEmail: getNotifyEmail,
    refreshClubEmailDisplays: refreshClubEmailDisplays,
    applyToAdminForm: applyToAdminForm
  };

  if (global.document) {
    global.document.addEventListener('DOMContentLoaded', function () {
      ensureClubContactInfo();
      refreshClubEmailDisplays();
    });
    global.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) refreshClubEmailDisplays();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
