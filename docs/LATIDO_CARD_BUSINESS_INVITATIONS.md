# Invitación de negocios a Tarjeta Latido

## Campaña y recordatorio cada 20 días

La Edge `latido_card_business_invitation_email` envía la plantilla aprobada por el operador, con sus dos imágenes originales por CID y el botón «Crear oferta gratis». El enlace personalizado abre `/card/negocios?negocio=<id>&crear=1`.

La campaña solo se habilita cuando el secret `LATIDO_CARD_INVITATION_TEST_MODE` vale exactamente `false`. Por defecto funciona como prueba cerrada. Las pruebas explícitas siguen limitadas a `jose13hue@gmail.com` y `play4slim1.2@gmail.com`, con asunto [PRUEBA], sin consumir la cola real. Sin una acción explícita solo se muestran recuentos.

Se envía un correo por propietario elegible, aunque tenga varios negocios. Se vuelve a encolar únicamente un envío confirmado hace al menos 20 días si sigue sin haber creado ninguna oferta. Las bajas, las preferencias, los negocios archivados o suspendidos y los propietarios con ofertas anteriores quedan excluidos. Los estados failed y processing requieren revisión manual; nunca se reintentan automáticamente.

El cron `latido-card-business-invitations` ejecuta `action: run` cada hora, al minuto 37: encola nuevos destinatarios y recordatorios vencidos, y procesa hasta 20. Esta comprobación horaria no significa enviar cada hora a una persona. Se conserva `sent_at` como referencia del plazo de 20 días. El resumen semanal usa otra Edge y otro cron.

Tras publicar un negocio visible se ofrece crear la primera oferta como siguiente paso opcional, sin el aviso automático «Profesional desbloqueado». Un negocio enviado a revisión no recibe esa invitación todavía. «Crear mi oferta» abre el modal «Crear oferta» sobre la pantalla actual. El negocio ya está seleccionado y no se navega a «Mi negocio». Cerrar conserva el borrador para ese negocio durante la sesión de la app.

El correo abre `/card/negocios?negocio=<id>&crear=1`. Si hace falta iniciar sesión, se conserva el destino. Los enlaces anteriores `/?crear-oferta=<id>` siguen abriendo el mismo modal sobre el inicio. Abrir el formulario solo consulta los permisos; el alta en Tarjeta Latido y la publicación de la oferta se guardan en una única transacción con `lc_save_offer`. Si la oferta falla, el negocio no queda inscrito. Solo los negocios con al menos un descuento activo y vigente aparecen en «Negocios participantes».

Los propietarios que aún no hayan creado descuentos reciben el mismo mensaje al entrar en la app central. Se coordina con el recordatorio de compartir tarjetas para que no aparezcan dos avisos a la vez, con prioridad para Tarjeta Latido. «Lo haré más tarde», Escape o cerrar el fondo posponen el aviso durante 30 días para ese propietario en ese navegador, aunque tenga varios negocios. La invitación sigue accesible en «Mi negocio» cuando no hay ofertas. Se mantienen los emojis de Latido.

El servidor limita el modal y el correo a propietarios reales de negocios publicados, con al menos un negocio no suspendido. No cuenta como propietario un administrador que solo gestiona negocios ajenos. Cualquier descuento anterior del propietario, incluso pausado, vencido o borrado, evita la invitación para crear el primero. El recordatorio dentro de un negocio vacío también permite ofrecer descuentos para ese negocio concreto.

Se retira el antiguo aviso automático «Tu negocio en una tarjeta». Compartir el negocio sigue disponible como acción manual desde su ficha y después de publicarlo. La invitación se mantiene con el título «Dales un motivo para visitarte», una tarjeta de ejemplo con el nombre y la ciudad reales y el CTA principal «Crear mi oferta». Los accesos «10 %», «2x1», «Regalo» y «Otro» abren el mismo modal con esa opción seleccionada. Se conserva el término «socios» y los emojis.

«Crear oferta» guía por cuatro pasos: tipo de oferta, dónde se aplica, usos por socio y revisión con vista previa. «Otro beneficio» omite el paso de alcance y muestra tres pasos. El título se genera a partir de las elecciones y «Cambiar» permite revisarlas antes de publicar. Las opciones avanzadas conservan condiciones, límite por día o semana y unidades limitadas. La navegación y el botón de cierre permanecen visibles mientras se desplaza el contenido.

La fecha de fin es opcional: se guarda como `infinity` de PostgreSQL, compatible con el RPC y los límites existentes, y se muestra «Sin fecha de fin». No se inventa una fecha futura ni se cambia el esquema. Las variantes 3x2 y segunda unidad a mitad se guardan como beneficios descritos (`service`) con su título generado; 2x1 mantiene `two_for_one`. La tarjeta, el directorio y el texto compartido conservan el beneficio concreto. Esta actualización no necesita SQL adicional.

## Activación

1. Ejecutar `supabase/latido_card_business_invitation.sql` después del instalador mínimo. Es idempotente y no envía ni encola correos. La app sigue funcionando si este módulo aún no está instalado.
2. Publicar el frontend antes de enviar la campaña para que el enlace abra directamente el formulario nuevo.
3. Reutilizar los secrets SMTP existentes: `SMTP_HOSTNAME`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, además de `LATIDO_APP_URL`. Crear `LATIDO_CARD_INVITATION_SECRET` con un valor privado independiente.
4. Desplegar `supabase functions deploy latido_card_business_invitation_email --no-verify-jwt`. La función valida el secret de campaña en todos los comandos de administración. La baja mediante token debe poder abrirse sin iniciar sesión.
5. En la terminal del operador, definir `SUPABASE_URL` y `LATIDO_CARD_INVITATION_SECRET` como variables de entorno. No guardar los valores en el repositorio ni pegarlos en logs.

```powershell
npm run card:invitations
npm run card:invitations -- --test=jose13hue@gmail.com
npm run card:invitations -- --queue
npm run card:invitations -- --send
npm run card:invitations -- --run
```

Aplicar también `supabase/latido_card_business_invitation_cron.sql` tras guardar el secret independiente en Vault como `latido_card_invitation_secret`. Activar `LATIDO_CARD_INVITATION_TEST_MODE=false` en la Edge cuando la instalación haya pasado las comprobaciones.

Sin opciones solo se muestran recuentos. `--queue` encola propietarios elegibles y recordatorios vencidos sin duplicarlos. `--send` procesa hasta 20 pendientes. `--run` combina ambas acciones y es lo que usa el cron. Repetirlo permite terminar la cola sin volver a enviar a quienes ya recibieron el correo en los últimos 20 días. El correo de prueba usa solo un negocio del propio destinatario; si no tiene ninguno, enlaza a Mi negocio.

## Entrega y preferencias

Un único registro privado por propietario conserva el estado y la baja aunque se elimine su negocio. Los usuarios de la app no pueden consultar la cola ni invocar los comandos de envío. Antes de cada entrega se comprueba otra vez la elegibilidad, el email confirmado de Auth y la preferencia existente de correos informativos (`weekly_digest_enabled`), si ese módulo está instalado. Una baja de esta campaña también impide futuros envíos de esta invitación.

El email incluye versión HTML y texto, un enlace directo al formulario y baja con confirmación en web, además de `List-Unsubscribe` de un clic. Abrir el enlace con GET no da de baja automáticamente, para evitar que lo hagan los escáneres de correo.

Los estados `failed` y `processing` no se reintentan automáticamente: SMTP puede aceptar un correo antes de fallar la conexión. Revisar la entrega en el proveedor antes de reabrir un caso manualmente. Un estado `sent` significa aceptado por SMTP, no garantiza llegada a la bandeja de entrada. Los recuentos de la vista previa indican candidatos generales; las preferencias y el email confirmado pueden reducir el envío final.

Validación local: `npm run test:card:invitations`, `npm run test:card:invitation-email`, `npm run test:card`, `npm run test:card:browser`, `npm run test:card:webkit`, `npm run build` y `deno check --node-modules-dir=none --no-config supabase/functions/latido_card_business_invitation_email/index.ts`.
