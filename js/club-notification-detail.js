/**
 * Detalle de aviso del club — modal al pulsar notificación o ?notif=ID
 */
(function (global) {
  'use strict';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function findNotificationByBroadcastId(broadcastId) {
    const id = String(broadcastId || '').trim();
    if (!id) return null;

    if (global.clubNotificationSystem && Array.isArray(global.clubNotificationSystem.notifications)) {
      const hit = global.clubNotificationSystem.notifications.find(function (n) {
        return (
          String(n.broadcastId || '') === id ||
          String(n.id || '') === id ||
          String(n.clientMessageId || '') === id
        );
      });
      if (hit) return hit;
    }

    try {
      const saved = JSON.parse(localStorage.getItem('club_notifications') || '[]');
      return (
        saved.find(function (n) {
          return (
            String(n.broadcastId || '') === id ||
            String(n.id || '') === id ||
            String(n.clientMessageId || '') === id
          );
        }) || null
      );
    } catch (_) {
      return null;
    }
  }

  function isImageAttachment(notification) {
    const type = String(notification.attachmentType || '').toLowerCase();
    if (type.indexOf('image/') === 0) return true;
    const url = String(notification.attachmentUrl || '').toLowerCase();
    return /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);
  }

  function isPdfAttachment(notification) {
    const type = String(notification.attachmentType || '').toLowerCase();
    if (type === 'application/pdf') return true;
    return /\.pdf(\?|$)/i.test(String(notification.attachmentUrl || '').toLowerCase());
  }

  function renderAttachment(notification) {
    const url = notification.attachmentUrl;
    if (!url) return '';

    const name = escapeHtml(notification.attachmentName || 'Adjunto');
    if (isImageAttachment(notification)) {
      return (
        '<div class="club-notif-detail-attachment">' +
        '<img src="' +
        escapeHtml(url) +
        '" alt="' +
        name +
        '" class="club-notif-detail-img">' +
        '</div>'
      );
    }
    if (isPdfAttachment(notification)) {
      return (
        '<div class="club-notif-detail-attachment">' +
        '<p><a href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener" class="club-notif-detail-pdf-link">📄 Abrir PDF: ' +
        name +
        '</a></p>' +
        '<iframe src="' +
        escapeHtml(url) +
        '" class="club-notif-detail-pdf" title="' +
        name +
        '"></iframe>' +
        '</div>'
      );
    }
    return (
      '<div class="club-notif-detail-attachment">' +
      '<p><a href="' +
      escapeHtml(url) +
      '" target="_blank" rel="noopener">📎 Descargar adjunto</a></p>' +
      '</div>'
    );
  }

  function ensureModal() {
    let modal = document.getElementById('clubNotificationDetailModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'clubNotificationDetailModal';
    modal.className = 'club-notif-detail-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'clubNotifDetailTitle');
    modal.hidden = true;
    modal.innerHTML =
      '<div class="club-notif-detail-backdrop" onclick="ClubNotificationDetail.close()"></div>' +
      '<div class="club-notif-detail-card">' +
      '<button type="button" class="club-notif-detail-close" onclick="ClubNotificationDetail.close()" aria-label="Cerrar">&times;</button>' +
      '<div class="club-notif-detail-header">' +
      '<img src="assets/escudo-192.png" alt="" class="club-notif-detail-escudo" width="48" height="48">' +
      '<div><p class="club-notif-detail-kicker">CD Sanabria CF</p><h2 id="clubNotifDetailTitle"></h2></div>' +
      '</div>' +
      '<div id="clubNotifDetailBody" class="club-notif-detail-body"></div>' +
      '<div id="clubNotifDetailAttachment" class="club-notif-detail-attach-wrap"></div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  function openClubNotificationDetail(broadcastId) {
    const notification = findNotificationByBroadcastId(broadcastId);
    const modal = ensureModal();
    const titleEl = document.getElementById('clubNotifDetailTitle');
    const bodyEl = document.getElementById('clubNotifDetailBody');
    const attachEl = document.getElementById('clubNotifDetailAttachment');

    if (!notification) {
      if (titleEl) titleEl.textContent = 'Aviso del club';
      if (bodyEl) {
        bodyEl.innerHTML = '<p>No se encontró el aviso. Recarga la página o vuelve a abrir desde la campana 🔔.</p>';
      }
      if (attachEl) attachEl.innerHTML = '';
      modal.hidden = false;
      document.body.classList.add('club-notif-detail-open');
      return;
    }

    if (global.clubNotificationSystem && typeof global.clubNotificationSystem.markAsRead === 'function') {
      global.clubNotificationSystem.markAsRead(notification.id);
    }

    if (titleEl) titleEl.textContent = notification.title || 'Aviso del club';
    if (bodyEl) {
      const when = notification.timestamp
        ? '<p class="club-notif-detail-time">' + escapeHtml(new Date(notification.timestamp).toLocaleString('es-ES')) + '</p>'
        : '';
      bodyEl.innerHTML = when + '<p>' + escapeHtml(notification.message || '') + '</p>';
    }
    if (attachEl) attachEl.innerHTML = renderAttachment(notification);

    modal.hidden = false;
    document.body.classList.add('club-notif-detail-open');
  }

  function closeClubNotificationDetail() {
    const modal = document.getElementById('clubNotificationDetailModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('club-notif-detail-open');
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('notif')) {
        params.delete('notif');
        const next = params.toString();
        history.replaceState({}, '', window.location.pathname + (next ? '?' + next : ''));
      }
    } catch (_) {}
  }

  function initFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const notifId = params.get('notif');
      if (notifId) {
        setTimeout(function () {
          openClubNotificationDetail(notifId);
        }, 600);
      }
    } catch (_) {}
  }

  global.ClubNotificationDetail = {
    open: openClubNotificationDetail,
    close: closeClubNotificationDetail,
    find: findNotificationByBroadcastId,
    initFromUrl: initFromUrl
  };
})(typeof window !== 'undefined' ? window : this);
