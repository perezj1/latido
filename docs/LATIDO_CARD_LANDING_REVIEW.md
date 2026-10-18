# Tarjeta Latido: landing y vistas de la app

Revisión local del 18 de octubre de 2026 basada en los cinco archivos HTML/CSS proporcionados. Sin despliegue ni ejecución de SQL remoto por el agente.

- La landing principal de Latido incorpora «Tarjeta Latido» en la navegación de escritorio y en el menú móvil.
- `/tarjeta-latido` tiene las vistas Socios y Negocios. Los enlaces `#socios`, `#negocios`, `#precio`, `#registro` y las ventajas abren el contenido correspondiente. Cambiar de vista y volver atrás conserva la dirección del navegador.
- El diseño sigue las referencias: portada con tarjeta/oferta ilustrativas, ventajas, pasos, precio, preguntas frecuentes y cierre. Los ejemplos son decorativos; no se publican como ofertas reales.
- La solicitud del visitante abre registro con retorno a `/card`. Para una cuenta abierta prepara el correo de activación con sus datos. El alta de negocio mantiene `?origen=tarjeta` y la revisión existente. La membresía sigue siendo manual; no se añade cobro automático.
- La app usa cabecera azul, pestañas Descuentos/Mi negocio, acceso a la información y a las alertas, y tarjeta real compacta desplegable. Mi negocio se muestra según los permisos de la cuenta; no exige membresía de socio al propietario.
- Búsqueda, ciudad y tipo (Todo, Descuentos, 2x1, Regalos, Otros) se combinan. Se conserva la vista Negocios y el catálogo completo; no se recuperan los filtros por categoría retirados anteriormente.
- Las alertas quedan al final del listado. Se valida ciudad, se guarda mediante RPC, se permite desactivar y se comunica cualquier fallo. Un guardado fallido nunca presenta las alertas como activadas.
- Mi negocio muestra la ficha real, Editar negocio a todo el ancho, ofertas con acciones visibles, menú de pausa/reactivación/borrado, enlace a ventajas profesionales y Crear oferta flotante. Se conservan resultados mensuales, actividad y material del local.
- Los términos con actividad siguen bloqueados: Crear nueva versión reemplaza la oferta mediante el RPC transaccional existente. Compartir solo utiliza enlaces públicos. Confirmación, contador y validación no se rediseñan.

Los estilos están limitados a `.lc-landing` y `.lc-app-page`; las variables y los estilos base de los archivos recibidos no se aplican globalmente a Latido. Se reutilizan las fuentes y el logo locales.

## SQL manual

Este rediseño no modifica el esquema ni añade migraciones. Reutiliza los RPC ya preparados. Si la instalación aún no tiene los módulos de experiencia o alertas, seguir el orden y los requisitos de [LATIDO_CARD_MINIMAL.md](LATIDO_CARD_MINIMAL.md#4-sql-manual):

1. [Experiencia](../supabase/latido_card_experience.sql): datos públicos del negocio, resumen mensual, edición y reemplazo.
2. [Alertas y preferencias](../supabase/latido_card_notifications.sql): requiere la infraestructura existente de `app_notifications.sql`.
3. [Verificación](../supabase/latido_card_verify.sql): comprobar los resultados `ok`.

La ejecución es manual en el entorno elegido por el propietario. No volver a instalar módulos antiguos después de estos módulos nuevos.

## Validación local

Las pruebas de navegador simulan exclusivamente las API de localhost. Incluyen navegación desde la landing principal, vistas y enlaces de la nueva landing, 320/390/1280 px, filtros combinados, persistencia de preferencias, rechazo de un guardado fallido y recuperación del descuento abierto. Se mantienen las pruebas de alta, edición, capacidad, usos, QR y validación existentes.

Capturas: `output/latido-card/chromium/landing-members-*.png`, `landing-business-*.png`, `member-mobile.png`, `business-390.png` y `alerts-enabled-mobile.png`. WebKit guarda las equivalentes en su carpeta.

Resultado: pasan `npm run lint`, `npm run build`, `npm run test:card`, `npm run test:card:browser`, `npm run test:card:webkit`, `npm run test:auth`, `npm run test:notifications`, `npm run test:search` y `npm run test:card:share`. También pasa `git diff --check`. Se revisaron las capturas de ambas landings, la tarjeta compacta, las alertas y la gestión del negocio; el aviso de descuento abierto ya no se solapa con la tarjeta.

Ajuste de identidad visual: las pestañas usan emojis (🎟️ Descuentos, 🏪 Mi negocio y 🛠️ Administración). Las identidades de negocio reutilizan la imagen de su ficha y, si falla, prueban las imágenes públicas disponibles de ese mismo negocio en sus ofertas; los logos se muestran completos con `object-fit: contain`. La selección de ciudad de las alertas usa texto más pequeño y el botón se reduce a «Activar», sin icono. Los filtros conservan desplazamiento táctil sin la barra gris visible. No se modifica SQL.
