# Métricas de Latido Club en administración

La sección **Latido Club** está en `/admin-latido`, dentro de Crecimiento (en móvil, abrir **Más**). Se puede consultar durante la captación de negocios sin abrir la experiencia de miembros.

## Instalación

En un proyecto que ya tiene Latido Club instalado, ejecutar únicamente [supabase/latido_club_admin_metrics.sql](../supabase/latido_club_admin_metrics.sql) en el SQL Editor de Supabase. Después, abrir la sección y pulsar Actualizar. El SQL es repetible y solo instala una función de consulta: no modifica registros ni permisos de lectura de las tablas.

Publicar el frontend no ejecuta este SQL. Si falta, el panel muestra la instrucción para instalarlo; no presenta ceros como si fueran datos reales. Si se reinstala el SQL base de Card, ejecutar este archivo después, porque el instalador base revoca permisos de las funciones `lc_*`.

## Definiciones

- Miembro activo: membresía activa cuya fecha de inicio ya llegó y cuya vigencia no ha terminado. Solo se cuentan membresías, no todas las cuentas de Latido.
- Oferta publicada: no archivada, activa, dentro de sus fechas, con un negocio publicado y no archivado, participante y sin suspensión.
- Negocio con ofertas: negocio distinto con al menos una oferta publicada. Varias ofertas de un negocio no duplican este indicador.
- Ofertas sin archivar: versiones actuales, aunque estén pausadas, vencidas, programadas o el negocio no esté disponible. Las versiones archivadas tienen su propio contador y filtro.
- Usos: redenciones sin anular. Se conserva y cuenta el historial aunque la oferta se archive posteriormente. Las anulaciones se muestran aparte.
- Reservas vigentes: pendientes, sin caducar, con membresía activa y oferta publicada.
- El periodo de 7, 30 o 90 días incluye el día actual y usa el calendario de Europe/Zurich. Filtra actividad y el listado de usos; los estados actuales y los otros listados no se limitan a ese periodo. Ofertas creadas incluye nuevas versiones.
- Por defecto se excluyen nombres de miembros/negocios y títulos de ofertas que empiezan por `[TEST]`, incluidos títulos históricos guardados en usos. No se intenta inferir pruebas por correos o nombres parecidos. El selector permite incluirlos.

El informe agrega todos los registros en el servidor; las búsquedas, filtros y páginas solo afectan al listado. Las listas se sirven en páginas de 25 registros con orden estable, sin truncar los totales. La función valida `lc_is_admin()` además de la protección de la ruta; no está disponible para visitantes ni para usuarios sin permisos de administración. No permite activar membresías ni cambiar ofertas, negocios o cobros.

## Verificación

`npm run test:club:admin` valida la función real en PostgreSQL local (PGlite): permisos, estados, historial, exclusión de pruebas, paginación y conservación de datos. `npm run test:club:admin:browser` comprueba la integración con el admin, móvil, filtros y errores usando servicios simulados. Para WebKit: `node scripts/test-latido-club-admin-browser.mjs --webkit`.
