# Suizamente: revisión completa del banco · 14

Revisión editorial de las **1.619 preguntas únicas** disponibles, considerando el
banco inicial, los 27 territorios y las correcciones publicadas hasta el trivial 13.
Se han revisado enunciados, opciones, soluciones, explicaciones y adecuación del
formato. El banco vigente está en
[suizamente-reviewed.json](../supabase/seed-data/suizamente-reviewed.json), con
respuestas y fuentes; es contenido privado del servidor.

## Una actualización para toda la instalación

En **Supabase → SQL Editor → New query**, ejecuta los siguientes **cuatro archivos
completos, uno por uno y en este orden**:

1. [suizamente_revision_completa_01.sql](../supabase/suizamente_revision_completa_01.sql): esquema, RLS y primeras preguntas; 584 KiB.
2. [suizamente_revision_completa_02.sql](../supabase/suizamente_revision_completa_02.sql): continuación; 584 KiB.
3. [suizamente_revision_completa_03.sql](../supabase/suizamente_revision_completa_03.sql): continuación; 584 KiB.
4. [suizamente_revision_completa_04.sql](../supabase/suizamente_revision_completa_04.sql): resto del banco y catálogo; 587 KiB.

Cada parte incluye su transacción y las entradas de catálogo de sus preguntas.
Puedes usar una consulta nueva para cada archivo; no es necesario mantener la
conexión entre partes. Si una parte falla, corrige el error y repite esa parte.
Puedes repetir las cuatro. El instalador grande `suizamente_revision_completa.sql`
se conserva como referencia y para conexión directa; no hace falta ejecutarlo.

**Si apareció `relation "sz_review_result" does not exist`:** los cuatro archivos
ya están corregidos. Abre de nuevo los archivos locales y reemplaza el texto
antiguo pegado en Supabase. Ejecuta otra vez 01 → 02 → 03 → 04, completos. La
importación usa una llamada atómica sin tablas temporales; puede repetirse también
si una parte anterior llegó a instalarse. La consulta que estaba pegada en el
editor no se actualiza cuando cambian los archivos locales.

La función auxiliar de importación permanece en `suizamente_private`, sin permisos
para `anon` ni `authenticated`; no añade tablas ni una nueva API pública. El error
anterior puede reproducirse al confirmar la creación de una tabla temporal con
`ON COMMIT DROP` antes de usarla: PostgreSQL la elimina al terminar esa transacción.
[Referencia de PostgreSQL](https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-ON-COMMIT).

Las cuatro partes incluyen el esquema vigente, RLS y todo el banco revisado. Sirve
también si no ejecutaste las entregas 11, 12 o 13. Esta revisión sustituye sus
instrucciones de instalación: ejecuta las cuatro partes y utiliza la versión
actual del código. Después de la cuarta, recarga Latido y empieza una etapa nueva.

Las partidas empezadas conservan las preguntas, opciones y soluciones que se les
asignaron. Puedes acabarlas y ver los cambios en la siguiente etapa. Se conservan
XP, mochila, racha, respuestas, etapas, intentos y semanas ya asignadas. Repetir el
SQL no crea versiones adicionales si el contenido ya coincide.

Las preguntas con ediciones propias diferentes de las versiones distribuidas se
conservan. El resultado del SQL agrupa las acciones y devuelve sus identificadores
en `omitted_ids` con `skipped_custom_edit`. Los contenidos que hayan superado su
fecha de revisión se omiten como `skipped_review_due`, para respetar su caducidad
editorial. Las preguntas propias con otros identificadores también se conservan.

Los SQL están preparados localmente; su ejecución en Supabase corresponde al usuario.

## Resultado de la revisión

| Decisión sobre el banco anterior | Preguntas |
|---|---:|
| Mejoradas | 1.027 |
| Conservadas tras revisar | 566 |
| Sustituidas | 26 |
| Total revisado | 1.619 |

Las 26 sustituidas preguntaban por direcciones web cantonales. Se retiran de la
selección de partidas nuevas y se añaden 26 tarjetas visuales de siglas cantonales,
con cuatro nombres de cantón para elegir. Las versiones anteriores siguen
disponibles para las partidas que las tenían asignadas. Por eso el archivo contiene
1.645 identificadores: **1.619 publicados y 26 retirados**.

Los cambios incluyen:

- Afirmaciones directas en los **298 verdaderos/falsos**. Ejemplo:
  «Liechtenstein comparte frontera con Suiza».
- Preguntas breves sobre lugares, sabores, símbolos y tradiciones; se conserva
  el contexto necesario para entender las reglas cantonales y sus excepciones.
- Opciones relacionadas con el tema: cuatro lugares, cuatro alimentos o cuatro
  traducciones plausibles, según la pregunta. Se corrigen incoherencias como
  preguntar por una carne y ofrecer platos completos como respuestas.
- Reconocer un cantón por su escudo o sigla se presenta como Suiza general:
  la etiqueta de procedencia evita dar la respuesta antes de jugar.
- Definiciones de parejas más cortas, conservando su correspondencia. Las
  correcciones visuales muestran las parejas y permiten ampliar el detalle.
- **34 respuestas numéricas** pasan de escritura a cuatro opciones.
- **14 preguntas con una sola traducción o solución** pasan de selección múltiple
  a respuesta directa. Las selecciones múltiples restantes tienen distintas
  cantidades de respuestas válidas.
- Las explicaciones acompañan la respuesta y mantienen sus enlaces de fuente.

El recorrido mantiene la selección cultural prioritaria de la versión 13, la
alternancia de formatos, los repasos y las preguntas prácticas de integración.
La velocidad no cambia los puntos. Los puntos ya ganados por una pregunta se
mantienen asociados a su identificador.

| Formato publicado | Preguntas |
|---|---:|
| Respuesta única | 665 |
| Verdadero/falso | 298 |
| Parejas | 217 |
| Ordenar | 189 |
| Imagen con cuatro opciones | 162 |
| Selección múltiple | 67 |
| Respuesta escrita breve | 20 |
| Elegir la afirmación falsa | 1 |

La escritura queda en torno al **1,2 %** del banco. La cantidad de cada formato en
una partida depende del territorio, la dificultad y el historial del jugador.

## Fuentes y trazabilidad

Las mejoras de redacción conservan las fuentes y las fechas de verificación del
contenido original. Esas fechas identifican el contraste de los hechos; el campo
`editorial_review` identifica separadamente la revisión de lenguaje e interacción
del 18/11/2026. Se mantienen los años, plazos, límites territoriales y supuestos
específicos de las preguntas administrativas.

Las nuevas tarjetas de siglas se contrastaron con la
[tabla del Parlamento suizo](https://ws-old.parlament.ch/cantons).
Las ilustraciones son SVG originales, con descripciones accesibles de las letras.

El [registro completo de decisiones](../supabase/seed-data/suizamente-review-audit.json)
incluye cada identificador revisado, campos modificados, enunciado y opciones
anteriores y posteriores, motivo editorial y fuente. Los archivos de las entregas
01–13 permanecen como material histórico; el banco vigente es `suizamente-reviewed.json`.
No importar ninguno de estos archivos privados desde React.

## Mantenimiento y validación

Las decisiones editoriales están en
`scripts/lib/suizamente-editorial-revision.mjs`. El generador reconstruye el banco,
el registro, el instalador completo y las cuatro partes a partir de las entregas
históricas y esas decisiones:

```sh
npm run suizamente:review
npm run test:suizamente:review
npm run test:suizamente:review:parts
```

La importación compara huellas de los JSONB publicados antes de modificar una
pregunta existente. Usa versiones nuevas para las correcciones, conserva las
versiones ya asignadas y omite cambios de administrador que no reconoce.

Validación local realizada: importación desde el seed inicial y desde la entrega
13, repetición sin duplicados, conservación exacta del estado del jugador y de las
versiones anteriores, respeto a ediciones propias, RLS, reto semanal común y
recorridos completos de las cinco montañas con las tres combinaciones de Suiza
general/cantón. Los recorridos superaron las cimas con los puntos reales del juego.
También se comprobaron partidas en Chromium y WebKit y la compilación de la app.
El corrector del servidor aceptó las soluciones de las **1.619 preguntas
publicadas**, en todos los formatos y con las opciones barajadas.
La instalación en cuatro partes también pasó las pruebas de equivalencia del
banco y catálogo, transacciones independientes, repetición y conservación del
progreso, sesiones, versiones y ediciones propias.
Además se reprodujo el error `42P01` anterior y se validó la instalación corregida
mediante llamadas confirmadas por separado, sin objetos temporales, incluidos
el rechazo de permisos públicos y la reversión atómica ante un error de datos.
