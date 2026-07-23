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
          activeAccessCode: session.activeAccessCode || session.accessCode,
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

  async function saveRosterBatch(players) {
    const data = await post('save_roster_batch', { players: players });
    return data.panel;
  }

  async function uploadFichaDocuments(fichaId, documents) {
    const data = await post('upload_ficha_documents', {
      fichaId: fichaId,
      documents: documents
    });
    return data.panel;
  }

  async function finalizeInscription(opts) {
    return post('finalize', {
      inscripcionPremiosAceptados: !!(opts && opts.inscripcionPremiosAceptados),
      payMethod: (opts && opts.payMethod) || 'card',
      changePayToCard: !!(opts && opts.changePayToCard)
    });
  }

  async function changePayMethodToCard() {
    return finalizeInscription({
      payMethod: 'card',
      changePayToCard: true,
      inscripcionPremiosAceptados: true
    });
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
    saveRosterBatch: saveRosterBatch,
    uploadFichaDocuments: uploadFichaDocuments,
    finalizeInscription: finalizeInscription,
    changePayMethodToCard: changePayMethodToCard,
    submitRedsysRedirect: submitRedsysRedirect
  };
})(typeof window !== 'undefined' ? window : globalThis);
