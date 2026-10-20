# Borrado de publicaciones de negocios

El error `latido_card_businesses_provider_id_fkey` ocurre porque `providers` tiene referencias desde Tarjeta Latido. Borrar físicamente ese registro rompe las claves necesarias para ofertas y usos anteriores. Abrir el gestor antiguo también daba de alta un negocio sin haber creado ofertas, por eso podía ocurrir incluso con un negocio vacío.

La interfaz ya no realiza esa alta al abrir el gestor o el formulario: solo al publicar una oferta. Para los negocios ya vinculados, el borrado retira la publicación conservando el registro privado que sostiene su historial.

## Actualización de una instalación existente

Ejecutar **`supabase/latido_card_business_deletion.sql`** en el SQL Editor del proyecto Latido. Es idempotente y no retira ninguna publicación por sí solo. El instalador `latido_card_minimal.sql` actualizado también incluye la corrección.

Después, el botón habitual **Borrar publicación** funciona con el mismo DELETE del propietario:

- Un negocio vinculado a Tarjeta Latido se marca con `providers.deleted_at` y `active=false`.
- Las políticas restrictivas de RLS lo ocultan a visitantes y a propietarios, incluida «Mis publicaciones», y evitan restaurarlo con un UPDATE de la app.
- El negocio deja de participar, sus descuentos se pausan y las pantallas de validación anteriores dejan de ser válidas.
- Las ofertas, usos y claves foráneas se conservan. El socio sigue viendo su historial anterior.
- Las API de gestión rechazan reactivar un negocio retirado. Los negocios sin vínculo con Card mantienen el borrado habitual.

El trigger de archivo se ejecuta después de los guards de suscripciones ya existentes (`prevent_provider_delete_with_active_subscription`). El borrado sigue bloqueado cuando esos guards indican una suscripción activa: esta actualización no modifica pagos ni cancelaciones.

Si no se ha aplicado el SQL, la app muestra una explicación comprensible del bloqueo de Card en lugar del error interno de PostgreSQL. No se han borrado publicaciones reales para probarlo: `npm run test:card` verifica el borrado del propietario, el rechazo de otro usuario, la protección de suscripciones, la ocultación pública y la conservación del historial en una base de datos local.
