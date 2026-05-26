# Maqueta inscripción — cómo compartir para aprobación

## Archivo (sin deploy)

- **`inscripcion-jugador-demo.html`** — un solo archivo; funciona abriéndolo en el PC o adjuntándolo por WhatsApp/email.
- En el escritorio: `ABRIR-FORMULARIO-DEMO.bat` + `LEEME-inscripcion-demo.txt`.

## Enlace web (solo tras deploy completo)

- **https://cdsanabriacf.com/inscripcion-jugador-demo.html** — dará 404 en Netlify hasta que subas `netlify-dist` con ese archivo. Para aprobar el diseño **no hace falta** publicar.

## Cómo enviarlo por móvil

### Opción A — Archivo adjunto (email / WhatsApp)

1. Copia el archivo `inscripcion-jugador-demo.html` al móvil (email, Drive, cable).
2. Ábrelo con **Chrome** o **Safari**.
3. Pueden rellenar campos y pulsar **「📋 Copiar resumen」** para pegar un texto en WhatsApp.

### Opción B — Enlace web (recomendado si ya está desplegado)

1. Sube `netlify-dist` con el build actual.
2. Envía el enlace **https://cdsanabriacf.com/inscripcion-jugador-demo.html** por WhatsApp o correo.

### Opción C — Compartir desde el móvil

En la franja naranja superior: **「📤 Compartir enlace」** (si el navegador lo permite).

## ¿Se pueden meter después los datos de la demo en el club?

**No de forma automática.** Esta maqueta:

- **No** escribe en Firebase (`sanabria_players`).
- **No** actualiza el panel de administración.
- Los botones de pago solo muestran un aviso.

La inscripción **real** es `inscripcion-jugador.html` en la web publicada (con Firebase y Redsys).

Si en las pruebas alguien rellena la demo y queréis conservar esos datos, habría que:

1. Copiar el resumen con **「Copiar resumen」**, o  
2. Pedir que repitan la inscripción en la web real cuando esté activa, o  
3. (Futuro) Añadir en admin **「Importar borrador JSON」** — no está implementado ahora.

## Diferencia demo vs producción

| | Demo | Producción |
|---|------|------------|
| Guardar jugador | No | Sí → `sanabria_players` |
| Pago | Simulado | Redsys / transferencia + admin |
| Precios | Ejemplo fijo en el HTML | Panel → configuración inscripciones |
