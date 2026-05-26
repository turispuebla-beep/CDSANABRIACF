# Acceso local y login de administrador

## Error típico en F12

```
origin ('null') is not supported
Firebase no disponible, usando solo localStorage
```

**Causa habitual:** la app se abrió como archivo local en lugar de la URL publicada. Firebase (módulos ES) necesita un origen HTTP/HTTPS válido.

## Uso recomendado

En **producción** abre siempre la URL **HTTPS** de Netlify del club (CD Sanabria CF).

Para pruebas en tu PC, opcionalmente puedes usar `scripts/serve-local.ps1` en esta carpeta (`CDSANABRIACF1`).

---

## Roles de las cuentas (Authentication)

| Email | Rol | Cómo entra en la web |
|-------|-----|----------------------|
| **amco@gmx.es** | **Super administrador** del club | «Acceso administrador» → panel completo + funciones solo super admin |
| **alarico1963@gmail.com** | **Usuario normal** (socio / amigo / jugador, según su ficha) | **No** usar «Acceso administrador». Login de socio o amigo en la página principal |
| cdsanabriafc@gmail.com | Cuenta del club (opcional) | Solo admin si creas documento en `sanabria_admins` con `isAdmin` (no super admin salvo que lo indiques) |

---

## Super administrador: Firestore obligatorio

Tener **amco@gmx.es** en Authentication **no basta** para el panel. Debe existir **un solo documento** de super admin:

| Campo | Valor |
|-------|--------|
| Colección | `sanabria_admins` |
| **ID del documento** | `PMhRCGKtlJgftYfHARSNOmS7A7D3` (UID de amco@gmx.es) |

Campos del documento:

```json
{
  "appScope": "cdsanabriacf",
  "isAdmin": true,
  "isSuperAdmin": true,
  "role": "super_admin",
  "email": "amco@gmx.es",
  "name": "Super administrador"
}
```

[Firestore → sanabria_admins](https://console.firebase.google.com/project/cdsanabriacf2026/firestore)

### Importante

- **No** crees documento en `sanabria_admins` para `alarico1963@gmail.com` (`3YvmxvrvPfOhSPmwSxirdgrnCeB2`) si es usuario normal.
- Si ese documento existe por error, **bórralo** o no podrá distinguirse bien del acceso de panel.

En la web del club (URL HTTPS de Netlify): **Acceso administrador** → **amco@gmx.es** + contraseña de Authentication.

El código del panel reserva algunas acciones (gestión de otros admins, etc.) solo a **amco@gmx.es**.

---

## Usuario normal (alarico1963@gmail.com)

- Registro / login como **socio** o **amigo** en `index.html` (no panel admin).
- Su UID `3YvmxvrvPfOhSPmwSxirdgrnCeB2` debe estar en `sanabria_members` o `sanabria_friends`, **no** en `sanabria_admins`.

---

## Comprobar que Firebase cargó

En F12 → Consola debe aparecer:

`Firebase CDSANABRIACF2026 configurado correctamente`

Y **no** debe repetirse `Firebase no disponible` al segundo 2–3.

Si tras usar http:// sigue fallando, revisa bloqueadores o que `js/firebase-config.js` no dé error 404.
