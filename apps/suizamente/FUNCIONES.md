# Suizamente independiente: decisiones de presentación y acceso

Estas decisiones actualizan la especificación de Suizamente por petición expresa.
No cambian las reglas, los precios ni los premios del juego.

- **Sesión persistente:** Supabase guarda y renueva la sesión entre aperturas y pestañas.
  Sin sesión aparecen Crear cuenta gratis, Ya tengo cuenta, Entrar con Google y
  Conectar con tu cuenta de Latido. La bienvenida se hace después del login;
  el perfil se completa después del regalo si todavía no existe.
- **Identidad:** Latido aporta el nombre y la foto inicial, mediante lectura del
  perfil y el mismo acceso de Supabase, dentro de Suizamente. Un apodo o foto ya elegidos en Suizamente se
  conservan. Los cambios se guardan solo en el juego; no editan el perfil de Latido.
- **Foto:** botón de cámara accesible junto al avatar, selección de galería/cámara
  según el dispositivo, vista previa y guardado al confirmar el formulario. Recorte
  cuadrado de 512 px, JPEG sin metadatos; originales de hasta 10 MB, JPEG final de
  menos de 200 KB. Archivos únicos en `suizamente-avatars/{usuario}/`; permisos por
  propietario y URL en `ajustes.foto_url` del jugador. Si falla una imagen sigue
  disponible la inicial del apodo. Las fotos son públicas, como los avatares.
- **Apariencia:** siempre clara, incluso con ajustes antiguos o sistema oscuro.
  El selector de tema no se muestra. Sonidos, vibración y menos animaciones siguen
  siendo ajustables.
- **Barra inferior:** estilo de la píldora de Latido copiado en componentes propios:
  64 px, radio de 30 px, tres sombras, márgenes de 12 px y 10 px más área segura,
  máximo de 430 px; Inicio central de 54 px con aro de colores y logo de 30 px.
  Texto de 11 px con contraste AA, áreas táctiles de al menos 44 px, foco visible y
  sin transiciones con menos animaciones. Conserva rutas. El espacio transparente
  superior deja pasar los toques.
- **Publicación:** las ramas `suizamente` y `suizamente-social` publican esta app de
  `apps/suizamente`; no se fusionan con `main` ni requieren modificar Latido.

## Dinámica, ataques y PWA

- Tres aciertos normales abren directamente la elección de un sello que falte.
  Hay que acertar una pregunta de su categoría para ganarlo; la barra vuelve a cero.
  La casilla de sello y el duelo conservan sus reglas. Gana quien completa los seis.
- La ruleta se gira pulsando sus sectores o su centro, con acceso por teclado en el
  centro. Se elimina el botón de giro independiente. Los resultados tienen
  «Continuar», que vuelve a la ruleta sin girarla automáticamente.
- La navegación inferior se reserva a las pantallas del menú y se oculta durante
  toda la partida, incluidas ruleta, elección de sello, preguntas, respuestas,
  resultado final y ataque. Sobre Inicio, un contador rojo muestra las partidas
  con rival, en estado `jugando`, en las que te toca. No cuenta búsquedas pendientes.
- Tras una victoria, «Atacar» sustituye a «Revancha». Se muestran los cantones
  construidos del rival; las regiones completas siguen protegidas. Una victoria
  permite un solo ataque; se conserva el límite diario configurado.
- El ataque consta de `asaltos.preguntasTrasVictoria` preguntas (5 por defecto),
  elegidas por el servidor y sin repetir dentro del ataque. Solo cinco aciertos
  lo completan. Un fallo definitivo o el tiempo agotado no roba monedas, no baja
  niveles y no consume escudos. Los comodines compatibles siguen disponibles.
- **Regla aclarada por el usuario:** el cantón baja un nivel incluso con escudo.
  Se transfieren hasta 100 monedas de la víctima al atacante; si tiene un escudo,
  se usa uno automáticamente y el robo se reduce a hasta 70. La transferencia se
  limita al saldo disponible para evitar monedas negativas. El premio y el daño se
  registran en la misma transacción y no se pueden repetir. Los valores nominales
  se leen de `asaltos.premio` y `asaltos.premioConEscudo`.
- Los nuevos asaltos se ofrecen tras ganar (`asaltos.momento = victoria`). Los
  asaltos antiguos ya guardados mantienen su funcionamiento para poder terminarlos.
- El mapa permite desplazarse por la página con el dedo. «Mover», abajo a la
  derecha, activa giro y zoom; «Bloquear» los desactiva. Se retiran «?» y la pastilla
  «Gira, amplía y toca». Se conserva «Toda Suiza» al elegir un cantón.
- El aviso de instalación aparece en una visita nueva y vuelve después de confirmar
  el perfil con «¡A jugar!», aunque se hubiera cerrado. No aparece dentro de la PWA
  instalada ni durante una partida. En iPhone ofrece la guía de Safari:
  [Compartir y Añadir a pantalla de inicio](https://support.apple.com/es-es/guide/iphone/iphea86e5236/ios).
- Se reintenta una lectura si iOS pierde la conexión al reanudar la PWA; las
  mutaciones no se repiten automáticamente. Un acceso correcto a la API retira
  el aviso de conexión antiguo. La partida se actualiza al volver a primer plano.

## Fotos compartidas y guía de instalación

- Todas las fotos se recortan visualmente en círculo, también en el formulario de
  perfil, las listas y las partidas. El archivo JPEG sigue siendo cuadrado para
  mantener el formato de subida existente.
- «¡A jugar!» y «Guardar cambios» van después de todos los campos del perfil, en
  el flujo de la página. Hay que llegar a ellos haciendo scroll; no flotan sobre
  el cantón ni los años en Suiza.
- Los avatares se asocian al id de la cuenta, nunca al apodo. La API proporciona
  únicamente las URLs públicas de las personas presentes en cada respuesta, en
  `avatares`. Se prefiere la foto elegida en Suizamente; después, la de Latido y,
  por último, la del proveedor de acceso. Sin foto válida se muestra la inicial.
  Esto se aplica también al rival, amigos, búsquedas, perfiles, rankings, ligas,
  duelos, asaltos y los listados de administración que contienen avatares.
- El banner de instalación flota abajo, con el estilo del banner de Latido y
  contenido adaptado a Suizamente: instalación gratuita, desde el navegador y sin
  App Store ni Google Play, «Instalar» y «Ahora no». Reserva espacio al final de
  la página y se coloca por encima de la navegación cuando está visible.
- En iOS, «Ver vídeo» despliega el reproductor; «Ocultar vídeo» lo retira. Usa una
  copia propia de `install-ios.mp4`, ya existente en Latido, con controles y
  reproducción dentro de la página. No descarga el vídeo antes de desplegarlo.
  Una nota aclara que el ejemplo muestra Latido y que los pasos se hacen sin salir
  de Suizamente. Se conserva la guía textual y el comportamiento de mostrar el
  aviso al entrar y después de «¡A jugar!», salvo en la app ya abierta como PWA.

## Aspecto de la partida y fondos de Latido

- `LatidoBackdrop` reutiliza los SVG originales `ESCENA` y `DECO` del prototipo,
  copiados sin cambios. Fondo blanco roto `#FBF9F6`, tinte radial superior y escena
  inferior, sin interacción ni contenido accesible. Cada pantalla aísla sus capas
  y mantiene un ancho máximo de 430 px.
- Partida usa el tinte cielo y los dibujos laterales; elegir sello, victoria,
  cofre y asalto usan naranja; derrota y sobre, azul; preparar duelo, rojo;
  resultado del duelo, verde o rojo. La selección del cantón para atacar comparte
  el fondo naranja del asalto. Vuelta completa usa el tinte de la siguiente
  vuelta definido en la configuración. Las tarjetas son blancas y los pies
  transparentes siguen al contenido, sin cubrirlo aunque haya que hacer scroll.
- `MatchWheel` mantiene fija la geometría, con sello arriba, arco de aciertos,
  bombillas y botón central con aro de colores. Solo anima la luz, en sentido
  horario, con frenado y dos parpadeos. Se detiene siempre en la casilla de la API;
  el tiempo de giro sigue viniendo de `ruleta.duracionGiroMs`. Con «Menos
  animaciones» o la preferencia del sistema se ilumina directamente el destino.
- Mientras gira, el botón queda desactivado. Durante el turno del rival se
  sustituye por el logo sin botón. Los cuatro comodines inferiores son indicadores
  de inventario de 32 px; se siguen activando exclusivamente dentro de la pregunta.
- Estos cambios son de presentación: no modifican API, SQL, reglas ni premios.

## Ataque aplazado, carga y avisos breves

- Tras ganar la partida completa se muestran «Atacar ahora» y «Atacar después».
  La segunda opción abre Inicio con las partidas terminadas (`?terminadas=1`).
  Cada victoria mantiene su enlace «Atacar», incluso tras cerrar y volver a
  entrar. Aplazar no crea un asalto ni consume la oportunidad: se utiliza la
  victoria que ya guarda el servidor y sus límites actuales, sin nuevos premios.
- Las pantallas de partida, tienda, álbum, mapa, comunidad y administración se
  cargan por separado. Inicio y la entrada conservan sus componentes comunes.
  Se elimina la espera de apertura para quien ya tiene un perfil.
- La PWA instala solo los recursos de entrada. Las pantallas, fuentes y geometría
  del mapa se guardan al utilizarlas; nunca se cachean respuestas de la API ni
  rutas de autenticación. La caché se renueva con cada compilación.
- Las lecturas repetidas de configuración y resúmenes usan una caché breve en
  memoria, separada por cuenta. Las acciones la invalidan. Las partidas concretas,
  las preguntas y sus tiempos siempre se consultan en el servidor.
- Un fallo temporal de conexión o de pasarela reintenta una lectura una vez. Las
  acciones no se repiten automáticamente. Se retira el aviso amarillo global que
  interrumpía la pantalla por un fallo de actualización en segundo plano. Si ya
  había datos, los resúmenes los conservan mientras se recupera la conexión; una
  carga inicial fallida mantiene su opción de reintento.
- Los errores de acciones, incluido saldo insuficiente, aparecen arriba en un
  aviso blanco con borde rojo durante 4,5 s y se anuncian al lector de pantalla.
  Las confirmaciones breves duran 3,5 s. No desplazan el contenido ni la barra.
- «Mover» solo activa o bloquea los gestos del mapa: dedo, ratón y rueda. No
  despliega otros botones. Se retira el crédito visible bajo el mapa y se conserva
  en la ayuda y en los archivos originales.
- El mapa plano aparece mientras carga la maqueta. Las miniaturas y vistas de
  niveles fuera de pantalla no crean un renderer 3D. Las miniaturas animan hasta
  20 fps; Inicio y el mapa bloqueado, 30 fps; al manipularlo, hasta 60 fps. Se
  reducen la resolución de sombras y el coste de renderizado en móvil.

## Momentos (23.17 de la referencia)

- `v2/Moment.jsx` recibe pasos y una función de cierre. `MomentProvider` mantiene
  una cola por cuenta y evita duplicados por identificador. La capa ocupa toda la
  ventana por encima de la navegación, hace inerte el fondo y contiene el foco.
  Tocar, Intro o espacio avanzan; Escape y «Omitir» terminan la presentación.
- `moment.css` conserva los keyframes de `CSS_MOMENTO`: rayos, destellos,
  apertura, fichas, cartas, confeti y pérdidas. Las dos preferencias de menos
  animaciones desactivan todo movimiento. En pantallas estrechas las fichas y
  cartas se ajustan; en pantallas bajas o con muchos avisos el contenido desplaza.
- Inicio presenta primero los avisos de ausencia sin leer y los duelos cuyo
  resultado sigue sin ver en el servidor; después, el regalo diario disponible.
  La Tienda utiliza la misma apertura. Los avisos antiguos que solo contienen
  texto se enseñan tal como llegan, sin inventar cantidades ni apodos.
- El regalo y los cofres se cobran mediante las operaciones existentes antes de
  presentar sus pasos. El sobre ya adjudica todas las cartas y compensaciones al
  abrirse: se reutiliza `girar` para revelar sus resultados guardados antes de
  animarlos. Omitir, recargar o cerrar no altera lo cobrado. Un sobre parcialmente
  revelado se retoma en el servidor, sin abrir otro ni repetir premios.
- Después de la respuesta se presenta el sello; el duelo lleva a su resultado,
  el asalto a la partida y el final de partida a su resumen. Un duelo que completa
  el pasaporte presenta primero el duelo, su resultado y después la victoria.
  Se usan los premios devueltos, el inventario entregado y la configuración del
  servidor; no se cambian reglas, precios, API ni SQL. No hay migraciones.
- Los avisos de ausencia se marcan al cerrar mediante `novedades/leer`; los duelos
  usan su operación existente `continuar`. `momentReads.js` conserva por cuenta
  las lecturas pendientes si falla la conexión y las reenvía al volver, recuperar
  el foco o reconectar. «Omitir» siempre puede cerrar sin esperar a la red.
  Los recibos locales de presentación de sello, duelo y fin evitan repetirlos al
  recargar; no representan premios ni sustituyen los avisos leídos del servidor.
- Prueba: `npm run test:moments` (Chromium y WebKit, React y SQL real temporal).
  Incluye todos los momentos en 320, 390 y 1440 px, 320 × 568, teclado, árbol
  accesible, preferencias de movimiento, cola simultánea, recargas y recuperación
  de lecturas. Las capturas y tres comparaciones con `pantallas.html` quedan en
  `output/momentos/{chromium,webkit}/comparacion.html` y `comparacion.png`.
  La referencia se busca en `../../../latido/suizamente`; se puede indicar otra
  carpeta con `SUIZAMENTE_DESIGN_ROOT`. Queda la escucha manual con NVDA/VoiceOver.

## Compartir «Mi Suiza» y los Momentos (13, 23.8, 23.10 y 23.17)

- `story.js` amplía el motor Canvas con `mapa` y `logro`, conserva las funciones
  anteriores y exporta `dibujar`, `png` y `compartir`. Los ocho ejemplos coinciden
  píxel a píxel con `disenos/imagenes-compartir.js`, incluido el de pregunta.
  El motor se carga cuando se utiliza, no al abrir Inicio.
- El mapa tiene el botón «Compartir mi Suiza» o «Compartir {cantón}». Captura la
  vista actual a densidad ×3 tras terminar sus animaciones y restaura después el
  renderer. Sin WebGL, genera el mapa SVG con ajuste «contener».
- `ShareImage` presenta el canvas de 1080 × 1920 y el interruptor accesible
  «Poner mi apodo», apagado al abrir. El apodo modifica únicamente el titular si
  se activa. La vista previa se prepara en otro canvas para evitar resultados
  antiguos al alternar rápidamente el interruptor. Compartir utiliza el archivo
  ya preparado para conservar la activación del gesto en móviles; en escritorio
  se descarga. «Guardar la imagen» siempre descarga el PNG.
- `WorldMap` permite capturar la vista y esperar al final real de su animación.
  Al confirmar el servidor el nivel máximo, `MomentoCanton` muestra su maqueta y
  monumento; no concede premios. Si termina una región o la vuelta, su cofre o
  resumen se abre después. La imagen de vuelta se crea en una maqueta temporal
  con todos los cantones completos y el color de la vuelta terminada; se destruye
  después de capturarla, aunque la vista actual muestre ya la vuelta siguiente.
- Los Momentos de victoria, duelo ganado, carta nueva de tres estrellas, colección
  y cantón incluyen un botón que comparte directamente, sin apodo. Tocar el botón
  o pulsar Intro cuando tiene el foco no cierra ni avanza el Momento.
- v19 añade `coleccionesCompletadas` a la respuesta del sobre, con sus nueve
  cartas y el premio realmente entregado del libro de movimientos, incluidos los
  escudos limitados por inventario. Guarda una instantánea por sobre. Reutiliza
  íntegramente el cobro existente: no cambia reglas, premios, costes ni puntos.
  Cada colección recién cobrada añade un paso al Momento del sobre y no se repite
  al abrir otro. Los sobres antiguos conservan una lista vacía.
- Ninguna imagen contiene datos del rival. El apodo propio solo aparece mediante
  el interruptor; los emails se excluyen. El pie y los textos usan el dominio
  canónico `https://suizamente.latido.ch`. Compartir no concede nada ni envía
  peticiones de escritura a la API. Los porcentajes requieren al menos 20 votos.
- `npm run test:sharing` ejecuta SQL y navegadores Chromium/WebKit. Prueba captura
  ×3, privacidad, interruptor, PNG móvil/descarga, respaldo SVG, cola tras región,
  colección cobrada una vez y el botón de Momento con ratón y teclado. Las capturas
  en 320, 390 y escritorio, tres imágenes comparadas y `MomentoCanton` quedan en
  `output/compartir/<navegador>/comparacion.html`. La escucha manual en un lector
  de pantalla y la hoja nativa en dispositivos físicos siguen siendo comprobación
  manual; el árbol accesible y la llamada con archivo están cubiertos por pruebas.

## Navegación, recarga y Atrás (25 de noviembre de 2026)

- Recargar conserva la URL, sus parámetros y la cuenta elegida en la misma pestaña. No vuelve al acceso, al formulario de perfil ni a Inicio. Una partida vuelve a cargar su estado del servidor en su misma URL.
- La identidad depende de la sesión persistida y validada por Supabase. No requiere una elección adicional por pestaña. Una nueva pestaña o apertura conserva la cuenta y la ruta; cerrar sesión elimina el acceso.
- Las flechas «Volver» recorren el historial real. El destino declarado en la pantalla queda como alternativa si no hay historial interno.
- Un enlace directo tiene Inicio debajo de él. Recargar no añade más entradas.
- Los pasos de bienvenida se reflejan en el parámetro `paso` de la URL: recargar conserva el paso y Atrás vuelve al paso anterior.
- Al terminar el acceso y guardar el perfil se retiran del recorrido de Atrás los pasos de acceso/perfil. El destino solicitado queda encima de Inicio.
- Ese ajuste interno no monta Inicio cuando el destino es otra pantalla, por lo que no activa su regalo diario ni sus momentos de llegada.
- Al tocar Inicio se vuelve a la raíz del historial interno. Atrás desde ahí permite salir mediante la navegación nativa; no recorre las pestañas anteriores ni vuelve al acceso. No se captura ese Atrás para mantener la app abierta.
- El cierre de la ventana y el retorno al sistema dependen del navegador y del modo instalado. La web no intenta forzar el cierre de una pestaña normal: [restricciones de Window.close](https://developer.mozilla.org/en-US/docs/Web/API/Window/close).

Implementación: `game/entry.jsx`, `game/navigation.jsx`, `game/main.jsx`, `Account.jsx`, `Shared.jsx`, `Onboarding.jsx` y la limpieza de URL de `game/src/pages/Auth.jsx`. No cambia API, datos de juego ni migraciones.

Pruebas desde esta carpeta:

```sh
npm run test:navigation
npm run test:entry
npm run build
node scripts/test-suizamente-delivery.mjs
```

La prueba de navegación usa Chromium/WebKit con PostgreSQL temporal: recarga repetida, URL/parámetros/historial intactos, partida activa, flecha y Atrás del navegador, salida a un documento externo desde Inicio, enlaces directos, cuenta distinta, pestaña nueva y cierre de sesión. No escribe en producción. Resultados en `output/navegacion/`.

La salida del contenedor instalado debe comprobarse también con el botón o gesto de Atrás de Android en un dispositivo físico; una pestaña de escritorio no reproduce ese contenedor.

## Cuatro opciones en preguntas con respuesta (25 de noviembre de 2026)

- Se importa el banco revisado: 631 preguntas pasan de tres a cuatro opciones, añadiendo únicamente la última; las 369 de Verdad · Mito conservan dos. Los dilemas conservan dos o tres. Se actualizan los 419 emojis neutros de pregunta, sin reordenar opciones ni cambiar `correcta`.
- El servidor guarda una permutación nueva al enviar cada pregunta normal, de sello, duelo, asalto o práctica. Verdad · Mito conserva `[0,1]`. Recargar devuelve el mismo orden. En preguntas nuevas, `indice` es la posición visible; el servidor la traduce al índice original antes de guardar votos e intentos y devuelve resultados y descartadas en posiciones visibles. No se expone el índice original ni el emoji de opción. Las preguntas ya enviadas conservan su contrato anterior mediante una marca interna; los votos y porcentajes mantienen siempre sus índices originales.
- Una pregunta de partida ya enviada conserva su instantánea anterior, sus tres opciones si las tenía y su plazo. La migración no reescribe preguntas en curso, votos ni resultados.
- `QuestionOptions.jsx` comparte el aspecto de pregunta y resultado: sin emoji de opción, texto centrado, ✓/✕ en círculo a la izquierda y prefijos ocultos «Correcta: …» / «Tu respuesta, incorrecta: …». Los dilemas conservan sus emojis.
- La antigua clave `soloConTresOpciones` conserva su nombre por compatibilidad: excluye preguntas con menos de tres opciones. Quita una elimina una incorrecta de las tres disponibles; Otra oportunidad mantiene el primer voto original y permite el segundo intento. No cambian sus precios ni efectos.
- Las propuestas Con respuesta requieren cuatro textos y una correcta entre 0 y 3; sus opciones no muestran editor de emoji. La moderación y valoración usan el mismo componente. Los dilemas siguen admitiendo dos o tres opciones.
- Se copian banco y esquema a `server/suizamente/data/` y `public/suizamente/data/`. `juego.json` incorpora la nueva pregunta de `primeraVez`; se conservan las reglas de asaltos y logros ya desplegadas, porque el archivo de referencia contenía cambios ajenos a esta entrega. v22 retira el abanico y sus ejemplos de la bienvenida.
- El juego base de Latido también utiliza cuatro opciones, orden aleatorio salvo Verdad · Mito, color rojo para `.o4`, teclas 1–4 y textos de respuesta/compartir sin emoji de opción. Su catálogo de votos y sus propuestas sociales se amplían sin borrar votos.

Migración: `supabase/suizamente_v21_cuatro_opciones.sql`, generada desde `suizamente_v21_cuatro_opciones.sql.in` y el banco revisado con `node scripts/sync-cuatro-opciones.mjs <carpeta de referencia>`. Comprueba prefijos de opciones y respuestas originales antes de actualizar y cancela toda la transacción si encuentra diferencias incompatibles. Puede repetirse. No altera reglas, premios ni tiempos.

Archivos: `QuestionOptions.jsx`, `answers.css`, `Raid.jsx`, `Duels.jsx`, `Community.jsx`, `Admin.jsx`, `community.css`, `Onboarding.jsx`, `onboarding.css` (práctica centrada y sin emoji de opción); banco/esquema/configuración; migración y generador; catálogo, validación y SQL del juego base; `public/suizamente/juego.js`, `juego.html`, `experiencia.js`; pruebas y ayudantes de la vista local.

Pruebas desde esta carpeta:

```sh
npm run test:four-options
node scripts/test-suizamente-onboarding-browser.mjs --functional-only
npm run build
node scripts/test-suizamente-delivery.mjs
```

La validación de la referencia se ejecuta con `node herramientas/validar-preguntas.js`; la copia del repositorio, con `node scripts/validar-suizamente.cjs` desde la raíz. Capturas de pregunta/acierto/fallo en 320, 390, escritorio y 375 × 667, con comparación frente a `pantallas.html`, en `output/cuatro-opciones/<navegador>/comparacion.html`. Se verifican lectura accesible, índices correctos e incorrectos, umbral de porcentajes, comodines, orden variable, Verdad · Mito fijo, propuestas y conservación de votos/instantáneas/recompensas. Queda la revisión manual con lector de pantalla y dispositivos físicos.

## Primera vez: tres pasos (sección 22, 25 de noviembre de 2026)

Se sustituye la bienvenida de cinco pasos por tres, conservando los componentes de partida y el cobro existente:

1. Pregunta real de `primeraVez.pregunta` (`r_s5o1xw`), cuatro opciones barajadas por el servidor y sin tiempo. Título «¿Cuánto sabes de Suiza?» y «Ahora no». Respondida: «¡Correcto! 🎉» o «¡Casi!», dato y foco en el título. No produce votos, premios ni porcentajes y se excluye de las partidas.
2. «Gana los 6 sellos»: el mismo `MatchWheel` de la partida al 75 %, barra 2/3 y pasaporte 4/6.
3. «Construye tu Suiza»: Lucerna en un marco de 300 × 300, niveles 1 → 2 → 3 cada 1,5 s y pausa de 3 s en el monumento. «🎁 Abrir mi regalo» abre los dos pasos existentes de `Moment` y `welcomeSteps`. También los abre «Saltar» desde los pasos anteriores. La maqueta se desmonta al abrir el regalo o salir del paso. Se conserva su motor 3D, confeti y destrucción de recursos. Con menos animaciones permanece en el nivel 3; sin WebGL hay una silueta centrada.

Fondo del juego, tres rayitas accesibles «Paso n de 3», contenido centrado horizontal y verticalmente, sin etiquetas ni abanico. En pantallas bajas se aplican las proporciones compactas de la referencia. La URL conserva el paso al recargar y Atrás vuelve al anterior; los enlaces antiguos a pasos 4/5 llegan al último paso disponible. Se conserva el avance por deslizamiento.

El regalo utiliza `recompensas.bienvenida`, mediante su configuración pública. El servidor lo entrega una sola vez con `motivo=bienvenida`; sin perfil queda pendiente hasta guardarlo. Omitir o recargar no vuelve a cobrarlo. Desde Ajustes se muestra «✓ Listo» y no hay regalo. Las dos pistas existentes conservan sus textos, `role="note"`, temporizador activo y eliminación transaccional al girar/responder; cuando se consumen ambas desaparece `ajustes.guia`.

Migración nueva: `supabase/suizamente_v22_onboarding_tres.sql`, después de v21. Retira `primeraVez.ejemplos` de la configuración y su consulta/campo de la API; conserva intentos anteriores, orden, votos, movimientos y marcas. No cambia reglas, premios ni precios. Las migraciones históricas conservan su secuencia; el generador de v21 ya no reincorpora ejemplos. El banco, el esquema y `juego.json` ya estaban actualizados en la entrega de cuatro opciones.

Archivos: `Onboarding.jsx`, `onboarding.css`, migración v22, `sync-cuatro-opciones.mjs` y SQL regenerado de v21, ayudantes de base/vista de pruebas, `test-suizamente-v22.mjs`, pruebas de bienvenida/navegación/entrada y `package.json`. `MatchWheel`, `WorldMap`, `Moment`, `moments` y la partida se reutilizan.

Pruebas: `npm run test:first-visit`, `npm run test:navigation`, `npm run test:entry`, `npm run test:four-options`, `npm run build` y `node scripts/test-suizamente-delivery.mjs`. SQL temporal comprueba ausencia de respuestas anticipadas, práctica sin premios/votos, adopción de sesión firmada, exclusión, regalo único y pistas. Chromium/WebKit comprueban los tres pasos sin scroll a 390 × 844, 320 × 700, 375 × 667 y escritorio; corrección, foco, salto, movimiento reducido, ciclo de Lucerna, desmontaje y alternativa sin WebGL. Capturas de pasos, respuesta, regalo y dos pistas, junto a sus referencias, en `output/primera-vez/<navegador>/comparacion.html` y `comparacion.png`. Queda la escucha manual con NVDA/VoiceOver y la revisión en dispositivos físicos.

## Pantallas pequeñas (23.18)

`compact.css` centraliza las variables normales y una sola regla `@media(max-height:760px)` con las medidas de la tabla. Sustituye los ajustes parciales de altura de `answers.css`, `onboarding.css` y `moment.css`; las reglas de anchura y las de acceso siguen siendo independientes. Las medidas de pantallas normales se conservan.

- Pregunta: banda de 10 px, icono de 38 px, título de 18 px; caja sin mínimo, emoji de 36 px, pregunta de 19 px; opciones de 48 px con 8 px de separación y círculos de comodines de 44 px. La pista mantiene su texto y cabe junto a las cuatro opciones. Se reduce únicamente el espacio exterior cuando está presente.
- Ruleta: 296 px, o 214 px con la pista; avatares de 50 px, barra, jugadores y comodines completos.
- Respuesta: opciones de 44 px; guardar, reportar y compartir pasan a iconos de 32 px con nombres accesibles, junto al título del dato. Se oculta su presentación anterior en la pantalla baja. El usuario confirmó conservar estas acciones: no se añaden valoraciones 👍/👎 ni endpoints. Un dato largo hace scroll en el contenido y el pie queda visible. Compartir reutiliza la hoja existente.
- Onboarding: escenario de 330 px, rueda al 60 %, maqueta de 250 px y opciones de 44 px. Mismo flujo, textos y accesibilidad.
- Mapa: maqueta de 205 px; tarjetas sobre la navegación. Al enfocar un cantón se compactan también el botón de construcción y las miniaturas para conservar ambos controles en pantalla. Los SVG de Inicio usan el ancho de su caja, con máximo.
- Duelo, fin de partida, cofre, sobre, vuelta y vista previa de compartir reducen espacios, conservando sus botones y contenido. Los momentos caben sin scroll en 375 × 667. La escena inferior se identifica en `LatidoBackdrop` y se oculta solo con la regla de pantalla baja; se mantienen los iconos laterales.

Archivos de producto: `compact.css`, `SuizamenteApp.jsx`, `LatidoBackdrop.jsx`, `Duels.jsx`, `Sharing.jsx`, `answers.css`, `onboarding.css`, `moment.css`. Pruebas: `scripts/test-suizamente-small-browser.mjs`, `scripts/test-suizamente-moments-browser.mjs`, `scripts/fixtures/suizamente-normal-390-{chromium,webkit}.json`, `package.json` y este documento. Sin migraciones, cambios en API, datos, reglas, textos, premios ni precios.

`npm run test:small` usa React y PostgreSQL temporal. Captura las 12 pantallas del grupo 12 en 375 × 667 junto a su referencia; verifica geometría normal contra la versión previa (390 × 844), ausencia de desbordamiento horizontal en 320 × 568, selección de sello, resultado del duelo, cofre, sobre, cantón enfocado, preguntas largas y los iconos accesibles. Comprueba el banco revisado con cuatro opciones y la pista, sin emitir votos. El dato largo permite scroll con el pie visible. `node scripts/test-suizamente-moments-browser.mjs --small --webkit` amplía los momentos a WebKit. `test:first-visit`, `test:four-options`, build y entrega completan la regresión.

Capturas y resultados: `output/pantallas-bajas/{chromium,webkit}/comparacion.html`, `comparacion.png` y `resultado.json`. Las capturas normales anteriores sirven como base de geometría; no se regeneran para aceptar un cambio de aspecto sin justificarlo. Queda probar en un iPhone físico con la barra de Safari expandida, zonas seguras y los ajustes de tamaño de texto del sistema.

## Sesión, avisos y fluidez (25 de noviembre de 2026)

- Se elimina la elección de cuenta por pestaña que hacía aparecer el acceso aunque Supabase conservase una sesión válida. Se reutilizan su almacenamiento persistente, renovación y recuperación de conexión. Cerrar sesión sigue cerrando el acceso. No se guardan credenciales adicionales.
- «Conectar con tu cuenta de Latido» lleva el logo oficial y utiliza el formulario de acceso de Suizamente con la misma cuenta de Supabase. No abre Latido ni una ventana de enlace. Email y Google conservan la ruta solicitada. La primera bienvenida se presenta después de identificarse; un enlace directo a una partida abre esa partida.
- `NotificationBell` añade una campana junto al monedero y Menú. Muestra los turnos pendientes del servidor y enlaces a sus partidas. La activación reutiliza el permiso, suscripción y ajuste de avisos existentes. El service worker normaliza los destinos de Suizamente al origen actual; al tocar una notificación abre la partida exacta o navega y enfoca una ventana existente. No se crea una API nueva. En iPhone, el push web requiere instalar la app en la pantalla de inicio y conceder el permiso desde una acción del usuario: [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- Se retira la frase del desglose bloqueado «Por país y por años en Suiza…». Los datos elegibles siguen apareciendo y se conserva el umbral de privacidad del servidor.
- Regalo, cofre y sobre de la tienda utilizan dibujos SVG propios, sin pixelación al ampliar. Los momentos de regalo/cofre usan los mismos dibujos; el sobre grande conserva su construcción vectorial y logo SVG. Se mantienen las animaciones de apertura y el movimiento reducido.
- La partida y el asalto dejan de renderizarse cinco veces por segundo en reposo: el reloj solo actualiza durante una pregunta, una vez por segundo. La caducidad y los tiempos del servidor se conservan. No consulta partidas con la pestaña oculta.
- Los mapas estáticos y miniaturas dibujan solo al cambiar; el mapa interactivo mantiene su animación. El motor detiene su bucle fuera de pantalla o con la app oculta, lo reanuda al volver y cancela recursos al desmontar. Se conservan las referencias de jugador/mapa/ajustes cuando la respuesta no cambia. La campana se carga aparte; no añade el catálogo de Latido al acceso inicial ni fuerza comprobaciones de actualización del service worker al enfocar.

Medición local reproducible en Chromium, mapa 390 × 844 con cuatro lienzos y dos segundos de observación: solicitudes de fotograma 480 → 121 y dibujos 159 → 46. Es trabajo de renderizado medido en la vista de prueba, no una garantía de FPS en dispositivos. Con movimiento reducido: cero fotogramas y dibujos en reposo; al ocultar el documento: cero, con reanudación comprobada. `npm run test:fluidity` guarda la medición actual en `output/sesion-fluidez/fluidez.json`.

Archivos de producto: `game/entry.jsx`, `game/main.jsx`, `Account.jsx`, `Auth.jsx`, `SuizamenteApp.jsx`, `NotificationBell.jsx`, `Lobby.jsx`, `Game.jsx`, `Raid.jsx`, `WorldMap.jsx`, `world3d.js`, `ObjectArt.jsx`, `Moment.jsx`, `moments.jsx`, `Economy.jsx`, `Rewards.jsx`, `Sharing.jsx`, `moment.css`, `production.css`, `pushNotifications.js`, `public/sw.js` y `public/suizamente-assets/latido.svg`. Sin migraciones, cambios de API, banco, reglas, premios ni precios.

Pruebas: `npm run test:session`, `npm run test:entry`, `npm run test:navigation`, `npm run test:first-visit`, `npm run test:small`, momentos en WebKit, `npm run test:play`, `npm run test:fluidity`, build y entrega. Las pruebas usan SQL temporal y sesiones de prueba; no envían avisos ni crean perfiles en producción. Chromium y WebKit verifican reapertura, pestaña nueva, recarga, renovación del token, cierre explícito, login de Latido sin ventana externa, bienvenida posterior, regalo único y campana con partida real. La prueba del service worker cubre app abierta/cerrada y destinos. La base de geometría normal solo cambia en Inicio por la campana solicitada.

Capturas: `output/sesion-fluidez/`, `output/primera-vez/`, `output/pantallas-bajas/` y `output/momentos/`. Queda la comprobación en un iPhone físico: cerrar/reabrir Safari y app instalada, aceptar push y tocar un aviso real desde la pantalla bloqueada; también la escucha manual con VoiceOver.

Comprobación pública de producción, sin cuentas ni escrituras: `node scripts/smoke-suizamente-public.mjs`. Verifica acceso antes de la bienvenida, logo, formulario de Latido en el mismo origen, tres anchos, configuración pública, álbum privado protegido y service worker actualizado en Chromium/WebKit.
