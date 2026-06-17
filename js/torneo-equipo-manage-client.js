/**
 * Cliente API — panel responsable torneo (invitar, entrenador, finalizar).
 */
(function (global) {
  'use strict';

  const API = '/.netlify/functions/torneo-equipo-manage';

  async function post(action, payload) {
    const session = global.TorneoResponsableAccess && global.TorneoResponsableAccess.readSession();
    if (!session) throw new Error('Sesión caducada. Vuelve a entrar con tu código.');
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        Object.assign({}, payload || {}, {
          action: action,
          accessCode: session.accessCode,
          contactEmail: session.contactEmail
        })
      )
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'No se pudo completar la operación.');
    }
    if (data.panel && global.TorneoResponsableAccess) {
      global.TorneoResponsableAccess.writeSession(session.accessCode, session.contactEmail, data.panel);
    }
    return data;
  }

  async function refreshPanel() {
    const data = await post('refresh', {});
    return data.panel;
  }

  async function saveCoach(coach) {
    const data = await post('save_coach', { coach: coach });
    return data.panel;
  }

  async function invitePlayer(invite) {
    return post('invite_player', { invite: invite });
  }

  async function finalizeInscription() {
    return post('finalize', {});
  }

  function submitRedsysRedirect(redirect) {
    if (!redirect || !redirect.gatewayUrl) return;
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = redirect.gatewayUrl;
    form.style.display = 'none';
    ['Ds_SignatureVersion', 'Ds_MerchantParameters', 'Ds_Signature'].forEach(function (name) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = redirect[name];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  global.TorneoEquipoManage = {
    refreshPanel: refreshPanel,
    saveCoach: saveCoach,
    invitePlayer: invitePlayer,
    finalizeInscription: finalizeInscription,
    submitRedsysRedirect: submitRedsysRedirect
  };
})(typeof window !== 'undefined' ? window : globalThis);
