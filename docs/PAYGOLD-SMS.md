# PayGold SMS — cobro con enlace desde el panel admin

Proyecto: **CDSANABRIACF** · TPV Caja Rural (Redsys) · Comercio `139060982` · Terminal `101`

## Qué hace

Desde **Panel admin → pestaña Tienda → PayGold**, un administrador puede:

1. Elegir socio (opcional), tipo de cobro (cuota / ropa / otro), concepto e importe.
2. Indicar móvil (9 dígitos, sin +34).
3. Pulsar **Enviar enlace PayGold** → Redsys envía el **SMS** con el enlace de pago.
4. Al pagar el socio, `redsys-notification` confirma el cobro en Firestore.

- **Cuota socio:** activa al socio automáticamente (igual que TPV web).
- **Ropa / otro:** aviso al club por correo; validación manual si aplica.

## Requisitos

- TPV Redsys configurado en Netlify (`REDSYS_*`, `SITE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON`).
- **PayGold activo** en Caja Rural (terminal 101).
- URL de notificación en Ruralvía:  
  `https://www.cdsanabriacf.com/.netlify/functions/redsys-notification`
- URL del comercio corregida por Caja Rural (sin typo en el dominio).

## Archivos

| Archivo | Rol |
|---------|-----|
| `netlify/functions/redsys-paygold-send.js` | Admin → Redsys PayGold REST (SMS) |
| `netlify/functions/lib/redsys.js` | Firma REST, tipo operación `F` |
| `netlify/functions/redsys-notification.js` | Confirma pago `paygold_custom` |
| `js/admin-paygold.js` | Formulario e historial en admin |
| `admin-panel.html` | UI pestaña Tienda |

## Prueba recomendada (tras TPV normal OK)

1. Admin → **Tienda** → PayGold.
2. Importe **1 €**, concepto «Prueba PayGold».
3. Tu móvil de prueba.
4. Comprobar SMS de Redsys y pago.
5. Historial en la tabla y estado en `sanabria_payments`.

## Desactivar PayGold (sin quitar TPV)

Variable Netlify: `REDSYS_PAYGOLD_DISABLED=true`

## Errores frecuentes

| Código / mensaje | Causa |
|------------------|--------|
| SIS0324 | SMS no enviado (móvil, saldo SMS TPV, PayGold) |
| SIS0487 | PayGold no habilitado en terminal |
| Firma incorrecta | Clave SHA-256 en Netlify |
