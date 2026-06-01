/**
 * Datos de contacto del club — valores por defecto y sincronización localStorage.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubContactInfo';

  const DEFAULT_CLUB_CONTACT_INFO = {
    email: 'cdsanabriafc@gmail.com',
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

  /** Asegura clubContactInfo en localStorage (email del club por defecto). */
  function ensureClubContactInfo() {
    const current = readRaw();
    const merged = Object.assign({}, DEFAULT_CLUB_CONTACT_INFO, current || {});
    const em = String(merged.email || '').trim();
    if (!em || !em.includes('@')) {
      merged.email = DEFAULT_CLUB_CONTACT_INFO.email;
    }
    if (!merged.address) merged.address = DEFAULT_CLUB_CONTACT_INFO.address;
    if (!merged.website) merged.website = DEFAULT_CLUB_CONTACT_INFO.website;
    merged.lastModified = new Date().toISOString();
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  function getNotifyEmail() {
    const c = ensureClubContactInfo();
    return String(c.email || DEFAULT_CLUB_CONTACT_INFO.email).trim();
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
    DEFAULT_CLUB_CONTACT_INFO: DEFAULT_CLUB_CONTACT_INFO,
    ensureClubContactInfo: ensureClubContactInfo,
    getNotifyEmail: getNotifyEmail,
    applyToAdminForm: applyToAdminForm
  };
})(typeof window !== 'undefined' ? window : globalThis);
