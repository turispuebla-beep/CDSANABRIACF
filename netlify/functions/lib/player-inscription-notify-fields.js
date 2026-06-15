'use strict';

const GARMENT_LABELS = {
  match_shirt: 'Camiseta partido',
  match_shorts: 'Pantalón corto partido',
  tracksuit: 'Chándal',
  train_kit: 'Ropa de entreno',
  train_shirt: 'Camiseta entreno',
  train_shorts: 'Pantalón entreno',
  train_jacket: 'Chubasquero',
  cazadora: 'Cazadora'
};

function getKitItems(reg) {
  if (!reg || typeof reg !== 'object') return [];
  if (Array.isArray(reg.kitOrder) && reg.kitOrder.length) return reg.kitOrder;
  if (reg.kit && Array.isArray(reg.kit.items) && reg.kit.items.length) return reg.kit.items;
  return [];
}

function garmentLabel(item) {
  if (!item) return 'Prenda';
  return String(
    item.label || GARMENT_LABELS[item.id] || item.garment || item.prenda || item.id || 'Prenda'
  ).trim();
}

function garmentSize(item) {
  return String((item && (item.size || item.talla)) || '—').trim() || '—';
}

function formatKitSummary(reg) {
  const items = getKitItems(reg);
  if (!items.length) return '—';
  return items
    .map((it) => {
      const price = Number(it.price) > 0 ? ` — ${Number(it.price).toFixed(2)} €` : '';
      return `${garmentLabel(it)}: talla ${garmentSize(it)}${price}`;
    })
    .join(' | ');
}

function buildKitNotifyFields(reg) {
  const items = getKitItems(reg);
  const cb = (reg && reg.chargeBreakdown) || {};
  const fields = [{ label: 'Pedido ropa (resumen)', value: formatKitSummary(reg) }];
  items.forEach((it) => {
    const price = Number(it.price) > 0 ? ` — ${Number(it.price).toFixed(2)} €` : '';
    fields.push({
      label: garmentLabel(it),
      value: `Talla ${garmentSize(it)}${price}`
    });
  });
  if (cb.kit != null && Number(cb.kit) > 0) {
    fields.push({ label: 'Subtotal ropa (€)', value: Number(cb.kit).toFixed(2) });
  }
  return fields;
}

function consentYesNo(flag, acceptedAt) {
  if (flag === true || flag === 'true' || flag === 1) return 'Sí';
  if (acceptedAt) return 'Sí';
  if (flag === false || flag === 'false' || flag === 0) return 'No';
  return 'No';
}

function buildConsentNotifyFields(reg) {
  const r = reg || {};
  return [
    {
      label: 'Normas inscripción CD Sanabria CF',
      value: consentYesNo(r.clubRulesAccepted, r.clubRulesAcceptedAt)
    },
    {
      label: 'Consent. jugador/a CD Sanabria CF',
      value: r.playerConsent ? 'Sí' : 'No'
    },
    {
      label: 'Consent. fotos y vídeos del club',
      value: r.photoConsent ? 'Sí' : 'No'
    },
    {
      label: 'Autorización categoría superior',
      value: consentYesNo(r.categorySuperiorConsent, r.categorySuperiorConsentAt)
    }
  ];
}

function buildPlayerInscriptionNotifyFields(reg, opts) {
  const extra = opts && typeof opts === 'object' ? opts : {};
  const cb = (reg && reg.chargeBreakdown) || {};
  const season = String(reg.inscriptionSeason || reg.temporada || '').trim();
  const fields = [
    { label: 'ID ficha', value: reg.id || '—' },
    { label: 'Nombre', value: reg.name || reg.nombre || '—' },
    { label: 'Apellidos', value: reg.surname || reg.apellidos || '—' },
    { label: 'DNI', value: reg.dni || '—' },
    { label: 'Nº socio vinculado', value: reg.numeroSocio || reg.memberNumber || '—' },
    { label: 'Temporada', value: season || '—' },
    { label: 'Categoría', value: reg.category || reg.categoria || '—' },
    { label: 'Fecha nacimiento', value: reg.birthDate || reg.fechaNacimiento || '—' },
    { label: 'Domicilio', value: reg.domicilio || reg.address || reg.direccion || '—' },
    { label: 'Localidad', value: reg.localidad || '—' },
    { label: 'Provincia', value: reg.provincia || '—' },
    { label: 'Teléfono', value: reg.phone || reg.telefono || '—' },
    { label: 'Email', value: reg.email || '—' },
    { label: 'Posición', value: reg.position || reg.posicion || '—' },
    { label: 'Grupo sanguíneo', value: reg.bloodGroup || '—' },
    { label: 'Lesiones', value: reg.injuries || '—' },
    { label: 'Alergias / enfermedad', value: reg.allergyIllness || '—' },
    { label: 'Observaciones', value: reg.observations || '—' },
    {
      label: 'Peso (kg)',
      value: reg.weightKg != null && reg.weightKg !== '' ? reg.weightKg : '—'
    },
    {
      label: 'Altura (cm)',
      value: reg.heightCm != null && reg.heightCm !== '' ? reg.heightCm : '—'
    },
    { label: 'Cuota ficha (€)', value: cb.ficha != null ? cb.ficha : reg.fichaFee != null ? reg.fichaFee : '—' },
    { label: 'Cuota socio (€)', value: cb.socio != null ? cb.socio : reg.socioFee != null ? reg.socioFee : '—' },
    { label: 'Total inscripción (€)', value: cb.total != null ? cb.total : reg.totalCharge != null ? reg.totalCharge : '—' },
    ...buildKitNotifyFields(reg),
    { label: 'Tutor/a', value: reg.guardianName || '—' },
    { label: 'DNI tutor/a', value: reg.guardianDNI || reg.guardianDni || '—' },
    { label: 'Teléfono tutor/a', value: reg.guardianPhone || '—' },
    { label: 'Email tutor/a', value: reg.guardianEmail || '—' },
    { label: 'Domicilio tutor/a', value: reg.guardianAddress || '—' },
    ...buildConsentNotifyFields(reg)
  ];
  if (extra.orderId) fields.push({ label: 'Pedido pasarela', value: extra.orderId });
  if (extra.paid) fields.push({ label: 'Estado', value: 'Pagado / activo' });
  if (extra.paymentNote) fields.push({ label: 'Nota pago', value: extra.paymentNote });
  if (extra.offlineChannel === 'transferencia' || extra.includeClubAccount) {
    fields.push({ label: 'Cuenta club', value: 'CAJA RURAL ES12 3085 0034 8222 5127 9226' });
  }
  return fields;
}

module.exports = {
  getKitItems,
  formatKitSummary,
  buildKitNotifyFields,
  buildConsentNotifyFields,
  buildPlayerInscriptionNotifyFields
};
