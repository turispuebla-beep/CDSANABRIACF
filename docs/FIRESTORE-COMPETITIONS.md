# Firestore: `sanabria_competitions`

## Permisos (reglas publicadas)

| Acción | Quién |
|--------|--------|
| **Leer** | Cualquiera si el documento tiene `appScope: "cdsanabriacf"` (calendario público / PWA) |
| **Crear / editar / borrar** | Solo administradores (`sanabria_admins` con `isAdmin` o `role` admin) |

### Validación al escribir

- `appScope` obligatorio: `cdsanabriacf`
- `name` o `title` no vacío
- `type` opcional: `torneo`, `liga`, `amistoso`, `entrenamiento`
- `excludeFromOfficialPlayerStats` opcional: booleano
- `teams` y `matches` opcionales: deben ser listas si existen

## Publicar reglas

Desde la raíz del repo `CDSANABRIACF1`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-firestore-rules.ps1
```

O manualmente:

```bash
firebase login
firebase deploy --only firestore:rules --project cdsanabriacf2026
```

También puedes pegar el contenido de `firestore.rules` en la consola Firebase → Firestore → Reglas → Publicar.

## Sincronización en la app

- **Escritura**: `saveCompetitionRecord` → `persistRecordToFirebase('clubCompetitions', 'competitions', …)` → colección `sanabria_competitions` (con `appScope` automático vía `firebase-config.js`).
- **Lectura en vivo**: `onSnapshot` en `js/firebase-config.js` actualiza `localStorage.clubCompetitions`.

## Prueba offline del flujo (2 categorías + externos)

```bash
node scripts/verify-competition-flow.cjs
```

Simula semifinales por categoría, generación de finales separadas y campeones `categoryChampions` sin mezclar cuadros.

## Prueba manual en el panel

1. Inicia sesión como **admin** en `admin-panel.html`.
2. **Competiciones** → Nueva → Tipo **Torneo**, categorías **Alevín** e **Infantil**.
3. Marca **Solo puntúa esta competición**.
4. Añade equipos del club + **invitados** (`GUEST_…`) en cada categoría.
5. Genera calendario / cuadro; guarda resultados de semifinales.
6. Comprueba que se crean **dos finales** (una por categoría).
7. En Firebase Console → `sanabria_competitions` debe aparecer el documento con `teams`, `matches`, `appScope`.

Si `persist` falla con `permission-denied`, vuelve a publicar reglas y confirma que tu usuario está en `sanabria_admins`.
