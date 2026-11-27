# Cinco mejoras opcionales

Implementación de los prompts 32–36 de `suizamente/MEJORAS.md`. Las cifras y condiciones son las de la propuesta, pendientes de aprobar por Latido. Los cinco `activo` permanecen en `false`. No hay misterios publicados. Las migraciones v27–v33 se aplicaron en producción el 27 de noviembre de 2026, con publicación del cliente en `suizamente` y `suizamente-social` autorizada por el usuario.

## Archivos y aislamiento

- `server/suizamente/data/juego.json`: bloque `mejoras` completo; las claves anteriores permanecen intactas.
- `server/suizamente/data/decoraciones.json`: ocho tipos, condiciones y 119 huecos comprobados sobre la geometría real de los 26 cantones. No se cambian los modelos ni la maqueta existente.
- `fuentes/misterios.txt`, `fuentes/LEEME-FUENTES.md`, `herramientas/generar-misterios.js`: contenido editorial y validación. El ejemplo del diseño está comentado; las pistas que faltaban se dejan pendientes de Latido. `data/misterios.json` y su copia privada del servidor están vacíos.
- `public/suizamente-assets/`: nueve SVG nuevos y símbolos añadidos al sprite, modelos y miniaturas copiados literalmente. El candado es el original facilitado por Latido en la conversación.
- `game/src/components/suizamente/v2/Mejoras*.jsx`, `mejoras.css` y `game/src/lib/suizamenteDecoraciones.js`: pantallas, controles accesibles, compartir y carga diferida. Solo se añaden accesos condicionales a Inicio, Menú, Mapa, Amigos y Ajustes.
- `server/suizamente/mejoras-routes.mjs`: rutas nuevas `/api/suizamente/mejoras/*`. La API anterior conserva sus rutas y acciones.

El cliente lee los interruptores de la configuración HTTP y el servidor los comprueba de nuevo en SQL. Las rutas desactivadas no permiten jugar. Las pruebas comparan definiciones y permisos de todas las funciones anteriores antes/después de las migraciones. Con todo apagado no hay peticiones a las rutas nuevas ni cambios de composición en las cinco pantallas comparadas con el commit anterior.

## Migraciones nuevas, en orden

Aplicar después de v26, antes de servir un cliente que active alguna mejora:

| Migración | Añade |
|---|---|
| `suizamente_v27_mejoras_base.sql` | `mejoras_configuracion`, `mejoras_ajustes`, `mejoras_avisos`; utilidades privadas y validación de cuenta mediante el motor existente |
| `suizamente_v28_minuto.sql` | `minuto_partidas`, `minuto_respuestas`; reloj, puntuación, premios, récord y clasificación |
| `suizamente_v29_espejo.sql` | `espejo_retos`, `espejo_jugadas`; enlaces, tiempos, resultado, revancha y avisos |
| `suizamente_v30_misterio.sql` | `misterios`, `misterio_intentos`; contenido privado, pistas, solución, racha y premios |
| `suizamente_v31_decorar.sql` | `persona_decoraciones`, `decoraciones_gustos`; desbloqueos, posiciones, visitas y me gusta |
| `suizamente_v32_un_toque.sql` | Resumen de Inicio, preferencias, trabajador de avisos, RPC pública nueva y guardado de datos de los modos nuevos en la Libreta existente |
| `suizamente_v33_mejoras_datos.sql` | Semilla de las tablas nuevas, con todo apagado; tarea cron independiente si `pg_cron` ya está disponible |

No se sustituyen tablas, funciones, permisos ni tareas anteriores. Las tablas nuevas tienen RLS y no permiten lectura o escritura directa desde el navegador. Solo las funciones públicas nuevas dan acceso a los datos permitidos. Los bloqueos conservan el orden del motor anterior; premios, posiciones y aceptación de enlaces son transaccionales.

El trabajador `public.suizamente_mejoras_avisos()` solo lo ejecuta `service_role` o la tarea SQL. Si no existe `pg_cron`, programar esa función una vez por minuto desde el mecanismo de servidor disponible antes de activar los avisos. No requiere ni modifica el cron anterior. Reutiliza `v7_notificar`, que en la aplicación independiente escribe en `suizamente_notificaciones` y usa el transporte push existente. No escribe en la bandeja de Latido.

Las claves del libro de movimientos son `motivo=minuto, ref=partida`; `espejo, reto:persona`; `misterio, fecha`; `decoracion, id`. El índice único existente impide cobrar dos veces. Los premios se calculan en el servidor y las partidas guardan su configuración al empezar. El reloj y los cortes de día/semana/mes usan Europe/Zurich.

## Probar localmente

Desde `apps/suizamente`:

```powershell
npm run test:mejoras:contenido
npm run test:mejoras:servidor
npm run test:mejoras:mapa
npm run test:mejoras:browser
npm run test:mejoras:casos
npm run test:mejoras:apagadas
npm run build
```

Las pruebas usan React, HTTP y PostgreSQL desechable, con cuentas de prueba. No necesitan credenciales de producción ni envían mensajes reales. Las pruebas de navegador activan los cinco interruptores únicamente en su configuración temporal. La primera partida de Minuto en Chromium dura los 60 segundos reales; WebKit acelera únicamente el reloj de la base temporal para completar el resto del recorrido.

`test:mejoras:apagadas` necesita una copia del commit previo en `SUIZAMENTE_BASE_ROOT` (carpeta `apps/suizamente`); el valor por defecto apunta al worktree local `suizamente-mejoras-base`. `SUIZAMENTE_DESIGN_ROOT` permite indicar la carpeta de referencia para los SVG, miniaturas, modelos y capturas. El valor por defecto es la carpeta `latido/suizamente` vecina al repositorio.

Para una revisión interactiva aislada, ejecutar `npm run dev:mejoras` y abrir `http://127.0.0.1:5678/__suizamente_qa?cuenta=alex`. La barra permite entrar con Alex, Lu o Caro; usar otra ventana privada para jugar entre dos cuentas. Activa los cinco modos solo en PostgreSQL temporal, prepara amigos y un cantón con una decoración disponible. No conecta a datos de producción. El misterio permanece oculto porque no hay contenido aprobado; su ejemplo se usa exclusivamente en las pruebas automatizadas. También puede usarse `startSuizamentePreview(port, {mejoras:true})` directamente.

Para una activación real posterior hay que aprobar los valores, cambiar los interruptores deseados en `server/suizamente/data/juego.json`, regenerar la semilla y mantener la misma configuración en SQL y HTTP. No basta con modificar el navegador.

```powershell
node herramientas/generar-misterios.js
node herramientas/generar-misterios.js --escribir
node scripts/generar-mejoras-sql.mjs
```

El generador rechaza campos inválidos, textos demasiado largos, fechas imposibles o repetidas y opciones sin una única correcta; no escribe nada ante un error. Los misterios aprobados se insertan por fecha sin reordenar las opciones ni sobrescribir contenido ya publicado. Los datos editoriales privados están excluidos de los archivos servidos por Vite y del build del cliente.

## Comprobaciones y capturas

`output/mejoras/` conserva resultados SQL, capturas a 390 × 844 y 375 × 667, referencias y comparaciones. `referencia/` contiene las 21 pantallas de `mejoras.html`; `chromium/` y `webkit/`, los recorridos nuevos; `casos-*`, los cuatro botones de Inicio, el momento, los dos mapas y el cupo de premios; `final/`, las pantallas con el acabado final y el Inicio desplazado hasta sus listas e ideas; `apagadas/`, la comparación real con la versión anterior; `huecos/`, las siete regiones, las coordenadas y el presupuesto local de renderizado. Tras ejecutar las pruebas, `npm run capturas:mejoras` actualiza las referencias y las 20 comparaciones en `comparaciones/index.html`.

Se comprueban respuestas tardías y repetidas, transacciones únicas, límites, privacidad del ranking, empate por tiempo y empate exacto, caducidad, enlace aceptado por una sola persona y registro completo desde ese enlace. El misterio cubre 1/2/3 pistas, fallos, racha, ausencia de contenido y porcentaje oculto hasta 20 respuestas. Decorar cubre propiedad, tipo de hueco, cantón sin construir, mover/quitar, visitas de solo lectura, me gusta y momento una sola vez.

En la maqueta se añade únicamente `decorar(lista)` a `world3d.js`. Mover o quitar reutiliza las instancias, geometrías y materiales; no hay sombras de decoraciones con cuatro núcleos/4 GB o menos. Los botones de huecos próximos se separan sin cambiar el ancla real y mantienen una línea que la señala. Las tarjetas van en tres columnas. El contador se limita a los huecos construidos de la región visible; el selector permite volver a regiones desbloqueadas. La comparación local del renderizado incluye los ocho modelos; la fluidez definitiva requiere comprobar un teléfono físico.

El aviso del misterio tiene un pequeño interruptor al pie de su propia pantalla para poder activarlo aunque Un toque esté apagado. Usa la misma preferencia que Avisos. Ideas y misterio vienen apagados; el silencio nocturno viene encendido. Los recordatorios no incluyen soluciones ni datos privados.

Verificación en producción: las 384 funciones anteriores y sus permisos conservan exactamente la misma firma MD5 antes y después de aplicar las migraciones; el cron nuevo está activo, los cinco interruptores apagados y el banco de misterios vacío. El rol anónimo no puede leer el banco ni ejecutar el trabajador de avisos; `service_role` sí puede ejecutar este último. La RPC nueva devuelve la configuración pública y rechaza jugar con una mejora apagada.

Las ocho regresiones anteriores de Inicio, Menú, Nueva partida, iconos, mapa, compartir, partida e invitaciones pasan. `npm test` conserva 25/27, igual que el commit anterior: fallan `datos-demo.test.mjs` (contexto de respuesta indefinido) y `service-worker-update.test.mjs` (nombre antiguo de caché). El presupuesto de entrega también fallaba antes: 116.589 bytes frente al límite de 115.000; la ampliación queda alrededor de 120 kB. No se han cambiado esos tests ni los sistemas anteriores para ocultar sus fallos. El build pasa y las pantallas nuevas se cargan de forma diferida.

Pendiente de producto: aprobación de valores/condiciones y contenido por Latido, antes de activar las mejoras. Pendiente de dispositivo: compartir nativo, recepción push, VoiceOver/TalkBack y rendimiento en teléfonos físicos. Quedan asimismo los tres fallos anteriores citados. Las pruebas locales no se presentan como comprobaciones realizadas en teléfonos reales.
