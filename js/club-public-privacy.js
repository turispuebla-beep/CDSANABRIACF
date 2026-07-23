/**
 * Privacidad web — lista pública de jugadores/as (solo si el admin la activa).
 */
(function (global) {
  'use strict';

  const SETTINGS_KEY = 'cdsanabriacfSettings';

  function readClubSettings() {
    try {
      return JSON.parse(global.localStorage.getItem(SETTINGS_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function isClubAdminSession() {
    if (global.localStorage.getItem('isAdmin') === 'true') return true;
    try {
      const cur = JSON.parse(global.localStorage.getItem('currentAdmin') || global.localStorage.getItem('adminUser') || '{}');
      return !!(cur && (cur.email || cur.uid || cur.isAdmin === true || cur.role === 'admin' || cur.role === 'super_admin'));
    } catch (_) {
      return false;
    }
  }

  /** false por defecto: nadie ve nombres de jugadores en la web hasta que el admin lo active. */
  function isPublicPlayersListVisible() {
    if (isClubAdminSession()) return true;
    return readClubSettings().publicPlayersListVisible === true;
  }

  function playersHiddenNoticeHtml() {
    return (
      '<div style="margin:20px 0;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">' +
      '<p style="margin:0 0 6px;font-size:1.5rem;">🔒</p>' +
      '<p style="margin:0;color:#475569;line-height:1.5;font-size:0.95rem;">' +
      '<strong>Plantilla y categorías no publicadas.</strong><br>' +
      'Los nombres y categorías de jugadores/as solo las ve la directiva hasta que se active la publicación. Puedes consultar calendario y competiciones.' +
      '</p></div>'
    );
  }

  function filterPlayersForLocalCache(players) {
    if (isPublicPlayersListVisible()) return Array.isArray(players) ? players : [];
    if (isClubAdminSession()) return Array.isArray(players) ? players : [];
    return [];
  }

  global.ClubPublicPrivacy = {
    isPublicPlayersListVisible: isPublicPlayersListVisible,
    playersHiddenNoticeHtml: playersHiddenNoticeHtml,
    filterPlayersForLocalCache: filterPlayersForLocalCache
  };
})(typeof window !== 'undefined' ? window : globalThis);
