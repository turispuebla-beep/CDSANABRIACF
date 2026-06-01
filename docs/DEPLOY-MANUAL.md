# Deploy manual — CD Sanabria CF

Guía de 1 página para subir la web sin depender del agente de IA.

**Proyecto Firebase:** `cdsanabriacf2026` · **Scope:** `cdsanabriacf`  
**Hosting:** Netlify (subida manual del contenido de `netlify-dist/`)

---

## 1. Generar la carpeta de subida

Desde la raíz del repo (`CDSANABRIACF1`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\build-netlify-dist.ps1"
```

Comprobar salida **0** y que existan en `netlify-dist/`:

- `_redirects`, `.netlifyignore`, `404.html`
- `index.html`, `admin-panel.html`, `sw.js`, `manifest.json`
- `js/`, `assets/` (escudos y cartel torneo)

El script **sube automáticamente la versión de caché** del Service Worker (`sw.js`) para que los usuarios no queden con JS antiguo.

---

## 2. Subir a Netlify

1. Entra en el panel de Netlify del sitio del club.
2. Sube el **contenido** de `netlify-dist/` (no la carpeta entera vacía; todos los archivos dentro).
3. Tras publicar, abre `https://tu-dominio/deploy-version.json` y confirma fecha reciente.

**Importante:** con ZIP manual **no** se despliegan las funciones serverless (`netlify/functions/`). Para correo automático, jugador/a en servidor, contraseña de ficha y Redsys usa la **CLI** (sección 2b) o Git.

### 2b. Deploy con Netlify CLI (web + funciones, sin Git)

#### A) Instalar (solo la primera vez)

1. **Node.js LTS** (18 o 20): https://nodejs.org — en PowerShell: `node -v` y `npm -v`.
2. **CLI de Netlify** (global):

```powershell
npm install -g netlify-cli
netlify --version
```

3. **Dependencias del proyecto** (raíz `CDSANABRIACF1`):

```powershell
cd C:\Users\marsa\Desktop\CDSANABRIACF1
npm install
```

4. **Iniciar sesión y enlazar el sitio:**

```powershell
netlify login
cd C:\Users\marsa\Desktop\CDSANABRIACF1
netlify link
```

- Elige el equipo/cuenta correcta.
- Elige el sitio del club (ej. `cdsanabriacf` o tu dominio).
- Confirma que detecta `netlify.toml` (`publish = netlify-dist`, `functions = netlify/functions`).

Se crea `.netlify/state.json` (puedes versionarlo o ignorarlo; no contiene secretos).

#### B) Variables en Netlify (solo la primera vez, o al cambiar correo/Redsys)

Panel: **Site configuration → Environment variables → Add a variable** (scope **Production**).

Copia la plantilla de `netlify_env.example`. Mínimo recomendado:

| Variable | Para qué |
|----------|----------|
| `SITE_URL` | URL pública sin barra final (`https://www.cdsanabriacf.com`) |
| `ALLOWED_ORIGINS` | Mismas URLs separadas por coma (dominio + `.netlify.app`) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Solicitudes jugador, inscripción, aprobar, portal contraseña |
| `SMTP_*` + `CLUB_*` | Correo automático (`send-club-email`) — ver `docs/EMAIL-SOCIOS.md` |
| `REDSYS_*` | Pagos tarjeta/Bizum (opcional hasta que tengáis claves) |

**`FIREBASE_SERVICE_ACCOUNT_JSON` (una sola línea):**

1. [Firebase Console](https://console.firebase.google.com/project/cdsanabriacf2026/settings/serviceaccounts/adminsdk) → **Generar nueva clave privada** → descargas un `.json`.
2. En PowerShell (cambia la ruta del archivo):

```powershell
node -e "const fs=require('fs'); const p='C:\\Users\\marsa\\Downloads\\cdsanabriacf2026-xxxx.json'; process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync(p,'utf8'))));" | Set-Clipboard
```

3. En Netlify: variable `FIREBASE_SERVICE_ACCOUNT_JSON` → pega **todo** el contenido (empieza por `{"type":"service_account",...}`).
4. **No** subas ese `.json` al repo ni al ZIP manual.

Tras guardar variables, hace falta **un deploy con CLI** (paso C) para que las funciones las lean.

#### C) Subir web + funciones (cada vez que cambies código)

**Atajo recomendado** (desde la raíz `CDSANABRIACF1`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\deploy-netlify-prod.ps1"
```

O con npm: `npm run deploy:prod`

Equivalente manual:

```powershell
cd C:\Users\marsa\Desktop\CDSANABRIACF1
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File ".\build-netlify-dist.ps1"
netlify deploy --prod
```

**Primera vez en un PC nuevo:** `.\netlify-cli-setup.ps1` o `npm run netlify:setup`

- El build debe terminar con código **0** y existir `_redirects`, `404.html` en `netlify-dist/`.
- `netlify deploy --prod` publica **netlify-dist/** y **netlify/functions/**.
- Ya no hace falta subir el ZIP a mano si usas siempre este comando (opcional: puedes seguir subiendo manual solo la web, pero entonces las funciones no se actualizan).

**Prueba previa (opcional, URL temporal):**

```powershell
netlify deploy
```

Abre la URL de “draft deploy” que imprime la CLI; para producción usa `--prod`.

#### D) Comprobar que las funciones responden

Sustituye `https://www.cdsanabriacf.com` por tu dominio:

| URL | Qué esperar |
|-----|-------------|
| `/deploy-version.json` | Fecha reciente del build |
| `/.netlify/functions/redsys-config` | JSON (aunque Redsys no esté configurado) |
| Netlify → **Logs → Functions** | Sin error al probar registro / solicitud jugador |

| Función | Operativa con CLI si… |
|---------|------------------------|
| `send-club-email` | `SMTP_USER` + `SMTP_PASS` configurados |
| `submit-player-application` | `FIREBASE_SERVICE_ACCOUNT_JSON` |
| `submit-player-inscription` | Igual |
| `approve-player-application` | Igual + admin en panel |
| `player-portal-auth` | Igual |
| Redsys / Bizum | `REDSYS_MERCHANT_CODE`, `REDSYS_SECRET_KEY`, etc. |

#### E) Errores frecuentes CLI

| Problema | Solución |
|----------|----------|
| `netlify: command not found` | `npm install -g netlify-cli` y nueva ventana PowerShell |
| No enlaza el sitio | `netlify link` de nuevo en la raíz del repo |
| Funciones 404 en producción | Deploy fue solo ZIP manual → usar `netlify deploy --prod` |
| Función 500 “FIREBASE…” | Revisar `FIREBASE_SERVICE_ACCOUNT_JSON` en una línea |
| Correo no sale | Ver logs de `send-club-email` y `docs/EMAIL-SOCIOS.md` |

---

## 3. Reglas Firestore (si cambiaste `firestore.rules`)

Copia el contenido de `firestore.rules` en Firebase Console → Firestore → Reglas → Publicar.

Incluye bloqueo de altas públicas cuando **modo actualización** está ON (`sanabria_config/sitePublicMode.actionsDisabled == true`).

---

## 4. Modo actualización (tras cada subida)

- Por defecto en código: **OFF** (registros abiertos).
- Tras subir, entra como **admin** en el panel → **Dashboard** → **Actualización: ON/OFF** (se guarda en Firestore). Así todos los dispositivos quedan sincronizados aunque cambie el código.
- Cuando termines de probar en producción, pulsa **OFF** para reabrir inscripciones al público.

---

## 5. Dónde configurar Colabora y torneo

| Qué | Dónde |
|-----|--------|
| Formulario **Colabora** (opciones, precios, textos) | Admin → **Publicidad** → «Formulario público de colaboradores» |
| Vista previa mail / solicitudes locales | Misma sección → «Vista previa y diagnóstico local» |
| **Preinscripciones torneo** (listado Firestore) | Admin → **Eventos** → «Preinscripciones torneo» |
| Email/teléfono del club | `js/club-contact-defaults.js` + Admin → contacto del club |
| Cartel torneo | `assets/torneo-futbol-7-2026.jpeg` |

Contacto canónico del club: **cdsanabriafc@gmail.com** (`club-contact-defaults.js`).

---

## 6. Checklist antes de cada subida

Marca en local (o en producción justo después de subir):

- [ ] **Build** ejecutado sin errores (`build-netlify-dist.ps1`)
- [ ] **Banner modo actualización**: OFF por defecto; admin lo activa si hace falta
- [ ] **Colabora**: abrir modal, rellenar sin enviar; aviso de adjuntos visible
- [ ] **Torneo**: abrir modal de preinscripción, ver formulario (sin enviar si modo ON)
- [ ] **Inscripción jugador/a**: formulario carga y valida campos
- [ ] **Login socio**: acceso con cuenta de prueba
- [ ] **Panel admin**: login, pestaña Eventos (preinscripciones), Publicidad (Colabora)

---

## 7. Git y archivos legacy

- **Versionar:** `index.html`, `admin-panel.html`, `js/`, `assets/`, `sw.js`, `firestore.rules`, scripts de build.
- **No versionar:** `netlify-dist/` (se genera siempre con el script).
- Legacy archivado en `archive/` (p. ej. `index_live.html` — otro proyecto, no mezclar con el club).

---

## 8. Contraseñas socios

- Producción usa **Firebase Auth**; la contraseña no va a Firestore.
- `js/club-password-hash.js` hashea accesos en modo simulación / local.
- Reglas Firestore: `hasNoPlainPassword()` bloquea campos `password` en documentos.
