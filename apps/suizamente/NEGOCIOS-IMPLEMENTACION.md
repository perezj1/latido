# Mapa y negocios · entrega 37–39

Precios aprobados por Latido el 27 de noviembre de 2026: En el mapa CHF 19/mes o 190/año; Plus CHF 39/mes o 390/año. Se leen exclusivamente de `server/suizamente/data/juego.json`.

## Qué cambia

- `mapa.barraCanton: false`: maqueta sin barra y tarjetas con enlace para acercar y botón de subida de 44 px. El botón usa la operación, el coste, el confeti y el momento originales. Con `true` se conserva la presentación anterior, probada en Chromium y WebKit.
- `huecos.json`: 26 cantones, 85 plazas, seis huecos de tierra y uno de aire por cantón, y uno de agua donde existe. Calculados con el `Huecos3D.repartir` original. Latido autorizó ajustar los márgenes de entrada por cantón; se guardan en `huecos-ajustes.json`. Se añade un margen de visibilidad para que redondear las coordenadas no las deje detrás de un obstáculo. Zúrich queda cerca del ejemplo original.
- La herramienta `herramientas/generar-huecos.html` muestra todos los huecos ocupados, permite revisar los 26 cantones y descargar el JSON. Se abre desde el servidor Vite local. El juego solo lee las coordenadas guardadas.
- Las decoraciones referencian esos ids. La migración mueve las colocadas al hueco libre más próximo del mismo tipo y cantón. Los árboles y las piedras próximos se ocultan mientras haya cualquier ocupante y vuelven al retirarlo. Los modelos y las miniaturas originales se copian sin cambios.
- Alta de negocio, lista de espera, figura y chincheta, ficha y oferta, directorio, panel privado, resumen, pregunta del mes y revisión por administración. Cada cambio de ficha conserva la publicada hasta su aprobación. Las plazas en revisión, cambios o activas son exclusivas; la capacidad se comprueba bajo bloqueo del cantón.
- Factura manual con referencia única, periodos pagados, gracia e impago, cambios de plan al siguiente periodo y baja al final del periodo pagado. Las estadísticas solo conservan totales: las claves de deduplicación son temporales, con secreto diario y limpieza independiente. El porcentaje no aparece por debajo del mínimo configurado.
- La pregunta patrocinada es independiente y se ofrece antes de la ruleta. Respeta el máximo por partida y el reloj del servidor. No cambia la fase, el turno, el marcador, los sellos, las monedas, los comodines ni la XP de la partida. La correcta y el dato llegan después de responder; la fuente permanece privada. Las preguntas están fuera del banco original.

## Estado de los pagos

**Latido pidió aplazar la integración automática.** El paso de pago y el panel muestran «Pago automático · Próximamente disponible». Sigue la factura manual. No se han creado clientes, productos, suscripciones ni cobros en Stripe, ni añadido claves o el SDK. `negocios.cobroAutomatico` continúa en `false`.

Para retomarlo: conectar un sandbox de Stripe, configurar dos productos y sus cuatro precios aprobados, guardar tarjeta sin cobrar mediante Checkout/SetupIntent, activar la suscripción tras aprobar, verificar webhooks con firma e idempotencia de factura y evento, y añadir el portal con cambios de plan al siguiente periodo. Probar aprobación, primer cobro, fallo, gracia, duplicados y baja antes de habilitarlo. Usar claves restringidas de prueba y secretos solo del servidor. Latido debe decidir IVA, condiciones e información de factura; no se ha activado Stripe Tax.

La documentación actual de [TWINT en Stripe](https://docs.stripe.com/payments/twint) ya indica recurrencia compatible, pero excluye B2B. El producto vende a negocios: hay que confirmar con Stripe su admisibilidad. Si se admite, se mantiene la decisión de Latido de ofrecerlo solo como pago anual. La factura QR depende del proceso de facturación de Latido; no se inventa un IBAN ni una factura.

## Migraciones y configuración

Aplicar en orden, después de v33:

1. `supabase/suizamente_v34_huecos.sql`: tabla privada de huecos, datos y traslado de decoraciones.
2. `supabase/suizamente_v35_negocios.sql`: tablas privadas del negocio, ofertas, cambios, preguntas, estadísticas y claves temporales, pagos, espera, avisos, capacidad, reportes, localidades y contador de preguntas; RPC independiente `suizamente_negocios`. RLS y acceso directo revocado.
3. `supabase/suizamente_v36_negocios_datos.sql`: configuración apagada y localidades del directorio oficial de swisstopo. Programa un trabajo nuevo de limpieza si existe pg_cron; no modifica los trabajos anteriores.

No se sustituyen funciones ni tablas de las partidas. Los ejemplos de Café Cumbia y su pregunta viven exclusivamente en las pruebas locales; nunca se insertan como contenido de producción.

Los datos postales proceden del [directorio oficial de localidades de swisstopo](https://www.swisstopo.admin.ch/de/amtliches-ortschaftenverzeichnis), descargado el 27 de noviembre de 2026. La elección de ciudad y cantón es explícita cuando un código postal cruza límites cantonales. No se usa una deducción aproximada por prefijos.

`negocios.activo` continúa en `false` en el JSON y en la base. Antes de abrir altas, Latido debe publicar sus condiciones y guardar su enlace en `negocios_configuracion.condiciones_url`; mientras falte, el alta lo explica y el servidor no acepta solicitudes. Revisar IVA y el envío manual de las facturas. No hacen falta nuevas variables de entorno para esta entrega.

## Archivos principales

- Interfaz: `MapPage3D.jsx`, `WorldMap.jsx`, extensiones de `world3d.js`, `mapCards.css`, `Negocios.jsx`, `NegociosMap.jsx`, `NegocioPregunta.jsx`, `negocios.css`; accesos condicionales en `Menu.jsx`, `Admin.jsx`, `SuizamenteApp.jsx` y `Game.jsx`.
- Transporte: rutas independientes en `server/suizamente/negocios-routes.mjs`, configuración pública y resolución de huecos; excepción limitada al email de facturación en el panel privado ya autorizado por el servidor. Las fichas públicas y los endpoints anteriores mantienen su filtro de contactos.
- Datos y recursos: `server/suizamente/data/{juego,decoraciones,huecos,huecos-ajustes,postales}.json`; figuras, miniaturas y 18 SVG de negocio, con el lápiz de negocio separado para conservar el icono anterior.
- Herramientas, migraciones y pruebas de esta entrega en `herramientas/`, `scripts/`, `test/` y `supabase/`.

## Cómo probar

Desde `apps/suizamente`:

```sh
npm run dev:negocios
```

Abre la URL que muestra la terminal. Alex crea y gestiona el negocio; Caro es administración; Lu, en otra ventana privada, lo ve como quien juega. La base es temporal y no conecta con producción. El enlace de condiciones de este entorno es una prueba.

```sh
npm run test:negocios:datos
npm run test:negocios:servidor
npm run test:negocios:browser
npm run test:negocios:huecos
npm run test:negocios:apagados
npm run capturas:negocios
npm run build
```

Para cambiar las coordenadas tras una revisión: `node scripts/generar-huecos.mjs --escribir`, después `npm run generar:negocios:sql`. No modificar coordenadas a mano ni recalcularlas en el juego. Los ids publicados permanecen estables. El generador de mejoras resuelve las referencias y, a partir de esta entrega, escribe `suizamente_mejoras_datos_actualizar.sql`; conserva inmutable la migración v33 ya publicada.

Las capturas y la comparación con `negocios.html` quedan en `output/negocios/comparacion.html`, con ambas medidas y motores. `output/negocios/huecos/` contiene los 26 cantones ocupados, el informe de superficies/visibilidad/restauración y la medición de renderizado local. Los recursos de captura se ignoran en Git.

La comparación apagada usa la revisión publicada `7888920` en un worktree separado (`SUIZAMENTE_BASE_ROOT` permite señalar otro directorio con esa revisión). Comprueba también los textos, nombres accesibles y posiciones de Inicio; solo distingue como suavizado los píxeles mezclados en un borde, sin ignorar cambios de color plano. Menú, Ajustes, Amigos y el mapa con barra coinciden píxel a píxel en ambas medidas. El renderizado local enfocado con los 85 negocios cargados midió 30,1 ms frente a 28,7 ms de base; se reutilizan las 2.281 mallas y sus recursos.

## Validación y límites

Las pruebas nuevas cubren alta y revisión, exclusividad y capacidad, email privado, cambio pendiente, pago manual único, gracia, baja, contadores diarios, mínimo del porcentaje, pregunta con reloj y sin premios, migración de huecos y control de acceso. Las pruebas anteriores de mejoras y de la barra antigua se conservan. La comparación apagada usa `barraCanton: true` para comprobar el aspecto anterior; el nuevo mapa sin barra se verifica por separado.

`npm test` conserva dos fallos anteriores a esta entrega: `datos-demo.test.mjs` espera `correctAnswer` en el banco antiguo y `service-worker-update.test.mjs` espera el antiguo espacio de caché. No se han cambiado esos datos ni el service worker para ocultarlos. El presupuesto antiguo de entrega también estaba excedido antes; esta entrega no lo redefine.

Pendientes de operación: condiciones para negocios, IVA y proceso de factura/QR de Latido; activar el módulo cuando Latido quiera. El cobro automático queda aplazado por petición expresa.

## Base de producción

Las migraciones v34, v35 y v36 están aplicadas el 27 de noviembre de 2026: 85 plazas, 197 huecos de decoración y 4.246 localidades oficiales. Cero negocios de ejemplo, cero permisos directos de `anon`/`authenticated` sobre las tablas nuevas, limpieza programada y ambos interruptores de negocios en `false`. La huella de definiciones y permisos de todas las funciones anteriores coincide antes y después (`63e58d685d22bdfdadc5a22bea2d0763`).
