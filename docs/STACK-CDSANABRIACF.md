# Stack — CD Sanabria CF (CDSANABRIACF)

## Proyecto

| | |
|---|---|
| Cliente / app | **CD Sanabria CF** — CDSANABRIACF |
| Firebase | **cdsanabriacf2026** |
| Alcance en datos | `appScope: cdsanabriacf` |
| Colecciones Firestore | `sanabria_*` (members, friends, events, competitions, payments, …) |
| Deploy | Netlify → carpeta `netlify-dist/` |
| Marca plataforma | **Turisteam** (desarrollo) |

## Configuración

- `js/firebase-config.js` — Auth, Firestore, sincronización en tiempo real
- Reglas: `firestore.rules` → publicar con `scripts/publish-firestore-rules.ps1`

## Desarrollo local (opcional)

Si necesitas probar en tu PC, puedes usar un servidor HTTP local (`scripts/serve-local.ps1`). En producción usa siempre la URL Netlify del club.
