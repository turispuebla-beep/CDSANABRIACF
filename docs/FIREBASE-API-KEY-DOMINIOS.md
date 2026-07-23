# Restringir la API key de Firebase por dominio

La clave en `js/firebase-config.js` (`apiKey`) es **pública por diseño** en apps web. Debe limitarse en Google Cloud para que solo funcionen tus dominios.

## Pasos (proyecto `cdsanabriacf2026`)

1. Abre [Google Cloud Console → APIs y servicios → Credenciales](https://console.cloud.google.com/apis/credentials?project=cdsanabriacf2026).
2. En **Claves de API**, localiza la clave usada por la app web (suele llamarse *Browser key* o *Web API Key*).
3. Editar → **Restricciones de aplicación** → **Referentes HTTP (sitios web)**.
4. Añade solo estos orígenes (uno por línea):
   - `https://www.cdsanabriacf.com`
   - `https://cdsanabriacf.com`
   - `https://cdsanabriacf.netlify.app`
   - `http://localhost:*` (solo si pruebas en local)
5. **Restricciones de API** → limitar a:
   - Identity Toolkit API
   - Cloud Firestore API
   - Firebase Installations API
   - (FCM si usáis notificaciones push)
6. Guardar.

## Comprobar

- La web en producción carga Firebase sin error en consola.
- Abrir `index.html` desde el Escritorio (`file://`) **debe fallar** (correcto).

## Torneo F7 vs jugadores del club

- **Jugadores del club:** `sanabria_players` (solo admin) + `sanabria_players_public` (web pública, sin DNI).
- **Torneo F7:** `sanabria_torneo_preinscripciones` y `sanabria_torneo_documents` — **colecciones distintas**, no se mezclan con la plantilla del club.
