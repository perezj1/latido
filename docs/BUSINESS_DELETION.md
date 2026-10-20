# Borrado de negocios y suscripciones

El Perfil consulta primero `get_business_deletion_status`. Un negocio sin
renovaciones pendientes se elimina con la confirmación normal y sin consultar
Stripe. La falta de configuración de Stripe no bloquea el borrado gratuito.

Si tiene una suscripción que todavía se renueva, muestra:

> Tienes una suscripción activa. ¿Seguro que quieres eliminar este negocio?
>
> Se cancelará la renovación de tu suscripción y se eliminará el negocio.

Solo tras aceptar se invoca `create_business_promotion_portal` con
`cancelForDeletion=true`. El servidor verifica al propietario y obtiene los
identificadores desde sus propios registros. Programa el fin de renovación con
`cancel_at_period_end=true`, confirma la respuesta y sincroniza el estado local
antes de permitir el DELETE. No crea reembolsos, pagos ni ajustes prorrateados.

Se incluyen las promociones profesionales y las alertas contratadas por separado.
Los planes Premium que comparten la misma suscripción se procesan una sola vez.
El portal de facturación y `syncOnly` conservan su comportamiento de consulta;
no cancelan nada sin la petición explícita de borrado.

Cancelar el diálogo no cambia nada. Si Stripe o la sincronización fallan, el
negocio se conserva. Si el borrado falla después de programar la cancelación,
la renovación puede quedar cancelada; el propietario puede reintentar el borrado.
No hay transacción única entre Stripe y PostgreSQL. El trigger de la base sigue
bloqueando el DELETE si aparece otra renovación concurrentemente.

## Publicación

1. Aplicar `supabase/business_promotion_delete_guard.sql` después de los módulos
   de pagos. Es repetible y mantiene los permisos de propietario. Las alertas
   son opcionales: no exige instalar su tabla en proyectos que no la usan.
2. Desplegar la función `create_business_promotion_portal` actualizada.
3. Publicar la app y actualizar la PWA. Una función antigua no confirma la
   cancelación; la app conserva el negocio en ese caso.

El merge de Git no aplica el SQL ni despliega por sí solo la función de Supabase.
No ejecutar borrados ni cancelaciones reales como prueba de despliegue.

Validación local: `npm run test:business:deletion`, `npm run lint`,
`deno check --node-modules-dir=none --no-config supabase/functions/create_business_promotion_portal/index.ts`
y `npm run build`. Los servicios de Stripe se simulan sin claves ni red.
