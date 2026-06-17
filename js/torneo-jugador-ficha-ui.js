/**
 * Ficha jugador/a torneo — torneo-jugador.html
 */
(function (global) {
  'use strict';

  const API = '/.netlify/functions/torneo-jugador-ficha';

  function $(id) {
    return global.document.getElementById(id);
  }

  function getInviteToken() {
    return new URLSearchParams(global.location.search || '').get('invite') || '';
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

  function updateAgeHint() {
    const birth = $('tjBirth') && $('tjBirth').value;
    const age = ageFromBirth(birth);
    const hint = $('tjAgeHint');
    if (!hint) return;
    if (age == null) {
      hint.hidden = true;
      hint.textContent = '';
      return;
    }
    hint.hidden = false;
    hint.textContent = 'Edad: ' + age + ' años' + (age < 18 ? ' (menor — datos de tutor/a obligatorios)' : '');
  }

  function toggleGuardian() {
    const birth = $('tjBirth') && $('tjBirth').value;
    const age = ageFromBirth(birth);
    updateAgeHint();
    const block = $('tjGuardianBlock');
    if (!block) return;
    const minor = age != null && age < 18;
    block.hidden = !minor;
    block.querySelectorAll('input').forEach(function (el) {
      if (el.id && el.id.indexOf('tjGuardian') === 0) el.required = minor;
    });
  }

  async function api(action, extra) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        Object.assign({ action: action, inviteToken: getInviteToken() }, extra || {})
      )
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) throw new Error(data.error || 'Error');
    return data;
  }

  function renderHeader(ficha) {
    $('tjTeamName').textContent = ficha.teamName || 'Equipo';
    $('tjEventName').textContent = ficha.eventName || 'Torneo Fútbol 7 — 2026';
    const cats = Array.isArray(ficha.categoryLabels) ? ficha.categoryLabels.join(', ') : '';
    $('tjCategories').textContent = cats || '—';
    if (ficha.inviteEmail && $('tjInviteEmail')) $('tjInviteEmail').value = ficha.inviteEmail;
  }

  function showForm() {
    $('tjLoading').hidden = true;
    $('tjDone').hidden = true;
    $('tjFormWrap').hidden = false;
  }

  function showDone(ficha) {
    $('tjLoading').hidden = true;
    $('tjFormWrap').hidden = true;
    $('tjDone').hidden = false;
    const name = ficha.submittedData
      ? [ficha.submittedData.name, ficha.submittedData.surname].filter(Boolean).join(' ')
      : '';
    $('tjDoneText').textContent = name
      ? 'Gracias, ' + name + '. Tu ficha ha quedado registrada.'
      : 'Tu ficha ha quedado registrada. El responsable del equipo y el club la recibirán.';
  }

  function readFormBase() {
    return {
      name: ($('tjName') && $('tjName').value.trim()) || '',
      surname: ($('tjSurname') && $('tjSurname').value.trim()) || '',
      dniType: ($('tjDniType') && $('tjDniType').value) || 'espanol',
      dni: ($('tjDni') && $('tjDni').value.trim()) || '',
      birthDate: ($('tjBirth') && $('tjBirth').value) || '',
      email: ($('tjEmail') && $('tjEmail').value.trim()) || '',
      phone: ($('tjPhone') && $('tjPhone').value.trim()) || '',
      guardian: {
        name: ($('tjGuardianName') && $('tjGuardianName').value.trim()) || '',
        surname: ($('tjGuardianSurname') && $('tjGuardianSurname').value.trim()) || '',
        dniType: ($('tjGuardianDniType') && $('tjGuardianDniType').value) || 'espanol',
        dni: ($('tjGuardianDni') && $('tjGuardianDni').value.trim()) || '',
        phone: ($('tjGuardianPhone') && $('tjGuardianPhone').value.trim()) || '',
        email: ($('tjGuardianEmail') && $('tjGuardianEmail').value.trim()) || ''
      },
      photoConsent: !!($('tjPhotoConsent') && $('tjPhotoConsent').checked),
      clubRulesAccepted: !!($('tjClubRules') && $('tjClubRules').checked),
      playerConsent: true
    };
  }

  async function readFormWithDocuments() {
    const base = readFormBase();
    const U = global.TorneoDocumentUpload;
    if (!U) throw new Error('Subida de documentos no disponible.');
    const documents = await U.readLabeledInputs([
      { el: $('tjDocAnverso'), id: 'dni_anverso', label: 'DNI anverso' },
      { el: $('tjDocReverso'), id: 'dni_reverso', label: 'DNI reverso' },
      { el: $('tjDocOtro'), id: 'otro_doc', label: 'Otro documento' }
    ]);
    if (!documents.length) {
      throw new Error('Sube al menos el DNI por el anverso u otro documento válido.');
    }
    return Object.assign({}, base, { documents: documents });
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const errEl = $('tjError');
    const btn = $('tjSubmitBtn');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando…';
    }
    try {
      const ficha = await readFormWithDocuments();
      const data = await api('submit', { ficha: ficha });
      showDone(data.ficha || {});
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudo enviar.';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Enviar ficha';
      }
    }
  }

  async function init() {
    const token = getInviteToken();
    if ($('tjDocLegal') && global.TorneoDocumentUpload) {
      $('tjDocLegal').textContent = global.TorneoDocumentUpload.TORNEO_DOC_LEGAL_TEXT;
    }
    if (!token) {
      $('tjLoading').hidden = true;
      $('tjErrorMain').hidden = false;
      $('tjErrorMain').textContent = 'Enlace no válido. Pide al responsable del equipo que te reenvíe la invitación.';
      return;
    }
    $('tjBirth') && $('tjBirth').addEventListener('change', toggleGuardian);
    $('tjBirth') && $('tjBirth').addEventListener('input', toggleGuardian);
    $('tjForm') && $('tjForm').addEventListener('submit', handleSubmit);

    try {
      const data = await api('get', {});
      const ficha = data.ficha || {};
      renderHeader(ficha);
      if (ficha.alreadySubmitted) {
        showDone(ficha);
        return;
      }
      showForm();
      toggleGuardian();
    } catch (err) {
      $('tjLoading').hidden = true;
      $('tjErrorMain').hidden = false;
      $('tjErrorMain').textContent = err.message || 'No se pudo cargar la ficha.';
    }
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
