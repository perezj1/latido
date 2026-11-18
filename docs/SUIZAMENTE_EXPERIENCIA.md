# Suizamente: claridad y ritmo de juego

**Actualización 13 — trivial:** si ya instalaste el juego, consulta [los dos SQL nuevos y los cambios de jugabilidad](SUIZAMENTE_TRIVIAL.md). No repitas los parches anteriores después de esta actualización.

Actualización local del 18 de noviembre de 2026. El estado previo se guardó y subió únicamente a `latidoCard`, commit `8a0140b`. Los cambios descritos aquí son posteriores a ese commit y quedan locales.

## Qué cambia

- Una tarjeta por pregunta, con categoría reconocible y color discreto. El enunciado ocupa el centro; las instrucciones son breves y las preguntas de selección no repiten «elige tu respuesta».
- Los **296 verdaderos/falsos del banco** están comprobados como afirmaciones. Se corrigen en origen las veinte formulaciones antiguas con «respuesta propuesta», y la app también reformula esas versiones si todavía las devuelve un servidor anterior, sin depender del SQL 12. Ejemplo: «Liechtenstein comparte frontera con Suiza». Debajo se elige verdadero o falso.
- Al unir una pareja equivocada, se resaltan las dos tarjetas y aparece «No encajan. Prueba otra pareja». Cuatro puntos muestran el avance. El margen para considerar acertada la pregunta sigue visible y conserva la regla existente.
- Al terminar las parejas, se muestran primero las asociaciones que costaron intentos. Cada una tiene su propia tarjeta con término y significado. Las cuatro asociaciones completas quedan disponibles en un desplegable.
- Después de contestar, las columnas se ordenan por la correspondencia correcta y se identifican como solución. Así, las filas verdes ya no colocan un término junto a la definición barajada de otro término. Antes de responder se conserva el orden aleatorio.
- La corrección de una pregunta de parejas ya completada usa un tono de repaso. No se confunde haber unido las cuatro al final con haber obtenido un acierto: los fallos y los XP reales siguen siendo los del servidor.
- Las respuestas múltiples se corrigen como lista, en lugar de un párrafo con respuestas pegadas.
- Las explicaciones largas tienen una vista breve con «Ver explicación completa». Se conserva todo el texto, sus matices y la fuente. El botón de continuar permanece visible mientras se consulta una corrección extensa.
- El repaso al final de la ronda muestra también las parejas en tarjetas.

Se conserva la alternancia de formatos, las rondas del camino, las montañas, el reto semanal, el revelado de imágenes de 5 × 5 píxeles durante 20 segundos y las preferencias de movimiento reducido. No se añaden tiempos límite, apuestas, pagos, anuncios ni bonificaciones por responder deprisa.

## Instalar esta mejora

**Para ver las afirmaciones basta con recargar la app: no requiere ejecutar SQL.** La corrección se aplica también a respuestas del servidor anterior, partidas guardadas y repaso final. El editor exige una afirmación para guardar un verdadero/falso.

El archivo **`supabase/suizamente_actualizacion_experiencia_12.sql`** sigue disponible para la presentación en el servidor y las soluciones estructuradas de parejas. Es una actualización de funciones sobre una instalación con Suizamente. No hace falta repetir semillas, ampliaciones ni activar RLS de nuevo para esta corrección de textos.

La actualización 12 es independiente de la ampliación NE/JU del lote 11. Si ese lote sigue pendiente, sus dos archivos mantienen su función y orden propios.

El SQL es transaccional y repetible. No modifica respuestas confirmadas, versiones almacenadas, XP, etapas, inventario ni intentos. El servidor reconoce veinte formulaciones originales, independientemente del identificador y del espaciado. La app reconoce sus estructuras y conserva el valor propuesto recibido, incluso si la afirmación es falsa. Una pregunta editada posteriormente en el panel conserva la redacción del editor. El JSON de presentación permanece en `supabase/seed-data/`, fuera del frontend.

Las soluciones estructuradas de parejas se devuelven después de contestar esa pregunta o en el repaso final. Antes, la columna derecha sigue barajada y no se entrega la correspondencia. La interfaz también admite la respuesta textual del servidor anterior, validándola contra las etiquetas y definiciones de la pregunta.

## Referencias y criterio editorial

Se revisaron fuentes oficiales de [Preguntados: temas y categorías](https://triviacrack.help.etermax.com/hc/en-us/articles/360033522154-Topics), [Duolingo: investigar las dificultades y practicar errores](https://blog.duolingo.com/how-duolingo-works-with-learners/) y [Duolingo: dificultad y práctica de errores](https://blog.duolingo.com/keeping-you-at-the-frontier-of-learning-with-adaptive-lessons/). La adaptación para Latido prioriza una pregunta clara, respuesta inmediata, variedad de temas y repaso útil. Es una decisión de diseño; no se afirma haber medido una mejora de retención en Suizamente.

Para nuevas preguntas:

1. Una sola idea por pregunta. En verdadero/falso, una afirmación completa; sin pregunta más «respuesta propuesta».
2. Preferir frases cortas y ejemplos de la vida real. Conservar cantón, municipio, año o excepción cuando sean necesarios para que la respuesta sea correcta.
3. Cuatro alternativas claras en selección e imagen; en múltiple, indicar que puede haber varias correctas. Evitar distractores ambiguos o distinciones técnicas sin utilidad cotidiana.
4. Explicación breve que enseñe el motivo. Detalles y matices disponibles sin cortar el texto ni cambiar el sentido; fuente accesible al responder.
5. Mezclar cultura, geografía, convivencia, vida diaria e idioma con los trámites necesarios. El Suizómetro sigue siendo aprendizaje dentro del juego.

La reformulación conserva las respuestas y conceptos del banco existente. Se releen federalismo, geografía, instituciones, alquiler, contrato laboral, primas y lenguas en sus fuentes oficiales; la URL de mapas de validez de SBB devuelve 403 y no se presenta como una nueva verificación de sus condiciones. No se cambian tarifas, coberturas, requisitos o fechas de las preguntas existentes.

## Comprobaciones

`node scripts/test-suizamente-experience.mjs` simula la actualización desde la función anterior: verifica los veinte enunciados, partidas abiertas, conservación de versiones y notas, respeto a ediciones del administrador, privacidad de las soluciones y repetición del SQL.

Las pruebas de navegador cubren los dos casos enviados por el usuario, las filas alineadas, los avisos tras fallar, el repaso de la pareja que costó intentos, las cuatro tarjetas completas, la compatibilidad con la API anterior y el botón de continuar visible en 320, 390 y 1280 píxeles.

`node scripts/test-suizamente-statements.mjs` comprueba los 296 enunciados nativos, las veinte formas antiguas sin SQL, ambos órdenes de verdadero/falso, saltos CRLF, partidas guardadas, repaso y que no se cambian respuestas ni tipos de pregunta. Los generadores rechazan nuevos verdaderos/falsos interrogativos. La prueba de navegador obliga al servidor de prueba a devolver el enunciado antiguo de Liechtenstein con otro identificador y verifica que al entrar y recargar se muestra la afirmación correcta.

Regenerar únicamente esta actualización: `node scripts/generate-suizamente-experience-update.mjs`. No regenerar migraciones históricas.
