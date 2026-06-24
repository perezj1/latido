# Planes profesionales con Stripe

Esta integracion cobra los planes profesionales mediante tarjeta o TWINT y limita
las plazas por plan entre suscripciones activas y Checkout reservados.
Checkout usa los metodos dinamicos de Stripe: tarjeta aparece inmediatamente y
TWINT se incorpora automaticamente cuando Stripe aprueba la cuenta.

## 1. Base de datos

Ejecuta los archivos en este orden desde Supabase SQL Editor:

1. `supabase/business_promotion_plans.sql`
2. `supabase/business_promotion_payments.sql`
3. `supabase/business_promotion_collaboration_plans.sql`

## 2. Secretos de Stripe

No guardes `sk_test`, `sk_live` ni `whsec` en Git o en variables `VITE_*`.

```powershell
supabase secrets set `
  STRIPE_SECRET_KEY=sk_live_REEMPLAZAR `
  STRIPE_PRICE_ID=price_1TjZKOH2cbjImjqPfshQGYUi `
  STRIPE_PRICE_BASIC=price_REEMPLAZAR_BASICA `
  STRIPE_PRICE_PREMIUM=price_REEMPLAZAR_PREMIUM `
  LATIDO_APP_URL=https://www.latido.ch `
  --project-ref zmievixfjefjppofebbh
```

La clave `sk_live` o `sk_test` debe pertenecer a la misma cuenta de Stripe
que los `price_...` configurados.

`STRIPE_PRICE_ID` se mantiene para el plan `featured` / Negocio Destacado.
Tambien puedes usar `STRIPE_PRICE_FEATURED` como nombre explicito.

## 3. Desplegar Edge Functions

Cada funcion contiene todo lo necesario en su propio `index.ts`. No requiere
crear una carpeta `_shared` ni archivos adicionales.

```powershell
supabase functions deploy create_business_promotion_checkout --project-ref zmievixfjefjppofebbh
supabase functions deploy create_business_promotion_portal --project-ref zmievixfjefjppofebbh
supabase functions deploy business_promotion_stripe_webhook --no-verify-jwt --project-ref zmievixfjefjppofebbh
```

Solo el webhook se despliega con `--no-verify-jwt`. Las funciones invocadas por
la app deben seguir exigiendo una sesion valida de Supabase.

## 4. Webhook de Stripe

En Stripe Workbench, crea un destino Webhook con esta URL:

```text
https://zmievixfjefjppofebbh.supabase.co/functions/v1/business_promotion_stripe_webhook
```

Selecciona estos eventos:

```text
checkout.session.completed
checkout.session.expired
invoice.paid
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
```

Copia el secreto del endpoint, que empieza por `whsec_`, y configuralo:

```powershell
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_REEMPLAZAR --project-ref zmievixfjefjppofebbh
```

## 5. Portal de clientes

En Stripe, abre la configuracion del portal de clientes de Billing y permite:

- Cambiar el metodo de pago.
- Cancelar la suscripcion al final del periodo.
- Consultar facturas y pagos.

## 6. Prueba

1. En Latido, abre `Perfil > Mis publicaciones`.
2. Abre el menu de un negocio verificado.
3. Pulsa `Colaboracion profesional`.
4. Elige `Destacar`, `Basica` o `Premium`.
5. Comprueba las plazas y continua a Stripe.
6. Completa un pago de prueba.
7. Confirma en Supabase que el negocio tiene `promotion_plan = 'featured'`, `basic` o `premium`.

Al pasar a produccion, crea o copia el producto en modo activo y sustituye
`sk_test`, `price_...` y `whsec_...` por los valores del entorno activo.
