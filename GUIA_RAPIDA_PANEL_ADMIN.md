# Guía rápida del panel de administración

Esta guía resume cómo usar las funciones nuevas de directiva y eventos en el panel de administración.

## 1) Directiva

Ruta en panel: `Directiva`

- Pulsa `Añadir cargo`.
- Rellena:
  - Nombre y apellidos
  - DNI (obligatorio para vinculación automática)
  - Cargo (Presidencia, Vicepresidencia, Secretaría, Tesorería, Vocalía)
  - Área o nota (opcional)
- Marca si quieres que sea visible en la web pública.
- Guarda.

Notas:
- El DNI se usa para reconocer automáticamente personas de directiva al apuntarse a eventos.
- Puedes ocultar/mostrar integrantes sin borrarlos.

## 2) Crear evento con reglas por perfil

Ruta en panel: `Eventos` -> `Crear Nuevo Evento`

Configura:
- Datos básicos: nombre, fecha, horario, ubicación, descripción.
- Precios por perfil:
  - Socios/as
  - Amigos/as
  - Jugadores/as
  - Directiva
  - Entrenadores/as (mismo criterio que el resto: precio propio configurable)
- Inscripción:
  - Mínimo/máximo de inscritos.
  - Inicio y fin de inscripción.
- Quién puede apuntarse:
  - Socios/as
  - Amigos/as
  - Jugadores/as
  - Directiva
  - Entrenadores/as (si están en la lista de entrenadores del club, se inscriben con tarifa de entrenador/a aunque también sean socios/as)
- Si permites jugadores/as:
  - Todos los jugadores/as, o
  - Solo categorías concretas.

## 3) Duplicar evento (muy útil)

Ruta en panel: `Eventos` -> botón `Duplicar` en un evento existente.

Qué hace:
- Copia configuración completa del evento al formulario.
- Permite cambiar solo lo necesario (por ejemplo categoría, fecha o precio).
- No copia inscritos/as.

Uso típico:
- Crear autobús por categorías.
- Repetir actividades con cambios mínimos.

## 4) Editar evento

Ruta en panel: `Eventos` -> botón `Editar`.

- Abre el evento en modo edición.
- Cambia datos y guarda.
- Mantiene inscritos/as ya existentes.

## 5) Limpiar eventos antiguos

Ruta en panel: `Eventos` -> botón `Eliminar antiguos`.

- Indica cuántos días de antigüedad quieres usar como filtro.
- El sistema borra eventos finalizados más antiguos que ese umbral.
- Pide confirmación antes de eliminar.

## 6) Cómo se detecta el perfil al apuntarse

Al inscribirse en eventos:
- Si coincide como directiva, aplica perfil directiva.
- Si coincide como entrenador/a del club (lista de entrenadores), aplica perfil entrenador/a.
- Si coincide como jugador/a del club, aplica perfil jugador/a.
- Si no, aplica amigo/a o socio/a según sesión.

Prioridad aplicada:
1. Directiva
2. Entrenador/a
3. Jugador/a
4. Amigo/a
5. Socio/a

Detección de jugador/a:
- Por DNI o nombre+apellidos en `clubPlayers` (jugadores/as del club).
- No depende del email.

Detección de entrenador/a:
- Por DNI o nombre+apellidos en la lista de entrenadores del club (`clubCoaches`), igual que directiva y jugadores/as.

En la lista de eventos del panel, los precios se muestran con nombres completos (Socios/as, Amigos/as, Jugadores/as, Directiva, Entrenadores/as), no con iniciales.

## 7) Persistencia y sincronización

Todo se guarda en el panel y se sincroniza para:
- Web
- App
- PWA

Si haces cambios y no los ves en otro dispositivo al momento:
- Actualiza la vista.
- Verifica conexión.
- Revisa que el evento se haya guardado correctamente.

## 8) Recomendaciones de uso del club

- Mantener DNI correcto y homogéneo (sin errores de formato).
- Usar duplicado de eventos para ahorrar tiempo.
- Revisar siempre:
  - grupos permitidos,
  - categorías de jugadores/as,
  - precios por perfil,
  antes de publicar.
