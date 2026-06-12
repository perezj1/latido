# Emails de mensajes no leidos

Este flujo envia como maximo un email por ciclo de mensajes no leidos:

1. El primer mensaje no leido crea un aviso pendiente para dentro de 10 minutos.
2. Si Latido esta visible cuando llega el mensaje, el ciclo queda suprimido.
3. Si el usuario abre Latido antes del envio, el ciclo tambien queda suprimido.
4. Los mensajes adicionales no crean mas emails.
5. Cuando todos los mensajes quedan leidos, el ciclo se reinicia.

## 1. Activar el correo gratuito de Nominalia

No pulses en comprar SMTP ni en envios adicionales. SMTP no es una cuenta
separada: es la forma tecnica de enviar desde el correo normal.

Si tienes el Pack Dominio de Nominalia, activa una de las tres cuentas incluidas:

1. Entra en `https://controlpanel.nominalia.com`.
2. Haz clic en `latido.ch` en la columna derecha.
3. Abre el icono `EMAIL`.
4. Pulsa `+ CREAR`.
5. Crea `notificaciones@latido.ch` y asignale una password fuerte.
6. En el campo `Producto`, selecciona el pack gratuito incluido con el dominio.
7. Comprueba que puedes entrar en `https://webmail.nominalia.com`.

Si el formulario solo muestra productos de pago y no aparece ningun pack
incluido, tu modalidad concreta de dominio no tiene las cuentas gratuitas
activadas. En ese caso debes pedir a soporte de Nominalia que active las tres
cuentas incluidas antes de comprar nada.

La Edge Function usa la misma direccion y password que funcionan en Webmail:

```text
Host: authsmtp.securemail.pro
Puerto: 465
Seguridad: SSL/TLS
Usuario: notificaciones@latido.ch
Password: la password del correo
```

## 2. Ejecutar la migracion

Primero confirma que `supabase/message_read_status.sql` ya esta aplicado. Despues,
abre Supabase Dashboard > SQL Editor y ejecuta todo:

```text
supabase/message_email_notifications.sql
```

## 3. Configurar secretos de la Edge Function

Genera un secreto independiente para el cron. En PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Configura los secretos:

```bash
supabase secrets set \
  SMTP_HOSTNAME="authsmtp.securemail.pro" \
  SMTP_PORT="465" \
  SMTP_SECURE="true" \
  SMTP_USERNAME="notificaciones@latido.ch" \
  SMTP_PASSWORD="PASSWORD_DEL_CORREO" \
  SMTP_FROM="Latido <notificaciones@latido.ch>" \
  LATIDO_APP_URL="https://www.latido.ch" \
  EMAIL_CRON_SECRET="SECRETO_GENERADO" \
  EMAIL_MAX_BATCH="25" \
  --project-ref zmievixfjefjppofebbh
```

La password del correo solo va en Supabase. No debe ir en Vercel ni usar prefijo
`VITE_`.

## 4. Desplegar

```bash
supabase functions deploy latido_message_email --project-ref zmievixfjefjppofebbh
```

## 5. Probar el correo antes de activar el cron

```bash
curl -i -X POST "https://zmievixfjefjppofebbh.supabase.co/functions/v1/latido_message_email" \
  -H "Content-Type: application/json" \
  -H "x-latido-cron-secret: SECRETO_GENERADO" \
  -d '{"test_email":"TU_EMAIL_DE_PRUEBA"}'
```

La respuesta esperada es:

```json
{"ok":true,"test":true}
```

## 6. Programar la funcion cada minuto

Abre `supabase/message_email_cron.sql` y reemplaza:

```text
EMAIL_CRON_SECRET_VALUE
```

Usa exactamente el mismo valor que guardaste como `EMAIL_CRON_SECRET` en los
secretos de la Edge Function. Ejecuta el archivo completo en Supabase SQL
Editor. El secreto queda guardado en Supabase Vault y el cron llama a la
funcion cada minuto. El archivo se puede volver a ejecutar sin duplicar los
secretos ni el trabajo programado.

## 7. Prueba funcional

1. Usa dos usuarios de prueba.
2. Cierra Latido para el usuario receptor y espera al menos 45 segundos para que
   expire su presencia.
3. Envia un mensaje desde el otro usuario.
4. Para no esperar, ejecuta:

```sql
UPDATE public.message_email_notification_state
SET due_at = NOW()
WHERE status = 'pending';
```

5. Espera la siguiente ejecucion del cron.
6. Envia mas mensajes: no debe llegar otro email.
7. Abre la conversacion receptora y confirma que todos quedan leidos.
8. Cierra Latido, envia un mensaje nuevo y confirma que empieza un ciclo nuevo.

## Diagnostico

```sql
SELECT *
FROM public.message_email_notification_state
ORDER BY updated_at DESC;

SELECT *
FROM public.app_presence_sessions
ORDER BY last_seen_at DESC;

SELECT *
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

SELECT *
FROM net._http_response
ORDER BY created DESC
LIMIT 20;
```

Estados:

```text
pending     espera los 10 minutos
processing  una funcion lo esta procesando
sent        ya se envio el unico email del ciclo
suppressed  app activa, preferencia desactivada o email no disponible
```
