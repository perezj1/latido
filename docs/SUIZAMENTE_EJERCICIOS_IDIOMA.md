# Suizamente: 64 ejercicios nuevos de alemán · actualización 16

## Activar en la instalación existente

Ejecuta únicamente
[suizamente_actualizacion_idiomas_16.sql](../supabase/suizamente_actualizacion_idiomas_16.sql)
en Supabase → SQL Editor. Es un archivo pequeño, de aproximadamente 93 KiB.
Incluye el selector de idiomas de la actualización 15: no es necesario ejecutar
ambos ni repetir las cuatro partes de la revisión completa.

Después recarga Latido y empieza una etapa, práctica o test nuevo. Las partidas
ya asignadas conservan sus versiones y respuestas. El SQL puede repetirse y
conserva las ediciones propias del administrador.

## Ejercicios añadidos

| Tarea | Cantidad | Ejemplo |
|---|---:|---|
| Elegir la palabra alemana | 16 | Elige «la llave» en alemán |
| Elegir el significado | 16 | ¿Qué significa «der Schlüssel»? |
| Completar el hueco con una opción | 16 | Completa «Wo ist mein ___?» para decir «¿Dónde está mi llave?» |
| Ordenar fragmentos de una frase | 12 | Wo / ist / mein Schlüssel? |
| Unir parejas | 4 | Palabras de casa, transporte, documentos y compras |

Son ejercicios originales para vocabulario cotidiano: llaves, parada, horarios,
billetes, recibos, documentos, candidaturas, correo, residuos, salario, pedir ayuda
y la compra. Las opciones se barajan y no hay que escribir ninguna respuesta.
Las explicaciones muestran la equivalencia o la frase completa.

Se incluyen fuentes léxicas por pregunta, con fecha de contraste del 18/11/2026:
diccionarios PONS, Langenscheidt y dict.cc, y vocabulario del Goethe-Institut.
Las frases y situaciones son elaboración propia. Las fuentes sustentan el
vocabulario; no se presenta cada frase inventada como una cita del diccionario.
Por ejemplo, se contrastaron [Schlüssel](https://de.pons.com/%C3%BCbersetzung/deutsch-spanisch/Schl%C3%BCssel),
[Lohn](https://de.langenscheidt.com/deutsch-spanisch/lohn) y
[Hilfe en el vocabulario A1](https://www.goethe.de/pro/relaunch/prf/de/A1_SD1_Wortliste_02.pdf).

## Integración

El banco vigente contiene **1.683 preguntas publicadas** y 26 retiradas. Hay
**433 preguntas de la categoría idioma**, de las que **364 son ejercicios
interactivos aptos para el recorrido**. Se mantienen los idiomas y preguntas
anteriores.

Continúa la distribución de la actualización 15: un ejercicio en cada etapa
normal y práctica libre, y 2/2/3/3/4 en las cimas. En las cimas cuentan para
aprobar igual que las demás preguntas. Se mantiene la política existente de XP.

Las variantes de una palabra comparten identificadores de aprendizaje. El
selector evita repetir ese vocabulario dentro de una misma cima o práctica:
una pareja no debe revelar la respuesta de una pregunta posterior. Entre
partidas las variantes permiten repasar la palabra en situaciones distintas.

Los datos con soluciones permanecen en el servidor:
`supabase/seed-data/suizamente-language-exercises.json`. El archivo se integra
también en `suizamente-reviewed.json`, el registro editorial y los cuatro
instaladores para instalaciones nuevas.

## Mantenimiento y pruebas

```sh
npm run suizamente:review
npm run test:suizamente:language:exercises
npm run test:suizamente:languages
npm run test:suizamente:review:parts
```

El corrector evalúa las 64 soluciones con opciones barajadas. Se comprueban la
importación repetible, RLS, ausencia de XP duplicados, las ediciones propias,
las versiones asignadas y el progreso guardado. Las rutas completas comprueban
las cinco cimas y la variedad de formatos. La prueba de navegador usa las cinco
familias de ejercicios a 320, 390 y 1280 píxeles, con corrección y resultados reales.
