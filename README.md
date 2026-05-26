# CD Sanabria CF — CDSANABRIACF

Aplicación web y PWA del **Club Deportivo Sanabriacf**: socios, amigos, eventos, competiciones internas y panel de administración.

## Stack (único proyecto)

| | |
|---|---|
| **Firebase** | `cdsanabriacf2026` |
| **appScope** | `cdsanabriacf` |
| **Colecciones** | `sanabria_*` (members, friends, events, competitions, …) |
| **Deploy** | Netlify → carpeta `netlify-dist/` |
| **Marca / desarrollo** | **Turisteam** (tus proyectos) |
| **Backend** | Firebase del club (`cdsanabriacf2026`) |

Configuración: `js/firebase-config.js`.

## Admin

- Login: Firebase Authentication + documento `sanabria_admins/{UID}` con `appScope: cdsanabriacf`.
- Super administrador: `amco@gmx.es` (ver `docs/ACCESO-LOCAL-Y-ADMIN.md`).

## Documentación

- `docs/STACK-CDSANABRIACF.md` — qué proyecto usar y qué no
- `docs/ACCESO-LOCAL-Y-ADMIN.md` — login y Firestore
- `docs/SEGURIDAD-CREDENCIALES.md` — credenciales y buenas prácticas

## Publicar en Netlify (subida manual)

Antes de subir, ejecuta siempre:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\build-netlify-dist.ps1"
```

Eso deja `netlify-dist/` listo con **`_redirects`**, **`.netlifyignore`** y **`404.html`** (plantillas en `scripts/netlify-deploy/`).

Sube el **contenido** de la carpeta `netlify-dist/` a Netlify.
