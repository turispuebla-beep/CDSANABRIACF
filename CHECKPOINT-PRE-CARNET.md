# Checkpoint — antes del carnet virtual de socio

**Fecha:** 26 mayo 2026  
**Proyecto:** CDSANABRIACF1 (`cdsanabriacf2026`)

## Qué incluye este punto de guardado

### Web / PWA (`netlify-dist/` — sincronizado con build)
- Pagos Redsys: `pago-cuota-socio.html`, `pago-resultado.html`, `js/redsys-payments.js`
- Botón pago en login y registro de socio
- UX modales pago tarjeta vs transferencia
- Emails cliente: `js/club-email-notify.js` (envío vía funciones Netlify)
- Numeración socios: `js/club-member-numbers.js`
  - Honor 1–50 (asignación manual admin)
  - Regulares desde 51
  - Formato visible: **N.º SOC. 000051**
- Socio de Honor en panel admin (editar socio)
- Alta activa al instante tras pago tarjeta (servidor)

### Panel admin
- Validación manual + email al socio
- Bloque Socio de Honor en edición

### Funciones Netlify (`netlify/functions/` — no van dentro del ZIP estático)
- `redsys-create-payment`, `redsys-notification`, `redsys-payment-status`
- `send-club-email`
- `lib/redsys.js`, `lib/firestore-admin.js`, `lib/member-email.js`, `lib/club-email.js`

### Documentación
- `docs/PAGOS-REDSYS-CAJA-RURAL.md`
- `docs/EMAIL-SOCIOS.md`
- `netlify_env.example`

## Despliegue

1. **Sitio estático:** contenido de `netlify-dist/` (o ZIP en carpeta `ZIP/checkpoint-pre-carnet-*.zip`)
2. **Pagos y emails:** deploy con funciones desde la raíz del repo (`netlify.toml`)

## Pendiente (siguiente fase)

- Carnet virtual de socio (ver + descargar JPG/PDF, solo socio/admin, sin email)

## Nota Git

Esta carpeta **no tiene repositorio git** inicializado. El guardado es: archivos fuente + `netlify-dist` + ZIP de respaldo en `ZIP/`.
