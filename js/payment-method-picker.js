/**
 * Modal: elegir transferencia, efectivo o TPV (exclusivo) antes de enviar el formulario.
 */
(function (global) {
  'use strict';

  var MODAL_ID = 'paymentOfflinePickerModal';
  var resolvePending = null;
  var VALID = ['transferencia', 'efectivo', 'tpv'];

  function ensureModal() {
    if (global.document.getElementById(MODAL_ID)) return;
    var wrap = global.document.createElement('div');
    wrap.id = MODAL_ID;
    wrap.className = 'modal';
    wrap.style.cssText = 'display:none;z-index:10050;';
    wrap.innerHTML =
      '<div class="modal-content" style="max-width:420px;margin:8% auto;padding:24px;border-radius:12px;">' +
      '<span class="close" id="paymentOfflinePickerClose" style="cursor:pointer;font-size:1.5rem;">&times;</span>' +
      '<h2 style="margin:0 0 12px;font-size:1.15rem;color:#1e3a8a;">Forma de pago</h2>' +
      '<p style="margin:0 0 16px;font-size:0.9rem;color:#64748b;line-height:1.45;">Indica cómo vas a pagar. Marca una opción:</p>' +
      '<label style="display:flex;align-items:center;gap:10px;margin:10px 0;padding:12px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;">' +
      '<input type="checkbox" id="payPickTransferencia" style="width:18px;height:18px;">' +
      '<span><strong>Transferencia bancaria</strong><br><small style="color:#64748b">Ingreso en cuenta del club</small></span></label>' +
      '<label style="display:flex;align-items:center;gap:10px;margin:10px 0;padding:12px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;">' +
      '<input type="checkbox" id="payPickEfectivo" style="width:18px;height:18px;">' +
      '<span><strong>Efectivo</strong><br><small style="color:#64748b">Pago en mano al club</small></span></label>' +
      '<label style="display:flex;align-items:center;gap:10px;margin:10px 0;padding:12px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;">' +
      '<input type="checkbox" id="payPickTpv" style="width:18px;height:18px;">' +
      '<span><strong>TPV</strong><br><small style="color:#64748b">Pago con datáfono en el club</small></span></label>' +
      '<p id="paymentOfflinePickerErr" style="display:none;color:#dc2626;font-size:0.85rem;margin:8px 0 0;"></p>' +
      '<div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button type="button" id="paymentOfflinePickerConfirm" class="btn-primary" style="flex:1;min-width:140px;">Enviar solicitud</button>' +
      '<button type="button" id="paymentOfflinePickerCancel" class="btn-secondary" style="flex:1;min-width:100px;">Cancelar</button>' +
      '</div></div>';
    global.document.body.appendChild(wrap);

    var cbT = global.document.getElementById('payPickTransferencia');
    var cbE = global.document.getElementById('payPickEfectivo');
    var cbP = global.document.getElementById('payPickTpv');

    function pick(which) {
      if (!cbT || !cbE || !cbP) return;
      cbT.checked = which === 'transferencia';
      cbE.checked = which === 'efectivo';
      cbP.checked = which === 'tpv';
    }

    function bindExclusive(cb, value) {
      cb.addEventListener('change', function () {
        if (cb.checked) pick(value);
        else if (!cbT.checked && !cbE.checked && !cbP.checked) pick('');
      });
    }

    bindExclusive(cbT, 'transferencia');
    bindExclusive(cbE, 'efectivo');
    bindExclusive(cbP, 'tpv');

    global.document.getElementById('paymentOfflinePickerClose').addEventListener('click', closeCancel);
    global.document.getElementById('paymentOfflinePickerCancel').addEventListener('click', closeCancel);
    global.document.getElementById('paymentOfflinePickerConfirm').addEventListener('click', function () {
      var err = global.document.getElementById('paymentOfflinePickerErr');
      var choice = cbT.checked ? 'transferencia' : cbE.checked ? 'efectivo' : cbP.checked ? 'tpv' : '';
      if (!choice) {
        if (err) {
          err.style.display = 'block';
          err.textContent = 'Marca transferencia, efectivo o TPV para continuar.';
        }
        return;
      }
      if (err) err.style.display = 'none';
      hide();
      if (resolvePending) {
        var r = resolvePending;
        resolvePending = null;
        r(choice);
      }
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

  function normalizeChoice(raw) {
    var c = String(raw || '').trim().toLowerCase();
    return VALID.indexOf(c) >= 0 ? c : 'transferencia';
  }

  function showPaymentOfflinePicker(opts) {
    ensureModal();
    var m = global.document.getElementById(MODAL_ID);
    var cbT = global.document.getElementById('payPickTransferencia');
    var cbE = global.document.getElementById('payPickEfectivo');
    var cbP = global.document.getElementById('payPickTpv');
    var err = global.document.getElementById('paymentOfflinePickerErr');
    if (cbT) cbT.checked = false;
    if (cbE) cbE.checked = false;
    if (cbP) cbP.checked = false;
    if (err) err.style.display = 'none';
    var h2 = m && m.querySelector('h2');
    if (h2 && opts && opts.title) h2.textContent = opts.title;
    m.style.display = 'block';
    return new Promise(function (resolve) {
      resolvePending = function (choice) {
        resolve(choice ? normalizeChoice(choice) : null);
      };
    });
  }

  global.PaymentMethodPicker = {
    showPaymentOfflinePicker: showPaymentOfflinePicker,
    normalizeOfflinePayment: normalizeChoice
  };
})(typeof window !== 'undefined' ? window : globalThis);
