# Tarjeta Latido: revisión de experiencia e integración

Trabajo local del 17 de octubre de 2026. Sin despliegue ni ejecución de SQL en Supabase por el agente. Las capturas usan datos ficticios y RPC simulados en localhost. No contienen cuentas reales.

## Cambios y decisiones

| Tarea | Problema | Cambio y motivo | Alternativa descartada |
|---|---|---|---|
| A1 | Un socio con negocio no encontraba cómo participar | Acceso gratuito al final de `/card` para quien no participa, bloque en Para Empresas y texto nuevo en Publicar | Repetir la captación a propietarios que ya participan |
| A2 | El registro mezclaba planes y salidas duplicadas | Origen `tarjeta` conservado incluso al iniciar sesión; planes opcionales cerrados y desactivados; final centrado en crear oferta | Quitar los planes o prometer aprobación en un plazo inexistente |
| A3 | Compartir competía con la primera oferta | Invitación con ejemplo, cuatro opciones rápidas, crear y posponer | Compartir antes de tener una oferta |
| A4 | El límite aparecía después de rellenar todo | Actualizado el 20/10: se elimina el límite de ofertas por negocio; Crear oferta abre directamente el formulario, también desde invitaciones | Quitar límites de usos por socio, stock o autorización |
| A5 | Un descuento CHF no sugería mínimo y pedía hora | Selector de mínimo en el primer paso; fecha de calendario convertida al final del día suizo, con horario de verano; explicación desde el negocio | Mover el mínimo porcentual al primer paso: se mantiene avanzado porque no tiene el riesgo de superar el importe de la compra |
| A6 | Publicar cerraba la ventana sin siguiente paso | Éxito con vista previa y material para la primera oferta; las siguientes recuerdan que el QR permanece | Imprimir el documento detrás de un `<dialog>`: depende del DOM, recorta contenido y varía entre navegadores |
| A7 | El QR ocupaba espacio diario y existía sin ofertas | Material plegado, PNG a resolución triple, compartir/copiar, impresión independiente y guía A6 | QR vacío, credenciales privadas, scanner y modo caja |
| A8 | Ofertas y resultados quedaban escondidos | Selector arriba; resumen del servidor; ofertas visibles con estado, usos mensuales y acciones; actividad de 20 en 20; material al final | Calcular totales a partir de los últimos 100 registros |
| A9 | Cambiar términos exigía empezar de cero | Edición sin actividad; reemplazo transaccional con pausa y publicación; borrador original privado | Reconstruir combos y beneficios libres a partir del título. En ofertas antiguas se conserva el título hasta cambiar sus campos |
| A10 | Una página de hasta tres ofertas tenía buscador y pestañas | Datos públicos del local, mapas, ficha y sección «Ya usaste aquí», sin buscador ni pestañas | Añadir información de propietario o socio a la respuesta pública |
| B1–B2 | Barra de una sola opción y cabeceras diferentes | Barra solo con destinos adicionales, caché de acceso por cuenta y espacio reservado durante la consulta; estilos comunes | Navegación inferior y consultas redundantes por cada consumidor |
| B3 | Perfil y ofertas del mismo negocio estaban aislados | Enlaces al editor existente y al panel del negocio seleccionado desde las publicaciones y el apartado profesional de Perfil | Construir ahora otro editor o un nuevo panel sin revisión del propietario |
| B4 | Compartir llamaba club a la tarjeta | Mensaje «hazte socio de Tarjeta Latido» | Cambiar el nombre del menú sin decisión del propietario |
| C1 | Salir de una validación impedía recuperarla | Aviso superior con enlace al mismo uso y contador con `server_now` y reloj monotónico; desaparece al caducar | Registrar otro uso o cambiar la pantalla de validación |
| C2 | Presentación de la tarjeta | Título centrado, ilustración inclinada justo debajo, ventajas, precio y solicitud; pasos numerados a continuación | Tarjeta de socio de ejemplo y cálculo de ahorro, retirados por petición del propietario |
| C3 y C6 | Número, validez y tarjeta se repetían | Tarjeta cerrada por defecto; tarjeta, renovación e historial en la misma zona; lista de descubrimiento sin pestañas | Mantener pestañas entre datos personales y descubrimiento |
| C4–C5 | Dos listas y filtros poco claros | Un buscador y ciudad; selector Descuentos/Negocios | Inventar una ubicación precisa: Inicio guarda un **cantón**, no una ciudad. Se usa su nombre si coincide con una ciudad del catálogo y, en otro caso, Todas con aviso |
| C7 | Los emails no identificaban la cuenta | Solicitud/renovación con nombre, email de cuenta y número de socio, codificados en el `mailto:` | Añadir pagos, estados de solicitud o activación automática |
| D1–D3 | El valor de la tarjeta no aparecía en Latido | Beneficio en fichas y listados, un catálogo público compartido por sesión y ofertas en búsqueda por título, negocio y ciudad | Una llamada por tarjeta o datos privados en la caché |
| D4 | Los bots recibían metadatos genéricos de la SPA | Función Vercel sirve el HTML construido con metadatos públicos escapados; conserva la SPA y ofrece fallback si el RPC falla | Solo modificar etiquetas con JavaScript: WhatsApp no obtiene esa respuesta |
| D5 | Inicio podría comunicar descuentos cercanos | Propuesta visual separada, sin modificar `HomeLatidoCard.jsx` | Aplicarla sin la revisión solicitada |
| E1 | El negocio no recibía señales de actividad | Avisos dentro de Latido: primer uso, pocas unidades, fin próximo y resumen semanal; claves únicas evitan duplicados | Montar un sistema nuevo de email o solicitar permisos push para avisos internos |
| E2 | Socios sin recordatorios útiles | Vencimiento a siete días; novedades de todo el cantón elegido, con consentimiento explícito, revocable y máximo una cada siete días | Activar novedades por defecto o confundir el permiso con cookies analíticas |
| E3 | Faltaba medir el recorrido | Eventos de visita, solicitud, detalles, uso confirmado, inicio/abandono por paso, publicación, QR y recepción del primer uso; sin identificadores ni textos personales | Medir la página de validación: contradice la exclusión expresa. Se mide la confirmación anterior; la validación sigue completamente excluida |

El resumen y el historial describen pantallas mostradas por socios, no ventas verificadas. Las referencias de socio del negocio se limitan a cuatro dígitos; los agregados no contienen identificadores de clientes.

## Migraciones manuales

En una instalación existente con los módulos actuales de Card y `app_notifications.sql` instalados:

1. [`supabase/latido_card_experience.sql`](../supabase/latido_card_experience.sql).
2. [`supabase/latido_card_notifications.sql`](../supabase/latido_card_notifications.sql).
3. [`supabase/latido_card_verify.sql`](../supabase/latido_card_verify.sql): once comprobaciones, además del recuento informativo de tablas.

Ambos archivos nuevos usan una transacción y pueden repetirse. No conceden acceso directo a tablas de Card. Los RPC privados verifican identidad y permisos; el cron solo puede ejecutarlo el propietario de las funciones o `service_role`. El módulo de avisos conserva las clases de notificación ya instaladas.

La planificación reutiliza `pg_cron` con el trabajo `latido-card-notifications`, cada hora al minuto 15. Las fechas y la semana se calculan en `Europe/Zurich`; el resumen del lunes cubre la semana anterior completa. La frecuencia horaria evita depender del huso horario del cron y las claves únicas impiden repetir avisos. Si no está instalada la extensión, no intenta instalarla ni reemplaza otros trabajos: debe habilitarse el trabajo en desarrollo antes de comprobar la entrega periódica. Las novedades locales usan además un bloqueo de preferencias y un intervalo mínimo de siete días. El aviso de unidades se emite una vez por promoción al quedar dos o menos, y no se repite si una anulación repone unidades.

Para una instalación nueva se aplican primero el instalador mínimo y sus módulos de activación, borrado y participación, y después estos dos archivos. **No volver a ejecutar módulos antiguos después de los nuevos**, porque sustituyen funciones con versiones anteriores. Nunca aplicar scripts de `legacy/` a una instalación actual.

El servidor rechaza `lc_save_offer` cuando `providers.active=false`; por eso un negocio pendiente de revisión ve la explicación y puede volver a Mi negocio, pero no se le invita a publicar una oferta que fallaría.

## Impresión y vista previa social

`/card/material/:providerId` muestra únicamente el material del negocio público si tiene ofertas vigentes. `?tipo=guia` muestra la guía para el personal. El propietario pulsa Imprimir en esa página; el CSS usa A6 con márgenes de 8 mm. La ventana de éxito y Mi negocio comparten el mismo componente de pegatina. La descarga PNG espera fuentes y QR y usa el mismo diseño.

`api/card-share.js` lee `dist/index.html` incluido en la función. Solo llama a `lc_catalog` o `lc_business_benefits` con la clave pública; nunca usa la clave de servicio. `/card` y `/card/negocio/:id` pasan por la función, por lo que el HTML de las vistas previas no depende del agente de usuario. Los identificadores inválidos no consultan Supabase. Las validaciones conservan sus cabeceras de privacidad y su ruta separada. El mecanismo sigue el uso de [funciones con Vite](https://vercel.com/docs/frameworks/frontend/vite) y [reescrituras de Vercel](https://vercel.com/docs/routing/rewrites).

Pendiente de despliegue autorizado: comprobar la inclusión de `dist/index.html`, las variables públicas del proyecto y las reescrituras en una Preview de Vercel. La prueba local de la función verifica el HTML resultante sin ejecutar JavaScript, pero no sustituye ese entorno. No se ha solicitado ni realizado un despliegue.

## Capturas de revisión

Los enlaces son archivos locales producidos por las pruebas. Las comparaciones usan 390 px; también se generan 320 px, escritorio y movimiento reducido.

| Recorrido | Antes, 390 px | Después, 390 px |
|---|---|---|
| Mi negocio, ofertas y actividad | [Antes](../output/latido-card/before/business-mobile.png) | [Después](../output/latido-card/chromium/business-390.png) |
| Material QR | [Antes](../output/latido-card/before/business-qr-mobile.png) | [Después](../output/latido-card/chromium/business-material-mobile.png) |
| Socio | [Antes](../output/latido-card/before/compact-member-mobile.png) | [Después](../output/latido-card/chromium/member-mobile.png) |
| Visitante | [Antes](../output/latido-card/before/intro-mobile.png) | [Después](../output/latido-card/chromium/visitor-mobile.png) |
| Ficha pública Card | [Antes](../output/latido-card/before/business-detail-mobile.png) | [Después](../output/latido-card/chromium/business-detail-mobile.png) |
| Revisión del formulario | [Antes](../output/latido-card/before/offer-review-mobile.png) | [Después](../output/latido-card/chromium/offer-review-mobile.png) |
| Registro e invitación | [Antes](../output/latido-card/before/business-invitation-mobile.png) | [Después](../output/latido-card/chromium/registration-next-offer-mobile.png) |

Nuevas pantallas: [mínimo CHF](../output/latido-card/chromium/offer-fixed-minimum-mobile.png), [éxito con QR](../output/latido-card/chromium/first-offer-success-mobile.png), [guía A6](../output/latido-card/chromium/staff-guide-a6.png), [Para Empresas](../output/latido-card/chromium/companies-invitation-mobile.png), [320 px y movimiento reducido](../output/latido-card/chromium/member-320-reduced-motion.png), [escritorio](../output/latido-card/chromium/member-desktop.png). WebKit guarda sus capturas equivalentes en `output/latido-card/webkit/`.

## Propuestas pendientes de decisión

1. **Inicio, D5:** [propuesta a 390 px](../output/latido-card/chromium/proposal-home-discounts-mobile.png). Mostrar «N descuentos en {ciudad}» junto a Ver tarjeta. Es una modificación temporal del DOM durante la captura, con datos de prueba; no se ha aplicado al componente de Inicio.
2. **Club, B4:** renombrar el acceso de camisetas como **Tienda**, conservando `/club`. Ayuda a distinguirlo de Tarjeta Latido. El menú actual no se ha renombrado.
3. **Google, D4:** recomiendo indexar las páginas públicas de negocios con ofertas vigentes y contenido suficiente, con canonical por negocio. Las variantes de oferta pueden compartir el canonical del negocio. Ayuda a búsquedas locales y evita duplicar páginas. Hasta la decisión se mantiene `noindex, follow`; las validaciones siguen en `noindex, nofollow, noarchive`.
4. **Panel único, B3:** propuesta «Mis negocios», con selector común y secciones Ficha · Ofertas de la tarjeta · Material del local · Visibilidad · Clientes potenciales. Reutilizaría el editor de Perfil y los RPC actuales; Ficha y Ofertas serían las primeras secciones. No se ha construido otro panel.

## Verificación

La instalación nueva y la actualización desde el modelo antiguo se prueban en PostgreSQL embebido, con las migraciones nuevas ejecutadas dos veces. Se comprueban permisos, borrador, bloqueo de términos con actividad, reemplazo y rollback, agregados por encima del límite de historial, referencias enmascaradas, consentimiento y deduplicación de avisos. Las fechas prueban invierno, verano y ambos cambios de horario de Zúrich.

Chromium y WebKit simulan exclusivamente las API de localhost. Cubren el uso idempotente y la pantalla existente, la recuperación de esa misma validación sin un nuevo uso, QR/PNG y página imprimible, creación de varias ofertas, formulario, invitaciones, registro, administración, buscador, filtros compartidos, navegación y vista de socio/visitante. La función de compartir tiene una prueba separada con `fetch` simulado.

Comandos: `npm run test:card`, `npm run test:card:browser`, `npm run test:card:webkit`, `npm run test:card:invitations`, `npm run test:auth`, `npm run test:notifications`, `npm run test:search`, `npm run lint`, `npm run build`, y, tras construir, `npm run test:card:share`.

**Resultado local: todos los comandos anteriores pasan.** También pasa `git diff --check`. Se comprobó la recuperación de una promoción limitada ya consumida sin otro uso y el aviso con un reloj de dispositivo adelantado doce horas. Se revisaron visualmente las capturas del socio, visitante, negocio, formulario, resultado con QR, material e impresión; se corrigió el recorte de la vista previa del resultado antes de la última ejecución.

Siguen pendientes las comprobaciones físicas con dos móviles, la lectura del QR impreso y la Preview de Vercel. No hay cambios en `LatidoDiscountCard.jsx`, `LatidoOfferVisual.jsx`, la confirmación ni `LatidoCardValidation.jsx`.

## Corrección tras la revisión en la cuenta del propietario

Se corrigieron dos regresiones del cliente, sin cambios SQL adicionales:

- El catálogo compartido filtraba su array en cada render. Al comunicar GlobalSearch sus resultados al estado de Tablón, la referencia nueva provocaba otro render y el ciclo se repetía. Ahora el resultado está memorizado y las ofertas vencidas se retiran mediante un temporizador; los renders ajenos al catálogo no cambian su referencia.
- Las ofertas destacadas se excluían del catálogo inferior. Si eran las únicas de la ciudad, la sección de filtros quedaba vacía. El catálogo inferior conserva todas las coincidencias. La presentación restaurada ya no duplica destacados dentro de la tarjeta comercial.

Las pruebas de Chromium y WebKit cubren ahora una cuenta con empresa y sin membresía personal, las ofertas debajo de los filtros, Tablón con su callback de resultados y el botón Volver tanto en una ficha abierta mediante parámetros como en una URL de anuncio. También capturan los avisos de consola `Maximum update depth exceeded`, que no generan necesariamente un evento `pageerror`.
## Simplificación visual solicitada en la revisión

- Se retiran los chips de categoría. Se conservan búsqueda, ciudad y Descuentos/Negocios.
- Crear oferta pasa a una barra fija inferior con margen para el área segura del móvil. No se repite junto al título ni en el estado vacío del gestor. Desde el 20/10 el diálogo abre directamente el formulario y permite varias ofertas habituales o promociones activas a la vez.
- Resultados presenta únicamente los descuentos usados este mes en el negocio, calculados por el servidor y sin anulaciones.
- Material y primera publicación comparten solo Descargar imagen, Compartir imagen y enlace público con Copiar al lado. Compartir usa un archivo PNG; sin soporte Web Share de archivos, descarga la imagen y avisa. Las rutas imprimibles se conservan, sin botones aquí.
- La ilustración de tarjeta inclinada se sitúa justo debajo del título centrado; siguen las tres ventajas, precio y CTA. Se retiran la tarjeta de socio de ejemplo y el bloque de cálculo de ahorro. Los pasos son una lista numerada de texto: «Elige tu descuento», «Actívalo», «Muéstralo al pagar y ahorra», reutilizada en la ayuda.

Estos ajustes no requieren SQL adicional. Las capturas actuales de visitante, negocio y material sustituyen a las anteriores de esta revisión.

La exportación PNG usa canvas y el QR decodificado directamente. En WebKit, rasterizar un SVG con `foreignObject` omitía el QR aunque el archivo se descargara correctamente. La prueba ahora inspecciona los píxeles del PNG compartido, además de comprobar el nombre de descarga, las acciones disponibles y el fallback sin Web Share de archivos.

La ilustración decorativa reutilizable está en `LatidoCardIllustration`; no contiene datos de socio y se oculta a tecnologías de asistencia. Los círculos respetan movimiento reducido. La tarjeta real del socio conserva su componente existente. La captura de la presentación actual está en `visitor-card-presentation.png`.
