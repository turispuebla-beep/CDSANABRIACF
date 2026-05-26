/**
 * Panel admin — configuración inscripciones jugador/a
 */
(function (global) {
  'use strict';

  function el(id) {
    return document.getElementById(id);
  }

  function renderCategoryFeesTable(settings) {
    const tbody = el('inscCategoryFeesBody');
    if (!tbody || !global.ClubInscriptionConfig) return;
    tbody.innerHTML = '';
    global.ClubInscriptionConfig.CATEGORIES.forEach(function (cat) {
      const tr = document.createElement('tr');
      const ficha = Number((settings.categoryFees.ficha || {})[cat.id] || 0);
      const socio = Number((settings.categoryFees.socio || {})[cat.id] || 0);
      tr.innerHTML =
        '<td style="padding:8px;border:1px solid #e2e8f0;">' +
        cat.label +
        '</td>' +
        '<td style="padding:8px;border:1px solid #e2e8f0;"><input type="number" min="0" step="0.01" data-cat="' +
        cat.id +
        '" data-fee="ficha" value="' +
        ficha +
        '" style="width:100%;padding:6px;"></td>' +
        '<td style="padding:8px;border:1px solid #e2e8f0;"><input type="number" min="0" step="0.01" data-cat="' +
        cat.id +
        '" data-fee="socio" value="' +
        socio +
        '" style="width:100%;padding:6px;"></td>';
      tbody.appendChild(tr);
    });
  }

  function renderGarments(settings) {
    const wrap = el('inscGarmentsGrid');
    if (!wrap || !global.ClubInscriptionConfig) return;
    wrap.innerHTML = '';
    global.ClubInscriptionConfig.GARMENT_IDS.forEach(function (gid) {
      const g = settings.garments[gid] || {};
      const div = document.createElement('div');
      div.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;';
      div.innerHTML =
        '<label style="display:flex;align-items:center;gap:8px;font-weight:600;margin-bottom:8px;">' +
        '<input type="checkbox" data-garment-enabled="' +
        gid +
        '" ' +
        (g.enabled !== false ? 'checked' : '') +
        '> ' +
        (g.label || gid) +
        '</label>' +
        '<label style="font-size:0.85rem;">Precio (€)</label>' +
        '<input type="number" min="0" step="0.01" data-garment-price="' +
        gid +
        '" value="' +
        Number(g.price || 0) +
        '" style="width:100%;padding:6px;margin-top:4px;">';
      wrap.appendChild(div);
    });
  }

  function loadInscriptionAdminForm() {
    if (!global.ClubInscriptionConfig) return;
    const s = global.ClubInscriptionConfig.read();
    if (el('inscSeason')) el('inscSeason').value = s.season || '2026-2027';
    if (el('inscOpen')) el('inscOpen').checked = !!s.registrationsOpen;
    if (el('inscOpenFrom')) el('inscOpenFrom').value = s.openFrom ? s.openFrom.slice(0, 16) : '';
    if (el('inscOpenUntil')) el('inscOpenUntil').value = s.openUntil ? s.openUntil.slice(0, 16) : '';
    if (el('inscChargeFicha')) el('inscChargeFicha').checked = !!s.chargeFicha;
    if (el('inscChargeSocio')) el('inscChargeSocio').checked = !!s.chargeSocio;
    if (el('inscKitMode')) el('inscKitMode').value = s.kitMode || 'per_garment';
    if (el('inscPayCard')) el('inscPayCard').checked = s.paymentMethods.card !== false;
    if (el('inscPayBizum')) el('inscPayBizum').checked = !!s.paymentMethods.bizum;
    if (el('inscPayTransfer')) el('inscPayTransfer').checked = s.paymentMethods.transfer !== false;
    renderCategoryFeesTable(s);
    renderGarments(s);
    updateInscriptionStatusBadge();
  }

  function updateInscriptionStatusBadge() {
    const badge = el('inscStatusBadge');
    if (!badge || !global.ClubInscriptionConfig) return;
    const st = global.ClubInscriptionConfig.isOpenNow();
    if (st.ok) {
      badge.textContent = 'ABIERTAS';
      badge.style.background = '#059669';
    } else {
      badge.textContent = 'CERRADAS';
      badge.style.background = '#dc2626';
    }
    badge.title = st.reason || '';
  }

  function collectSettingsFromForm() {
    const base = global.ClubInscriptionConfig.read();
    const categoryFees = { ficha: {}, socio: {} };
    document.querySelectorAll('#inscCategoryFeesBody input[data-cat]').forEach(function (inp) {
      const cat = inp.getAttribute('data-cat');
      const fee = inp.getAttribute('data-fee');
      if (!cat || !fee) return;
      categoryFees[fee][cat] = Number(inp.value) || 0;
    });
    const garments = JSON.parse(JSON.stringify(base.garments));
    global.ClubInscriptionConfig.GARMENT_IDS.forEach(function (gid) {
      const en = document.querySelector('[data-garment-enabled="' + gid + '"]');
      const pr = document.querySelector('[data-garment-price="' + gid + '"]');
      garments[gid] = garments[gid] || {};
      garments[gid].enabled = en ? en.checked : true;
      garments[gid].price = pr ? Number(pr.value) || 0 : 0;
    });
    return {
      season: (el('inscSeason') && el('inscSeason').value.trim()) || '2026-2027',
      registrationsOpen: !!(el('inscOpen') && el('inscOpen').checked),
      openFrom: el('inscOpenFrom') && el('inscOpenFrom').value ? new Date(el('inscOpenFrom').value).toISOString() : '',
      openUntil: el('inscOpenUntil') && el('inscOpenUntil').value ? new Date(el('inscOpenUntil').value).toISOString() : '',
      chargeFicha: !!(el('inscChargeFicha') && el('inscChargeFicha').checked),
      chargeSocio: !!(el('inscChargeSocio') && el('inscChargeSocio').checked),
      kitMode: (el('inscKitMode') && el('inscKitMode').value) || 'per_garment',
      categoryFees: categoryFees,
      garments: garments,
      paymentMethods: {
        card: !!(el('inscPayCard') && el('inscPayCard').checked),
        bizum: !!(el('inscPayBizum') && el('inscPayBizum').checked),
        transfer: !!(el('inscPayTransfer') && el('inscPayTransfer').checked)
      }
    };
  }

  function saveInscriptionAdminSettings() {
    if (!global.ClubInscriptionConfig) {
      alert('Módulo de inscripciones no cargado');
      return;
    }
    const merged = global.ClubInscriptionConfig.write(collectSettingsFromForm());
    updateInscriptionStatusBadge();
    alert('✅ Configuración de inscripciones guardada.\nTemporada: ' + merged.season);
  }

  global.loadInscriptionAdminForm = loadInscriptionAdminForm;
  global.saveInscriptionAdminSettings = saveInscriptionAdminSettings;
  global.updateInscriptionStatusBadge = updateInscriptionStatusBadge;

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('inscSeason')) {
      loadInscriptionAdminForm();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
