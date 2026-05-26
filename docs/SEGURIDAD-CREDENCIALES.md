# Seguridad de credenciales (CDSANABRIACF)

## Qué hace la aplicación

- **Administradores**: solo Firebase Authentication + documento `sanabria_admins/{UID}`. No se guardan contraseñas de admin en `localStorage`.
- **Socios / amigos**: Firebase Auth en producción; en modo local solo **hash SHA-256** (`passwordHash`), nunca texto claro.
- **Entrenadores**: `passwordHash` (igual que antes).
- **Firestore**: las reglas bloquean campos `password` en socios y amigos.
- Al cargar la web se ejecuta `sanitizeClubLocalCredentials()` para migrar/borrar contraseñas en claro del navegador.

## Si las contraseñas antiguas estuvieron publicadas

Rotar en [Firebase Authentication](https://console.firebase.google.com/project/cdsanabriacf2026/authentication/users):

1. **amco@gmx.es** (super admin) — contraseña nueva fuerte.
2. Cualquier cuenta que usara `533712` o `admin123` documentadas en versiones viejas del repo.

## Deploy

No subas a Netlify archivos con credenciales de prueba (`CREDENCIALES-*.md`, etc.). La carpeta `netlify-dist` del repo ya no debe incluir contraseñas en documentación.

## API key de Firebase

La clave en `js/firebase-config.js` es pública por diseño; restringe dominios en Google Cloud Console.
