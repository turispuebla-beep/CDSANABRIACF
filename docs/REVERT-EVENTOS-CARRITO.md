# Cómo revertir el carrito de eventos (si hiciera falta)

Implementación: **mayo 2026** — carrito por evento, invitados, formas de pago configurables.

## Archivos nuevos (borrar para deshacer)

- `js/event-cart.js`
- `docs/REVERT-EVENTOS-CARRITO.md` (este archivo)

## Archivos modificados (restaurar desde git o copia de seguridad)

- `index.html` — UI eventos, carrito, precio solo del usuario logueado
- `admin-panel.html` — formulario evento (pago, invitados)
- `js/redsys-payments.js` — `guests` / `registrationBundle` en pago evento
- `netlify/functions/redsys-create-payment.js`
- `netlify/functions/lib/firestore-admin.js` — `completeEventPayment` con invitados
- `pago-resultado.html` — mensaje evento pagado

## Con git (si tienes commit anterior)

```powershell
cd "C:\Users\marsa\Desktop\CDSANABRIACF1"
git checkout HEAD~1 -- index.html admin-panel.html js/event-cart.js js/redsys-payments.js
git checkout HEAD~1 -- netlify/functions/redsys-create-payment.js netlify/functions/lib/firestore-admin.js
git checkout HEAD~1 -- pago-resultado.html
Remove-Item js/event-cart.js -ErrorAction SilentlyContinue
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-netlify-dist.ps1
```

(Ajusta `HEAD~1` al commit correcto.)

## Datos en navegador

Los carritos viven en `localStorage` con clave `cdsan_event_cart_<idEvento>`. Borrar desde DevTools → Application → Local Storage si quieres limpiar pruebas.

## Eventos ya guardados

Los eventos antiguos siguen funcionando: sin campos nuevos se asumen tarjeta + transferencia y sin invitados hasta que edites el evento en el panel.
