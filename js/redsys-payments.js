/**
 * TPV virtual Caja Rural (Redsys) — CDSANABRIACF / cdsanabriacf2026
 * Tarjeta + Bizum (Bizum requiere REDSYS_BIZUM_ENABLED=true en Netlify).
 */
(function (global) {
  'use strict';

  const API_CREATE = '/.netlify/functions/redsys-create-payment';
  const API_STATUS = '/.netlify/functions/redsys-payment-status';
  const API_CONFIG = '/.netlify/functions/redsys-config';

  const runtime = {
    loaded: false,
    loading: null,
    cardEnabled: false,
    bizumEnabled: false
  };

  function applyConfig(data) {
    runtime.loaded = true;
    runtime.cardEnabled = !!(data && data.cardEnabled);
    runtime.bizumEnabled = !!(data && data.bizumEnabled);
  }

  async function loadConfig(force) {
    if (runtime.loaded && !force) return runtime;
    if (runtime.loading && !force) return runtime.loading;

    runtime.loading = (async function () {
      try {
        if (isLocalFile()) {
          applyConfig({
            cardEnabled: global.CDSAN_REDSYS_ENABLED !== false,
            bizumEnabled: global.CDSAN_REDSYS_BIZUM_ENABLED === true
          });
          return runtime;
        }
        const res = await fetch(API_CONFIG, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        applyConfig(data);
      } catch (_) {
        applyConfig({
          cardEnabled: global.CDSAN_REDSYS_ENABLED !== false,
          bizumEnabled: global.CDSAN_REDSYS_BIZUM_ENABLED === true
        });
      }
      return runtime;
    })();

    return runtime.loading;
  }

  function isEnabled() {
    if (runtime.loaded) return runtime.cardEnabled;
    return global.CDSAN_REDSYS_ENABLED !== false;
  }

  function isBizumEnabled() {
    if (runtime.loaded) return runtime.bizumEnabled;
    return global.CDSAN_REDSYS_BIZUM_ENABLED === true;
  }

  function hasOnlinePayment() {
    return isEnabled() || isBizumEnabled();
  }

  function isLocalFile() {
    return global.location && global.location.protocol === 'file:';
  }

  async function postJson(url, payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Error ${res.status}`);
    }
    return data;
  }

  function submitRedirectForm(redirect) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = redirect.gatewayUrl;
    form.style.display = 'none';
    const fields = {
      Ds_SignatureVersion: redirect.Ds_SignatureVersion,
      Ds_MerchantParameters: redirect.Ds_MerchantParameters,
      Ds_Signature: redirect.Ds_Signature
    };
    Object.keys(fields).forEach(function (name) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = fields[name];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  function normalizePayMethod(value) {
    return String(value || '').trim().toLowerCase() === 'bizum' ? 'bizum' : 'card';
  }

  async function startPayment(payload) {
    if (isLocalFile()) {
      throw new Error('El pago online solo está disponible en la web publicada del club (HTTPS).');
    }
    const payMethod = normalizePayMethod(payload.payMethod);
    const data = await postJson(API_CREATE, Object.assign({}, payload, { payMethod: payMethod }));
    if (!data.ok || !data.redirect) {
      throw new Error(data.error || 'No se pudo iniciar el pago');
    }
    submitRedirectForm(data.redirect);
    return data.orderId;
  }

  async function payMembership(opts) {
    const amountEur = Number(opts.amountEur);
    if (!Number.isFinite(amountEur) || amountEur <= 0) {
      return null;
    }
    return startPayment({
      type: 'membership_fee',
      payMethod: opts.payMethod || 'card',
      amountEur: amountEur,
      email: opts.email,
      memberId: opts.memberId,
      description: opts.description || 'Cuota socio CD Sanabria CF (' + amountEur + ' EUR)'
    });
  }

  async function payPlayerInscription(opts) {
    const amountEur = Number(opts.amountEur);
    if (!Number.isFinite(amountEur) || amountEur <= 0) {
      return null;
    }
    return startPayment({
      type: 'player_inscription',
      payMethod: opts.payMethod || 'card',
      amountEur: amountEur,
      email: opts.email,
      playerId: opts.playerId || null,
      playerRegistration: opts.playerRegistration || null,
      description: opts.description || 'Inscripción jugador/a (' + amountEur + ' EUR)'
    });
  }

  async function payEventRegistration(opts) {
    const amountEur = Number(opts.amountEur);
    if (!Number.isFinite(amountEur) || amountEur <= 0) {
      return null;
    }
    return startPayment({
      type: 'event_registration',
      payMethod: opts.payMethod || 'card',
      amountEur: amountEur,
      email: opts.email,
      eventId: opts.eventId,
      priceTier: opts.priceTier,
      participant: opts.participant,
      guests: opts.guests || [],
      registrationBundle: opts.registrationBundle || null,
      description: opts.description || 'Inscripción evento (' + amountEur + ' EUR)'
    });
  }

  async function getPaymentStatus(orderId) {
    const res = await fetch(API_STATUS + '?order=' + encodeURIComponent(orderId));
    return res.json();
  }

  global.CdsanRedsys = {
    loadConfig: loadConfig,
    isEnabled: isEnabled,
    isBizumEnabled: isBizumEnabled,
    hasOnlinePayment: hasOnlinePayment,
    payMembership: payMembership,
    payPlayerInscription: payPlayerInscription,
    payEventRegistration: payEventRegistration,
    getPaymentStatus: getPaymentStatus,
    startPayment: startPayment
  };
})(typeof window !== 'undefined' ? window : globalThis);
