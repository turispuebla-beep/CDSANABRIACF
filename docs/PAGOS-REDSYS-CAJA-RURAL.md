# Pagos online — TPV Caja Rural (Redsys)

Proyecto: **CDSANABRIACF** · Firebase **`cdsanabriacf2026`** · Colección pedidos: **`sanabria_payments`**

## Qué hace

- **Cuota de socio**: tras el registro, redirección al TPV si hay importe > 0.
- **Eventos de pago**: al apuntarse, si el precio aplicado (socios, jugadores, directiva, etc.) > 0, pago antes de inscribir.
- **Notificación bancaria** (`redsys-notification`): actualiza Firestore. Cuota de socio OK → `pagado: true`, `status: active`, `estado: activo` (alta activa al instante, sin validación manual del admin).

## Variables en Netlify (Site settings → Environment)

| Variable | Descripción |
|----------|-------------|
| `REDSYS_MERCHANT_CODE` | Código de comercio (FUC) — lo da Caja Rural |
| `REDSYS_TERMINAL` | Terminal (suele ser `001`) |
| `REDSYS_SECRET_KEY` | Clave secreta en Base64 |
| `REDSYS_ENV` | `test` o `production` |
| `REDSYS_BIZUM_ENABLED` | `true` cuando Caja Rural active Bizum en el TPV (si no, solo tarjeta) |
| `SITE_URL` | URL pública, ej. `https://tudominio.netlify.app` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo de cuenta de servicio Firebase (una línea) |

## Despliegue

1. **Conectar el repo** a Netlify (no solo subir ZIP de `netlify-dist`) para que funcionen `netlify/functions`.
2. O deploy desde Git con `netlify.toml` en la raíz de `CDSANABRIACF1`.
3. Publicar reglas: `scripts/publish-firestore-rules.ps1`
4. Pruebas en entorno **test** de Redsys antes de `production`.

## Archivos

- `netlify/functions/redsys-create-payment.js` — inicia pago (tarjeta o Bizum con `payMethod`)
- `netlify/functions/redsys-config.js` — indica a la web si tarjeta/Bizum están activos
- `netlify/functions/redsys-notification.js` — callback del banco
- `netlify/functions/redsys-payment-status.js` — consulta estado
- `js/redsys-payments.js` — cliente web
- `pago-resultado.html` — vuelta OK/KO

## Manual solo `netlify-dist`

Si subes solo la carpeta estática, **no hay funciones** y el pago online no funcionará. Hace falta deploy con funciones o Netlify CLI vinculado al proyecto.
