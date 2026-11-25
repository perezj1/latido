# Fuentes del banco de preguntas

Aquí se escriben las preguntas. `herramientas/generar-preguntas.js` las convierte en `data/preguntas.json`.

```bash
node herramientas/generar-preguntas.js              # prueba: recuentos por modo y tema, y errores
node herramientas/generar-preguntas.js --escribir   # guarda data/preguntas.json
node herramientas/validar-preguntas.js              # valida el resultado
```

Reglas generales de todos los archivos `.txt`:
- Una pregunta (o un elemento) por línea, con los campos separados por `|`.
- Las líneas que empiezan por `#` son comentarios. Las líneas vacías se ignoran.
- Límites: pregunta ≤ 140 caracteres, opción ≤ 90, dato ≤ 300.
- Temas válidos: `comida`, `casa`, `papeles`, `trabajo`, `dinero`, `salud`, `transporte`, `idioma`, `social`,
  `fiestas`, `naturaleza`, `cultura`.
- Estilo: humor amable, trato de tú, lenguaje neutro en género al hablar a quien juega, y un dato real sobre Suiza
  relacionado con la pregunta.

El `id` de cada pregunta sale de su texto. **Si cambias el texto de una pregunta ya publicada, nace una pregunta
nueva** y sus votos empiezan de cero. Cambiar solo el `dato` no cambia el `id`.

## base.json
Las 100 primeras preguntas. No se tocan nunca: sus votos dependen de ellas.

## cuarta-opcion.txt · la cuarta opción de las preguntas antiguas
Las preguntas con respuesta tienen 4 opciones. Las que se escribieron con 3 (en `base.json` y en `manual-*.txt`)
toman la cuarta de aquí, una por línea: `id|opción` (siempre incorrecta). El generador la añade **al final**, sin
cambiar el `id` ni el orden de las que ya había, porque los votos guardan su índice. Las de vocabulario, cantones,
ciudades, fechas, personas e inventos la sacan solas de sus listas. Si falta alguna, el generador lo dice.

## manual-*.txt · preguntas escritas a mano
Tres tipos de línea. Las opciones empiezan con un emoji (en el juego solo se enseña en los dilemas).

```
D|tema|emoji|pregunta|opción 1|opción 2[|opción 3]|dato
R|tema|emoji|pregunta|*opción correcta|opción|opción|opción|dato
V|tema|emoji|afirmación|V o M|dato
```

- `D` = dilema de «¿Qué prefieres?» (sin respuesta correcta).
- El emoji de una pregunta con respuesta no puede ser el de ninguna de sus opciones: daría la respuesta, porque las
  opciones se enseñan sin emoji. Si coincide, el generador lo cambia por uno neutro (el del tema).
- `R` = pregunta con respuesta, con **4 opciones**: la correcta lleva `*` delante. El generador baraja las opciones una
  vez y fija ese orden (en el juego se vuelven a barajar en cada pregunta).
- `V` = «¿Verdad o mito?»: la pregunta queda «¿Verdad o mito? {afirmación}» con las opciones ✅ Verdad y ❌ Mito.
  `V` si la afirmación es verdadera, `M` si es falsa. En los mitos, el dato explica lo que es verdad.
  Procura mantener un reparto parecido de verdades y mitos (ahora 55 % / 45 %), o la gente aprende a contestar siempre lo mismo.

Ejemplos:
```
D|casa|🧺|¿Qué prefieres?|🧺 Lavandería común con turno los martes a las 6:00|🛁 Lavar a mano en la bañera|En muchos edificios la lavandería se usa por turnos.
R|dinero|📱|¿Qué es TWINT?|*📱 Una app suiza para pagar con el móvil|👯 Un baile de Appenzell|🍬 Unos caramelos|🚞 Un tren de montaña|La usan millones de personas en Suiza.
V|transporte|🚇|Zúrich tiene metro.|M|Se mueve con tranvía, autobús y cercanías. La única ciudad suiza con metro es Lausana.
```

Los dilemas y las preguntas manuales entran siempre. Son lo mejor del banco: escribe aquí lo nuevo.

## vocabulario.txt · preguntas de idioma
```
L|palabra|significado|emoji|dato
```
`L` = `DE` (suizo alemán), `FR` (francés de Suiza), `IT` (Tesino) o `RM` (romanche). De cada palabra sale
«En suizo alemán, ¿qué significa «X»?», con otras dos palabras del mismo idioma como distractores. De las
palabras con significado corto sale también «¿Cómo se dice «Y» en suizo alemán?», pero solo entra una muestra
(`TOPE_VOCAB_VUELTA` en el generador) para que el idioma no ocupe demasiado.

## parejas.txt · dilemas automáticos «A o B»
```
categoría|nombre|emoji|dato
```
Categorías: `comida`, `ciudad`, `naturaleza`, `fiesta`, `plan`, `palabra`, `experiencia`, `souvenir`. El generador
empareja cosas de la misma categoría («¿Qué prefieres comer? 🫕 Fondue o 🥔 Raclette») y rellena los dilemas
hasta 1000. `TOPE_PAREJAS` limita cuántas salen de cada categoría para equilibrar los temas.

## Cultura general
| Archivo | Formato | Pregunta que genera |
|---|---|---|
| `cantones.txt` | `código\|nombre\|capital\|emoji\|dato` | Capital de cada cantón (y al revés), si la capital no se llama igual |
| `ciudades.txt` | `ciudad\|código de cantón\|emoji\|dato` | «¿En qué cantón está X?» |
| `fechas.txt` | `año\|emoji\|evento\|dato` | «¿En qué año {evento}?» con años cercanos como distractores |
| `personas.txt` | `fue o es\|nombre\|descripción\|emoji\|dato` | «¿Quién fue X?» con descripciones de otras personas |
| `inventos.txt` | `invento\|emoji\|dato` | «¿Cuál de estos inventos nació en Suiza?» frente a inventos no suizos |

## Prioridades del generador
- Dilemas: `base.json` → `manual D` → parejas por turnos hasta llegar a 1000.
- Preguntas con respuesta: `base.json` → `manual R y V` → vocabulario → ciudades → capitales → fechas → personas →
  inventos → muestra de vocabulario al revés, hasta llegar a 1000.

Si añades preguntas manuales, el banco sigue en 1000 + 1000: salen primero las automáticas del final de la lista.
Para tener más de 1000 de cada, sube `OBJETIVO` en el generador.

## album.txt · cartas del álbum
```
= Nombre de la colección | archivo de fuentes
nombre exacto | rareza (1, 2 o 3)
```
Cada colección tiene 9 cartas sacadas de otro archivo de `fuentes/` (`inventos.txt`, `vocabulario.txt`,
`personas.txt`, `ciudades.txt`, `fechas.txt` o `cantones.txt`): el nombre tiene que coincidir exactamente, y el
emoji y el dato salen de ese archivo. No cambies el orden de una colección publicada (el id de cada carta es
«colección-número»); las nuevas, al final. Después: `node herramientas/generar-album.js --escribir`.
