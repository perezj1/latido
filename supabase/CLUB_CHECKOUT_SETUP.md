# Activar los pedidos de Latido Club

El código queda preparado, pero no debe publicarse la web hasta terminar estos
pasos. El proyecto Supabase enlazado actualmente es `zmievixfjefjppofebbh`.

## 1. Crear las tablas

Abre Supabase Dashboard > SQL Editor, pega el contenido de
`supabase/club_orders.sql` y ejecútalo. La tabla tiene RLS activado y no concede
acceso a `anon` ni a usuarios autenticados; solo las funciones con
`service_role` pueden leer los datos de clientes.

## 2. Crear una clave exclusiva de Stripe

En Stripe, empieza en modo de prueba. Crea una clave restringida para Latido
Club con el permiso mínimo necesario para crear, leer y caducar Checkout
Sessions. No sustituyas la clave usada por otras funciones de Latido.

Guarda las claves de Stripe y Gelato y la tarifa de envío en Supabase:

```powershell
supabase secrets set --project-ref zmievixfjefjppofebbh STRIPE_CLUB_SECRET_KEY="rk_test_..." GELATO_API_KEY="..." CLUB_SHIPPING_CHF="7.90" CLUB_ORDER_EMAIL="latidoch@gmail.com"
```

Las credenciales SMTP ya configuradas en el proyecto se reutilizan. Solo sería
necesario definir `CLUB_EMAIL_FROM` si se quiere un remitente diferente de
`SMTP_FROM`.

## 3. Desplegar las dos funciones

```powershell
supabase functions deploy create_club_checkout --project-ref zmievixfjefjppofebbh
supabase functions deploy club_stripe_webhook --project-ref zmievixfjefjppofebbh
```

`supabase/config.toml` ya establece `verify_jwt = false` para ambas. El checkout
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

## 5. Configurar y publicar la web cuando se autorice

En Vercel añade esta variable para Production y Preview:

```text
VITE_CLUB_SHIPPING_CHF=7.90
```

Debe coincidir siempre con `CLUB_SHIPPING_CHF` de Supabase. Publica la web solo
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

Un pedido pagado queda en `club_orders` con `gelato_status = pending`. Después
de crearlo manualmente en Gelato, actualiza desde Supabase Dashboard:

- `status`: `gelato_ordered`
- `gelato_status`: el estado que quieras mostrar internamente
- `gelato_order_id` o `gelato_order_reference`: referencia de Gelato
- `tracking_url`: cuando Gelato genere el seguimiento

El email es una alerta; la tabla `club_orders` es la fuente real del pedido.
