# Correo automático a socios — CD Sanabria CF

## Qué envía

| Momento | Quién recibe | Contenido |
|---------|--------------|-----------|
| Tras **registrarse** en la web | Socio (+ copia opcional al club) | Registro recibido, nº socio, cuota, pasos de pago |
| Tras **pago con tarjeta OK** (Redsys) | Socio | Alta activa, cuota pagada |

Remitente visible: **`SENDGRID_FROM_EMAIL`** (recomendado: `cdsanabriafc@gmail.com`).

## Configuración en Netlify

1. Cuenta en [SendGrid](https://sendgrid.com) (plan gratuito suele bastar al inicio).
2. **Verificar remitente**: Single Sender o dominio con el correo del club.
3. Crear **API Key** con permiso “Mail Send”.
4. Variables en Netlify → Site configuration → Environment:

| Variable | Ejemplo |
|----------|---------|
| `SENDGRID_API_KEY` | `SG.xxx...` |
| `SENDGRID_FROM_EMAIL` | `cdsanabriafc@gmail.com` |
| `SENDGRID_FROM_NAME` | `CD Sanabria CF` |
| `CLUB_REPLY_EMAIL` | `cdsanabriafc@gmail.com` |
| `CLUB_NOTIFY_EMAIL` | `cdsanabriafc@gmail.com` (copia en cada alta nueva) |
| `ALLOWED_ORIGINS` | `https://tu-sitio.netlify.app` |
| `SITE_URL` | Misma URL pública |

También necesitas `FIREBASE_SERVICE_ACCOUNT_JSON` (la función comprueba que el socio exista antes de enviar).

## Archivos

- `netlify/functions/send-club-email.js` — registro (llamada desde la web)
- `netlify/functions/lib/member-email.js` — plantillas
- `netlify/functions/lib/club-email.js` — SendGrid
- `js/club-email-notify.js` — cliente

El correo de **pago confirmado** se dispara en el servidor (`completeMembershipPayment`), no desde el navegador.

## Deploy

Debe desplegarse el sitio **con funciones Netlify** (no solo ZIP de `netlify-dist`).

## Si no llega el correo

- Revisa carpeta spam.
- SendGrid → Activity: ver si se envió o rebotó.
- Sin variables SendGrid: el registro sigue funcionando; solo no se manda email (aviso en consola del navegador / logs Netlify).
