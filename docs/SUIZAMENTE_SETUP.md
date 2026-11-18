# Suizamente: activar el modo juego

**Ampliación actual 16:** si ya instalaste la revisión 14, ejecuta solo el
[SQL de 64 ejercicios nuevos e idiomas en etapas y cimas](SUIZAMENTE_EJERCICIOS_IDIOMA.md).
Incluye la actualización 15.

**Actualización vigente 14:** [revisión completa del banco e instalación en cuatro SQL](SUIZAMENTE_REVISION_COMPLETA.md). Sustituye las instrucciones de los parches anteriores.

Implementado dentro de Latido, sin commit, push, despliegue ni escrituras en el Supabase remoto.

**Actualización de diseño del 13/11/2026:** se ha contrastado la interfaz con el paquete `Suizamente-para-programador` y sus capturas. Estos ajustes de interfaz no cambian el esquema ni requieren SQL adicional si ya ejecutaste los tres archivos de esta versión. Detalle en [Referencias de diseño](suizamente-design-references.md).

## Acciones manuales necesarias

En **Supabase → SQL Editor → New query**, ejecuta completos estos cuatro archivos,
uno por uno y en este orden:

1. [suizamente_revision_completa_01.sql](../supabase/suizamente_revision_completa_01.sql).
2. [suizamente_revision_completa_02.sql](../supabase/suizamente_revision_completa_02.sql).
3. [suizamente_revision_completa_03.sql](../supabase/suizamente_revision_completa_03.sql).
4. [suizamente_revision_completa_04.sql](../supabase/suizamente_revision_completa_04.sql).

Incluyen API, modo juego, RLS y **1.683 preguntas publicadas**, más 26 retiradas.
Cada archivo es transaccional y repetible; conserva cuentas, XP, niveles, partidas y ediciones
propias del banco. Se aplica también sobre instalaciones anteriores sin repetir
los SQL históricos. [Detalle y registro editorial](SUIZAMENTE_REVISION_COMPLETA.md).

**Los scripts activan RLS**. No hay que activar un interruptor adicional ni crear políticas públicas. `suizamente_private` debe permanecer fuera de los esquemas expuestos de la API. No hacen falta claves nuevas, Edge Functions, tareas cron, buckets ni Realtime: se usa la conexión de Supabase existente.

Después de ejecutar la cuarta parte, recarga Latido. Si conservas una instalación PWA abierta, ciérrala y vuelve a abrirla para cargar la versión nueva.

Comprobación opcional en SQL Editor:

```sql
select count(*) as preguntas from suizamente_private.questions;
-- Banco vigente: 1.709 identificadores, incluidos los 26 retirados.
-- Puede haber más si has creado preguntas propias.

select public.suizamente('summary', '{}'::jsonb)->>'game_version';
-- 4. Sin sesión de jugador no devuelve respuestas ni crea un jugador.
```

## Pantallas y funciones

- **Inicio:** tarjeta Suizamente con racha, montaña y siguiente llegada o etapa; botón para empezar o retomar. **Perfil:** tarjeta Suizómetro bajo la cabecera, con XP, nivel y acceso al progreso privado.
- **Camino `/suizamente`:** paisaje distinto por montaña, sendero con marcas, etapas completadas/actuales/bloqueadas, cambio de montaña y ficha al tocar un nodo. Se abre situado en la etapa actual.
- **Cabecera:** procedencia, racha, XP y mochila. **Barra inferior:** Inicio de Latido, Camino, Reto y Progreso. Durante las preguntas y los resultados se oculta la navegación.
- **Procedencia:** Suiza general y Cantón independientes, ambas activas inicialmente. El cantón inicial es el de la persona autenticada. Los 26 cantones caben en un desplegable. Se impide desactivar ambas opciones. Las partidas empezadas conservan su selección. Si falta contenido local apropiado, se completa con preguntas generales y se informa.
- **Partida:** respuesta inmediata al tocar, salvo selección múltiple, que espera a «Comprobar». Respuesta única, verdadero/falso, afirmación falsa, selección múltiple de hasta cinco opciones, parejas e ilustraciones. «No lo sé», explicaciones, enlaces oficiales, avisos de errores y traducciones de palabras alemanas.
- **Resultado:** XP, aciertos, duración sin bonificar velocidad, premios, avance y revisión de respuestas propias. Celebración de la primera etapa del día. Teclado 1–5, Enter y Escape, foco visible y movimiento reducido. Las hojas modales contienen el foco; la tarjeta flotante de una parada permite seguir explorando el mapa.
- **Progreso `/suizamente/progreso` y `/perfil/suizometro`:** montaña, XP, racha, etapas, mochila, acierto inicial, categorías, filtros de procedencia/dificultad y práctica por tema. También permite repasar errores de los nuevos formatos.
- **Reto `/suizamente/reto`:** diez preguntas generales compartidas semanalmente, diez puntos por acierto, sin XP ni premio por rapidez. Solo se publica alias y resultado si se activa la clasificación. Los empates comparten puesto.

## Montañas y reglas

| Montaña | Etapas | Preguntas por etapa normal | Test | Aciertos necesarios | XP acumulados |
|---|---:|---:|---:|---:|---:|
| Uetliberg | 6 | 5 | 10 | 8 | 150 |
| Rigi | 8 | 6 | 12 | 9 | 400 |
| Pilatus | 10 | 7 | 15 | 11 | 800 |
| Eiger | 12 | 8 | 18 | 14 | 1300 |
| Matterhorn | 15 | 10 | 20 | 16 | 2000 |

Cada montaña empieza con **tres preguntas de llegada** sobre ella. Las 51 etapas incluyen repasos y retos con premio de tres preguntas. Se avanza en orden y se pueden practicar montañas completadas. Las marcas de senderos son una metáfora del juego, no una clasificación ni una recomendación para excursiones reales.

El servidor selecciona dificultad creciente, prioriza el tema de la etapa, errores pendientes y preguntas nuevas, y respeta la procedencia. Las llegadas son sobre su montaña; los tests usan conocimientos generales y el reto semanal mantiene una selección común. El banco inicial se reutiliza: no se anuncian cientos de preguntas únicas por montaña.

**XP:** primer acierto de una pregunta estable: 10 en respuesta normal/verdadero-falso, 15 en selección múltiple/imagen/afirmación falsa y 20 en parejas. Repetir ese acierto no vuelve a pagar, aunque cambie su versión. Completar una etapa nueva añade 5; superar una cima añade 20 una vez. Fallos y «No lo sé» no restan. Alemán opcional sin XP. Las partidas anteriores conservan sus reglas. Los umbrales se configuran en el panel; sus valores iniciales son los de la tabla.

**Mochila:** una pregunta señalada de cada etapa normal puede dar un regalo. Los retos con premio lo dan al acertar las tres; un reto fallado puede repetirse para conseguir el premio pendiente. Cada regalo del sendero se gana una vez, validado en el servidor:

- **XP doble:** se consume al iniciar la próxima etapa nueva elegible. Duplica primeros aciertos y bonus de esa etapa; no duplica aciertos cobrados ni ranking.
- **Vida extra:** se consume al abrir el test real y permite un fallo más. Su efecto queda guardado al recargar.
- **Protector:** cubre un día perdido de una racha existente. Se consume uno por día perdido al completar la siguiente partida; si no alcanza el inventario, empieza una racha nueva.

La etapa se guarda en la pregunta exacta, incluida su explicación y parejas resueltas. El test permite **un intento al día de Suiza**, tras completar etapas y XP. Termina antes si ya no se puede aprobar. Salir mediante su botón cuenta como intento no superado; recargar no cambia respuestas ni recupera vidas. Suspender no resta XP ni etapas.

La racha suma una vez al día con `Europe/Zurich`; solo muestra días realmente jugados o protegidos. El Suizómetro indica aprendizaje dentro del juego, no integración, residencia, naturalización o un nivel oficial de idioma.

**Compatibilidad:** se conservan niveles y XP anteriores. Las montañas inferiores al nivel existente se consideran superadas; se empieza la llegada del nivel actual. Los enlaces de partidas antiguas siguen funcionando. La API anterior de ascenso no permite saltarse etapas del nuevo modo.

## Panel editorial

Abre `/admin-latido?section=suizamente` con tu administrador habitual. Puedes crear/editar los ocho formatos, elegir ilustración, marcar llegadas, publicar, retirar, versionar, anular y revisar avisos. Las partidas asignadas conservan su versión y orden de opciones. Las soluciones de preguntas sin responder no se envían al navegador.

Solo si tu administrador habitual recibe un rechazo del servidor, autorízalo desde SQL Editor:

```sql
insert into suizamente_private.admins (user_id)
select id from auth.users where lower(email) = lower('TU_EMAIL_ADMIN')
on conflict do nothing;
```

Debe mantener también el acceso administrativo habitual de Latido. La escuela de alemán es opcional: configura nombre y URL HTTPS para mostrar un enlace identificado como colaboración al terminar una práctica de alemán. No se comparten respuestas con la escuela.

Cobertura y fuentes: [revisión del banco](suizamente-content-sources.md). Los 26 cantones cuentan con el banco inicial y la ampliación de 50 entradas por cantón; la variedad concreta depende de tema y dificultad. Las futuras cumbres, senderos cantonales e invierno se presentan como ideas aún no disponibles.

## Arrancar y probar

La corrección de todos los verdaderos/falsos del 18 de noviembre funciona al recargar la app, incluso con el servidor anterior; no requiere SQL. La actualización `supabase/suizamente_actualizacion_experiencia_12.sql` sigue disponible para la presentación del servidor y las soluciones estructuradas de parejas. No repetir semillas ni activar RLS de nuevo. Detalles y compatibilidad en [SUIZAMENTE_EXPERIENCIA.md](SUIZAMENTE_EXPERIENCIA.md).

```bash
npm run dev
```

Abre `/suizamente` en la dirección que indique Vite. Prueba los seis formatos sin cuenta; después, con cuenta, comprueba el cantón inicial, completa la llegada, responde una etapa, sal y retómala, consulta mochila/racha y prueba el ranking privado. Una cuenta cooperadora debe tener progreso propio.

```bash
npm run build
npm run lint
npm run test:suizamente
npm run test:suizamente:game
npm run test:suizamente:browser
node scripts/test-suizamente-browser.mjs --webkit
```

Las pruebas usan PostgreSQL local mediante PGlite y navegadores de prueba; no modifican el Supabase remoto. Ejecutan realmente los SQL del juego con sus roles y restricciones.

Tras editar el JSON privado, regenera el seed con `npm run suizamente:seed`. Nunca importes ese JSON en el cliente. La demostración tiene seis ejemplos públicos independientes en `src/data/suizamenteArcadeDemo.js`, sin guardar respuestas en el servidor. El servidor calcula respuestas, premios, intentos, rachas, XP y ascensos.

La ampliación de 1.350 preguntas está completa localmente: **50 de Suiza general y 50 de cada uno de los 26 cantones**, con 135 ilustraciones, revelado progresivo y alternancia de formatos. Detalles, soluciones privadas y fuentes en [suizamente-content/LEEME.md](suizamente-content/LEEME.md). El usuario confirma SQL hasta 10. Ejecutar primero `suizamente_actualizacion_ilustraciones_11.sql` y después `suizamente_expansion_ne_ju_20261117.sql`; recargar el frontend local. No repetir el seed ni los lotes anteriores. El test permite un intento por día natural suizo: desde las 00:00 del día siguiente, conservando XP y etapas.
