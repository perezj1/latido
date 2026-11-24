# Suizamente: idiomas dentro del recorrido · actualización 15

**Ampliación vigente 16:** [64 ejercicios nuevos y un único SQL pequeño](SUIZAMENTE_EJERCICIOS_IDIOMA.md).
Incluye este selector y las preguntas nuevas. Si ya ejecutaste el 15, puedes
ejecutar directamente el 16.

Antes de la ampliación 16, el banco contenía 369 preguntas clasificadas como idioma. El selector del
recorrido las excluía expresamente, de modo que solo se veían al practicar esa
categoría. Esta actualización integra ejercicios breves durante el juego.

## Instalación existente

Si ya ejecutaste la revisión 14, ejecuta únicamente
[suizamente_actualizacion_idiomas_15.sql](../supabase/suizamente_actualizacion_idiomas_15.sql)
en Supabase → SQL Editor. El archivo mide aproximadamente 16 KiB y no reimporta
preguntas. Después recarga Latido y empieza una etapa nueva. Las partidas
empezadas conservan su selección anterior. Si ya ejecutaste la primera versión
del SQL 15, vuelve a ejecutar este mismo archivo actualizado para incluir las cimas.

Los cuatro instaladores de la revisión completa también incorporan ahora este
selector para instalaciones nuevas. No necesitas volver a ejecutarlos.

## Comportamiento

- Un ejercicio de idioma en cada etapa normal, manteniendo su número total de
  preguntas. La posición cambia y conserva la imagen inicial y la pregunta con premio.
- La práctica libre sin categoría incluye un ejercicio entre sus cinco preguntas.
- Los tests de cima incluyen aproximadamente un 20 % de idioma, repartido durante
  la partida y también presente al repetir una cima en modo práctica:

  | Cima | Total de preguntas | De idioma |
  |---|---:|---:|
  | Uetliberg | 10 | 2 |
  | Rigi | 12 | 2 |
  | Pilatus | 15 | 3 |
  | Eiger | 18 | 3 |
  | Matterhorn | 20 | 4 |

- Traducciones de expresiones, parejas, frases para ordenar y avisos ilustrados:
  se utilizan **300 ejercicios existentes con fuentes**. Las preguntas sobre
  cursos, trámites de integración y política lingüística siguen disponibles en
  la práctica por tema.
- Se prioriza vocabulario aún no visto y el del cantón seleccionado. Con Suiza
  general activa también pueden aparecer ejercicios de otras lenguas suizas,
  identificados como generales. Con solo cantón se respeta la selección local y
  el complemento general disponible del juego.
- No exige escribir. En las etapas normales puedes usar «No lo sé» y continuar
  aunque falles. **En una cima, el idioma cuenta para aprobar igual que cualquier
  pregunta**: acertar suma un acierto y fallar o saltar consume el margen de fallos.
  Se mantienen la cantidad total de preguntas, los aciertos exigidos y la vida extra.
- El idioma mantiene sus reglas de XP individual. En una cima la interfaz lo
  identifica como «Acierto del test», y al aprobar se mantiene el premio de cima.
- Llegadas, repasos del sendero, retos con premio y reto semanal
  conservan sus selecciones sin añadir ejercicios de idioma. La práctica
  específica de idiomas sigue accesible desde Progreso.

La clasificación, las soluciones, fuentes y versiones del banco se conservan.
El cambio actualiza tres funciones privadas y sus permisos; no modifica partidas,
XP, premios, racha, intentos ni progreso ya guardados. Si un banco propio no tiene
ejercicios disponibles, el selector completa la etapa con otras preguntas.

## Validación local

Se probaron los cinco niveles con Zürich, Genève y Ticino: 31 ejercicios en etapas
y 14 en cimas por recorrido, los cuatro formatos y todas las cimas accesibles sin
puntos añadidos. En Zürich se saltaron todos los ejercicios de las etapas normales.
Se verificó además que los errores de idioma pueden suspender una cima, que se
mantiene un intento real por día y que repetir una cima incluye la misma cuota.
También se verificaron las preferencias de procedencia, la práctica libre,
la práctica específica sin XP, las semanas asignadas, la conservación de partidas,
los permisos privados, un banco sin ejercicios disponibles y una cima ya asignada
con el selector anterior. Esa cima conserva sus preguntas y sus reglas originales.

```sh
npm run suizamente:languages
npm run test:suizamente:languages
```

`npm run suizamente:review` también regenera el selector y el SQL pequeño antes
de reconstruir los instaladores completos.
