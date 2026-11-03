# Seguimiento de las consultas

Estado comprobado el 3 de noviembre de 2026:

- El usuario instaló la migración y el cron `latido-conversation-followups`
  (job 17, cada diez minutos) y desplegó las funciones de respuesta, correo y push.
- Los envíos automáticos se controlan con `CONVERSATION_FOLLOWUP_ENABLED` y
  permanecen desactivados por defecto. Activar únicamente tras verificar la
  interfaz de producción y los enlaces públicos del correo.
- Se desplegó una opción de prueba del emisor, autenticada con el secreto del cron.
  Solo admite `latidoch@gmail.com` y conversaciones de cuentas marcadas con
  `user_metadata.latido_followup_test=true`. No selecciona la cola ni envía push.
- Se probaron las tres respuestas contra el endpoint y la base de datos reales,
  incluidas las correcciones, el motivo opcional y el rechazo de enlaces usados.
- El usuario confirmó la recepción del correo y respondió «Sí»: quedó guardado
  una sola vez y el seguimiento de esa prueba quedó cerrado.
- La función forma parte del Latido existente. La página pública de respuesta
  es `/seguimiento` y el panel del administrador es `/admin?section=followups`.
  No se crea otro sitio web.

Las pruebas reales usan una cuenta temporal sin email confirmado, con dirección
`example.invalid`, y conversaciones consigo misma sin mensajes. Los detalles
privados de estas pruebas están en `supabase/.temp/followup-live-record.json`
(ignorado por Git). No se modificaron conversaciones de personas reales.

El correo de prueba apuntaba a `http://127.0.0.1:5244`: solo sirve donde esté
accesible ese servidor local. No reenviar esos enlaces como si fueran públicos.
En producción, configurar `LATIDO_APP_URL=https://www.latido.ch`.

## Panel del administrador

Admin → Seguimiento de consultas muestra totales, filtros por resultado, nombre
y email del usuario, contacto consultado, fechas, próxima pregunta, motivo de
«No» e historial de las últimas diez respuestas con su canal (correo o chat).
La vista y el refresco consultan una función SQL restringida al administrador.
Los registros marcados `is_test=true` no entran en las métricas ni en la cola de
envíos reales; se pueden revisar con el filtro «Solo pruebas».

## Probar ahora

```powershell
npm run preview:followups
```

Abre http://127.0.0.1:5242/scripts/fixtures/followup-preview.html.
La vista utiliza los componentes reales y una base PostgreSQL local en memoria
(PGlite), con personas y conversaciones ficticias. Al cerrarla se pierden los
datos de prueba. El resto de pestañas y servidores de Latido conserva su entorno.

- **Simular primer día:** oculta la pregunta durante los primeros siete días.
- **Avanzar 7 días:** hace que el siguiente seguimiento venza inmediatamente.
- **Generar aviso y correo de prueba:** ejecuta la selección SQL de avisos y
  muestra el correo en pantalla; no utiliza SMTP ni envía notificaciones push.
- **Sí:** registra el éxito y detiene los recordatorios de esa conversación.
- **No:** registra «No conseguido» y detiene los recordatorios de esa conversación.
- **En proceso:** guarda la respuesta y programa la siguiente pregunta para dentro
  de siete días. Se puede indicar «Ya lo he conseguido» antes de esa fecha.
- **Reiniciar caso:** vuelve al primer seguimiento con datos ficticios.

El enlace **Ver los cinco estados del diseño** muestra la pregunta, éxito,
en proceso, motivo opcional de «No» y confirmación de cierre con el diseño compacto.
En el chat, «Sí» ofrece compartir Latido; «En proceso» muestra la fecha de la
próxima pregunta. «No» cierra el seguimiento inmediatamente y permite elegir
opcionalmente «No me respondió», «No era lo que buscaba», «No hubo acuerdo» u
«Otro motivo», o pulsar «Omitir». El motivo queda registrado en el admin.
No se ofrece «Cambiar respuesta» en el chat ni en las pantallas del correo.
La X solo oculta la tarjeta de confirmación: una consulta en
proceso volverá a mostrar la pregunta cuando llegue su fecha.

Un clic en los botones del correo abre la página y guarda automáticamente la
respuesta mediante POST, sin iniciar sesión ni mostrar una confirmación adicional.
La página muestra el resultado con la franja de marca, cabecera de Latido,
tarjeta central y pie de agradecimiento. «Sí» permite compartir Latido;
«En proceso» muestra la próxima fecha y el acceso al chat. «No» permite elegir
un motivo opcional y enviarlo; «Volver a Latido» permite salir sin elegir motivo.
Tras enviar el motivo se muestra el cierre del seguimiento. No hay una opción
para cambiar la respuesta. Los enlaces usan tokens
aleatorios por conversación y ronda en el fragmento de la URL, caducan, se invalidan
al responder y no contienen emails ni datos del usuario. El endpoint rechaza GET;
la respuesta la envía el navegador al cargar la página con una opción válida.
No se interpretan respuestas de texto enviadas al buzón remitente.
Tras responder desde el correo se concede una continuación privada de 30 minutos
para indicar el motivo opcional sin iniciar sesión.
Los cambios quedan en el historial y no reutilizan el enlace original del correo.

El correo utiliza el HTML facilitado por el usuario en `email-template.ts`, con
franja de marca, logo PNG absoluto, contacto y contexto personalizados, y tres
tarjetas de respuesta. Se conservan los estilos adaptativos y los ajustes de
Outlook. Las variables se escapan antes de insertarlas en el HTML. En
Perfil → Notificaciones se pueden activar o desactivar los emails de mensajes
sin leer y seguimiento. El correo no incluye un enlace a estos ajustes. La preferencia se
guarda en `email_notification_preferences` y se respeta al seleccionar los envíos.

## Funcionamiento preparado para producción

Cada conversación nueva con título genera un seguimiento para la persona que
inició el contacto, a partir de su primer mensaje. Los siguientes mensajes no
reinician el plazo. La instalación del esquema no ejecuta una incorporación
masiva de conversaciones anteriores.
No se pregunta a la persona que publicó el anuncio ni se inventan mensajes suyos.

Las conversaciones anteriores también muestran la pregunta cuando el primer
mensaje del iniciador tiene al menos siete días. `cf_get` incorpora el chat al
abrirlo si todavía no tiene seguimiento. El script idempotente
`supabase/conversation_followups_backfill.sql` incorpora además todos los chats
antiguos que ya cumplen el plazo, para que aparezcan en el admin desde ese momento.
La primera ronda histórica tiene `delivery_status='skipped'`: se ve en el chat y
no genera correos, push ni avisos retrospectivos. Si la persona elige «En proceso»,
se programa el siguiente recordatorio dentro de siete días como en los chats nuevos.
Los chats eliminados por el iniciador y las cuentas bloqueadas quedan excluidos.
Los resultados existentes se conservan al volver a ejecutar el script.

La tarjeta aparece al final del chat. El aviso persistente en Latido y el push
dicen «¿Cómo fue tu consulta?» y abren esa conversación. El correo utiliza SMTP
existente, respeta los avisos de email y requiere una dirección verificada. Los
chats eliminados y las cuentas bloqueadas quedan excluidos. Los trabajos utilizan
reservas y reintentos, sin duplicar el aviso en la app en la misma ronda.
Si no se responde, se conserva «Sin confirmar» y no se envía otro correo en esa
ronda. Una respuesta «En proceso» programa otra ronda; «Sí» y «No» terminan el seguimiento.

Admin → Seguimiento de consultas muestra el estado
confirmado por el usuario y si respondió desde el chat o el correo. «En proceso» es
un resultado provisional y no equivale a una contratación fallida.

Después de revisar y autorizar la activación: instalar
`supabase/conversation_followups.sql`, desplegar `conversation_followup_email`,
`conversation_followup_answer` y la modificación de `latido_push_notification`.
Configurar `CONVERSATION_FOLLOWUP_CRON_SECRET`, el mismo secreto en Vault como
`conversation_followup_cron_secret`, y `CONVERSATION_FOLLOWUP_ENABLED=true`.
Instalar separadamente `supabase/conversation_followups_cron.sql` para comprobar
los avisos cada diez minutos. El emisor permanece inactivo sin el flag explícito.

## Verificación

```powershell
npm run test:followups
npm run test:followups:email
npm run test:followups:browser
npm run test:notifications
npm run lint
npm run build
deno check --no-lock --node-modules-dir=none supabase/functions/conversation_followup_email/index.ts supabase/functions/conversation_followup_answer/index.ts supabase/functions/latido_push_notification/index.ts
```
