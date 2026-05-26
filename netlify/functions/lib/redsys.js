'use strict';

const crypto = require('crypto');

const REDSYS_URLS = {
  test: 'https://sis-t.redsys.es:25443/sis/realizarPago',
  production: 'https://sis.redsys.es/sis/realizarPago'
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
  return { ok: true, env, merchantCode, terminal, secretKey, siteUrl, gatewayUrl: REDSYS_URLS[env] };
}

/** Estado público (sin secretos) para la web. */
function getRedsysPublicConfig() {
  const cfg = getRedsysConfig();
  return {
    ok: cfg.ok,
    cardEnabled: cfg.ok,
    bizumEnabled: cfg.ok && isEnvTruthy('REDSYS_BIZUM_ENABLED'),
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

function encrypt3DES(order, secretKeyBase64) {
  const key = Buffer.from(secretKeyBase64, 'base64');
  let data = Buffer.from(String(order), 'utf8');
  const pad = 8 - (data.length % 8);
  data = Buffer.concat([data, Buffer.alloc(pad, pad)]);
  const iv = Buffer.alloc(8, 0);
  const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function signMerchantParameters(merchantParametersB64, order, secretKeyBase64) {
  const derived = encrypt3DES(order, secretKeyBase64);
  return crypto.createHmac('sha256', derived).update(merchantParametersB64).digest('base64');
}

function buildRedirectForm(cfg, merchantParams) {
  const order = merchantParams.DS_MERCHANT_ORDER;
  const merchantParameters = Buffer.from(JSON.stringify(merchantParams), 'utf8').toString('base64');
  const signature = signMerchantParameters(merchantParameters, order, cfg.secretKey);
  return {
    gatewayUrl: cfg.gatewayUrl,
    Ds_SignatureVersion: 'HMAC_SHA256_V1',
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: signature
  };
}

function decodeMerchantParameters(b64) {
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

function verifyNotificationSignature(merchantParametersB64, signature, secretKeyBase64) {
  const params = decodeMerchantParameters(merchantParametersB64);
  const order = params.Ds_Order || params.DS_ORDER;
  if (!order) return { ok: false, error: 'Pedido no encontrado en notificación' };
  const expected = signMerchantParameters(merchantParametersB64, order, secretKeyBase64);
  const a = Buffer.from(String(signature || ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Firma incorrecta' };
  }
  return { ok: true, params, order: String(order) };
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

module.exports = {
  getRedsysConfig,
  getRedsysPublicConfig,
  isEnvTruthy,
  normalizePayMethod,
  generateRedsysOrderId,
  buildRedirectForm,
  decodeMerchantParameters,
  verifyNotificationSignature,
  isRedsysPaymentOk,
  amountToCents
};
