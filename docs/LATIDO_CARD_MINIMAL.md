# Tarjeta Latido: funcionamiento e integración

Tarjeta Latido ofrece descuentos a la comunidad hispanohablante en Suiza. Los negocios participan gratis; la membresía del cliente cuesta CHF 6,90 al mes. La activación sigue siendo manual por email. No hay pagos ni renovaciones automáticas.

La revisión de octubre de 2026 se detalla en [LATIDO_CARD_EXPERIENCE_REVIEW.md](LATIDO_CARD_EXPERIENCE_REVIEW.md), con decisiones por tarea, capturas de antes/después, pruebas y propuestas pendientes.

La landing pública para socios y negocios está en `/tarjeta-latido`, accesible desde la landing principal. La revisión visual del 18 de octubre se describe en [LATIDO_CARD_LANDING_REVIEW.md](LATIDO_CARD_LANDING_REVIEW.md).

## 1. Experiencia del socio

1. Entra desde Inicio, Perfil o el menú, o escanea el QR público del negocio con la cámara normal del móvil. Puede consultar las ofertas antes de solicitar su tarjeta. Login conserva la dirección del negocio y la oferta.
2. El socio ve número y vigencia en una franja compacta. **Ver tarjeta** abre y cierra su tarjeta real, cerrada inicialmente. Debajo, **Activar alertas** abre el modal de preferencias y desaparece cuando están activadas; la campana siempre permite gestionarlas. La navegación del catálogo usa pestañas de texto con línea azul: **Descuentos**, **Negocios** y, para socios, **Usados**, con historial personal y cifra anual sin acciones para activar usos antiguos. La transición respeta la preferencia de movimiento reducido.
3. Un buscador, la ciudad y el tipo de oferta filtran **Descuentos / Negocios** desde un mismo selector, sin chips de categorías. Inicio guarda un **cantón**, no una ciudad: se usa su nombre si coincide con una ciudad del catálogo. Sin coincidencia se muestran todas las ciudades con un aviso. Cada lista conserva su previsualización de diez elementos.
4. Activar o Usar ahora abre la confirmación existente. Consultar o cancelar no consume nada. Solo confirmar llama a `lc_use_offer` con un UUID idempotente. El servidor comprueba membresía, negocio, condiciones, existencias y límites.
5. Se abre `/card/validacion/:id` con el ticket existente: negocio, beneficio, condiciones, contador, animación, fecha y hora suizas y referencia de socio enmascarada. Dura como máximo cinco minutos; nunca supera la vigencia de membresía u oferta. La confirmación y la validación no se modifican en esta revisión.
6. El cliente muestra la pantalla. El personal comprueba visualmente negocio, contador y fecha y hora, y aplica el descuento en su caja. No necesita cuenta, scanner, códigos ni PIN.
7. Si sale mientras la validación sigue vigente, el aviso superior en `/card` y en la página del negocio vuelve a **la misma validación**, sin registrar otro uso. El contador usa `server_now` y tiempo monotónico, no la hora del dispositivo. Desaparece al caducar.
8. Los descuentos gastados permanecen atenuados con su próxima disponibilidad. El historial conserva ofertas caducadas, pausadas o borradas.

La página pública del negocio muestra todas sus ofertas y los datos públicos de local que existan: dirección, teléfono, horario, mapa y enlace a su ficha de Latido. No tiene buscador ni pestañas. Debajo aparece **Ya usaste aquí** con el historial local y su diseño actual.

Los visitantes ven el título centrado y, justo debajo, la ilustración de tarjeta blanca inclinada con franja multicolor y círculos de porcentaje y negocio. Siguen las tres ventajas, precio y solicitud. Se retira por ahora la tarjeta de ejemplo con «0001» y «Tu nombre», además del bloque de cálculo de ahorro. «Cómo funciona» contiene solo una lista numerada: «Elige tu descuento», «Actívalo», «Muéstralo al pagar y ahorra»; también se usa en la ayuda del socio. Las ofertas reales aparecen en el catálogo. Los correos de solicitud y renovación incluyen nombre, email de cuenta y número de socio cuando existe.

**Límite del modelo:** la comprobación es visual. Contador y animación ayudan a distinguir una captura estática, pero no impiden pantallas falsas ni compartir una validación durante su vigencia. El historial registra descuentos solicitados y mostrados; no acredita ventas, importes ni descuentos aplicados en caja.

## 2. Mi negocio

1. Un propietario no necesita membresía de socio. La cabecera contiene nombre, estado, selector de negocio, alta de otro negocio y enlace al editor de Perfil. Consultar el panel o formulario no inscribe al negocio; inscripción y primera oferta se publican atómicamente.
2. El registro desde Card conserva `?origen=tarjeta`, incluso al iniciar sesión. Los planes opcionales permanecen cerrados y desactivados. La pantalla final se centra en crear oferta, con una sola salida. Si está pendiente de revisión, explica que deberá aprobarse antes: `lc_save_offer` exige `providers.active=true`. No se promete un plazo inexistente.
3. **Resultados** muestra una sola cifra: descuentos usados este mes en tu negocio, excluyendo anulaciones. Se calcula en el servidor para el mes suizo, no a partir del historial limitado a cien filas.
4. **Tus ofertas**, siempre visible, conserva la vista previa actual y añade estado, usos mensuales y menú. Los estados son Activa, Pausada, Caducada y Agotada. Solo las pausadas permiten Borrar, con confirmación y conservación del historial.
5. **Crear oferta** es el CTA fijo inferior, con espacio reservado para no tapar el contenido. Abre directamente el formulario aunque ya existan ofertas activas. Un negocio puede mantener varias ofertas habituales y promociones limitadas simultáneas, sin aviso de ocupación ni necesidad de pausar otra. Los límites de usos por socio y las unidades de cada promoción se mantienen.
6. El formulario mantiene cuatro pasos (tres para Otro), título automático y vista previa. Los descuentos CHF preguntan el mínimo al inicio; el mínimo porcentual queda avanzado. La fecha pide solo día y se guarda a las 23:59:59 en `Europe/Zurich`, con horario de verano. Sin fecha se guarda `infinity`. Las promociones explican una unidad por socio.
7. Las ofertas sin actividad permiten **Editar** con `lc_update_offer`. Reservas, incluso liberadas, y usos bloquean los términos con `OFFER_TERMS_LOCKED`. Con actividad, **Crear nueva versión** usa `lc_replace_offer`: pausa y crea en una transacción. Si falla, revierte también la pausa.
8. Los borradores nuevos se conservan en `original_draft`, privado. Los combos y beneficios libres no se reconstruyen fielmente desde el título. Las ofertas antiguas conservan el título hasta cambiar los campos que lo generan.
9. Publicar mantiene el diálogo con resultado y vista previa. La primera oferta ofrece el mismo material simplificado del gestor. Las siguientes recuerdan que el QR no cambia.
10. **Actividad** muestra veinte usos inicialmente, ampliables, con fecha y hora suizas, referencia de cuatro dígitos y estado. Anular uso está dentro del menú y exige un motivo. Son usos mostrados por socios, no ventas verificadas.
11. **Material para tu local** está plegado. Ofrece solo **Descargar imagen**, **Compartir imagen** y el enlace público con **Copiar** al lado. Compartir envía un archivo PNG; si no hay soporte de archivos en Web Share, descarga la imagen y avisa. Cancelar no genera error. Sin ofertas vigentes no muestra QR. Las rutas imprimibles existentes siguen disponibles, sin botones de impresión en este material. PNG usa el mismo diseño a resolución triple.
12. Latido conserva la autoridad para gestionar membresías y suspender negocios. El propietario no puede revertir una suspensión.

El QR es público y estable, basado en el UUID del negocio. Nunca contiene identidad de socio, reservas ni credenciales.

## 3. Integración y avisos

Las fichas y listados de negocios de Inicio, Explorar y búsqueda muestran el mejor beneficio. Comparten una consulta pública por sesión, invalidada al modificar ofertas desde el gestor. GlobalSearch encuentra ofertas por título, negocio y ciudad y abre `/card/negocio/:id?oferta=:offerId`.

`api/card-share.js` sirve el HTML construido con etiquetas sociales específicas, escapadas y obtenidas mediante RPC público. Las reescrituras incluyen `/card` y `/card/negocio/:id`; la función incluye `dist/index.html` y conserva la SPA. Si falla el catálogo se sirve la app con etiquetas generales y sin caché de esa respuesta. Las páginas permanecen en `noindex, follow` hasta decisión del propietario.

Los avisos reutilizan `app_notifications`: primer socio, pocas unidades, oferta próxima a terminar, resumen semanal y membresía próxima a vencer. Las novedades cubren todo el cantón elegido, con un selector de los 26 cantones y el código guardado en `latido_card_notification_preferences.canton`. Se comparan con el cantón del negocio, de modo que una alerta de Zürich incluye, por ejemplo, ofertas de Winterthur. Requieren consentimiento expreso y revocable y un mínimo de siete días entre entregas. Se entregan dentro de Latido; no se crea otro sistema de email ni se solicitan permisos push.

El trabajo pg_cron `latido-card-notifications` ejecuta la función privada cada hora al minuto 15. Las fechas usan `Europe/Zurich`; las claves únicas impiden duplicados. El lunes se resume la semana anterior completa. Si no está instalada la extensión, la migración no la instala ni altera otros trabajos: debe completarse la planificación en desarrollo. El aviso de pocas unidades se emite una vez por promoción al quedar dos o menos.

Los eventos de medición respetan el consentimiento analítico, sin datos personales ni identificadores de oferta, negocio o uso. Incluyen el paso de abandono y las acciones del QR. La validación sigue completamente excluida; el uso se mide en la confirmación anterior.

Las propuestas de Inicio, nombre Tienda, indexación y panel único están en la revisión; no se han aplicado.

## 4. SQL manual

En una **instalación actual**, después de los módulos de activación, borrado y participación y con `app_notifications.sql` instalado:

1. [latido_card_experience.sql](../supabase/latido_card_experience.sql): categoría pública, datos del local, `server_now`, resumen, referencia enmascarada, borrador privado, edición y reemplazo.
2. [latido_card_notifications.sql](../supabase/latido_card_notifications.sql): preferencias por RPC, avisos y planificación cuando pg_cron existe.
3. [latido_card_multiple_offers.sql](../supabase/latido_card_multiple_offers.sql): en instalaciones existentes, retira el límite de ofertas por negocio en creación, edición y reactivación. No modifica ofertas ni historial; conserva permisos, suspensión y bloqueo de términos usados. Los instaladores actuales también incluyen este cambio.
4. [latido_card_canton_alerts.sql](../supabase/latido_card_canton_alerts.sql): para instalaciones con avisos ya instalados, amplía las alertas de ciudad a cantón y actualiza los RPC. Conserva el consentimiento y la última entrega cuando puede identificar la región mediante los negocios o el nombre del cantón. Una ciudad ambigua o desconocida requiere elegir cantón antes de reactivar. El RPC acepta `p_canton`; conserva `p_city` opcional para clientes anteriores. El instalador actual de avisos ya incluye este cambio.
5. [latido_card_downloads.sql](../supabase/latido_card_downloads.sql): adjuntos PDF opcionales publicados en `/downloads/`. Expone `download_path` en el catálogo y permite descargar el regalo directamente, también sin membresía. La configuración del archivo se administra por SQL; la edición normal conserva el adjunto. Aplicar este módulo antes de desplegar la interfaz de descarga.
6. [latido_card_verify.sql](../supabase/latido_card_verify.sql): once comprobaciones deben devolver `ok=true`, además del recuento informativo de tablas.

Los módulos nuevos usan transacción y pueden repetirse. **No se han ejecutado en Supabase. Nunca ejecutarlos automáticamente en producción.** No volver a instalar módulos antiguos después de los nuevos: restaurarían versiones anteriores de los RPC.

Para una **instalación nueva o anterior al modelo mínimo**, aplicar primero, en orden: `latido_card_minimal.sql`, `latido_card_cleanup_legacy.sql`, `latido_card_business_directory.sql`, `latido_card_offer_activation.sql`, `latido_card_business_deletion.sql` y `latido_card_business_participation.sql`. Después los dos módulos nuevos y la verificación. El módulo de avisos requiere la infraestructura normal de `app_notifications.sql`.

Las invitaciones opcionales y su correo se describen en [LATIDO_CARD_BUSINESS_INVITATIONS.md](LATIDO_CARD_BUSINESS_INVITATIONS.md). Los ejemplos de `latido_card_test_examples.sql` son solo para desarrollo. No ejecutar scripts de `legacy/` en una instalación vigente.

La limpieza archiva tablas retiradas en `latido_card_archive` y detiene exclusivamente el antiguo cron de tarjetas físicas, conservando usos y auditoría. Si llegó a desplegarse `latido_card_physical_email`, debe desactivarse por separado; no borrar SMTP, pg_cron, pg_net ni recursos compartidos.

Durante el piloto, el administrador activa un perfil y su vigencia en `/card/admin`. No debe presentarse como un cobro o una suscripción recurrente ya integrados.

## 5. Contrato técnico y seguridad

Las tablas principales conservadas son `latido_card_memberships`, `latido_card_businesses`, `latido_card_offers`, `latido_card_claims`, `latido_card_redemptions` y `latido_card_admin_audit`. Se añade `latido_card_notification_preferences` para consentimiento, cantón y última entrega; la ciudad antigua se conserva para compatibilidad.

Todo dato de Card pasa por RPC `SECURITY DEFINER`, con `search_path` fijo y autorización interna. Las tablas tienen RLS y no conceden permisos directos a anon/authenticated. El catálogo solo expone campos públicos. Los agregados no contienen identidades de clientes; el historial del negocio limita la referencia a cuatro dígitos.

- Públicos: `lc_catalog`, `lc_participating_businesses`, `lc_business_benefits`.
- Cuenta: `lc_member_home`, `lc_use_offer`, `lc_validation`, `lc_notification_preferences`.
- Propietario: `lc_business_dashboard`, `lc_save_offer`, `lc_update_offer`, `lc_replace_offer`, `lc_set_offer_active`, `lc_delete_offer`, `lc_reverse_redemption`.
- Administración: `lc_admin_overview`, `lc_admin_enroll`, `lc_admin_business`.
- Servicio: `lc_send_scheduled_notifications`, restringido al propietario de la función y `service_role`.

Publicación y edición bloquean el proveedor para serializar cambios; el uso bloquea membresía y oferta. Las reservas vigentes se reutilizan sin consumir otra unidad; una vencida necesita disponibilidad. Anular invalida la pantalla y restituye disponibilidad según condiciones.

La confirmación conserva su UUID en `sessionStorage` antes de pedir el uso. Una respuesta perdida se reintenta con ese UUID y devuelve el mismo uso y vencimiento. El servidor reutiliza también una validación abierta de la misma oferta. Los periodos son días suizos, semanas de lunes a domingo y meses naturales, no intervalos fijos.

La validación mantiene su reloj monotónico, Wake Lock cuando está disponible, vibración inicial y comprobaciones al regresar de segundo plano y cada treinta segundos. Sin conexión no muestra estado válido. Solo puede consultarla su usuario; su URL no es un cupón transferible. Sigue excluida de caché, indexación y telemetría. Compartir solo usa enlaces públicos o el PNG del QR público del negocio.

Las rutas Scanner y `/c/:token` conservan el aviso de retirada y la limpieza de credenciales antiguas. No restaurar API del Scanner ni cuentas de trabajadores.

## 6. Verificación

Ejecutar `npm run test:card`, `npm run test:card:browser`, `npm run test:card:webkit`, `npm run test:card:invitations`, `npm run test:auth`, `npm run test:notifications`, `npm run test:search`, `npm run lint` y `npm run build`. Tras construir, ejecutar `npm run test:card:share`.

PGlite prueba instalación nueva y actualización histórica, repetición de migraciones, permisos, idempotencia, límites, términos, rollback del reemplazo, agregados sobre más de cien usos, consentimiento y deduplicación. Las fechas incluyen ambos cambios de horario de Zúrich.

Los navegadores simulan solo API de localhost, sin tocar Supabase real. Cubren confirmación y validación existentes, recuperación, registro, invitaciones, gestión, PNG, impresión, filtros y navegación en 390 px, 320 px, escritorio y movimiento reducido. Las capturas anteriores están en `output/latido-card/before`; las actuales, en `chromium` y `webkit`.

Antes de publicar quedan las comprobaciones con dos móviles reales, lectura del QR impreso y revisión de la función social y reescrituras en una Preview de Vercel. Las pruebas locales no sustituyen esos entornos.

No se ha desplegado la app ni aplicado SQL en Supabase. No hacer commit ni push sin autorización expresa del propietario.
