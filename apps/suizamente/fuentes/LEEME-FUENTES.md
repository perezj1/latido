# Misterios: contenido de Latido

`misterios.txt` añade una línea por fecha con los doce campos separados por `|` que indica su cabecera. Las líneas vacías y las que empiezan por `#` no se publican. El ejemplo del diseño está comentado y no es contenido aprobado.

Fecha ISO real y única; tipo `monumento`, `silueta`, `palabra`, `personaje` o `tradicion`; imagen `-` o código de cantón. La silueta no puede dar la solución: Latido debe revisarla. Tres pistas, cuatro opciones, exactamente una marcada con `*`, y un dato comprobado. No cambies el orden de las opciones de un misterio publicado.

Límites editoriales: pregunta y pistas hasta 180 caracteres; opciones hasta 100; dato hasta 500. No se admiten campos vacíos, HTML, caracteres de control ni fechas imposibles. Estos límites validan contenido, no son premios ni reglas de juego.

`node herramientas/generar-misterios.js` comprueba sin escribir; `--escribir` genera `data/misterios.json` y la copia privada para el servidor. El banco vacío es válido: un día sin contenido no muestra misterio. Este generador no ejecuta ni modifica los de preguntas y álbum.

El calendario actual cubre del 28-11-2026 al 28-11-2027. Las entradas añadidas
adaptan contenido del banco existente y las siluetas del mapa, por petición de
Latido. Cada línea conserva su origen y el manifiesto
`misterios-calendario-2026-2027.json` conserva su hash. El lote se puede reproducir
con `node herramientas/generar-calendario-misterios.mjs`; no se sobrescribe si
cambia el contenido. Su `--escribir` es una herramienta editorial, no una tarea
diaria automática. Los días posteriores se preparan como un nuevo lote.

Después de validar y compilar, `node scripts/generar-misterios-publicacion.mjs
--salida supabase/NUEVA_PUBLICACION.sql` prepara la inserción privada en Supabase.
No sobrescribe fechas existentes. El servidor selecciona cada día por la hora de
Zúrich: no genera preguntas en el teléfono ni descarga el calendario futuro.
