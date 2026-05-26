/**
 * Panel admin — columnas exportación jugadores/as
 */
(function (global) {
  'use strict';

  function el(id) {
    return document.getElementById(id);
  }

  function renderExportFieldsGrid() {
    const wrap = el('playerExportFieldsGrid');
    if (!wrap || !global.ClubPlayerExportConfig) return;
    const settings = global.ClubPlayerExportConfig.read();
    const enabled = settings.enabledFields || {};
    const groups = {};
    global.ClubPlayerExportConfig.FIELD_CATALOG.forEach(function (f) {
      if (!groups[f.group]) groups[f.group] = [];
      groups[f.group].push(f);
    });

    wrap.innerHTML = '';
    Object.keys(groups).forEach(function (groupKey) {
      const box = document.createElement('div');
      box.style.cssText = 'margin-bottom:14px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;';
      const title = global.ClubPlayerExportConfig.GROUP_LABELS[groupKey] || groupKey;
      box.innerHTML = '<h4 style="margin:0 0 10px;color:#1e3a8a;font-size:0.95rem;">' + title + '</h4>';
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;';
      groups[groupKey].forEach(function (f) {
        const lab = document.createElement('label');
        lab.style.cssText = 'display:flex;align-items:flex-start;gap:8px;font-size:0.88rem;';
        const checked = f.mandatory || enabled[f.id];
        const disabled = !!f.mandatory;
        let hint = '';
        if (f.mandatory) hint = ' (siempre)';
        if (f.clubOnly) hint += ' — club';
        lab.innerHTML =
          '<input type="checkbox" data-export-field="' +
          f.id +
          '" ' +
          (checked ? 'checked' : '') +
          (disabled ? ' disabled' : '') +
          ' style="margin-top:3px;">' +
          '<span>' +
          f.label +
          hint +
          '</span>';
        grid.appendChild(lab);
      });
      box.appendChild(grid);
      wrap.appendChild(box);
    });
  }

  function collectExportFieldsFromForm() {
    const base = global.ClubPlayerExportConfig.read();
    const enabled = { ...(base.enabledFields || {}) };
    global.ClubPlayerExportConfig.FIELD_CATALOG.forEach(function (f) {
      if (f.mandatory) {
        enabled[f.id] = true;
        return;
      }
      const cb = document.querySelector('[data-export-field="' + f.id + '"]');
      enabled[f.id] = cb ? cb.checked : !!f.defaultEnabled;
    });
    return { enabledFields: enabled };
  }

  function savePlayerExportFieldSettings() {
    if (!global.ClubPlayerExportConfig) {
      alert('Módulo de exportación no cargado');
      return;
    }
    global.ClubPlayerExportConfig.write(collectExportFieldsFromForm());
    renderExportFieldsGrid();
    alert('✅ Columnas de exportación guardadas.\nNombre, apellidos y DNI siempre se incluyen.');
  }

  function selectAllExportFields(on) {
    if (!global.ClubPlayerExportConfig) return;
    document.querySelectorAll('[data-export-field]').forEach(function (cb) {
      if (cb.disabled) return;
      cb.checked = !!on;
    });
  }

  function loadPlayerExportAdminForm() {
    renderExportFieldsGrid();
  }

  global.loadPlayerExportAdminForm = loadPlayerExportAdminForm;
  global.savePlayerExportFieldSettings = savePlayerExportFieldSettings;
  global.selectAllExportFields = selectAllExportFields;
  global.renderExportFieldsGrid = renderExportFieldsGrid;

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('playerExportFieldsGrid')) {
      loadPlayerExportAdminForm();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
