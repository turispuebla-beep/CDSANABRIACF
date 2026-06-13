'use strict';

const crypto = require('crypto');

const REDSYS_URLS = {
  test: 'https://sis-t.redsys.es:25443/sis/realizarPago',
  production: 'https://sis.redsys.es/sis/realizarPago'
};

const REDSYS_REST_URLS = {
  test: 'https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST',
  production: 'https://sis.redsys.es/sis/rest/trataPeticionREST'
};

function isEnvTruthy(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function getRedsysConfig() {
  const env = String(process.env.REDSYS_ENV || 'test').toLowerCase() === 'production' ? 'production' : 'test';
  const merchantCode = String(process.env.REDSYS_MERCHANT_CODE || '').trim();
  const terminal = String(process.env.REDSYS_TERMINAL || '001').trim();
  const secretKey = String(process.env.REDSYS_SECRET_KEY || '').trim();
  const siteUrl = String(process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');
  if (!merchantCode || !secretKey) {
    return { ok: false, error: 'REDSYS_MERCHANT_CODE o REDSYS_SECRET_KEY no configurados en Netlify' };
  }
  if (!siteUrl) {
    return { ok: false, error: 'SITE_URL no configurado (URL pública del sitio)' };
  }
  return {
    ok: true,
    env,
    merchantCode,
    terminal,
    secretKey,
    siteUrl,
    gatewayUrl: REDSYS_URLS[env],
    restUrl: REDSYS_REST_URLS[env]
  };
}

/** Estado público (sin secretos) para la web. */
function getRedsysPublicConfig() {
  const cfg = getRedsysConfig();
  const paygoldOff = isEnvTruthy('REDSYS_PAYGOLD_DISABLED');
  return {
    ok: cfg.ok,
    cardEnabled: cfg.ok,
    bizumEnabled: cfg.ok && isEnvTruthy('REDSYS_BIZUM_ENABLED'),
    paygoldEnabled: cfg.ok && !paygoldOff,
    env: cfg.ok ? cfg.env : null
  };
}

function normalizePayMethod(value) {
  return String(value || '').trim().toLowerCase() === 'bizum' ? 'bizum' : 'card';
}

function generateRedsysOrderId() {
  const t = Date.now().toString();
  const prefix = String(1000 + (parseInt(t.slice(-3), 10) % 9000));
  const suffix = t.slice(-8).padStart(8, '0');
  return (prefix + suffix).slice(0, 12);
}

const SIGNATURE_VERSION = String(process.env.REDSYS_SIGNATURE_VERSION || 'HMAC_SHA256_V1').trim();

function processKey16(secretKey) {
  let k = String(secretKey || '').trim();
  if (k.length > 16) k = k.slice(0, 16);
  if (k.length < 16) k = k.padEnd(16, '0');
  return k;
}

function toBase64Url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function normalizeSignatureForCompare(signature) {
  return String(signature || '').trim();
}

/** Acepta firma Redsys en Base64 o Base64URL (+/ vs -_). */
function signatureToBuffer(signature) {
  let s = normalizeSignatureForCompare(signature).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function signaturesMatch(received, expected) {
  try {
    const a = signatureToBuffer(received);
    const b = signatureToBuffer(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    return true;
  } catch (_) {
    return false;
  }
}

/** Firma Redsys actual (Caja Rural / terminal 101): AES + HMAC SHA-512. */
function diversifyKeyV2(order, secretKey) {
  const key16 = Buffer.from(processKey16(secretKey), 'utf8');
  let data = Buffer.from(String(order), 'utf8');
  const pad = 16 - (data.length % 16);
  data = Buffer.concat([data, Buffer.alloc(pad, pad)]);
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv('aes-128-cbc', key16, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function signMerchantParametersV2(merchantParametersB64, order, secretKey) {
  const derivedB64 = diversifyKeyV2(order, secretKey).toString('base64');
  const mac = crypto.createHmac('sha512', derivedB64).update(merchantParametersB64).digest();
  return toBase64Url(mac);
}

/** Firma HMAC_SHA256_V1 (3DES + relleno con ceros, según manual Redsys). */
function encrypt3DES(order, secretKeyBase64) {
  const key = Buffer.from(secretKeyBase64, 'base64');
  let data = Buffer.from(String(order), 'utf8');
  const paddedLen = Math.ceil(data.length / 8) * 8;
  data = Buffer.concat([data, Buffer.alloc(paddedLen - data.length, 0)]);
  const iv = Buffer.alloc(8, 0);
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function signMerchantParametersV1(merchantParametersB64, order, secretKeyBase64) {
  const derived = encrypt3DES(order, secretKeyBase64);
  return crypto.createHmac('sha256', derived).update(merchantParametersB64).digest('base64');
}

function getSignatureVersion() {
  return SIGNATURE_VERSION === 'HMAC_SHA256_V1' ? 'HMAC_SHA256_V1' : 'HMAC_SHA512_V2';
}

function signMerchantParameters(merchantParametersB64, order, secretKey, signatureVersion) {
  const version = signatureVersion || getSignatureVersion();
  if (version === 'HMAC_SHA256_V1') {
    return signMerchantParametersV1(merchantParametersB64, order, secretKey);
  }
  return signMerchantParametersV2(merchantParametersB64, order, secretKey);
}

function encodeMerchantParameters(merchantParams, signatureVersion) {
  const json = JSON.stringify(merchantParams);
  const buf = Buffer.from(json, 'utf8');
  if (signatureVersion === 'HMAC_SHA256_V1') {
    return buf.toString('base64');
  }
  return toBase64Url(buf);
}

function buildRedirectForm(cfg, merchantParams) {
  const order = merchantParams.DS_MERCHANT_ORDER;
  const signatureVersion = getSignatureVersion();
  const merchantParameters = encodeMerchantParameters(merchantParams, signatureVersion);
  const signature = signMerchantParameters(merchantParameters, order, cfg.secretKey, signatureVersion);
  return {
    gatewayUrl: cfg.gatewayUrl,
    Ds_SignatureVersion: signatureVersion,
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: signature
  };
}

function decodeMerchantParameters(b64) {
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

function verifyNotificationSignature(merchantParametersB64, signature, secretKey, signatureVersion) {
  const params = decodeMerchantParameters(merchantParametersB64);
  const order = params.Ds_Order || params.DS_ORDER;
  if (!order) return { ok: false, error: 'Pedido no encontrado en notificación' };

  const versions = signatureVersion
    ? [signatureVersion]
    : ['HMAC_SHA512_V2', 'HMAC_SHA256_V1'];

  for (const version of versions) {
    const expected = signMerchantParameters(merchantParametersB64, order, secretKey, version);
    if (signaturesMatch(signature, expected)) {
      return { ok: true, params, order: String(order), signatureVersion: version };
    }
  }
  return { ok: false, error: 'Firma incorrecta' };
}

function isRedsysPaymentOk(responseCode) {
  const code = parseInt(String(responseCode || ''), 10);
  return !isNaN(code) && code >= 0 && code < 100;
}

function amountToCents(amountEur) {
  const n = Math.round(Number(amountEur) * 100);
  if (!Number.isFinite(n) || n < 1) throw new Error('Importe inválido');
  return n;
}

function escapePayGoldXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPayGoldXmlData(opts) {
  const nombre = escapePayGoldXml(opts.buyerName || 'Cliente CD Sanabria CF');
  const texto = escapePayGoldXml(opts.concept || 'Pago CD Sanabria CF');
  const subject = escapePayGoldXml(opts.subject || 'Pago CD Sanabria CF');
  return `<nombreComprador>${nombre}</nombreComprador><textoLibre1>${texto}</textoLibre1><subjectMailCliente>${subject}</subjectMailCliente>`;
}

function normalizeEsMobile(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('34') && digits.length === 11) digits = digits.slice(2);
  if (digits.length !== 9) {
    throw new Error('Móvil español inválido (9 dígitos, sin prefijo +34)');
  }
  return digits;
}

function buildSignedRestBody(cfg, merchantParams) {
  const order = merchantParams.DS_MERCHANT_ORDER;
  const signatureVersion = getSignatureVersion();
  const merchantParameters = encodeMerchantParameters(merchantParams, signatureVersion);
  const signature = signMerchantParameters(merchantParameters, order, cfg.secretKey, signatureVersion);
  return {
    Ds_SignatureVersion: signatureVersion,
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: signature
  };
}

function parseRestResponse(cfg, rawJson) {
  if (rawJson && rawJson.errorCode) {
    return {
      ok: false,
      error: payGoldErrorMessage(String(rawJson.errorCode).replace(/^SIS/i, '')),
      params: rawJson
    };
  }
  if (rawJson && rawJson.Ds_MerchantParameters) {
    const verified = verifyNotificationSignature(
      rawJson.Ds_MerchantParameters,
      rawJson.Ds_Signature,
      cfg.secretKey,
      rawJson.Ds_SignatureVersion
    );
    if (!verified.ok) {
      return { ok: false, error: verified.error || 'Firma de respuesta Redsys inválida' };
    }
    return { ok: true, params: verified.params };
  }
  return { ok: true, params: rawJson || {} };
}

function isPayGoldLinkSent(responseCode) {
  return String(responseCode || '').trim() === '9998';
}

function payGoldErrorMessage(responseCode) {
  const c = String(responseCode || '').trim();
  if (!c) return 'Redsys no devolvió código de respuesta';
  if (c === '9324' || c.endsWith('324')) {
    return 'No se pudo enviar el SMS (SIS0324). Revisa el móvil o la configuración PayGold en Caja Rural.';
  }
  if (c === '9487' || c.endsWith('487')) {
    return 'PayGold no habilitado en el terminal (SIS0487). Contacta con Caja Rural.';
  }
  if (c === '9325' || c.endsWith('325')) {
    return 'El enlace PayGold ya finalizó o no existe fase inicial (SIS0325).';
  }
  return `Redsys rechazó la solicitud PayGold (código ${c})`;
}

async function sendPayGoldRequest(cfg, merchantParams) {
  const body = buildSignedRestBody(cfg, merchantParams);
  const res = await fetch(cfg.restUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    return { ok: false, error: 'Respuesta Redsys no válida', status: res.status, raw: text.slice(0, 400) };
  }
  const parsed = parseRestResponse(cfg, json);
  if (!parsed.ok) return parsed;

  const p = parsed.params;
  const response = p.Ds_Response || p.DS_RESPONSE || '';
  const order = p.Ds_Order || p.DS_ORDER || merchantParams.DS_MERCHANT_ORDER;
  const paymentUrl = p.Ds_UrlPago2Fases || p.DS_URLPAGO2FASES || null;

  if (isPayGoldLinkSent(response)) {
    return {
      ok: true,
      linkSent: true,
      order: String(order),
      paymentUrl,
      response: String(response),
      params: p
    };
  }
  if (isRedsysPaymentOk(response)) {
    return {
      ok: true,
      paid: true,
      order: String(order),
      paymentUrl,
      response: String(response),
      params: p
    };
  }
  return {
    ok: false,
    error: payGoldErrorMessage(response),
    order: String(order),
    paymentUrl,
    response: String(response),
    params: p
  };
}

module.exports = {
  getRedsysConfig,
  getRedsysPublicConfig,
  getSignatureVersion,
  isEnvTruthy,
  normalizePayMethod,
  generateRedsysOrderId,
  buildRedirectForm,
  buildSignedRestBody,
  buildPayGoldXmlData,
  normalizeEsMobile,
  decodeMerchantParameters,
  verifyNotificationSignature,
  signMerchantParametersV2,
  isRedsysPaymentOk,
  isPayGoldLinkSent,
  payGoldErrorMessage,
  sendPayGoldRequest,
  amountToCents
};
