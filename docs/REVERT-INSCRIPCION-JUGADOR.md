# Revertir — Inscripción jugador/a (temporada 2026-2027+)

## Archivos tocados

- `js/club-inscription-config.js`
- `js/player-inscription.js`
- `js/inscripcion-jugador-ui.js`
- `js/admin-inscription-config.js`
- `inscripcion-jugador.html`
- `index.html` (botón bajo escudo)
- `admin-panel.html` (config inscripciones)
- `js/redsys-payments.js`
- `js/firebase-config.js`
- `netlify/functions/redsys-create-payment.js`
- `netlify/functions/redsys-notification.js`
- `netlify/functions/lib/firestore-admin.js`
- `pago-resultado.html`
- `build-netlify-dist.ps1`
- `scripts/netlify-deploy/_redirects`

## Revert rápido (git)

```bash
git checkout HEAD -- js/club-inscription-config.js js/player-inscription.js js/inscripcion-jugador-ui.js js/admin-inscription-config.js inscripcion-jugador.html index.html admin-panel.html js/redsys-payments.js js/firebase-config.js netlify/functions/redsys-create-payment.js netlify/functions/redsys-notification.js netlify/functions/lib/firestore-admin.js pago-resultado.html build-netlify-dist.ps1 scripts/netlify-deploy/_redirects
```

Luego ejecutar `build-netlify-dist.ps1` y volver a desplegar **sitio + funciones Netlify**.

## Despliegue (importante)

El archivo `netlify/functions/lib/firestore-admin.js` lo modificó el asistente para activar inscripciones pagadas por Redsys. **No hace falta que lo edites tú**: al desplegar en Netlify, sube la carpeta `netlify/functions/` (o el repo conectado) para que esa lógica esté en producción.

## Exportación jugadores

- `js/player-export.js` — columnas completas (tallas, pagos, tutor, etc.)
- Panel → **Jugadores** o pestaña **Exportar** → Excel / Word / PDF
