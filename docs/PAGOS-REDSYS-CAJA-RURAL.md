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
| `REDSYS_TERMINAL` | Terminal del comercio (CD Sanabria: `101`) |
| `REDSYS_SECRET_KEY` | Clave **SHA-256** del terminal 101 (Ruralvía → Ver clave). Pegar tal cual. |
| `REDSYS_SIGNATURE_VERSION` | `HMAC_SHA256_V1` (por defecto Caja Rural). `HMAC_SHA512_V2` solo si el banco lo indica. |
| `REDSYS_ENV` | `test` (pruebas Ruralvía, sin cobro real) o `production` (clave definitiva activa) |
| `REDSYS_BIZUM_ENABLED` | `true` cuando Caja Rural active Bizum en el TPV (si no, solo tarjeta) |
| `SITE_URL` | URL pública, ej. `https://tudominio.netlify.app` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo de cuenta de servicio Firebase (una línea) |

## Entorno TEST vs producción (importante)

Ruralvía y Netlify deben usar **el mismo entorno**. Si Ruralvía está en *Entorno de pruebas* y Netlify tiene `REDSYS_ENV=production`, Redsys devuelve **SIS0042** (firma incorrecta).

| Entorno | Ruralvía | Netlify `REDSYS_ENV` | Pasarela | Cobros |
|---------|----------|----------------------|----------|--------|
| Pruebas | Entorno de pruebas + clave de test | `test` | `sis-t.redsys.es:25443` | Simulados |
| Real | Clave definitiva activa | `production` | `sis.redsys.es` | Reales |

Comercio club: **`139060982`** · Terminal: **`101`**.

Comprobar estado: `https://www.cdsanabriacf.com/.netlify/functions/redsys-config` → `"env":"test"` o `"production"`.

## Pruebas (sin cobro real)

1. Ruralvía → terminal **101** → entorno **pruebas** (no clave definitiva aún).
2. Netlify: `REDSYS_ENV=test` y clave SHA-256 de pruebas del terminal 101.
3. Deploy con funciones (`netlify deploy --prod` desde la raíz del repo).
4. Pago de prueba (cuota, inscripción o API `redsys-create-payment` con 1 €).
5. Tarjeta **ficticia** Redsys (en TEST **no** funciona tarjeta real):

| Campo | Valor |
|-------|-------|
| Número | `4548812049400004` (sin espacios) |
| Caducidad | `12/34` |
| CVV | `123` |
| CIP / 3DS | `123456` |

Alternativa aceptada: `4548810000000003` · caducidad `12/49` · CVV `123` · CIP `123456`.

6. OK si Redsys muestra *OPERACIÓN AUTORIZADA* y el pedido queda `paid` en `redsys-payment-status?order=NUMERO_PEDIDO`.

**Ruralvía (terminal 101)** — URLs recomendadas:

- Notificación: `https://www.cdsanabriacf.com/.netlify/functions/redsys-notification`
- URL OK: `https://www.cdsanabriacf.com/pago-resultado.html?result=ok`
- URL KO: `https://www.cdsanabriacf.com/pago-resultado.html?result=ko`

## Paso a producción

1. Caja Rural / Ruralvía → activar **clave definitiva** en terminal **101**.
2. Copiar la **nueva SHA-256** (suele cambiar respecto a la de pruebas).
3. Netlify: `REDSYS_ENV=production`, `REDSYS_SECRET_KEY=<SHA-256 definitiva>`.
4. Deploy funciones.
5. Prueba real de importe bajo (ej. 1 €) con **tarjeta real**.
6. Confirmar en Ruralvía y en `sanabria_payments` / panel admin.

## Despliegue

1. **Conectar el repo** a Netlify (no solo subir ZIP de `netlify-dist`) para que funcionen `netlify/functions`.
2. O deploy desde Git con `netlify.toml` en la raíz de `CDSANABRIACF1`.
3. Publicar reglas: `scripts/publish-firestore-rules.ps1`
4. Completar pruebas en entorno **test** (ver sección anterior) antes de `production`.

## PayGold SMS (panel admin)

Cobro con enlace enviado por **SMS** (Redsys PayGold): panel admin → Tienda → PayGold.  
Guía: `docs/PAYGOLD-SMS.md` · Función: `redsys-paygold-send.js`

## Archivos

- `netlify/functions/redsys-create-payment.js` — inicia pago (tarjeta o Bizum con `payMethod`)
- `netlify/functions/redsys-paygold-send.js` — PayGold SMS desde admin
- `netlify/functions/redsys-config.js` — indica a la web si tarjeta/Bizum/PayGold están activos
- `netlify/functions/redsys-notification.js` — callback del banco
- `netlify/functions/redsys-payment-status.js` — consulta estado
- `js/redsys-payments.js` — cliente web
- `pago-resultado.html` — vuelta OK/KO

## Manual solo `netlify-dist`

Si subes solo la carpeta estática, **no hay funciones** y el pago online no funcionará. Hace falta deploy con funciones o Netlify CLI vinculado al proyecto.
