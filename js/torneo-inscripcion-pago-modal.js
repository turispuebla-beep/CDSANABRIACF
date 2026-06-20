/**
 * Modal de pago — inscripción torneo F7 (finalizar plantilla).
 * Por ahora: solo tarjeta. Bizum y offline ocultos (activar flags cuando proceda).
 */
(function (global) {
  'use strict';

  var MODAL_ID = 'torneoInscripcionPagoModal';
  var resolvePending = null;

  /** Activar cuando el club habilite Bizum en el torneo. */
  var ENABLE_TORNEO_BIZUM = false;
  /** Activar cuando se permita transferencia/efectivo en el torneo. */
  var ENABLE_TORNEO_OFFLINE = true;
  var CLUB_BANK_ACCOUNT =
    (global.PaymentMethodPicker && global.PaymentMethodPicker.CLUB_BANK_ACCOUNT) ||
    'CAJA RURAL ES12 3085 0034 8222 5127 9226';

  function $(id) {
    return global.document.getElementById(id);
  }

  function escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatEur(amount) {
    if (global.ClubTorneoPricing && global.ClubTorneoPricing.formatEur) {
      return global.ClubTorneoPricing.formatEur(amount);
    }
    return Number(amount).toFixed(0) + ' €';
  }

  function ensureModal() {
    var existing = global.document.getElementById(MODAL_ID);
    if (existing) {
      existing.remove();
    }
    var wrap = global.document.createElement('div');
    wrap.id = MODAL_ID;
    wrap.className = 'modal';
    wrap.style.cssText =
      'display:none;position:fixed;inset:0;z-index:10080;background:rgba(15,23,42,0.55);' +
      'padding:16px;overflow:auto;align-items:flex-start;justify-content:center;';
    wrap.innerHTML =
      '<div class="modal-content" style="max-width:440px;margin:24px auto;padding:22px 20px 20px;' +
      'border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.2);position:relative;">' +
      '<span class="close" id="torneoPagoClose" style="cursor:pointer;font-size:1.5rem;line-height:1;">&times;</span>' +
      '<h2 id="torneoPagoTitle" style="margin:0 0 8px;color:#1e3a8a;font-size:1.15rem;">Pago inscripción torneo</h2>' +
      '<p id="torneoPagoIntro" style="margin:0 0 14px;font-size:0.9rem;color:#64748b;line-height:1.45;"></p>' +
      '<div id="torneoPagoAmountBox" style="background:#fefce8;border:1px solid #fde047;border-radius:10px;' +
      'padding:12px 14px;margin:0 0 16px;font-size:0.95rem;color:#713f12;"></div>' +
      '<div id="torneoPagoOnlineBlock">' +
      '<button type="button" id="torneoPagoCardBtn" class="btn btn-primary" style="width:100%;margin:0;">💳 Pagar con tarjeta</button>' +
      '<button type="button" id="torneoPagoBizumBtn" class="btn btn-primary" style="width:100%;margin:10px 0 0;display:none;' +
      'background:linear-gradient(135deg,#059669,#10b981);">📱 Pagar con Bizum</button>' +
      '</div>' +
      '<div id="torneoPagoOfflineBlock" style="display:none;margin-top:14px;padding-top:14px;border-top:1px dashed #cbd5e1;">' +
      '<p style="margin:0 0 10px;font-size:0.85rem;color:#64748b;">También puedes pagar por transferencia o en efectivo en el club. El club validará el ingreso.</p>' +
      '<div id="torneoPagoBankBox" style="margin:0 0 10px;padding:10px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:0.84rem;color:#1e40af;line-height:1.45;">' +
      '<strong>Cuenta del club (transferencia):</strong><br><span style="font-family:monospace;font-size:0.92rem;">' +
      CLUB_BANK_ACCOUNT +
      '</span></div>' +
      '<button type="button" id="torneoPagoOfflineBtn" class="btn btn-outline" style="width:100%;">🏦 Transferencia o efectivo</button>' +
      '</div>' +
      '<p id="torneoPagoError" style="display:none;color:#dc2626;font-size:0.88rem;margin:12px 0 0;"></p>' +
      '<button type="button" id="torneoPagoCancelBtn" class="btn btn-secondary" style="width:100%;margin-top:14px;">Cancelar</button>' +
      '</div>';
    global.document.body.appendChild(wrap);

    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) closeCancel();
    });
    $('torneoPagoClose').addEventListener('click', closeCancel);
    $('torneoPagoCancelBtn').addEventListener('click', closeCancel);
    $('torneoPagoCardBtn').addEventListener('click', function () {
      resolveChoice('card');
    });
    $('torneoPagoBizumBtn').addEventListener('click', function () {
      resolveChoice('bizum');
    });
    $('torneoPagoOfflineBtn').addEventListener('click', function () {
      handleOffline();
    });
  }

  function hide() {
    var m = global.document.getElementById(MODAL_ID);
    if (m) m.style.display = 'none';
  }

  function closeCancel() {
    hide();
    if (resolvePending) {
      var r = resolvePending;
      resolvePending = null;
      r(null);
    }
  }

  function resolveChoice(method) {
    hide();
    if (resolvePending) {
      var r = resolvePending;
      resolvePending = null;
      r(method);
    }
  }

  async function handleOffline() {
    if (!global.PaymentMethodPicker || !global.PaymentMethodPicker.showPaymentOfflinePicker) {
      resolveChoice('transferencia');
      return;
    }
    var choice = await global.PaymentMethodPicker.showPaymentOfflinePicker({
      title: 'Forma de pago de la inscripción',
      hideTpv: true,
      showClubAccount: true
    });
    if (choice) resolveChoice(choice);
  }

  function setError(msg) {
    var el = $('torneoPagoError');
    if (!el) return;
    if (msg) {
      el.style.display = 'block';
      el.textContent = msg;
    } else {
      el.style.display = 'none';
      el.textContent = '';
    }
  }

  function refreshOptionalMethods() {
    var bizumBtn = $('torneoPagoBizumBtn');
    var offlineBlock = $('torneoPagoOfflineBlock');
    if (bizumBtn) {
      var bizumOn =
        ENABLE_TORNEO_BIZUM &&
        global.CdsanRedsys &&
        global.CdsanRedsys.isBizumEnabled &&
        global.CdsanRedsys.isBizumEnabled();
      bizumBtn.style.display = bizumOn ? 'block' : 'none';
    }
    if (offlineBlock) {
      offlineBlock.style.display = ENABLE_TORNEO_OFFLINE ? 'block' : 'none';
    }
  }

  /**
   * @param {object} opts
   * @param {number} opts.amountEur
   * @param {number} [opts.teamCount]
   * @param {string} [opts.teamLabel]
   * @returns {Promise<string|null>} card|bizum|transferencia|efectivo|tpv|null
   */
  function showTorneoInscripcionPagoModal(opts) {
    ensureModal();
    opts = opts || {};
    var amount = Number(opts.amountEur) || 0;
    var teamCount = parseInt(opts.teamCount, 10) || 1;
    var teamLabel = String(opts.teamLabel || 'tu equipo').trim();

    setError('');
    if (amount <= 0) {
      return Promise.resolve(null);
    }

    if ($('torneoPagoIntro')) {
      $('torneoPagoIntro').textContent =
        'Elige cómo pagar la inscripción: tarjeta online o transferencia/efectivo. La plantilla se envía al club al confirmar.';
    }
    if ($('torneoPagoAmountBox')) {
      $('torneoPagoAmountBox').innerHTML =
        '<strong>Total a pagar:</strong> ' +
        escapeHtml(formatEur(amount)) +
        (teamCount > 1 ? '<br><span style="font-size:0.85rem;">' + teamCount + ' equipos incluidos</span>' : '') +
        '<br><span style="font-size:0.84rem;color:#854d0e;">' +
        escapeHtml(teamLabel) +
        '</span>';
      $('torneoPagoAmountBox').style.display = 'block';
    }

    refreshOptionalMethods();
    if (ENABLE_TORNEO_BIZUM && global.CdsanRedsys && global.CdsanRedsys.loadConfig) {
      global.CdsanRedsys.loadConfig().then(refreshOptionalMethods).catch(function () {});
    }

    var m = global.document.getElementById(MODAL_ID);
    m.style.display = 'block';

    return new Promise(function (resolve) {
      resolvePending = resolve;
    });
  }

  global.TorneoInscripcionPagoModal = {
    show: showTorneoInscripcionPagoModal,
    ENABLE_TORNEO_BIZUM: ENABLE_TORNEO_BIZUM,
    ENABLE_TORNEO_OFFLINE: ENABLE_TORNEO_OFFLINE
  };
})(typeof window !== 'undefined' ? window : globalThis);
