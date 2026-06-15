'use strict';

const { escapeHtml, getEmailConfig, sendViaSendGrid, clubNotifyRecipient } = require('./club-email');

const CLUB_NAME = 'CD Sanabria CF';

function formatPaymentLabel(channel) {
  const c = String(channel || '').trim().toLowerCase();
  if (c === 'transferencia' || c === 'transfer' || c === 'pending_transfer') return 'Transferencia bancaria';
  if (c === 'efectivo' || c === 'cash' || c === 'cash_manual') return 'Efectivo';
  if (c === 'tpv' || c === 'pending_tpv') return 'TPV (datáfono en el club)';
  if (c === 'bizum' || c === 'redsys_bizum') return 'Bizum';
  if (c === 'tarjeta' || c === 'card' || c === 'redsys_card' || c === 'redsys_caja_rural') return 'Tarjeta';
  if (c === 'gateway_pending' || c === 'pasarela') return 'Pasarela (pendiente de pago)';
  if (c === 'gratuito' || c === 'free') return 'Gratuito';
  if (c === 'consulta') return 'Consulta / presupuesto';
  if (c) return c;
  return '—';
}

function normalizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && f.label)
    .map((f) => ({
      label: String(f.label).trim(),
      value: f.value == null || f.value === '' ? '—' : String(f.value)
    }));
}

function pickDataValue(data, keys) {
  for (let i = 0; i < keys.length; i++) {
    const v = data[keys[i]];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function composeFullAddress(data) {
  const line = pickDataValue(data, ['direccion', 'address', 'domicilio']);
  const cp = pickDataValue(data, ['codigoPostal', 'postalCode', 'cp']);
  const loc = pickDataValue(data, ['localidad', 'city', 'poblacion']);
  const prov = pickDataValue(data, ['provincia', 'province']);
  const parts = [line, cp, loc, prov].filter(Boolean);
  return parts.join(', ');
}

function formatMemberNumberDisplay(data) {
  const num = pickDataValue(data, ['numeroSocio', 'memberNumber']);
  if (!num) return '';
  if (/^SOC/i.test(num)) return num + ' (provisional)';
  const n = parseInt(num, 10);
  if (Number.isFinite(n)) return 'N.º SOC. ' + String(n).padStart(6, '0');
  return num;
}

function formatFriendNumberDisplay(data) {
  const num = pickDataValue(data, ['numeroAmigo', 'friendNumber']);
  if (!num) return '';
  if (/^AMIG/i.test(num)) return num + ' (provisional)';
  const n = parseInt(num, 10);
  if (Number.isFinite(n)) return 'N.º AMIG. ' + String(n).padStart(6, '0');
  return num;
}

function fieldLabelKey(label) {
  const l = String(label || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (l === 'domicilio' || l === 'direccion' || l.startsWith('direccion ')) return 'direccion';
  if (l === 'nombre completo') return 'nombre_completo';
  if (l.startsWith('nombre')) return 'nombre';
  if (l.startsWith('apellido')) return 'apellidos';
  if (l === 'dni' || l === 'dni/nie' || l === 'dni tutor/a') return 'dni';
  if (l.startsWith('tel')) return 'telefono';
  if (l === 'email' || l === 'correo') return 'email';
  if (l.includes('socio') && (l.startsWith('n') || l.includes('numero'))) return 'numero_socio';
  if (l.includes('amigo') && (l.startsWith('n') || l.includes('numero'))) return 'numero_amigo';
  if (l === 'sexo') return 'sexo';
  if (l.includes('nacimiento') || l === 'nacimiento') return 'fecha_nacimiento';
  return l;
}

/** Bloque estándar: identidad + números de socio/amigo. */
function buildStandardIdentityFields(data) {
  const src = data && typeof data === 'object' ? data : {};
  const nombre = pickDataValue(src, ['nombre', 'name']);
  const apellidos = pickDataValue(src, ['apellidos', 'surname']);
  const dni = pickDataValue(src, ['dni', 'DNI']);
  const direccion = composeFullAddress(src);
  const telefono = pickDataValue(src, ['telefono', 'phone']);
  const email = pickDataValue(src, ['email', 'requesterEmail']);
  const sexo = pickDataValue(src, ['sexo', 'gender']);
  const fechaNac = pickDataValue(src, ['fechaNacimiento', 'birthDate']);
  const numeroSocio = formatMemberNumberDisplay(src);
  const numeroAmigo = formatFriendNumberDisplay(src);

  const out = [];
  if (numeroSocio) out.push({ label: 'Nº socio', value: numeroSocio });
  if (numeroAmigo) out.push({ label: 'Nº amigo/a', value: numeroAmigo });
  if (nombre) out.push({ label: 'Nombre', value: nombre });
  if (apellidos) out.push({ label: 'Apellidos', value: apellidos });
  if (dni) out.push({ label: 'DNI', value: dni });
  if (sexo) out.push({ label: 'Sexo', value: sexo });
  if (fechaNac) out.push({ label: 'Fecha nacimiento', value: fechaNac });
  if (direccion) out.push({ label: 'Dirección completa', value: direccion });
  if (telefono) out.push({ label: 'Teléfono', value: telefono });
  if (email) out.push({ label: 'Email', value: email });
  return out;
}

function mergeNotifyFields(data) {
  const standard = buildStandardIdentityFields(data);
  const standardKeys = new Set(standard.map((f) => fieldLabelKey(f.label)));
  const custom = normalizeFields(data.fields).filter((f) => {
    const key = fieldLabelKey(f.label);
    if (standardKeys.has(key)) return false;
    if (key === 'nombre_completo' && (standardKeys.has('nombre') || standardKeys.has('apellidos'))) {
      return false;
    }
    if (key === 'direccion' && standardKeys.has('direccion')) return false;
    return true;
  });
  return [...standard, ...custom];
}

function csvEscape(val) {
  return '"' + String(val == null ? '' : val).replace(/"/g, '""') + '"';
}

function buildExportAttachments(fields, data) {
  const kind = String(data.kind || 'registro')
    .replace(/[^\w-]/g, '_')
    .slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  const base = 'registro-' + kind + '-' + date;
  const title = String(data.title || data.kind || 'Registro').trim();

  const csvLines = ['Campo,Valor'];
  fields.forEach((f) => {
    csvLines.push(csvEscape(f.label) + ',' + csvEscape(f.value));
  });
  csvLines.push('');
  csvLines.push(csvEscape('Forma de pago') + ',' + csvEscape(formatPaymentLabel(data.paymentChannel || data.paymentMethod)));
  csvLines.push(csvEscape('Fecha aviso') + ',' + csvEscape(new Date().toLocaleString('es-ES')));
  const csv = '\uFEFF' + csvLines.join('\r\n');

  const docRows = fields
    .map(
      (f) =>
        '<tr><td style="padding:6px 12px;border:1px solid #ccc;font-weight:bold">' +
        escapeHtml(f.label) +
        '</td><td style="padding:6px 12px;border:1px solid #ccc">' +
        escapeHtml(f.value) +
        '</td></tr>'
    )
    .join('');
  const docHtml =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
    '<head><meta charset="utf-8"><title>' +
    escapeHtml(title) +
    '</title></head><body>' +
    '<h2>' +
    escapeHtml(title) +
    '</h2>' +
    '<p>Tipo: ' +
    escapeHtml(String(data.kind || '')) +
    ' · ' +
    escapeHtml(new Date().toLocaleString('es-ES')) +
    '</p>' +
    '<p><strong>Forma de pago:</strong> ' +
    escapeHtml(formatPaymentLabel(data.paymentChannel || data.paymentMethod)) +
    '</p>' +
    '<table style="border-collapse:collapse;width:100%">' +
    docRows +
    '</table></body></html>';

  const jsonObj = {};
  fields.forEach((f) => {
    jsonObj[f.label] = f.value;
  });
  jsonObj['Forma de pago'] = formatPaymentLabel(data.paymentChannel || data.paymentMethod);
  jsonObj['Fecha aviso'] = new Date().toLocaleString('es-ES');
  const jsonContent = JSON.stringify(jsonObj, null, 2);

  return [
    { filename: base + '.csv', content: csv, type: 'text/csv; charset=utf-8' },
    { filename: base + '.doc', content: docHtml, type: 'application/msword' },
    { filename: base + '.json', content: jsonContent, type: 'application/json; charset=utf-8' }
  ];
}

function buildClubAdminContent(data) {
  const title = escapeHtml(String(data.title || data.kind || 'Aviso web').trim());
  const kind = escapeHtml(String(data.kind || 'registro').trim());
  const paymentLabel = escapeHtml(formatPaymentLabel(data.paymentChannel || data.paymentMethod));
  const fields = mergeNotifyFields(data);
  const requester = String(data.requesterEmail || data.email || '').trim();

  const rows = fields
    .map(
      (f) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap"><strong>${escapeHtml(f.label)}</strong></td><td style="padding:6px 0;color:#1e293b">${escapeHtml(f.value)}</td></tr>`
    )
    .join('');

  const subject = `[${CLUB_NAME}] ${String(data.subject || data.title || 'Nuevo aviso').trim()}`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;color:#1e293b;line-height:1.5">
      <h2 style="color:#1e3a8a;margin:0 0 8px">${title}</h2>
      <p style="margin:0 0 16px;font-size:0.9rem;color:#64748b">Tipo: ${kind} · ${new Date().toLocaleString('es-ES')}</p>
      <table style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:0 0 16px;width:100%">
        <tr><td style="padding:4px 12px 4px 0;color:#1e40af"><strong>Forma de pago elegida</strong></td><td style="padding:4px 0;font-weight:700;color:#1e3a8a">${paymentLabel}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
        ${rows}
      </table>
      ${requester ? `<p style="font-size:0.9rem">Correo del solicitante: <a href="mailto:${escapeHtml(requester)}">${escapeHtml(requester)}</a></p>` : ''}
      <p style="font-size:0.85rem;color:#64748b;margin:12px 0 4px">📎 Adjuntos: <strong>Excel (.csv)</strong>, <strong>Word (.doc)</strong> y <strong>JSON (.json)</strong> con todos los datos.</p>
      <p style="font-size:0.85rem;color:#64748b;margin:0 0 8px">Para PDF: imprime este correo o usa el panel admin → Socios / Amigos / Jugadores → PDF.</p>
      <p style="font-size:0.85rem;color:#94a3b8">Mensaje automático desde la web del club.</p>
    </div>`;

  const textLines = [
    title,
    'Tipo: ' + String(data.kind || ''),
    'Forma de pago: ' + formatPaymentLabel(data.paymentChannel || data.paymentMethod),
    ''
  ];
  fields.forEach((f) => {
    textLines.push(f.label + ': ' + f.value);
  });
  if (requester) textLines.push('', 'Correo solicitante: ' + requester);
  textLines.push('', 'Adjuntos: Excel (.csv), Word (.doc) y JSON (.json)', 'Fecha: ' + new Date().toLocaleString('es-ES'));

  return { subject, html, text: textLines.join('\n'), fields };
}

async function sendClubAdminNotification(data) {
  const cfg = getEmailConfig();
  if (!cfg.ok) return { sent: false, reason: cfg.error };

  const to = clubNotifyRecipient(cfg);
  const content = buildClubAdminContent(data);
  const requester = String(data.requesterEmail || '').trim();
  const replyTo = requester && requester.includes('@') ? requester : cfg.replyTo || cfg.fromEmail;
  const attachments = buildExportAttachments(content.fields, data);

  await sendViaSendGrid({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    replyTo,
    attachments
  });

  return { sent: true, to };
}

module.exports = {
  formatPaymentLabel,
  buildStandardIdentityFields,
  mergeNotifyFields,
  buildClubAdminContent,
  buildExportAttachments,
  sendClubAdminNotification
};
