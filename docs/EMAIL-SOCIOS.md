# Correo automático — CD Sanabria CF

Para **pocos envíos** la opción recomendada es **Gmail gratis** vía SMTP. **No necesitas** acceso a `cdsanabriafc@gmail.com`: puedes crear un Gmail nuevo del club (ej. `cdsanabriacf.inscripciones@gmail.com`) y usarlo en Netlify.

---

## Gmail solo para inscripciones (sin acceso al correo oficial)

| Qué | Cómo |
|-----|------|
| Remitente (de quién “sale” el mail) | Tu Gmail nuevo (`SMTP_USER` / `SMTP_FROM_EMAIL`) |
| Avisos al club (copia solicitudes) | El mismo buzón (`CLUB_NOTIFY_EMAIL`) o reenvío a quien gestione el club |
| Jugador aceptado en admin | Correo automático al email que puso en el formulario |
| Texto “Consultas” en los correos | `CLUB_REPLY_EMAIL` (puede ser el Gmail nuevo o el del club cuando lo tengáis) |

**Importante:** los destinatarios verán **tu Gmail nuevo** como remitente, no `cdsanabriafc@gmail.com`, salvo que más adelante el club configure ese buzón.

---

## Resumen rápido (Gmail — gratis)

| Paso | Acción |
|------|--------|
| 1 | Activar **verificación en 2 pasos** en la cuenta Google del club |
| 2 | Crear **contraseña de aplicación** para “Correo” |
| 3 | Variables `SMTP_*` en Netlify (plantilla `netlify_env.example`) |
| 4 | Deploy **con funciones** (Git/CLI), no solo ZIP de `netlify-dist` |

---

## Qué envía la web

| Momento | Quién recibe |
|---------|--------------|
| Registro socio/a | Socio/a + copia al club (`CLUB_NOTIFY_EMAIL`) |
| Pago tarjeta OK (Redsys) | Socio/a |
| Solicitud «Inscripción jugador/a» | Club |
| Validación manual (admin) | Socio/a |

---

## Opción A — Gmail SMTP (recomendada, 0 €)

Usa el correo que ya tenéis: **cdsanabriafc@gmail.com**.

### Límites

- Cuenta Gmail normal: unos **500 correos/día** (sobra para un club).
- Sin cuota mensual ni prueba de 60 días como SendGrid.
- El remitente será **cdsanabriafc@gmail.com** (el mismo buzón).

### Configuración (una vez)

1. Entra en la cuenta **cdsanabriafc@gmail.com**.
2. **Seguridad Google** → activa **Verificación en 2 pasos** (obligatorio).
3. **Contraseñas de aplicaciones**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Aplicación: **Correo**
   - Dispositivo: **Otro** → nombre `Netlify CD Sanabria CF`
   - Copia la contraseña de **16 caracteres** (ej. `abcd efgh ijkl mnop` → en Netlify sin espacios: `abcdefghijklmnop`).

4. En **Netlify → Environment variables**:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=cdsanabriafc@gmail.com
SMTP_PASS=la_contraseña_de_aplicación_16_caracteres
SMTP_FROM_EMAIL=cdsanabriafc@gmail.com
SMTP_FROM_NAME=CD Sanabria CF
CLUB_REPLY_EMAIL=cdsanabriafc@gmail.com
CLUB_NOTIFY_EMAIL=cdsanabriafc@gmail.com

SITE_URL=https://www.cdsanabriacf.com
ALLOWED_ORIGINS=https://www.cdsanabriacf.com,https://cdsanabriacf.com,https://cdsanabriacf.netlify.app

FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

5. **No** hace falta configurar `SENDGRID_*` si usas Gmail.

6. Nuevo **deploy con funciones** (el build ejecuta `npm install` e instala `nodemailer`).

### Prueba

- Registro de socio de prueba en la web.
- Si falla: Netlify → **Functions** → `send-club-email` → logs (`Invalid login`, `Less secure app`, etc.).
- Revisa **spam** la primera vez.

---

## Opción B — SendGrid (de pago tras prueba)

Solo si preferís API dedicada o Gmail no os encaja.

- Prueba ~60 días (~100 correos/día), luego **~20 $/mes**.
- Verificar remitente en SendGrid + `SENDGRID_API_KEY`.

Si están definidos **SMTP y SendGrid**, el sistema usa **Gmail SMTP primero**.

---

## Otras alternativas gratis (no integradas aún)

| Servicio | Gratis aprox. | Notas |
|----------|----------------|-------|
| **Gmail SMTP** | ~500/día | ✅ Integrado en el proyecto |
| **Brevo** | 300/día | Haría falta cambiar código |
| **Resend** | 3.000/mes | Haría falta cambiar código |
| **Amazon SES** | Muy barato | Más técnico |

Para el volumen del club (decenas o pocos cientos al año), **Gmail SMTP es suficiente**.

---

## Deploy

| Método | ¿Correo? |
|--------|----------|
| Git + `netlify.toml` | ✅ |
| `netlify deploy --prod` desde la raíz | ✅ |
| Solo ZIP `netlify-dist/` | ❌ |

Archivos: `netlify/functions/lib/club-email.js`, `send-club-email.js`, `member-email.js`, `js/club-email-notify.js`.

---

## Errores frecuentes (Gmail)

| Error | Solución |
|-------|----------|
| `Invalid login` | Contraseña de aplicación incorrecta o sin 2FA |
| `535 Authentication failed` | Usar **contraseña de aplicación**, no la contraseña normal de Gmail |
| `503 Correo no configurado` | Faltan `SMTP_USER` y `SMTP_PASS` en Netlify |
| `404 Socio no encontrado` | Falta `FIREBASE_SERVICE_ACCOUNT_JSON` |
| No llega / spam | Normal al principio; marca como “No es spam” |

---

## Contacto

**cdsanabriafc@gmail.com**
