/**
 * UI pública — inscripción jugador/a
 */
(function (global) {
  'use strict';

  const state = { settings: null, kitSelections: {}, photoData: null };

  function $(id) {
    return document.getElementById(id);
  }

  function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? '' : 'none';
  }

  function formatEur(n) {
    return Number(n || 0).toFixed(2).replace('.', ',') + ' €';
  }

  function sizeOptionsHtml() {
    if (!global.ClubInscriptionConfig) return '';
    return global.ClubInscriptionConfig.ALL_SIZES.map(function (s) {
      return '<option value="' + s + '">' + s + '</option>';
    }).join('');
  }

  function renderKitSection() {
    const wrap = $('kitGarmentsWrap');
    if (!wrap || !state.settings) return;
    const garments = global.ClubInscriptionConfig.getEnabledGarments(state.settings);
    wrap.innerHTML = '';
    if (!garments.length) {
      wrap.innerHTML = '<p style="color:#64748b;">No hay equipación configurada para esta temporada.</p>';
      return;
    }
    const perGarment = state.settings.kitMode === 'per_garment';
    garments.forEach(function (g) {
      const row = document.createElement('div');
      row.className = 'kit-row';
      row.innerHTML =
        (perGarment
          ? '<label class="kit-check"><input type="checkbox" data-kit-id="' +
            g.id +
            '"> <span>' +
            g.label +
            ' (' +
            formatEur(g.price) +
            ')</span></label>'
          : '<span class="kit-label">' + g.label + ' (' + formatEur(g.price) + ')</span>') +
        '<select data-kit-size="' +
        g.id +
        '" class="kit-size" disabled><option value="">Talla</option>' +
        sizeOptionsHtml() +
        '</select>';
      wrap.appendChild(row);
      const cb = row.querySelector('[data-kit-id]');
      const sel = row.querySelector('[data-kit-size]');
      if (cb) {
        cb.addEventListener('change', function () {
          sel.disabled = !cb.checked;
          if (!cb.checked) sel.value = '';
          refreshCart();
        });
      } else if (sel) {
        sel.disabled = false;
      }
      if (sel) sel.addEventListener('change', refreshCart);
    });
  }

  function renderFeeCheckboxes() {
    const box = $('feeCheckboxes');
    if (!box || !state.settings) return;
    const s = state.settings;
    let html = '';
    if (s.chargeFicha) {
      html +=
        '<label class="fee-line"><input type="checkbox" id="payFichaCb" checked> Cuota de ficha / inscripción federativa</label>';
    }
    if (s.chargeSocio) {
      html +=
        '<label class="fee-line"><input type="checkbox" id="paySocioCb"> Cuota de socio/a del club (socio-jugador, sin duplicar alta)</label>';
    }
    if (!html) {
      html = '<p class="muted">No hay cuotas configuradas para cobrar en la inscripción.</p>';
    }
    box.innerHTML = html;
    const ficha = $('payFichaCb');
    const socio = $('paySocioCb');
    if (ficha) ficha.addEventListener('change', refreshCart);
    if (socio) socio.addEventListener('change', refreshCart);
  }

  function collectKitItems() {
    const items = [];
    const garments = global.ClubInscriptionConfig.getEnabledGarments(state.settings);
    const perGarment = state.settings.kitMode === 'per_garment';
    garments.forEach(function (g) {
      const cb = document.querySelector('[data-kit-id="' + g.id + '"]');
      const sel = document.querySelector('[data-kit-size="' + g.id + '"]');
      const selected = perGarment ? cb && cb.checked : true;
      if (!selected) return;
      const size = sel ? sel.value : '';
      if (!size) return;
      items.push({
        id: g.id,
        label: g.label,
        size: size,
        price: Number(g.price || 0)
      });
    });
    return items;
  }

  function getFormData() {
    return {
      name: ($('insName') && $('insName').value.trim()) || '',
      surname: ($('insSurname') && $('insSurname').value.trim()) || '',
      dni: ($('insDni') && $('insDni').value.trim()) || '',
      email: ($('insEmail') && $('insEmail').value.trim()) || '',
      phone: ($('insPhone') && $('insPhone').value.trim()) || '',
      address: ($('insAddress') && $('insAddress').value.trim()) || '',
      birthDate: ($('insBirth') && $('insBirth').value) || '',
      category: ($('insCategory') && $('insCategory').value) || '',
      position: ($('insPosition') && $('insPosition').value) || '',
      weightKg: $('insWeight') && $('insWeight').value ? Number($('insWeight').value) : null,
      heightCm: $('insHeight') && $('insHeight').value ? Number($('insHeight').value) : null,
      guardianName: ($('insGuardianName') && $('insGuardianName').value.trim()) || '',
      guardianDNI: ($('insGuardianDni') && $('insGuardianDni').value.trim()) || '',
      guardianPhone: ($('insGuardianPhone') && $('insGuardianPhone').value.trim()) || '',
      guardianEmail: ($('insGuardianEmail') && $('insGuardianEmail').value.trim()) || '',
      guardianAddress: ($('insGuardianAddress') && $('insGuardianAddress').value.trim()) || '',
      playerConsent: $('insPlayerConsent') && $('insPlayerConsent').checked,
      photoConsent: $('insPhotoConsent') && $('insPhotoConsent').checked,
      photoData: state.photoData
    };
  }

  function refreshCart() {
    const form = getFormData();
    const category = form.category || global.ClubInscriptionConfig.suggestCategoryFromBirthDate(form.birthDate);
    const kitItems = collectKitItems();
    const payFicha = !$('payFichaCb') || $('payFichaCb').checked;
    const paySocio = $('paySocioCb') && $('paySocioCb').checked;
    const cart = global.PlayerInscription.computeCart(state.settings, category, kitItems, payFicha, paySocio);

    const lines = $('cartLines');
    if (!lines) return;
    let html = '';
    kitItems.forEach(function (it) {
      html += '<div class="cart-line"><span>' + it.label + ' — talla ' + it.size + '</span><span>' + formatEur(it.price) + '</span></div>';
    });
    if (cart.fichaFee > 0) {
      html += '<div class="cart-line"><span>Cuota ficha</span><span>' + formatEur(cart.fichaFee) + '</span></div>';
    }
    if (cart.socioFee > 0) {
      html += '<div class="cart-line"><span>Cuota socio/a</span><span>' + formatEur(cart.socioFee) + '</span></div>';
    }
    if (!html) html = '<p class="muted">Selecciona equipación y/o cuotas.</p>';
    lines.innerHTML = html;
    if ($('cartTotal')) $('cartTotal').textContent = formatEur(cart.total);
    state.lastCart = { kitItems: kitItems, cart: cart, category: category };
  }

  function toggleGuardian() {
    const bd = $('insBirth') && $('insBirth').value;
    const age = global.ClubInscriptionConfig.calculateAge(bd);
    const sec = $('guardianBlock');
    show(sec, age != null && age < 18);
  }

  function onBirthChange() {
    const bd = $('insBirth') && $('insBirth').value;
    const cat = global.ClubInscriptionConfig.suggestCategoryFromBirthDate(bd);
    if ($('insCategory') && cat) $('insCategory').value = cat;
    if ($('insAge')) $('insAge').textContent = global.ClubInscriptionConfig.calculateAge(bd) ?? '—';
    const hint = $('insDniHint');
    const age = global.ClubInscriptionConfig.calculateAge(bd);
    if (hint) {
      hint.textContent =
        age != null && age < 18
          ? '(opcional para menores; obligatorio DNI del tutor/a abajo)'
          : '(obligatorio si eres mayor de edad)';
    }
    toggleGuardian();
    refreshCart();
  }

  function validateForm() {
    const f = getFormData();
    if (!f.name || !f.surname || !f.email || !f.phone || !f.birthDate) {
      return 'Completa nombre, apellidos, email, teléfono y fecha de nacimiento.';
    }
    const age = global.ClubInscriptionConfig.calculateAge(f.birthDate);
    if (age != null && age >= 18 && !f.dni) {
      return 'El DNI es obligatorio para mayores de edad.';
    }
    if (!f.playerConsent || !f.photoConsent) {
      return 'Debes aceptar los consentimientos obligatorios.';
    }
    if (age != null && age < 18) {
      if (!f.guardianName || !f.guardianDNI || !f.guardianPhone || !f.guardianEmail) {
        return 'Para menores, los datos del tutor/a son obligatorios.';
      }
    }
    const season = state.settings.season;
    const dniCheck = f.dni || (age != null && age < 18 ? f.guardianDNI : '');
    if (dniCheck) {
      const paid = global.PlayerInscription.findPaidPlayerForSeason(dniCheck, season);
      if (paid) {
        return 'Ya existe una inscripción pagada para esta temporada con este DNI.';
      }
    }
    const kitItems = collectKitItems();
    const garments = global.ClubInscriptionConfig.getEnabledGarments(state.settings);
    if (garments.length && !kitItems.length) {
      return 'Indica al menos una prenda con su talla.';
    }
    for (let i = 0; i < garments.length; i++) {
      const g = garments[i];
      const perGarment = state.settings.kitMode === 'per_garment';
      const cb = document.querySelector('[data-kit-id="' + g.id + '"]');
      const sel = document.querySelector('[data-kit-size="' + g.id + '"]');
      const selected = perGarment ? cb && cb.checked : true;
      if (selected && sel && !sel.value) {
        return 'Selecciona la talla de: ' + g.label;
      }
    }
    return null;
  }

  async function handlePhoto(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('La foto no puede superar 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      state.photoData = reader.result;
      const img = $('insPhotoPreview');
      if (img) {
        img.src = state.photoData;
        show($('insPhotoBox'), true);
      }
    };
    reader.readAsDataURL(file);
  }

  function buildRegistration() {
    const f = getFormData();
    f.category = f.category || global.ClubInscriptionConfig.suggestCategoryFromBirthDate(f.birthDate);
    const kitItems = state.lastCart ? state.lastCart.kitItems : collectKitItems();
    const payFicha = !$('payFichaCb') || $('payFichaCb').checked;
    const paySocio = $('paySocioCb') && $('paySocioCb').checked;
    const cart = global.PlayerInscription.computeCart(state.settings, f.category, kitItems, payFicha, paySocio);
    const player = global.PlayerInscription.buildPlayerRecord(f, { kitItems: kitItems, ...cart }, state.settings);
    const member = global.PlayerInscription.findMemberByDni(f.dni);
    if (member && member.id) player.linkedMemberId = member.id;
    return player;
  }

  async function submit(method) {
    const err = validateForm();
    if (err) {
      alert('❌ ' + err);
      return;
    }
    try {
      const reg = buildRegistration();
      const btn = $('btnSubmit');
      if (btn) btn.disabled = true;
      const result = await global.PlayerInscription.submitCheckout(reg, method);
      if (result.free) {
        alert('✅ Inscripción completada (importe 0 €). Tu ficha queda activa.');
        global.location.href = 'index.html';
      } else if (result.transfer) {
        alert(
          '✅ Inscripción registrada con estado PENDIENTE DE PAGO (transferencia).\n\nRealiza el ingreso según indique el club. Un administrador validará el pago y activará tu ficha.'
        );
        global.location.href = 'index.html';
      } else if (result.redirect) {
        /* Redirige a la pasarela; la ficha ya está guardada como pendiente de pago */
      }
    } catch (e) {
      alert('❌ ' + (e.message || e));
      const btn = $('btnSubmit');
      if (btn) btn.disabled = false;
    }
  }

  function initCategorySelect() {
    const sel = $('insCategory');
    if (!sel) return;
    sel.innerHTML = '<option value="">Automática por edad</option>';
    global.ClubInscriptionConfig.CATEGORIES.forEach(function (c) {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.label;
      sel.appendChild(o);
    });
    sel.addEventListener('change', refreshCart);
  }

  function initPaymentButtons() {
    const pm = state.settings.paymentMethods || {};
    show($('payCardBlock'), !!pm.card);
    show($('payBizumBlock'), !!pm.bizum);
    show($('payTransferBlock'), !!pm.transfer);
    if ($('btnPayCard')) {
      $('btnPayCard').onclick = function () {
        submit('card');
      };
    }
    if ($('btnPayBizum')) {
      $('btnPayBizum').onclick = function () {
        submit('bizum');
      };
    }
    if ($('btnPayTransfer')) {
      $('btnPayTransfer').onclick = function () {
        submit('transfer');
      };
    }
    if (global.CdsanRedsys && global.CdsanRedsys.loadConfig) {
      global.CdsanRedsys.loadConfig().then(function () {
        if ($('btnPayBizum') && !global.CdsanRedsys.isBizumEnabled()) {
          $('btnPayBizum').disabled = true;
          $('btnPayBizum').title = 'Bizum no activado en el club';
        }
      });
    }
  }

  function init() {
    if (!global.ClubInscriptionConfig || !global.PlayerInscription) {
      $('inscClosedMsg').textContent = 'Error cargando módulos de inscripción.';
      return;
    }
    state.settings = global.ClubInscriptionConfig.read();
    const open = global.ClubInscriptionConfig.isOpenNow(state.settings);
    if ($('inscSeasonLabel')) $('inscSeasonLabel').textContent = state.settings.season;
    if (!open.ok) {
      show($('inscFormWrap'), false);
      show($('inscClosedWrap'), true);
      $('inscClosedMsg').textContent = open.reason;
      return;
    }
    show($('inscClosedWrap'), false);
    show($('inscFormWrap'), true);
    initCategorySelect();
    renderKitSection();
    renderFeeCheckboxes();
    initPaymentButtons();
    refreshCart();

    if ($('insBirth')) $('insBirth').addEventListener('change', onBirthChange);
    if ($('insPhoto')) $('insPhoto').addEventListener('change', function (e) {
      handlePhoto(e.target.files[0]);
    });
    ['insName', 'insSurname', 'insDni'].forEach(function (id) {
      const node = $(id);
      if (node) node.addEventListener('blur', refreshCart);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : globalThis);
