/**
 * Plantilla conjunta torneo F7 — formulario multi-jugador (opción A).
 * DNI/documentos opcionales al guardar; se pueden subir después desde el panel.
 */
(function (global) {
  'use strict';

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

  function ageFromBirth(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
    return a;
  }

  function slotKey(i) {
    return 'slot_' + i;
  }

  function findFichaForSlot(fichas, index) {
    const list = Array.isArray(fichas) ? fichas : [];
    const bySlot = list.find(function (f) {
      return f.slotIndex === index;
    });
    if (bySlot) return bySlot;
    if (list[index]) return list[index];
    return null;
  }

  function playerLabel(ficha, index) {
    if (ficha && ficha.data && (ficha.data.name || ficha.data.surname)) {
      return [ficha.data.name, ficha.data.surname].filter(Boolean).join(' ');
    }
    if (ficha && ficha.label && ficha.label.indexOf('@') < 0) return ficha.label;
    return 'Jugador/a ' + (index + 1);
  }

  function slotStatusBadge(ficha) {
    if (!ficha || String(ficha.status || '') !== 'enviada') {
      return '<span class="roster-badge roster-badge--pending">Sin datos</span>';
    }
    if (ficha.documentsPending) {
      return '<span class="roster-badge roster-badge--docs">Datos OK · DNI pendiente</span>';
    }
    return '<span class="roster-badge roster-badge--ok">Completo</span>';
  }

  function guardianFieldsHtml(i, hidden) {
    return (
      '<div class="roster-guardian' +
      (hidden ? ' roster-guardian--hidden' : '') +
      '" data-guardian-for="' +
      i +
      '">' +
      '<p class="roster-guardian-title">Tutor/a (menor de edad) *</p>' +
      '<div class="grid2">' +
      '<div><label>Nombre tutor/a</label><input type="text" data-field="guardianName" autocomplete="off"></div>' +
      '<div><label>Apellidos tutor/a</label><input type="text" data-field="guardianSurname" autocomplete="off"></div>' +
      '</div>' +
      '<label>Tipo documento tutor/a</label>' +
      '<select data-field="guardianDniType"><option value="espanol">DNI español</option><option value="extranjero">Extranjero / NIE</option></select>' +
      '<label>Nº documento tutor/a</label>' +
      '<input type="text" data-field="guardianDni" autocomplete="off">' +
      '<label>Teléfono tutor/a</label>' +
      '<input type="tel" data-field="guardianPhone" autocomplete="tel">' +
      '<label>Email tutor/a (opcional)</label>' +
      '<input type="email" data-field="guardianEmail" autocomplete="email">' +
      '</div>'
    );
  }

  function slotFormHtml(i, ficha, locked) {
    const d = ficha && ficha.data ? ficha.data : {};
    const g = d.guardian || {};
    const birth = d.birthDate || '';
    const minor = ageFromBirth(birth) != null && ageFromBirth(birth) < 18;
    const fichaId = ficha && ficha.id ? ficha.id : '';
    const showDocs =
      ficha && String(ficha.status || '') === 'enviada' && ficha.documentsPending && !locked;

    return (
      '<div class="roster-slot" data-slot="' +
      i +
      '" data-ficha-id="' +
      escapeHtml(fichaId) +
      '">' +
      '<details class="roster-accordion"' +
      (i === 0 ? ' open' : '') +
      '>' +
      '<summary><span class="roster-summary-name">' +
      escapeHtml(playerLabel(ficha, i)) +
      '</span> ' +
      slotStatusBadge(ficha) +
      '</summary>' +
      '<div class="roster-slot-body">' +
      (locked ? '<p class="roster-locked-msg">Plantilla enviada al club. Solo lectura.</p>' : '') +
      '<div class="grid2">' +
      '<div><label>Nombre *</label><input type="text" data-field="name" required autocomplete="given-name" value="' +
      escapeHtml(d.name || '') +
      '" ' +
      (locked ? 'readonly' : '') +
      '></div>' +
      '<div><label>Apellidos *</label><input type="text" data-field="surname" required autocomplete="family-name" value="' +
      escapeHtml(d.surname || '') +
      '" ' +
      (locked ? 'readonly' : '') +
      '></div>' +
      '</div>' +
      '<label>Tipo documento *</label>' +
      '<select data-field="dniType" ' +
      (locked ? 'disabled' : '') +
      '><option value="espanol"' +
      (d.dniType !== 'extranjero' ? ' selected' : '') +
      '>DNI español</option><option value="extranjero"' +
      (d.dniType === 'extranjero' ? ' selected' : '') +
      '>Extranjero / NIE</option></select>' +
      '<label>Nº documento (DNI/NIE) *</label>' +
      '<input type="text" data-field="dni" required autocomplete="off" value="' +
      escapeHtml(d.dni || '') +
      '" ' +
      (locked ? 'readonly' : '') +
      '>' +
      '<label>Fecha de nacimiento *</label>' +
      '<input type="date" data-field="birthDate" required value="' +
      escapeHtml(birth) +
      '" ' +
      (locked ? 'readonly' : '') +
      '>' +
      '<p class="roster-age-hint" data-age-hint="' +
      i +
      '" hidden></p>' +
      '<label>Email (opcional)</label>' +
      '<input type="email" data-field="email" autocomplete="email" value="' +
      escapeHtml(d.email || '') +
      '" ' +
      (locked ? 'readonly' : '') +
      '>' +
      '<label>Teléfono (opcional)</label>' +
      '<input type="tel" data-field="phone" autocomplete="tel" value="' +
      escapeHtml(d.phone || '') +
      '" ' +
      (locked ? 'readonly' : '') +
      '>' +
      guardianFieldsHtml(i, !minor) +
      '<div class="roster-consents">' +
      '<label class="roster-check"><input type="checkbox" data-field="clubRulesAccepted"' +
      (d.clubRulesAccepted ? ' checked' : '') +
      (locked ? ' disabled' : '') +
      '> Acepto normas del torneo y del club *</label>' +
      '<label class="roster-check"><input type="checkbox" data-field="photoConsent"' +
      (d.photoConsent ? ' checked' : '') +
      (locked ? ' disabled' : '') +
      '> Consentimiento de imagen *</label>' +
      '</div>' +
      (showDocs
        ? '<div class="roster-docs-block">' +
          '<p class="roster-docs-title">📎 Subir DNI (puedes hacerlo ahora o más tarde)</p>' +
          '<p class="doc-legal roster-doc-legal"></p>' +
          '<label>DNI anverso</label>' +
          '<input type="file" data-doc="dni_anverso" accept="image/jpeg,image/png,image/webp,application/pdf">' +
          '<label>DNI reverso (recomendado)</label>' +
          '<input type="file" data-doc="dni_reverso" accept="image/jpeg,image/png,image/webp,application/pdf">' +
          '<button type="button" class="btn btn-outline roster-doc-btn" data-upload-docs="' +
          escapeHtml(fichaId) +
          '" style="width:100%;margin-top:8px;">📤 Enviar documentos de este jugador</button>' +
          '<p class="roster-doc-ok" hidden></p>' +
          '</div>'
        : ficha && ficha.documentsComplete
          ? '<p class="hint-ok" style="margin-top:10px;">✅ Documentación subida</p>'
          : !locked
            ? '<p class="roster-docs-later">Los documentos DNI se podrán subir después de guardar la plantilla.</p>'
            : '') +
      '</div></details></div>'
    );
  }

  function readField(el, name) {
    const node = el.querySelector('[data-field="' + name + '"]');
    if (!node) return '';
    if (node.type === 'checkbox') return !!node.checked;
    return String(node.value || '').trim();
  }

  function readPlayerFromSlot(el, index) {
    const guardian = {
      name: readField(el, 'guardianName'),
      surname: readField(el, 'guardianSurname'),
      dniType: readField(el, 'guardianDniType') || 'espanol',
      dni: readField(el, 'guardianDni'),
      phone: readField(el, 'guardianPhone'),
      email: readField(el, 'guardianEmail')
    };
    return {
      fichaId: el.getAttribute('data-ficha-id') || '',
      slotIndex: index,
      name: readField(el, 'name'),
      surname: readField(el, 'surname'),
      dniType: readField(el, 'dniType') || 'espanol',
      dni: readField(el, 'dni'),
      birthDate: readField(el, 'birthDate'),
      email: readField(el, 'email'),
      phone: readField(el, 'phone'),
      guardian: guardian,
      clubRulesAccepted: readField(el, 'clubRulesAccepted'),
      photoConsent: readField(el, 'photoConsent'),
      playerConsent: true
    };
  }

  function updateAgeHint(slotEl, index) {
    const birth = readField(slotEl, 'birthDate');
    const age = ageFromBirth(birth);
    const hint = slotEl.querySelector('[data-age-hint="' + index + '"]');
    const guardian = slotEl.querySelector('[data-guardian-for="' + index + '"]');
    if (!hint) return;
    if (age == null) {
      hint.hidden = true;
      if (guardian) guardian.classList.add('roster-guardian--hidden');
      return;
    }
    hint.hidden = false;
    hint.textContent = 'Edad: ' + age + ' años' + (age < 18 ? ' — datos de tutor/a obligatorios' : '');
    if (guardian) {
      if (age < 18) guardian.classList.remove('roster-guardian--hidden');
      else guardian.classList.add('roster-guardian--hidden');
    }
  }

  function bindSlotEvents(wrap, locked) {
    wrap.querySelectorAll('.roster-slot').forEach(function (slotEl) {
      const index = parseInt(slotEl.getAttribute('data-slot'), 10) || 0;
      const birthInput = slotEl.querySelector('[data-field="birthDate"]');
      if (birthInput && !locked) {
        birthInput.addEventListener('change', function () {
          updateAgeHint(slotEl, index);
        });
        birthInput.addEventListener('input', function () {
          updateAgeHint(slotEl, index);
        });
        updateAgeHint(slotEl, index);
      }
      const nameInput = slotEl.querySelector('[data-field="name"]');
      const surnameInput = slotEl.querySelector('[data-field="surname"]');
      function syncSummary() {
        const summary = slotEl.querySelector('.roster-summary-name');
        if (!summary) return;
        const n = readField(slotEl, 'name');
        const s = readField(slotEl, 'surname');
        summary.textContent = [n, s].filter(Boolean).join(' ') || 'Jugador/a ' + (index + 1);
      }
      if (nameInput) nameInput.addEventListener('input', syncSummary);
      if (surnameInput) surnameInput.addEventListener('input', syncSummary);
    });

    wrap.querySelectorAll('[data-upload-docs]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleUploadDocs(btn.getAttribute('data-upload-docs'), btn.closest('.roster-slot'));
      });
    });
  }

  async function handleUploadDocs(fichaId, slotEl) {
    if (!fichaId || !global.TorneoEquipoManage) return;
    const errEl = $('teRosterError');
    const okEl = slotEl && slotEl.querySelector('.roster-doc-ok');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (okEl) {
      okEl.hidden = true;
      okEl.textContent = '';
    }
    btnDisable(slotEl, true);
    try {
      const U = global.TorneoDocumentUpload;
      if (!U) throw new Error('Subida de documentos no disponible.');
      const documents = await U.readLabeledInputs([
        { el: slotEl.querySelector('[data-doc="dni_anverso"]'), id: 'dni_anverso', label: 'DNI anverso' },
        { el: slotEl.querySelector('[data-doc="dni_reverso"]'), id: 'dni_reverso', label: 'DNI reverso' }
      ]);
      if (!documents.length) {
        throw new Error('Selecciona al menos el DNI por el anverso.');
      }
      const panel = await global.TorneoEquipoManage.uploadFichaDocuments(fichaId, documents);
      if (global.TorneoEquipoPanelRefresh) global.TorneoEquipoPanelRefresh(panel);
      if (okEl) {
        okEl.hidden = false;
        okEl.textContent = '✅ Documentos enviados correctamente.';
      }
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudieron subir los documentos.';
      }
    } finally {
      btnDisable(slotEl, false);
    }
  }

  function btnDisable(slotEl, disabled) {
    if (!slotEl) return;
    const btn = slotEl.querySelector('.roster-doc-btn');
    if (btn) btn.disabled = !!disabled;
  }

  async function handleSaveBatch() {
    const wrap = $('teRosterBatchWrap');
    const errEl = $('teRosterError');
    const okEl = $('teRosterOk');
    const btn = $('teRosterSaveBtn');
    if (!wrap || !global.TorneoEquipoManage) return;
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (okEl) okEl.hidden = true;
    const slots = wrap.querySelectorAll('.roster-slot');
    const players = [];
    slots.forEach(function (slotEl, i) {
      players.push(readPlayerFromSlot(slotEl, i));
    });
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando plantilla…';
    }
    try {
      const panel = await global.TorneoEquipoManage.saveRosterBatch(players);
      if (global.TorneoEquipoPanelRefresh) global.TorneoEquipoPanelRefresh(panel);
      if (okEl) {
        okEl.hidden = false;
        okEl.textContent =
          '✅ Plantilla guardada. El club ha recibido los datos. Puedes subir el DNI de cada jugador cuando lo tengas.';
      }
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudo guardar la plantilla.';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📋 Guardar plantilla completa';
      }
    }
  }

  function render(panel) {
    const wrap = $('teRosterBatchWrap');
    const meta = $('teRosterMeta');
    const saveBtn = $('teRosterSaveBtn');
    if (!wrap) return;

    const playerCount = parseInt(panel.playerCount, 10) || 0;
    const fichas = Array.isArray(panel.fichas) ? panel.fichas : [];
    const submitted = parseInt(panel.fichasSubmitted, 10) || 0;
    const docsPending = parseInt(panel.documentsPendingCount, 10) || 0;
    const locked = ['enviada_club', 'pagada', 'pendiente_pago'].includes(String(panel.plantillaStatus || ''));

    if (meta) {
      meta.innerHTML =
        '<strong>' +
        submitted +
        ' / ' +
        playerCount +
        '</strong> jugadores con datos guardados' +
        (docsPending > 0 && !locked
          ? ' · <span style="color:#b45309;">' + docsPending + ' DNI pendiente(s)</span>'
          : docsPending === 0 && submitted >= playerCount
            ? ' · <span style="color:#059669;">documentación al día</span>'
            : '') +
        '. Los DNI pueden subirse después, siempre antes del inicio del torneo.';
    }

    if (playerCount < 1) {
      wrap.innerHTML = '<p class="sub">Número de jugadores no definido en la preinscripción.</p>';
      return;
    }

    let html = '';
    for (let i = 0; i < playerCount; i++) {
      html += slotFormHtml(i, findFichaForSlot(fichas, i), locked);
    }
    wrap.innerHTML = html;

    wrap.querySelectorAll('.roster-doc-legal').forEach(function (el) {
      if (global.TorneoDocumentUpload && global.TorneoDocumentUpload.TORNEO_DOC_LEGAL_TEXT) {
        el.textContent = global.TorneoDocumentUpload.TORNEO_DOC_LEGAL_TEXT;
      }
    });

    bindSlotEvents(wrap, locked);

    if (saveBtn) {
      saveBtn.style.display = locked ? 'none' : 'inline-flex';
      saveBtn.disabled = locked;
    }
  }

  function init() {
    const saveBtn = $('teRosterSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', handleSaveBatch);
    const toggle = $('teInviteToggle');
    const inviteBlock = $('teInviteBlock');
    if (toggle && inviteBlock) {
      toggle.addEventListener('click', function () {
        const open = inviteBlock.hidden;
        inviteBlock.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = open ? '▲ Ocultar invitaciones por email' : '▼ Alternativa: invitar jugadores por email';
      });
    }
  }

  global.TorneoRosterBatch = {
    render: render,
    init: init
  };
})(typeof window !== 'undefined' ? window : globalThis);
