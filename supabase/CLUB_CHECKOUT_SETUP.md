# Activar los pedidos de la Tienda Latido

El código queda preparado, pero no debe publicarse la web hasta terminar estos
pasos. El proyecto Supabase enlazado actualmente es `zmievixfjefjppofebbh`.

## 1. Crear las tablas

Abre Supabase Dashboard > SQL Editor, pega el contenido de
`supabase/club_orders.sql` y después `supabase/club_orders_admin.sql`. La tabla tiene RLS activado y no concede
acceso a `anon` ni a usuarios autenticados; solo las funciones con
`service_role` pueden leer los datos de clientes.

## 2. Crear una clave exclusiva de Stripe

En Stripe, empieza en modo de prueba. Crea una clave restringida para Latido
Club con el permiso mínimo necesario para crear, leer y caducar Checkout
Sessions. No sustituyas la clave usada por otras funciones de Latido.

Guarda las claves de Stripe y Gelato en Supabase. Los precios del catálogo ya
incluyen el envío a Suiza:

```powershell
supabase secrets set --project-ref zmievixfjefjppofebbh STRIPE_CLUB_SECRET_KEY="rk_test_..." GELATO_API_KEY="..." CLUB_ORDER_EMAIL="latidoch@gmail.com"
```

Las credenciales SMTP ya configuradas en el proyecto se reutilizan. Solo sería
necesario definir `CLUB_EMAIL_FROM` si se quiere un remitente diferente de
`SMTP_FROM`.

## 3. Desplegar las dos funciones

```powershell
supabase functions deploy create_club_checkout --project-ref zmievixfjefjppofebbh
supabase functions deploy club_stripe_webhook --project-ref zmievixfjefjppofebbh
supabase functions deploy club_order_status --project-ref zmievixfjefjppofebbh
```

`supabase/config.toml` ya establece `verify_jwt = false` para las tres. El checkout
es público porque compra gente sin cuenta; valida origen, productos y precios en
el servidor consultando directamente la Custom Store de Gelato y aplica
limitación básica. `GELATO_STORE_ID` es opcional; si no existe, busca la tienda
por el nombre `Latido Club`. El webhook es público porque Stripe no
envía un JWT, pero rechaza cualquier petición sin una firma válida de Stripe.

## 4. Crear el webhook en Stripe

En Stripe Workbench > Webhooks, crea un endpoint con esta URL:

```text
https://zmievixfjefjppofebbh.supabase.co/functions/v1/club_stripe_webhook
```

Suscribe exactamente estos eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Copia el signing secret del endpoint y guárdalo:

```powershell
supabase secrets set --project-ref zmievixfjefjppofebbh STRIPE_CLUB_WEBHOOK_SECRET="whsec_..."
```

Los secretos quedan disponibles inmediatamente; no hace falta volver a
desplegar las funciones.

## 5. Publicar la web cuando se autorice

Publica la web solo
después de que la base de datos, las funciones y el webhook estén preparados.
La Edge Function valida las variantes conectadas directamente contra la Custom
Store de Gelato. El endpoint web `/api/gelato?action=products` sigue alimentando
la presentación del catálogo cuando se publique la nueva versión de la web.

## 6. Prueba obligatoria antes de activar pagos reales

1. Usa Stripe en modo de prueba y compra un producto con la tarjeta de prueba
   `4242 4242 4242 4242`, una fecha futura y cualquier CVC.
2. Comprueba en `club_orders` que el pedido termina con `status = paid` y
   `payment_status = paid`.
3. Comprueba que llegan el email interno y el email del cliente.
4. Comprueba en Stripe que el webhook obtuvo HTTP 200.
5. Copia los identificadores de producto/variante del email y crea el pedido
   manual en Gelato desde la Custom Store `Latido Club`.

Para pasar a producción, crea la clave restringida en modo live y el endpoint
live de Stripe. Sustituye solamente `STRIPE_CLUB_SECRET_KEY` y
`STRIPE_CLUB_WEBHOOK_SECRET`; no toques las claves de otras funciones.

## Operación diaria

Abre `/admin-latido?section=storeOrders` o **Admin → Tienda · Pedidos**.
La vista inicial muestra todos los pedidos pagados. Cada pedido incluye
productos, cantidades, talla, color, SKU, variante Gelato, cliente, teléfono y
dirección de envío completa. Los filtros permiten revisar envíos, entregados y
checkouts pendientes o fallidos. Se actualiza automáticamente cada minuto mientras
la sección está visible, y también tiene un botón Actualizar.

1. El pago verificado por Stripe deja el pedido como **Pagado · pendiente**.
2. Crea manualmente el pedido en Gelato y pulsa **Marcar en proceso**.
3. Cuando se despache, pulsa **Marcar enviado** y añade seguimiento si existe.
4. Al confirmar su recepción, pulsa **Marcar entregado**.

Puedes guardar notas internas (incluida la referencia Gelato). Los cambios de
estado tienen fecha e historial; el servidor impide preparar pedidos sin pagar,
saltar fases o sobrescribir un cambio de otro administrador.

Al guardar el pago también se crea una notificación en Latido para las cuentas
de `business_promotion_admins`. El email interno se envía a `CLUB_ORDER_EMAIL`
(actualmente `latidoch@gmail.com`) y el cliente recibe su confirmación. Un fallo
del correo conserva el pedido pagado y provoca un reintento de Stripe; el panel
muestra los avisos pendientes. Si los reintentos de Stripe se agotan, revisa SMTP
y reenvía el evento desde Workbench. La tabla `club_orders` es la fuente real.

La página de retorno consulta `club_order_status` con la sesión y la referencia;
no muestra datos personales ni da el pago por confirmado a partir de la URL.
Las variantes y los precios se resuelven siempre desde el catálogo del servidor.

Verificación automatizada:

```powershell
npm run test:store
npm run test:store:webhook
npm run test:store:browser
npm run test:notifications
npm run lint
npm run build
deno check supabase/functions/create_club_checkout/index.ts supabase/functions/club_stripe_webhook/index.ts supabase/functions/club_order_status/index.ts
```

El 3 de noviembre de 2026 se comprobó la cuenta live (cobros y transferencias
habilitados), el endpoint y sus cuatro eventos, SMTP y un email de prueba aceptado
por el servidor para `latidoch@gmail.com`. Se abrió un Checkout live de CHF 24.90,
se verificaron la variante Negro/S y la dirección obligatoria en Suiza y se caducó
sin pagar. Esto comprueba la apertura del pago y la entrega del evento de
caducidad; no sustituye una compra real completada ni verifica la llegada a la
bandeja de entrada. No se modificaron las claves de producción.
