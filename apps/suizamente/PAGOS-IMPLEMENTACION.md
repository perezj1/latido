# Cobro de negocios

`negocios.cobroAutomatico` sigue apagado. La factura manual y el panel anterior
siguen siendo la vía publicada. No hay claves reales ni pagos reales habilitados.

La migración aditiva `suizamente_v37_negocios_cobros.sql` añade el estado de Stripe,
una cola persistente con exclusión por negocio, eventos y facturas únicos. No
reescribe funciones antiguas. Sus disparadores solo actúan con el interruptor
encendido. La RPC privilegiada solo acepta `service_role`; la RPC de cuenta
comprueba el perfil y la propiedad del negocio.

El servidor `negocios-pagos.mjs` usa Stripe 23.2.0 y la API 2026-11-18.endive.
Checkout en modo setup guarda la tarjeta antes de aprobar. Después de aprobar se
crea la suscripción. Solo los webhooks firmados confirman el pago. La suscripción hereda la tarjeta por defecto del cliente para que los cambios
del portal se apliquen al siguiente cobro. La tarjeta,
PAN y CVC se introducen exclusivamente en Stripe, nunca en Latido.

Los cambios de plan usan fases sin prorrateo: el precio nuevo comienza al acabar
el periodo vigente. El portal permite tarjeta, facturas y cancelación al final
del periodo; sus cambios de plan deben estar desactivados. Las notificaciones
de fallo conservan la primera fecha de impago; las facturas repetidas o fuera de
orden no duplican el libro ni acortan el periodo pagado.

## Configuración pendiente en el sandbox de Latido

1. Aplicar v37 antes de encender el cobro. Configurar las variables de servidor
   documentadas en `.env.example`. Se rechazan todas las claves live. La clave
   pública de Stripe no hace falta con Checkout alojado.
2. Crear dos productos (Mapa y Plus), cada uno con precio mensual y anual en CHF,
   coincidentes con `negocios.planes`. Crear configuraciones de métodos separadas
   para tarjeta y TWINT. Crear el portal con actualización de tarjeta y facturas,
   cancelación `at_period_end`, y cambio de plan deshabilitado.
3. Registrar el webhook POST `/api/suizamente/negocios/pagos/webhook` para
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`
   y `radar.early_fraud_warning.created`. Conservar el cuerpo original; la función
   de Vercel desactiva el parser para comprobar su firma.
4. Programar GET o POST `/api/suizamente/negocios/pagos/procesar`, con
   `Authorization: Bearer <SUIZAMENTE_STRIPE_CRON_SECRET>`, cada pocos minutos.
   La aprobación también intenta procesar inmediatamente. Los trabajos fallidos
   quedan pendientes, con identificadores idempotentes. El mantenimiento ya
   existente retira figuras tras la gracia y libera plazas al acabar la baja.
5. Publicar las condiciones comerciales reales de Latido y su URL en la
   configuración privada de negocios. Confirmar IVA/registro fiscal antes de
   activar Stripe Tax; no se activa sin esta decisión.
6. Ejecutar las pruebas reales del sandbox: tarjetas de prueba, aprobación y
   primer cobro, mensual/anual, fallo y gracia, autenticación adicional, plan
   diferido, portal, baja y reenvío de eventos. Por petición del usuario se omite
   el plan asistido y se deja pendiente probar su cuenta sin reconexión/claves.

## TWINT

La documentación actual de Stripe admite pagos sueltos y recurrentes, pero
excluye pagos B2B. Por tanto, no confirma la premisa antigua del prompt. La app
conserva la decisión de Latido de ofrecer solo pago anual suelto, sin renovación
automática por TWINT. Además requiere confirmar la admisibilidad de este cobro
comercial con Stripe antes de poner `SUIZAMENTE_STRIPE_TWINT_ELIGIBLE=true`.
Mientras tanto el botón explica que estará disponible próximamente.

Fuente: https://docs.stripe.com/payments/twint

## Pruebas locales

`node scripts/test-negocios-pagos.mjs` ejecuta PostgreSQL desechable, el SDK real
para firmar y verificar eventos y un doble local del transporte de Stripe. No
conecta con Stripe ni sustituye las pruebas de su sandbox. Comprueba setup sin
cobrar, permisos, tarjetas mensual/anual, TWINT anual, duplicados de evento y
factura, fallos, cambio diferido, portal, baja, firma inválida, rechazo de live y
cobro apagado. `npm run test:negocios:servidor` comprueba la vía manual anterior.

No se crean negocios, preguntas ni misterios en producción con estas pruebas.
