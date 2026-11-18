# Suizamente: giro hacia el trivial · versión 13

**Documento histórico. La versión vigente es la [revisión completa 14](SUIZAMENTE_REVISION_COMPLETA.md), disponible en cuatro SQL pequeños para el SQL Editor.**

El recorrido da prioridad a descubrir Suiza: lugares, banderas y escudos, sabores,
fiestas, naturaleza y curiosidades. La integración práctica sigue presente entre
las preguntas culturales y en la práctica por categorías.

## Actualizar una instalación existente

Si ya has ejecutado los SQL anteriores, ejecuta **solo estos dos archivos completos,
en este orden**, en el SQL Editor de Supabase:

1. [suizamente_actualizacion_trivial_13.sql](../supabase/suizamente_actualizacion_trivial_13.sql).
2. [suizamente_trivia_preguntas_13.sql](../supabase/suizamente_trivia_preguntas_13.sql).

Después recarga la app y empieza una etapa nueva. Las etapas que ya habías empezado
conservan sus preguntas y sus opciones. No vuelvas a ejecutar parches anteriores
después del 13, porque podrían reinstalar la selección antigua.

La actualización 13 incluye la presentación de afirmaciones y la corrección de
parejas de la 12, además de la lista actual de ilustraciones. No necesitas repetir
la 12. Los paquetes anteriores de preguntas siguen siendo necesarios para tener
todo su contenido; el catálogo 13 solo utiliza preguntas que realmente estén
publicadas. No publica por sí solo preguntas de paquetes que no hayas importado.

**RLS se activa automáticamente** para el catálogo privado. No hace falta exponer
otro esquema, cambiar claves ni activar políticas públicas. No se han ejecutado
estos archivos en tu Supabase remoto.

Ambos archivos son repetibles. Conservan XP, niveles, premios, cuentas, etapas,
intentos y versiones anteriores. El segundo añade 14 preguntas y mejora las
opciones de 26 preguntas mediante nuevas versiones, conservando su respuesta
correcta y su identificador. Si has editado una de esas preguntas en administración,
el importador aborta con `SZ_CONTENT_CONFLICT` para proteger tu edición; no fuerces
la importación ni borres la pregunta.

## Qué cambia al jugar

- Rondas con mayoría cultural: el selector reserva aproximadamente tres de cada
  cuatro posiciones para el trivial y una para vida cotidiana. Prioriza preguntas
  nuevas; repasos, disponibilidad y preferencias pueden variar la proporción.
- Una imagen al comenzar las rondas cuando existe una ilustración elegible. Después
  alterna respuestas, afirmaciones, parejas, selección múltiple y ordenación.
  Se conserva el descubrimiento lento con cuadrados de 5 × 5 píxeles y el botón
  para ver toda la imagen. No hay límite ni premios por rapidez.
- 508 entradas culturales catalogadas, de las que 288 sirven para el descubrimiento
  de Suiza general. Incluyen los 14 nuevos enunciados breves. No son 508 preguntas
  nuevas: se aprovecha el banco existente, con sus fuentes e identificadores.
- 118 enunciados existentes se presentan de forma más directa. Las ilustraciones
  evitan describir en la pregunta todos los rasgos que revelan la solución.
- Las opciones mejoradas comparan elementos de la misma clase: cataratas con
  cataratas, castillos con castillos, quesos con quesos, etc.
- Temas visibles en la tarjeta de pregunta y etapas con nombres de juego:
  «Primera partida», «Postales suizas», «Sabores y sorpresas» o «La gran vuelta».
- La demostración empieza con «¿Dónde está el Rigi?», incluye una bandera y una
  selección múltiple con dos respuestas verdaderas. Sus respuestas no dan XP.
- Los nuevos retos semanales priorizan preguntas culturales de respuesta única,
  comunes a todos. Las semanas ya generadas se conservan.

«Suiza general» incluye cultura y lugares de todo el país: puede aparecer un puente
de Luzern aunque tu cantón sea Zürich. Las normas locales no se reclasifican como
generales. Los contenidos exclusivamente cantonales siguen filtrándose por el
cantón elegido. La procedencia efectiva queda guardada en la partida para que el
chip muestre Suiza general o el cantón correcto.

El Suizómetro mantiene las estadísticas históricas por categoría y territorio de
la pregunta original. Una pregunta cultural de otro cantón mostrada en Suiza
general conserva esa atribución en las estadísticas; el chip de la partida refleja
la selección general. No se recalcula el historial ni se duplica XP por reclasificar.

## Datos y mantenimiento

- Catálogo privado: `supabase/seed-data/suizamente-trivia.json`.
- Edición y generación: `scripts/generate-suizamente-trivia.mjs` y
  `scripts/generate-suizamente-trivia-update.mjs` (`npm run suizamente:trivia`).
- El banco original de 1.350 preguntas y los paquetes históricos no se modifican.
- El catálogo solo aplica un enunciado corto cuando coincide exactamente con el
  texto revisado. Una edición diferente del administrador mantiene su redacción.
- Las 14 preguntas nuevas tienen fuentes oficiales revisadas el 18/11/2026:
  DFAE, Suiza Turismo y Rigi Plus. Las reutilizadas conservan sus fuentes y fechas
  originales; no se presenta su reutilización como una nueva verificación externa.
- El cliente solo recibe la pregunta actual y su información de presentación.
  El catálogo, las soluciones y las nuevas preguntas puntuables permanecen en el
  servidor. La demostración pública es una muestra independiente.

## Verificación

`npm run test:suizamente:trivia` comprueba importación repetible, protección de
sesiones, RLS, fuentes, índices correctos y tres recorridos completos: general,
cantón y ambos. Comprueba mayoría cultural, variedad, los cinco tests y alcanzar
los XP de cada cima sin sesiones adicionales cuando se acierta todo. También
comprueba que el reto semanal sea común y cultural.

La revisión visual se ejecuta con
`node scripts/test-suizamente-browser.mjs --trivia-only` (añade `--webkit` para
WebKit). El resto de pruebas conserva la cobertura del banco anterior, seguridad,
versiones, premios, errores, reanudación y administración.
