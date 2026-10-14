# Latido Card: operaciones y administración de Latido

Latido es el operador del programa: autoriza negocios, administra membresías,
recibe las solicitudes de tarjeta física, aprueba su preparación y registra
emisión y entrega. El comercio únicamente consulta ventajas y confirma canjes.
No recibe direcciones ni interviene en la fabricación de tarjetas.

## Qué está implementado

- El socio solicita primera tarjeta o reposición desde `/card`.
- Se guardan referencia, membresía, destinatario, tipo de entrega y dirección
  suiza cuando corresponde. La recogida no conserva una dirección innecesaria.
- Solo una solicitud abierta por membresía. Los reintentos de la misma petición
  no crean otra solicitud ni duplican avisos.
- Latido recibe un aviso en su bandeja de notificaciones y un email en cola.
- El socio recibe confirmación y avisos de cambios operativos, y puede consultar
  el estado o cancelar antes de comenzar la impresión.
- Administración tiene buscador de socios, selector de negocios, indicadores,
  bandeja por estado, notas, seguimiento y descarga del QR de impresión.
- Cada cambio conserva actor y fecha. Se auditan las ediciones administrativas
  de membresías, participación de negocios y credenciales físicas.
- Se distinguen notas internas y mensajes visibles al socio.

Los datos nuevos se crean al ejecutar la migración, no por abrir la interfaz.
Esta entrega no ha enviado correos reales ni ha aplicado cambios al proyecto
Supabase remoto. Impresión y envío se realizan manualmente; no existe una
integración automática con una imprenta o un transportista.

## Instalar los datos en desarrollo

1. Tener el esquema base y administradores de `business_promotion_admins`.
2. Instalar `supabase/latido_card.sql`.
3. Tener instalado `supabase/app_notifications.sql` y sus requisitos.
4. Instalar `supabase/latido_card_physical_requests.sql`.
5. Confirmar que las cuentas administradoras tienen perfiles y que sus emails
   coinciden con `business_promotion_admins`. Esa tabla determina la autoridad
   del servidor y los destinatarios administrativos de los avisos.
6. Mantener `VITE_ADMIN_EMAILS` coherente para presentar el acceso administrativo.
   Esta variable no concede permisos en la base de datos.

La migración conserva los tipos de notificación de otros módulos. No proporciona
permisos de lectura directa sobre solicitudes, direcciones, auditoría o cola
email a socios ni comercios. Los RPC hacen las comprobaciones correspondientes.

## Configurar la recepción por email

1. Revisar las cuentas de administración en `business_promotion_admins`.
   Cada correo de ese registro recibe aviso de nueva solicitud. Los avisos
   dentro de Latido se crean para administradores que además tienen perfil.
2. Reutilizar en el proyecto de desarrollo los secretos SMTP ya empleados por
   Latido: `SMTP_HOSTNAME`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`,
   `SMTP_PASSWORD` y `SMTP_FROM`. Opcionalmente definir `LATIDO_CARD_EMAIL_FROM`.
3. Crear un secreto aleatorio exclusivo `LATIDO_CARD_EMAIL_CRON_SECRET`.
   No reutilizar la clave de usuario ni publicar secretos en Git o frontend.
4. Desplegar `latido_card_physical_email` en desarrollo. La función acepta POST
   con `x-latido-card-cron-secret` y valida ese secreto aunque no use JWT.
5. Guardar en Supabase Vault `latido_project_url` y
   `latido_card_email_cron_secret`, con URL del proyecto de desarrollo y el
   mismo secreto de la función. Evitar reemplazar valores de producción.
6. Probar primero con cuentas y destinatarios de desarrollo autorizados.
7. Ejecutar `supabase/latido_card_physical_email_cron.sql` para programar la cola.
   Revisar los registros del cron y las respuestas HTTP de `pg_net`.

Los avisos incluyen referencia, estado y enlace a Latido. No contienen dirección,
QR, tokens, notas privadas ni enlace de seguimiento. Todos esos detalles se
consultan tras iniciar sesión con el permiso apropiado.

La cola guarda ocho intentos con espera progresiva, hasta una hora entre
intentos. Los trabajos se reclaman con bloqueo y una autorización temporal de
procesamiento; solo ese trabajo puede confirmar el envío. Un proceso caído
puede recuperarse al caducar su autorización. Los fallos finales se muestran
en administración y pueden reintentarse expresamente.

La entrega SMTP es al menos una vez: si el correo salió pero el proceso cayó
antes de registrar el resultado, puede repetirse. El Message-ID es estable,
pero no equivale a una garantía de deduplicación del proveedor. La solicitud y
su historial en la base de datos son siempre el registro principal.

## Preparar y entregar una tarjeta

1. Socio activo abre **Mi tarjeta física** y elige envío en Suiza o recogida.
2. Envía la solicitud. La referencia `LCP-…` identifica el pedido operativo.
3. Latido abre `/card/admin`, también accesible desde el panel Latido CRM.
4. Revisa los datos y confirma las condiciones de entrega/coste del piloto.
5. Cambia **Solicitada → Aprobada**. Puede rechazar con un mensaje al socio.
6. Pulsa **Emitir QR y pasar a impresión**. Se vincula una credencial física a
   la solicitud y se invalida cualquier física anterior del socio; su digital
   continúa funcionando.
7. Descarga el QR de 1024 píxeles y conserva el archivo de impresión de forma
   privada. El servidor almacena la huella, no un token recuperable.
8. Tras producir la tarjeta: **En impresión → Preparada**.
9. Para envío: **Preparada → Enviada → Entregada**, con seguimiento HTTPS
   opcional. Para recogida: **Preparada → Entregada**, tras entregarla al socio.
10. Socio consulta su estado y el mensaje público usando **Actualizar estado**.

Si se pierde la respuesta o archivo de emisión, no emitir desde el formulario
manual: usar **Reemitir QR de impresión** en esa solicitud. La operación
invalida el QR previo y queda registrada. La reemisión antes del envío vuelve
a impresión. Para tarjetas ya enviadas o entregadas, abrir una reposición.

Las transiciones se validan en el servidor. Se comprueba la versión de la
solicitud para evitar que dos administradores sobrescriban cambios. No se
permite marcar preparada/enviada/entregada una credencial que haya sido bloqueada.
Cancelar después de emitir bloquea el QR de esa solicitud. El socio solo puede
cancelar durante los estados solicitada o aprobada, antes de la emisión.
Latido también puede cerrar como cancelado un envío perdido o devuelto,
dejando un motivo visible y permitiendo que el socio solicite una reposición.

## Datos y límites operativos

Los destinatarios administrativos proceden de la configuración de Latido en la
base, no del navegador del socio. El contacto del solicitante procede de su
perfil. No se solicitan teléfonos en esta versión.

Dirección y notas no se envían a analítica ni a Scanner. La auditoría no
almacena tokens ni direcciones. Acordar con Latido el plazo de conservación y
el procedimiento de anonimización/eliminación antes del lanzamiento comercial.
No borrar pedidos o historiales para solucionar errores de emisión.

La primera versión entrega hasta 100 solicitudes por filtro, 40 usuarios por
búsqueda y 200 negocios en el selector. Añadir paginación al crecer el programa.
Las membresías siguen siendo manuales para piloto; esta solicitud no cobra ni
supone que una tarjeta o reposición sea gratuita.

## Verificación

`npm run test:card` comprueba permisos, duplicados, datos privados, transiciones,
versión, reemisión, cancelación, auditoría y recuperación de avisos.
`npm run test:card:browser` prueba solicitud del socio y circuito de aprobación,
impresión, envío y entrega, con APIs simuladas y capturas.
`npm run test:notifications` comprueba los avisos en la interfaz.
`deno check --node-modules-dir=auto supabase/functions/latido_card_physical_email/index.ts`
verifica la función sin enviarla ni ejecutarla en remoto.

Antes de habilitar recepción real: aplicar migraciones en desarrollo, comprobar
dos administradores sobre la misma solicitud, verificar emails con una cuenta
de prueba y confirmar que clientes y negocios no pueden leer otras solicitudes.
