# Tarjeta Latido: versión mínima

Esta guía sustituye las tres guías anteriores de Card. El cliente realiza el uso; el personal mira la pantalla y aplica el descuento en su caja. Los negocios participan gratis. La membresía de cliente sigue siendo CHF 6,90/mes.

## 1. Flujo que implementamos

1. El cliente entra desde **Perfil → Tarjeta Latido**, elige un descuento y pulsa **Activar**. También puede usar la cámara normal de su móvil para leer la pegatina pública del local: abre `/card/negocio/<id>` con los descuentos actuales de ese negocio.
2. Si necesita iniciar sesión, el login conserva la dirección del negocio y `?oferta=<id>` para devolverlo al mismo sitio. Un visitante puede consultar los descuentos antes de hacerse socio.
3. Todas las ofertas muestran **Activar**, tanto las habituales como las promociones limitadas. No hay un paso de reclamar ni de reservar por adelantado. Las pestañas son **Disponibles** y **Usadas**: la segunda muestra los usos registrados, incluso de ofertas que ya han caducado o se han pausado.
4. **Mostrar detalles / Ocultar detalles** despliega las condiciones dentro de la tarjeta. **Activar** abre la confirmación «¿Usar este descuento ahora?», con la imagen del negocio, el descuento y la compra mínima. **Cancelar** no registra nada.
5. **Usar ahora** llama a `lc_use_offer`. El servidor comprueba cuenta, membresía vigente, negocio, oferta, unidades y límite. Para promociones limitadas, reserva y consume una unidad en la misma transacción que registra el uso. Cancelar o fallar la operación no deja una reserva nueva.
6. Se abre `/card/validacion/<id>` con el diseño blanco de ticket: nombre del negocio, beneficio grande, compra mínima, estado **Tarjeta activa**, sello animado, cuenta atrás, hora suiza y referencia de socio enmascarada. Dura como máximo cinco minutos; nunca supera la vigencia de la membresía o de la oferta.
7. El cliente enseña esa pantalla. El personal verifica el negocio y las condiciones de compra y aplica el descuento en su propia caja. No necesita Latido, cuenta, teléfono ni scanner.
8. El uso aparece en ambos historiales. Al terminar los cinco minutos, la pantalla deja de mostrar que es válida. Un descuento limitado queda usado; los periódicos vuelven según su calendario; uno ilimitado permite otro uso.

**Límite del modelo:** la comprobación del personal es visual. El contador y la animación ayudan a distinguir una captura estática, pero no impiden pantallas falsas ni compartir una validación durante su ventana. El historial acredita que el cliente solicitó mostrar el descuento; no acredita una compra, su importe o el descuento realmente aplicado. No usar esta V1 como verificación fuerte de beneficios de alto valor.

## 2. Qué conserva y qué retira

Se conservan socios, números de socio, membresías, negocios, ofertas, reservas, usos anteriores, anulaciones y auditoría administrativa. Latido conserva la autoridad de suspender negocios, gestionar membresías y revisar actividad.

Se retiran la app separada Scanner, la cámara dentro de Latido, guías de permisos, cuentas/conexiones de trabajadores, enlaces privados del negocio, QR personales, credenciales y códigos de seis cifras. También se retiran solicitudes de tarjetas físicas, impresión personal, entrega y correos de envío, conforme a la decisión del proyecto.

La limpieza SQL **archiva** las tablas retiradas en `latido_card_archive`, sin acceso desde anon/authenticated. No las destruye ni expone ese esquema por la API. Los usos antiguos mantienen el identificador y nombre del scanner en `redemptions.legacy_metadata`. No hay que crear de nuevo las cuentas de prueba existentes ni volver a cargar ejemplos si ya están instalados.

La tarjeta de socio utiliza únicamente el diseño oscuro, sin QR personal ni selector de apariencia. La pantalla que muestra el descuento mantiene el diseño blanco de ticket del ejemplo. Ambas muestran datos reales; el reloj usa horario suizo. Este ajuste visual no requiere SQL adicional.

Las tarjetas de descuento muestran la imagen registrada del negocio, con un emoji según el tipo de descuento como alternativa si no hay imagen o falla la carga. El mismo recurso aparece en la confirmación y en el historial cuando está disponible. El historial aparece únicamente en **Usadas**, también al consultar los descuentos de un negocio. **Disponibles** muestra solo los descuentos disponibles. En la lista compacta, el título aparece primero, seguido del negocio y su ciudad en azul con texto más pequeño, el descuento y el límite de usos como texto sin etiquetas. Compartir aparece arriba a la derecha; **Mostrar detalles** es un botón secundario a la izquierda de **Activar**, ambos del mismo tamaño y con la misma tipografía. **Activar** y **Usar ahora** son azules; **Cancelar** tiene texto y borde rojos sobre fondo claro. El panel de condiciones conserva su fondo gris claro. La tarjeta de socio es oscura y la pantalla de validación es blanca; esta última adapta sus tamaños a la altura disponible para mostrar también las instrucciones, el socio y la hora.

## 3. SQL manual de Supabase, en este orden

Ejecutar cada archivo completo en SQL Editor del **mismo proyecto Supabase** de Latido. No ejecutar scripts de `supabase/legacy/latido_card/`: corresponden al sistema retirado. El instalador es válido tanto si Card ya estaba instalado como si todavía no lo estaba; presupone que la base normal de Latido ya contiene `profiles`, `providers` y `is_business_promotion_admin()`.

| Orden | Archivo | Resultado |
|---|---|---|
| 1 | [`supabase/latido_card_minimal.sql`](../supabase/latido_card_minimal.sql) | Instala/actualiza las seis tablas vigentes, las nuevas funciones, los límites diarios/semanales y los permisos. Retira el acceso de la app a todas las API antiguas. No activa socios ni cobra dinero. |
| 2 | [`supabase/latido_card_cleanup_legacy.sql`](../supabase/latido_card_cleanup_legacy.sql) | Detiene exclusivamente el cron `latido-card-physical-email`, elimina las funciones retiradas y mueve sus tablas al archivo privado. Conserva los usos e identifica su procedencia antigua. |
| 3 | [`supabase/latido_card_verify.sql`](../supabase/latido_card_verify.sql) | Solo lectura. Las cinco comprobaciones deben devolver `ok = true`; muestra también las cantidades de datos conservados. |
| Opcional, solo desarrollo | [`supabase/latido_card_test_examples.sql`](../supabase/latido_card_test_examples.sql) | Añade seis ofertas ficticias y dos membresías de prueba si todavía no existen. No ejecutar en producción. |

Los archivos 1 y 2 usan transacciones y se pueden repetir. No es necesario ejecutar de nuevo `schema.sql`, los SQL del Scanner ni `email_cron`. Si el editor avisa de operaciones que modifican objetos, se debe a la sustitución de restricciones/funciones y al archivado. Las tablas vigentes y archivadas quedan con RLS habilitado y sin permisos directos para clientes de la app; **no necesita que el editor añada sus propias políticas**.

**Si ya instalaste la versión mínima anterior:** ejecuta únicamente [`supabase/latido_card_activate_offers.sql`](../supabase/latido_card_activate_offers.sql) para esta actualización de «Disponibles / Usadas» y activación directa de promociones. Es transaccional, se puede repetir y no borra datos. Después puedes repetir `latido_card_verify.sql`. Las instalaciones nuevas ya incluyen estas funciones en `latido_card_minimal.sql` y no necesitan ejecutar el archivo adicional.

Si la Edge Function `latido_card_physical_email` llegó a desplegarse, elimínala o desactívala en **Supabase → Edge Functions** después del paso 2. SQL no elimina despliegues de Edge Functions. Ya se ha retirado su configuración del repositorio y el cron queda detenido; no borres SMTP, `latido_project_url`, pg_cron, pg_net ni otros recursos compartidos de Latido. El código anterior permanece en `supabase/legacy/latido_card/functions/` como referencia, fuera de la carpeta de despliegue.

Para activar una cuenta real durante el piloto: el administrador de Latido abre `/card/admin`, busca su perfil, selecciona usuario y vigencia y guarda la membresía. **El cobro recurrente automático todavía no está integrado.** El CTA del piloto solicita la activación por email a Latido; no debe presentarse como una suscripción que ya cobra o renueva automáticamente. Stripe y sus webhooks requieren otro trabajo antes de comercializar el cobro automático.

## 4. Administración y negocios

1. Un propietario con negocios registrados entra en **Mi negocio**. Se selecciona uno automáticamente y se registra gratis en el programa si no está suspendido. No necesita una membresía personal de pago.
2. Si tiene varios, el selector inferior permite cambiar el negocio que gestiona. Si no tiene ninguno, se muestra **Registrar mi negocio**.
3. Obtiene un QR público y estable basado en el UUID del negocio. Puede compartir el enlace o **Imprimir pegatina**. Nunca incluye identidad de socio, reservas ni credenciales. Cambiar, pausar o publicar una oferta no cambia la pegatina.
4. **Crear un descuento o promoción** está plegado y mantiene tres pasos: contenido, condiciones de uso y revisión. Se permite un descuento habitual y hasta dos promociones limitadas vigentes por negocio.
5. Los límites son por día suizo, semana de lunes a domingo, mes natural, total o ilimitados. Las promociones especiales permiten un uso total por socio y descuentan existencias al confirmar **Usar**. Se conservan las reservas anteriores: una que siga vigente se utiliza sin consumir otra unidad; una que haya caducado necesita unidades disponibles al activar. Una anulación restituye disponibilidad según las condiciones existentes.
6. Después de reservas o usos no se pueden cambiar las condiciones de una oferta. Se pausa y crea otra versión. Las nuevas condiciones aparecen con el mismo QR de negocio.
7. El historial del negocio muestra usos registrados. El propietario o Latido puede anular uno indicando motivo. Una anulación invalida su pantalla y restituye disponibilidad según las condiciones.
8. Latido gestiona membresías y puede **Retirar del programa** un negocio. Sus ofertas desaparecen y las pantallas abiertas dejan de validarse al comprobar de nuevo el servidor. El propietario no puede quitarse la suspensión. Restablecer participación conserva el enlace público.

## 5. Guía técnica para continuar el desarrollo

### Datos vigentes

| Tabla pública | Contenido |
|---|---|
| `latido_card_memberships` | Perfil, número único, estado y vigencia; fuente de activación |
| `latido_card_businesses` | Negocio participante, actividad y suspensión administrativa |
| `latido_card_offers` | Condiciones, fecha, existencias, tipo y frecuencia de uso |
| `latido_card_claims` | Reserva única por socio/oferta, estado y caducidad |
| `latido_card_redemptions` | Petición idempotente, socio, oferta, negocio, copia de condiciones, fecha, vencimiento de pantalla y anulación |
| `latido_card_admin_audit` | Actor y cambios administrativos; no credenciales privadas |

Todo acceso de la app pasa por funciones revisadas `SECURITY DEFINER` con `search_path` fijo y autorización interna. No añadir permisos directos de escritura a estas tablas para implementar botones.

### Funciones y rutas

- Catálogo público: `lc_catalog`, `lc_business_benefits(p_provider)`.
- Cuenta del cliente: `lc_member_home`, `lc_use_offer(p_offer,p_request_id)`, `lc_validation(p_redemption)`. Las funciones de reservas permanecen para compatibilidad con los datos anteriores; la interfaz ya no las llama directamente.
- Propietario: `lc_business_dashboard`, `lc_join_card_business`, `lc_save_offer`, `lc_set_offer_active`, `lc_reverse_redemption`.
- Administrador: `lc_admin_overview`, `lc_admin_enroll`, `lc_admin_business`.
- Pantallas: `src/pages/LatidoCard.jsx`, `LatidoCardValidation.jsx`, `LatidoCardBusiness.jsx`, `LatidoCardAdmin.jsx`. El perfil principal mantiene su acceso a `/card`.
- Componentes reutilizados: `LatidoCardIntro`, `LatidoCardOfferWizard`, `LatidoCardQr` (solo QR público).

### Reintentos, tiempo y autorización

La confirmación genera un UUID y lo conserva en `sessionStorage` antes de la petición. Si la respuesta se pierde después del registro, el siguiente intento lleva el mismo UUID. El servidor devuelve el mismo uso, con su vencimiento original. Recargar o volver del segundo plano consulta ese registro y no consume otro uso. También reutiliza una validación abierta de la misma oferta aunque llegue otra petición, para evitar doble clic entre pestañas. Para una oferta ilimitada se crea otro uso cuando termina la ventana anterior.

Las operaciones bloquean la membresía y la oferta en la base de datos. Los límites cuentan los usos no anulados; las reservas se serializan por oferta para respetar existencias. Los periodos usan `Europe/Zurich`, con cambios de horario de verano, y no intervalos fijos de 24 horas o 30 días. El vencimiento sale del servidor; el navegador calcula el contador con tiempo monotónico, vuelve a comprobar al recuperar visibilidad y cada 30 segundos. Si falla la conexión, no muestra el estado válido. Una suspensión o anulación remota puede tardar hasta ese intervalo en reflejarse en una pantalla ya visible.

La validación solo puede consultarla su propio usuario autenticado. Su URL no es un cupón transferible. La app y el servicio worker excluyen esa ruta del caché, las cabeceras impiden almacenamiento e indexación y la telemetría de Vercel omite la pantalla privada. No añadir datos privados a enlaces de ofertas compartidos.

### Retirada de instalaciones anteriores

`/scanner/` y los enlaces antiguos de vinculación muestran una página de retirada que limpia credenciales locales, retira el worker antiguo y abre `/card`. Se conserva `public/scanner/sw.js` únicamente para desinstalar el worker de dispositivos anteriores; no es una segunda app. Las tarjetas antiguas `/c/<token>` explican el nuevo acceso. Un acceso directo instalado puede seguir llamándose Scanner hasta que el usuario lo quite; ya no tiene permisos operativos en el servidor.

## 6. Verificación antes de publicar

Ejecutar:

```sh
npm run test:card
npm run test:card:browser
npm run test:card:webkit
npm run test:auth
npm run build
```

La prueba de base de datos usa PostgreSQL embebido PGlite con roles y RLS, tanto instalación nueva como actualización completa del modelo antiguo y archivado. Comprueba permisos, acceso entre usuarios, idempotencia, caducidad, límites, horarios suizos, reservas, existencias, suspensiones y anulaciones. Las pruebas de navegador simulan las API **en localhost**, sin tocar Supabase real, e incluyen login con retorno al negocio, confirmación, respuesta perdida tras registro, validación y recarga, reservas y gestión del QR público. Las capturas se guardan en `output/latido-card/`.

Completar después una prueba con Supabase de desarrollo y dos móviles reales (iPhone/Safari y Android/Chrome): leer la pegatina desde la cámara del sistema, iniciar sesión, mostrar la pantalla, comprobar la expiración y volver desde segundo plano. Las pruebas Chromium/WebKit con viewport móvil no sustituyen esos dispositivos ni prueban el lector de QR del sistema operativo. Verificar además impresión física de la pegatina y su lectura desde una distancia normal.

No se han ejecutado los SQL en Supabase ni desplegado la app como parte de estos cambios. No hacer commit o push hasta la autorización del propietario.
