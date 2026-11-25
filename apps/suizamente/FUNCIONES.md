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

## Instalación en Chrome de Android (25 de noviembre de 2026)

`game/installation.js` escucha `beforeinstallprompt` desde la entrada principal, antes de cargar la interfaz del juego. Así conserva el aviso si llega mientras se carga la app o se está en el formulario de acceso, donde el banner no está montado. `InstallBanner` se suscribe al estado compartido y llama a `prompt()` directamente desde el clic, sin esperas que pierdan la activación del usuario.

El evento es de un solo uso. Se consume antes de abrirlo, se bloquean intentos simultáneos y los avisos posteriores del navegador se conservan. Cancelar no muestra un error. Si el aviso se rechaza o todavía no está disponible, se ofrece la guía del navegador; en ese estado el botón indica «Cómo instalar». Aceptar oculta el banner, pero solo `appinstalled` confirma que terminó la instalación. No se fuerza ni se simula una instalación completada: Android muestra su confirmación nativa. Se conserva la guía y el vídeo de iPhone. Referencia de funcionamiento: [instalación desde la app, web.dev](https://web.dev/articles/customize-install).

Archivos: `game/installation.js`, `game/main.jsx`, `game/src/components/suizamente/v2/InstallBanner.jsx`, `package.json`, `scripts/test-suizamente-install-browser.mjs`, `scripts/smoke-suizamente-install.mjs` y este documento. Sin migraciones ni cambios en el juego.

Pruebas: `npm run test:install-game`, `npm run build`, `node scripts/test-suizamente-delivery.mjs`. Chromium/WebKit verifican aviso anterior al montaje, aviso durante el login, gesto de usuario, doble toque, cancelación, aviso consumido, aviso nuevo durante una operación pendiente, aceptación sin falsa marca de instalación, evento de instalación con el banner desmontado, tres anchos y guía de iPhone. La confirmación del sistema se simula en estas pruebas; no instalan aplicaciones en el ordenador.

`node scripts/smoke-suizamente-install.mjs` comprueba en producción el código compilado, la captura temprana y el clic con activación; también el manifiesto, sus iconos y los errores de instalabilidad reales mediante el protocolo de Chrome. Solo lecturas y un aviso de prueba simulado, sin cuentas ni instalación real. Resultados y capturas en `output/instalacion-samsung/`. Queda confirmar el diálogo y la instalación final en el Samsung físico; un mensaje del sistema que persista debe diagnosticarse con su texto exacto.

## Carga inicial y Nueva partida (25 de noviembre de 2026)

- El HTML ya contiene un estado de carga con logo y bloques de brillo, antes de que llegue JavaScript. `LoadingScreen` mantiene esa presentación durante el arranque y la carga de rutas. `LoadingCards` presenta filas accesibles para partidas, rivales y búsqueda; los bloques existentes del resto de pantallas reciben el mismo brillo. Se toman los neutros de las imágenes de carga de Latido. Las fotos conservan su tamaño, muestran brillo hasta cargar y recuperan la inicial si fallan; la maqueta tiene un indicador durante su carga. El brillo y la entrada de imágenes se desactivan con movimiento reducido del sistema o del juego.
- `WarmGameData` empieza configuración, jugador y los datos necesarios de Inicio/Nueva partida antes de terminar de descargar el módulo del juego. Comparte las peticiones pendientes con las pantallas. La configuración ya no se solicita dos veces durante el arranque. La lectura de nombre/foto de Latido deja de bloquear a quien ya tiene perfil de juego; crear un perfil conserva la espera necesaria para recoger su identidad inicial.
- Las partidas y los rivales de Nueva partida se muestran por separado, en cuanto responde cada consulta. No se presentan «sin partidas» o «sin rivales» mientras sus datos todavía están cargando. Los errores muestran Reintentar. Las invitaciones mantienen su recorrido y no consultan emparejamiento.
- Al volver a una pantalla se puede presentar la última respuesta real del servidor, hasta 30 segundos, mientras se vuelve a consultar. Solo se conserva en memoria, con copias separadas y por identidad: no se guarda en disco, cambia con la cuenta, se borra al cerrar sesión y se invalida con toda escritura. No se reutilizan preguntas ni resultados privados de partidas para este propósito. Las acciones y el cobro se siguen validando siempre en el servidor. Las fotos precargadas se publican también al consumir una respuesta ya disponible.
- Inicio evita volver a leer el jugador recién cargado. La lista existente de partidas incluye ahora los resúmenes guardados de duelos terminados y pendientes de ver. Evita una llamada adicional por cada partida del historial antes del regalo. No marca nada como visto al consultar: los avisos se siguen reconociendo al cerrar el momento. Durante un despliegue mixto se conserva compatibilidad con el servidor anterior, con un máximo de dos consultas simultáneas que dejan de programarse al salir de Inicio.

Migración: `supabase/suizamente_v23_carga.sql`, después de v22. Conserva los endpoints y la versión de configuración; añade `duelosIncluidos` y el resumen opcional `duelo` a la respuesta de la lista, usando exclusivamente datos ya guardados y solo para sus participantes. No cambia reglas, premios, votos, plazos, respuestas, saldos ni marcas de lectura. Es repetible y mantiene las funciones internas sin permisos públicos.

Medición local con Chromium y PostgreSQL temporal, introduciendo 2 s de demora en los metadatos de Latido y 1,6 s en la lista de partidas: Nueva partida/rivales pasan de unos 3 s a 0,85–1,05 s. Es un escenario reproducible de red lenta, no una promesa de ese tiempo en móviles o en producción. `node scripts/measure-suizamente-loading.mjs` guarda la medición actual en `output/carga/actual.json`; la base corresponde al commit anterior `c845d2c`.

Archivos: `index.html`, `game/main.jsx`, `game/Loading.jsx`, `game/loading.css`, `SuizamenteApp.jsx`, `Lobby.jsx`, `useData.js`, `MomentArrival.jsx`, `Shared.jsx`, `WorldMap.jsx`, `suizamenteV2.js`; migración v23, ayudantes SQL/vista de prueba, `package.json`, medición y pruebas de carga/v23, y este documento.

Comprobar desde `apps/suizamente`: `npm run test:loading`, `npm run test:session`, `npm run test:install-game`, `npm run test:entry`, `npm run test:navigation`, `npm run test:small`, momentos en Chromium/WebKit, build y entrega. La prueba de carga retiene respuestas para verificar progreso por secciones, arranque antes de JavaScript, metadatos sin bloqueo, petición compartida, brillo accesible, movimiento reducido, fotos, caché por cuenta, actualización al volver, invalidación tras escritura/salida y recuperación ante errores. v23 comprueba permisos, lectura por participante, equivalencia con el duelo individual, ausencia de soluciones en el resumen y conservación de votos/premios/configuración.

Capturas y resultados en `output/carga/{chromium,webkit}/`, con arranque y Nueva partida en 320, 390 y escritorio. Las pruebas de pantallas pequeñas conservan la geometría final anterior. La comprobación pública posterior al despliegue no inicia sesión ni crea cuentas. Queda medir con la conexión real de un iPhone/Samsung y escuchar las etiquetas de carga con VoiceOver/TalkBack.

## Melodía, música y sonidos (23.19, 25 de noviembre de 2026)

`game/src/lib/suizamenteSonido.js` adapta a ES modules el motor de `suizamente/disenos/sonido.js`. Conserva literalmente la partitura de ocho compases, las notas de las cinco piezas, los instrumentos y sus niveles: efectos 0,9 y música 0,4. No incorpora grabaciones ni archivos de audio. El motivo corto de la ruleta conserva sus cinco frecuencias y su envolvente, conectado al mismo contexto y al bus de efectos. El juego base queda intacto.

`Feedback` monta una sola instancia y un solo AudioContext para Suizamente. Los gestos pointerdown/pointerup, touchend, click o keydown lo desbloquean; la apertura pide la sintonía con una espera máxima de tres segundos. Al ocultar el documento se silencian las salidas, se descartan efectos pendientes y se suspende el contexto. Al volver se retoma la frase musical; al desmontar se cierra el contexto y se cancelan los temporizadores y recursos. La adaptación solo añade esa gestión de ciclo de vida, silencio y limpieza; no cambia los sonidos de la referencia.

La política `backgroundMusicFor`, junto al router, decide el fondo musical. Inicio, ruleta, Mapa, Álbum, Tienda, Amigos, Perfil y Ajustes tienen música. Apertura, onboarding, preguntas y sus respuestas, pregunta del día y administración no. `useQuestionScreen` comunica también el estado de respuesta, sin cambiar la navegación ni el tiempo de juego. La sintonía y la victoria detienen el fondo mientras suenan; el premio lo baja brevemente. Se conservan los fundidos y el retorno al principio de la frase de la referencia.

Los resultados guardados disparan acierto/fallo en partida, sello, duelo, desempate, asalto y práctica del onboarding; el primer fallo con Otra oportunidad tiene su propio sonido, aunque la pregunta siga abierta. Los tiempos agotados también suenan como fallo. Las vibraciones conservan sus duraciones de 20/35 ms y su ajuste independiente. Los dilemas no reciben un sonido.

Los momentos declaran su pieza: bienvenida/sintonía; sello, duelo ganado, asalto con éxito y cantón/premio; partida ganada/victoria. Los regalos, cofres y sobres suenan con premio al tocar para abrir, no al recibir la respuesta del servidor ni al omitir. Se retiran los antiguos sonidos duplicados de sello y cofre. Las marcas de presentación por cuenta impiden repetir un resultado o premio al volver atrás o recargar; la apertura usa una marca de sesión. Estas marcas no alteran premios, monedas ni estados del juego.

En Ajustes se añade Música encima de Sonidos, con «Fuera de las preguntas» y «Aciertos, fallos y premios» respectivamente, nombres/descripciones accesibles y filas horizontales como en la referencia. El resto de pantallas mantiene su presentación. `ajustes.musica` es booleano y cuenta como true cuando falta. Se guarda en el JSON de ajustes existente, en servidor y almacenamiento local. Música y Sonidos se actualizan por separado y apagan sus salidas al cambiar. El adaptador HTTP rechaza valores no booleanos de musica. No hay migraciones, endpoints nuevos ni cambios en reglas, precios o premios.

Archivos de producto: `suizamenteSonido.js`, `suizamenteFeedback.js`, `suizamenteV2.js`; `Finish.jsx`, `Context.js`, `SuizamenteApp.jsx`, `Game.jsx`, `Raid.jsx`, `Onboarding.jsx`, `Moment.jsx`, `moments.jsx`, `Rewards.jsx`, `Account.jsx`, `production.css` y `server/suizamente/http.mjs`. Pruebas: motor, ajustes, navegador, AudioContext simulado y comprobación pública; `package.json`, presupuesto de entrega y este documento. El módulo principal pasa de unos 101,6 a 112,5 KB, alrededor de 4,3 KB gzip más por toda la música sintetizada; el presupuesto comprobado pasa justificadamente de 110 a 115 KB. No se descargan pistas de audio.

Pruebas desde esta carpeta: `npm run test:audio`, momentos en Chromium/WebKit, `npm run test:first-visit`, `npm run test:small`, `npm run build` y `node scripts/test-suizamente-delivery.mjs`. En la referencia, `node herramientas/probar-sonido.js` da «Todo correcto». La prueba de la app compara la partitura y los instrumentos con esa referencia, simula el reloj/Web Audio y comprueba gestos, duración, mezcla, pausas, preferencias, duplicados y destrucción. SQL temporal comprueba persistencia de los dos booleanos; HTTP comprueba tipos sin llamadas remotas.

El navegador usa React y SQL reales, instrumentando solo Web Audio para verificar cada transición y el número de contextos. Comprueba ruleta, preguntas, respuestas, Otra oportunidad, agotamiento, sello, victoria, cofre, sobre, apertura, práctica, bienvenida, ocultación y salida. Chromium también reproduce el motor con Web Audio nativo. La compilación de WebKit de pruebas en Windows no expone AudioContext: allí se comprueba el motor simulado y la alternativa silenciosa, sin errores. Capturas de Ajustes a 320, 390 y escritorio y resultados en `output/sonido/`; referencia de Ajustes en `ajustes-referencia.png`.

Después del despliegue, `node scripts/smoke-suizamente-audio.mjs` comprueba públicamente un contexto nativo, primer toque, música sintetizada, ocultación/regreso, cierre al salir y ausencia de descargas de audio. No inicia sesión ni escribe datos del juego. Queda la escucha en iPhone/Samsung físicos, incluido el interruptor de silencio del iPhone, el bloqueo del móvil y la valoración auditiva de mezcla y fundidos.


### Seguimiento: desbloqueo táctil y regreso a la PWA

`Finish.jsx` reintenta el desbloqueo al soltar el dedo (`pointerup`, `touchend`, `click`), además de ratón/teclado, y conserva los escuchadores para recuperar interrupciones posteriores. El inicio de un toque no basta en navegadores táctiles; se usan los gestos de activación del estándar HTML (https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event). `pagehide`/`pageshow` complementan `visibilitychange`; todos los escuchadores se retiran al desmontar.

`suizamenteSonido.js` restaura la ganancia principal incluso cuando se ocultó antes del primer desbloqueo. Antes, esa secuencia dejaba el volumen en cero aunque el contexto arrancase más tarde. Una interrupción detiene la programación y desconecta las salidas anteriores; un nuevo toque visible reanuda el mismo contexto, también si falta el evento de regreso. No se reanuda con el documento oculto. No se cambia la partitura, la mezcla, las preferencias ni el comportamiento del modo Silencio.

Pruebas: el caso de volumen cero fallaba antes de la corrección y pasa después en `test-suizamente-sonido.mjs`. `npm run test:audio-touch` usa React/SQL reales en Chromium y WebKit, con una política Web Audio simulada que rechaza el inicio del toque y exige soltarlo. Cubre arranque bloqueado, salida antes del primer sonido, interrupción, regreso sin pageshow, silencio en segundo plano, contexto único y limpieza. Resultados: `output/sonido/tactil-{chromium,webkit}/resultado.json`. `smoke-suizamente-audio.mjs` comprueba ahora un toque táctil real de Playwright con Web Audio nativo de Chromium en producción. No sustituye la escucha en un iPhone físico. El usuario confirmó que tenía activado el modo Silencio; queda comprobar en su dispositivo al desactivarlo y volver a tocar, y al salir/entrar en la PWA. Sin migraciones ni cambios de API.


## Fluidez de las pestañas y silencio durante el juego y los premios (25 de noviembre de 2026)

Cambio de música solicitado expresamente por el usuario, posterior a 23.19: la ruleta y el resto de `/partida/`, `/sobre/` y `/cofre/` no tienen fondo musical. `Feedback` observa también la cola de Momentos y lo pausa mientras hay una capa activa, incluso sobre Inicio, Tienda o Mapa. Los efectos se conservan. Al cerrar la capa, la música vuelve solo si la pantalla de destino permite fondo y el ajuste Música sigue activado. Las notas, instrumentos, volúmenes y bloqueo por modo Silencio no cambian. Esta preferencia sustituye la mención anterior de música en la ruleta.

Fluidez:

- `preload.js` comparte las importaciones de las rutas con React.lazy. Adelanta el código de las pestañas durante los ratos libres, después del onboarding; no adelanta administración ni el motor WebGL. Se cancela al salir y se evita la precarga automática con ahorro de datos o conexión 2G. La intención de abrir una pestaña (puntero, toque o foco) adelanta su resumen, compartiendo la petición con la pantalla. No se precargan preguntas, giros, duelos ni escrituras.
- El arranque adelanta también los datos de la pestaña de entrada mientras se carga el jugador. Álbum, Tienda, Perfil y Logros usan la misma lectura con revalidación que el resto de la app. Al volver presentan inmediatamente la última respuesta del servidor, de esa cuenta y de hasta 30 segundos, mientras comprueban cambios. No se guardan datos de estas pantallas en disco. La copia del resumen se comparte durante 1,5 segundos para Álbum/Tienda/Amigos, 3 para Perfil y 5 para Logros. Las preguntas privadas no entran en esta caché.
- Toda escritura invalida las lecturas al empezar y al terminar, incluso ante un resultado de red desconocido. Una lectura que termina durante una compra o acción pendiente no puede dejar su copia anterior tras completarse la acción. Se mantienen copias separadas por cuenta y se borran al cerrar sesión. Las acciones siguen validadas y cobradas en el servidor.
- La consulta del contador de partidas no se reinicia con cada pestaña. Fotografías idénticas ya recibidas no vuelven a actualizar el estado global ni obligan a renderizar toda la app.
- Se verificó que Supabase está en `eu-central-1` y que la API de producción recorría `fra1::iad1`. `apps/suizamente/vercel.json` fija la función existente en Frankfurt (`fra1`), junto a la base de datos. No mueve datos ni cambia el alojamiento del resto de Latido. Vercel documenta esta configuración y recomienda situar la función cerca de su base de datos: https://vercel.com/docs/functions/configuring-functions/region .

Medición reproducible: `node scripts/measure-suizamente-tabs.mjs despues` usa React y SQL reales con 700 ms añadidos por respuesta. La base del commit `e1eda3f` tardaba 1.424 ms al volver a Álbum y 1.105 ms a Tienda; después, 4 y 5 ms mostrando la copia del servidor mientras se revalida. Es una prueba local de ese recorrido, no una promesa para todos los dispositivos. Datos y peticiones: `output/velocidad/antes.json` y `despues.json`. `node scripts/measure-suizamente-api.mjs antes|despues` mide cinco lecturas públicas de configuración, sin cuentas ni escrituras, y guarda tiempos/regiones; antes del cambio la mediana fue 495 ms. No guarda cookies, credenciales ni datos personales. La comprobación posterior debe confirmar la región publicada y comparar sus tiempos.

Archivos: `game/main.jsx`; en v2, `preload.js`, `SuizamenteApp.jsx`, `Shared.jsx`, `Rewards.jsx`, `Economy.jsx` y `Finish.jsx`; `suizamenteV2.js` y `suizamenteFeedback.js`; `vercel.json`, `package.json`, este documento y los scripts de pruebas/medición. Sin migraciones, cambios de API, reglas, tiempos de juego, premios o precios.

Pruebas: `npm run test:tabs`, `npm run test:loading`, `npm run test:audio`, `npm run test:audio-touch`, `npm run test:navigation`, build y entrega. La prueba de pestañas retiene respuestas para comprobar carga en paralelo desde el arranque, una petición por resumen, regreso sin esperar la red, ausencia de acciones especulativas, aislamiento por cuenta y la carrera entre lectura/escritura. La de audio comprueba la ruleta sin fondo, sobres/cofres, y el regalo real sobre Tienda (dos pasos sin música, efecto al abrir y vuelta del fondo al cerrar). Chromium y WebKit se prueban con las limitaciones de audio nativo ya documentadas. La entrega suma también los fragmentos compartidos del juego: no usa el menor tamaño de su archivo principal para relajar el presupuesto de 115 KB.

Para comprobar en el dispositivo: recargar una vez para recibir el despliegue, alternar Álbum/Tienda/Amigos/Inicio, abrir una partida y un sobre/cofre o regalo. La ruleta y los premios deben tener sus efectos sin fondo; Inicio/Tienda recuperan la música al terminar. Queda comparar la sensación y la latencia con la conexión real de iPhone y Samsung, y escuchar en un dispositivo físico.


## Barra del sistema y acciones del sobre (25 de noviembre de 2026)

La barra turquesa fija se sustituye por el color de la pantalla. El HTML y el manifiesto arrancan con `#FBF9F6`, igual que la carga. `InstallMetadata` monta `syncScreenChrome`: aplica el color del fondo superior de cada pantalla a `theme-color` y al fondo del documento. Los fondos ilustrados declaran su tinte en `LatidoBackdrop`; las preguntas toman el color real de su banda, y los Momentos usan su base clara y recuperan el color anterior al cerrarse. Un observador atiende cambios de pantalla, banda y capa, agrupados en un frame; ignora opciones, contadores de tiempo y animaciones individuales. Se retira al salir de Suizamente y restaura los metadatos anteriores.

La PWA conserva `display: standalone`. Se declaran `mobile-web-app-capable`, `apple-mobile-web-app-capable` y la barra iOS de estilo `default`, para conservar los indicadores oscuros sobre los fondos claros. No se fuerza `black-translucent`, que impone indicadores blancos. El área segura superior tiene el mismo color, y su espacio se descuenta de las pantallas para que el título y los controles no queden bajo la cámara o los indicadores. Fuentes de plataforma: [WebKit: theme-color](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/), [Apple: metadatos de la web app](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html) y [web.dev: pantalla completa en iOS y contraste](https://web.dev/learn/pwa/enhancements).

En Sobre, «Ver el álbum» y «Seguir» comparten una fila de dos columnas, con texto de 14 px, separación de 10 px y al menos 48 px de altura táctil. El pie permanece encima de la navegación inferior al desplazarse; los enlaces conservan sus nombres accesibles y el indicador de foco. El contenido largo sigue pudiendo desplazarse. No cambia ningún dato, texto, premio, precio, regla ni API; sin migraciones.

Archivos: `index.html`, `public/suizamente.webmanifest`, `game/src/lib/suizamenteChrome.js`, `v2/Finish.jsx`, `v2/LatidoBackdrop.jsx`, `v2/SuizamenteApp.jsx`, `v2/screenChrome.css`, `package.json`, `scripts/test-suizamente-screen-chrome.mjs`, `scripts/smoke-suizamente-public.mjs` y este documento.

Pruebas: `npm run test:screen-chrome`, `npm run test:small`, `npm run test:install-game`, build, entrega y comprobación pública posterior. La prueba usa React/SQL reales en Chromium y WebKit; comprueba tintes del sobre, tienda, pregunta, onboarding y regalo, restauración al cerrar, metadatos de arranque, enlaces de 48 px en 320×568, 375×667, 390×844 y escritorio, ausencia de solapamiento con la navegación y activación con Intro. En Chromium comprueba también el orden con Tab; WebKit en Windows conserva su configuración nativa de tabulación y comprueba foco, tabIndex y activación. Se simula expresamente un inset superior de 32 px para verificar la distribución, sin presentarlo como emulación de la barra nativa. Capturas y resultados: `output/barras-sistema/{chromium,webkit}/`.

Para probar: recargar la versión publicada, entrar en un sobre, cambiar de pantalla y abrir/cerrar un premio. Los botones del sobre deben estar juntos y por encima de la barra de pestañas. Queda verificar visualmente la barra nativa en el iPhone y Samsung físicos, tanto desde el navegador como desde la PWA: la aplicación entrega los colores y metadatos; el aspecto final de los indicadores lo decide cada versión del sistema/navegador.


## Barra de sello y bloqueos intermitentes (23.20, 25 de noviembre de 2026)

`Game.jsx` mantiene la respuesta y el dato al alcanzar la barra completa: no presenta la selección hasta tocar «🛂 ¡Juega por un sello!». `ResultStampBar` muestra directamente `tuBarra` y el umbral de `configPartida` que devuelve el servidor; no suma aciertos en el navegador. Solo marca como nuevo un resultado correcto normal confirmado al responder. No anima fallos, preguntas de sello, duelos o asaltos.

`SealProgress.jsx` y `sealProgress.css` aplican la secuencia de la referencia:

| Parte | Duración | Inicio |
| --- | --- | --- |
| Relleno del tramo nuevo | 0,6 s | 0,35 s |
| Golpe del tramo, icono y contador | 0,45 s | 0,95 s |
| Brillo de los tres tramos | 0,7 s, dos veces | 1,4 s |
| Salto del botón; después, latido | 0,45 s; 2,2 s en bucle | 1,15 s; 1,9 s |
| Sello estampado y rayos | 0,6 s; 1,8 s | 0,1 s; 0,2 s |
| Título y texto | 0,4 s | 0,4 s; 0,48 s |
| Insignias | 0,5 s cada una | 0,55 s y 0,08 s entre ellas |
| «o bien» y duelo | 0,4 s | 1,1 s; 1,15 s |

El brillo usa un halo con sombra fija: solo se anima su opacidad y escala. Todas las animaciones usan exclusivamente `transform` y `opacity`, con espacio reservado desde el principio. Los botones funcionan durante la entrada; al recibir foco de teclado aparecen inmediatamente. La selección usa el sello, encabezado, insignias y textos de `ElegirSello`; las ya conseguidas terminan grises. Las medidas para pantallas bajas siguen centralizadas en `compact.css`, en su regla de 760 px.

Los identificadores de presentación se construyen con cuenta, partida, turno y número de resultado devueltos por el servidor. Se recuerdan en `suizamente:sellos-vistos:<cuenta>`, con respaldo en memoria si el almacenamiento falla. Ni volver a pintar ni consultar de nuevo el servidor reinician la animación. Al recargar, volver atrás o regresar desde preparar el duelo se muestra el estado final. La selección ya abierta conserva su paso al recargar. Movimiento reducido del sistema y del juego muestran todo lleno y quieto; cambiar la preferencia tampoco vuelve a animarlo. No se añaden sonidos ni se altera la rueda o el tiempo de pregunta.

### Error «No se pudo completar la acción»

Los registros de PostgreSQL confirmaron errores `40P01` en las funciones de Suizamente. Se reprodujo la inversión de bloqueos entre la preparación de misiones, el jugador y su contador de peticiones. La migración `supabase/suizamente_v24_concurrencia.sql` coordina las transacciones de la misma cuenta antes de entrar en los motores existentes. Otras cuentas conservan su trabajo en paralelo. No crea tablas de juego ni modifica saldos, premios, votos, precios, reglas, plazos o respuestas. La firma, DTO y permisos de la API no cambian; el motor anterior queda privado como `v24_api_base`. Es repetible. Está aplicada en producción y se verificó que la API pública sigue disponible y la base privada no es ejecutable por authenticated.

El adaptador HTTP recupera además `40P01` y `40001`, que indican transacción abortada, repitiendo la llamada completa con el mismo cuerpo y la misma clave. Tiene como máximo tres intentos dentro del límite total anterior de 15 s. No repite escrituras tras fallos de red, respuestas desconocidas o un resultado de confirmación incierto. Las comprobaciones y los cobros siguen siendo del servidor. Los registros de recuperación solo incluyen acción, código SQL y número de intento. Referencias: [bloqueos de PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html) y [recuperación de transacciones abortadas](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html).

### Archivos y verificación

Producto: `v2/Game.jsx`, `v2/SealProgress.jsx`, `v2/sealProgress.css`, `v2/compact.css`, `server/suizamente/http.mjs` y migración v24. Pruebas: `test-suizamente-seal-browser.mjs`, `test-suizamente-retry.mjs`, `test-suizamente-concurrency.mjs`, ayudantes de SQL/vista previa, comprobaciones de juego y pantallas pequeñas, `package.json` y este documento. De las medidas normales de 390 px solo se actualiza la referencia de la selección de sello para su encabezado e insignias; preguntas, respuestas y datos largos conservan sus medidas.

Desde esta carpeta: `npm run test:seals`, `npm run test:concurrency` (Docker en marcha), `npm run test:play`, `npm run test:audio`, `npm run test:small`, build y entrega. La prueba con PostgreSQL 17 real usa un contenedor temporal y una pausa dentro de la función de la prueba para exponer el cruce de bloqueos: falla con el motor anterior y pasa con v24. Comprueba 16 peticiones paralelas, independencia entre cuentas, una sola compra/cobro, permisos y repetición de la migración. La prueba de HTTP aborta transacciones después de ejecutar la compra y verifica que solo un intento acaba confirmado y cobrado. Todo usa datos temporales; no crea cuentas ni acciones de prueba en producción.

Chromium y WebKit comprueban tres aciertos en 390×844 y 375×667, los tiempos y propiedades animadas, barra del servidor, dato visible hasta pulsar, casilla de sello de la ruleta, botón disponible desde el principio, insignias en orden y grises, conservación al consultar de nuevo, recarga/regreso del duelo, las dos preferencias de movimiento reducido y ausencia de sonidos nuevos. Si falla una petición al elegir categoría, conserva el error accesible y «Reintentar», sin repetir la entrada; también se comprueba. Capturas de la barra llenándose, 1/3, 2/3, 3/3, sello estampándose y selección final: `output/sellos/{chromium,webkit}/`. Las referencias están en `output/sellos/referencia-*.png`; el resultado de concurrencia real, en `output/sellos/concurrencia/resultado.json`.

Para probar: acertar tres preguntas normales seguidas; leer el dato con la barra llena; pulsar «🛂 ¡Juega por un sello!»; entrar y volver de preparar el duelo; recargar; repetir con Menos animaciones. Queda la valoración de fluidez en iPhone/Samsung físicos y seguir observando los registros con el tráfico real.

## Inicio: tu Suiza en el centro (23.21, 25 de noviembre de 2026)

`Home.jsx` sustituye el Inicio anterior por el escenario de la referencia: cabecera con avatar/nivel, racha, monedas y menú; título de la vuelta y progreso de la región; foto de la maqueta; accesos laterales; olas del fondo sin dibujos de línea; «＋ Nueva partida»; carruseles de turnos propios y ajenos. Se conserva además la campanita de notificaciones solicitada anteriormente. Las otras pestañas conservan sus pantallas y textos.

La foto se crea con `Mapa3D.fotoInicio()` en `world3d.js`, usando `alpha` en el renderer, escena sin fondo y PNG a escala 2. Enfoca toda Suiza, coloca exactamente la vuelta/región/niveles recibidos, termina la animación y destruye inmediatamente el renderer, geometrías, materiales, controles, observadores y contexto WebGL. Inicio solo conserva una imagen, sin controles ni bucle gráfico. Mientras llega el módulo, o si no funciona WebGL, se ve `MapDrawing` en SVG. Tocar el mapa o la barra de la región abre la pestaña Mapa.

`HomeMapPhoto.jsx` conserva hasta cuatro fotos/promesas en memoria, identificadas por cuenta, vuelta, región y niveles ordenados. Los cambios de monedas, regalos, misiones, foco o tamaño de pantalla no vuelven a crear la foto; la imagen se contiene en su caja. Construir, sufrir un cambio de niveles o empezar otra vuelta cambia la clave y la rehace. No persiste datos personales ni imágenes en almacenamiento local. La primera captura espera un hueco libre del navegador; si se abandona Inicio antes, se cancela esa tarea pendiente. El módulo 3D sigue siendo una importación diferida.

Los accesos usan las acciones y respuestas existentes de `tienda`, `misiones`, `dia`, `liga`, `partidas`, el inventario y la configuración del servidor. El regalo reutiliza `useDailyGift` y sus momentos; una vez abierto muestra «✓ Mañana» y lleva a Tienda. Los sobres reutilizan `useOpenPack`, que también retoma el sobre pendiente, y vuelven a Inicio después de su momento y resultado. Sin sobres, el acceso muestra los escudos reales y su máximo de configuración. Misiones cuenta objetivos alcanzados; la pregunta pierde el aviso al votar; la liga presenta el puesto/grupo y la zona que devuelve el servidor. Sin grupo muestra «—» y lo explica en la etiqueta accesible, sin inventar un puesto. Solo aparece un evento activo; el multiplicador del aviso sale de su efecto real, sin anunciar ×2 en eventos que no lo aplican.

`useData` permite reutilizar, solo para estos accesos, la última respuesta de la cuenta que ya exista en la caché breve de memoria. Conserva la actualización periódica, al recuperar foco/conexión y al reintentar. Toda escritura sigue invalidando la caché; los cambios guardados del jugador actualizan los accesos, también mientras se cierra un regalo. Las partidas se siguen consultando al entrar para mostrar los turnos actuales. No se añade ninguna API ni migración, ni se modifican premios, reglas, precios, plazos o el límite de peticiones.

Los carruseles son listas con enlaces y etiquetas completas. Ordenan los turnos propios por plazo de caducidad, muestran una tarjeta por vez y mantienen sus puntos decorativos mediante `scroll-snap`. El gesto táctil es nativo, permite zoom y scroll vertical, y el arrastre de ratón no abre una partida por accidente. Al recorrer enlaces con el teclado se hace visible la tarjeta enfocada. Se conservan el marcador, ronda, plazo y barra de sello del servidor; los dos estados vacíos usan los textos de 23.21. La última tarjeta lleva a `?terminadas=1`, que conserva resultados, fechas y la acción de atacar de las partidas terminadas.

Las variables `--sz-ini-*` están en `compact.css`, junto al resto de medidas, dentro de la misma regla de 760 px. Se quitan los nombres visuales de los accesos en pantallas bajas, manteniendo sus etiquetas accesibles. Los iconos SVG propios se copian sin cambios de la referencia a `public/suizamente-assets/iconos/`, solo para esta pantalla. No se cambian los iconos de las otras pestañas. Se eliminan `HomeMap`, `DurationHome`, `DailyPreview.jsx` y el carrusel antiguo de Inicio; el carrusel de Nueva partida permanece intacto.

Archivos de producto: nuevos `v2/Home.jsx`, `v2/HomeMapPhoto.jsx`, `v2/home.css`; `v2/Lobby.jsx`, `v2/Map.jsx`, `v2/Duration.jsx`, `v2/Rewards.jsx` (exporta el mismo hook de sobres), `v2/SuizamenteApp.jsx`, `v2/preload.js`, `v2/useData.js`, `v2/world3d.js`, `v2/compact.css`; eliminación de `v2/DailyPreview.jsx`; iconos de regalo, misiones, pregunta, las cuatro ligas, trofeo, escudo, sobre, pasaporte, racha, moneda, mapa y los seis sellos. Pruebas y documentación: `scripts/test-suizamente-home-browser.mjs`, prueba de pantallas bajas, sincronización de navegación antes de una salida deliberada del documento, únicamente la entrada Inicio de las dos referencias de medidas normales, `package.json` y este documento.

Verificación: `npm run test:home`, `npm run test:small`, `npm run test:moments`, `npm run test:tabs`, `npm run test:navigation`, build y entrega. Las pruebas usan React y SQL reales con cuentas temporales locales, nunca acciones de producción. Chromium y WebKit comprueban 390×844 y 375×667 sin scroll, 320×568 con un scroll corto (91 px en el escenario con dos carruseles), escritorio, ausencia de desbordamiento y fichas completas, transparencia del PNG, contexto destruido, reutilización de la foto y renovación después de construir desde Mapa, orden por plazo, arrastre/puntos, acceso con foco/activación, pregunta del día, sobres, escudos, regalo y estados vacíos. Chromium comprueba además Tab y el gesto táctil nativo; WebKit en Windows conserva su preferencia nativa de tabulación y comprueba foco y activación. Las pruebas de momentos verifican ausencia antes del regalo, premios guardados antes de mostrarlos y que recargar no los repite sobre el nuevo Inicio.

Capturas de Inicio y de las dos referencias exactas, comparación lado a lado y resultados: `output/inicio/{chromium,webkit}/`. Para repetir manualmente: deslizar ambos carruseles, abrir sus partidas, probar los seis accesos, construir en Mapa y volver, votar la pregunta, abrir un regalo/sobre y revisar sus avisos, consultar las terminadas y recargar. Queda comprobar los gestos, fluidez y lectura con VoiceOver/TalkBack en iPhone y Samsung físicos.

## Sellos e iconos propios (23.22, 25 de noviembre de 2026)

Los 41 dibujos de `disenos/iconos/` y su sprite se copian sin editar a `public/suizamente-assets/iconos/`. `Icono.jsx` presenta los símbolos `#sz-*` con `<svg><use/></svg>` y `Sello` selecciona la variante de color o gris. Los SVG son decoración, con `aria-hidden="true"` y `focusable="false"`; no añaden paradas al teclado. Los textos y etiquetas significativas se conservan. Los pasaportes mantienen sus etiquetas de categoría y estado; monedas/XP y el inventario conservan nombres accesibles con sus cantidades.

En texto corrido los iconos miden 1,2 em y los sellos 1,3 em. Los alojamientos de tamaño fijo conservan sus medidas: navegación, cabecera de pregunta, insignias, objetos de premio y comodines. Los SVG de los comodines se dibujan como bloque para no aumentar la línea por su línea base. Los círculos y bordes que formaban parte del dibujo antiguo de los sellos dejan sitio al borde ondulado del nuevo SVG, sin cambiar la caja. La ruleta conserva sectores, posiciones y tiempos: sustituye sus `<text>` de emoji por SVG centrados y girados en el mismo punto. No se añaden sonidos ni movimientos.

Se sustituyen los iconos en Inicio, navegación, onboarding y pistas, partida y respuestas, pasaportes, elección de sello, duelos, asaltos, mapa/ayuda/vueltas, tienda, álbum y sus premios, perfil/logros, misiones, liga/ranking, comunidad, menús, avisos, momentos y los controles para compartir. Los cofres usan `cofre`, los regalos `regalo`, los sobres `sobre` y cada medalla de vuelta su dibujo específico. `ObjectArt.jsx` es ahora un adaptador de los mismos SVG generados. El sobre animado conserva su caja, texto y secuencia de apertura. Los enlaces de vuelta a Inicio conservan sus palabras y eliminan el emoji de casa según la referencia.

La conversión de cadenas `IconText`/`iconizar` se aplica expresamente a texto de interfaz, incluidos títulos y avisos del servidor; no recorre ni modifica el DOM ni los datos. Los campos de contenido se presentan literalmente y se marcan con `data-sz-content` para comprobar esa frontera: pregunta, opciones, dato, dilemas y cartas. El título del detalle de una carta evita la conversión de títulos de interfaz. Los emojis fuera de la tabla se conservan. No se modifican bancos JSON, ids, votos, respuestas, API, precios, premios, reglas ni plazos. No hay migraciones nuevas.

El panel de administración queda dentro de `IconScope enabled={false}` para que los componentes comunes también conserven allí sus emojis. `Admin.jsx` sigue intacto. Los motores `story.js`, `shareData.js` y la función `storyData` de `Sharing.jsx` permanecen idénticos: las imágenes para compartir siguen con sus emojis. Solo cambian los botones y controles de su interfaz.

Archivos: nuevos `v2/Icono.jsx` y `v2/icons.css`; componentes de interfaz de `v2/` (`Shared`, `MatchWheel`, `Home`, `Account`, `Lobby`, `Game`, `QuestionOptions`, `FirstGameHint`, `Onboarding`, `SealProgress`, `Duels`, `Raid`, `VictoryAttack`, `Map`, `MapPage3D`, `Duration`, `Economy`, `Rewards`, `ObjectArt`, `Moment`, `moments`, `MomentArrival`, `NotificationBell`, `Community`, `Sharing`, `ShareImage` y el ámbito de administración en `SuizamenteApp`); `lib/suizamenteNotices.js`; recursos SVG; pruebas, `package.json` y este documento. Los estilos existentes de medidas compactas no se cambian. Las referencias automáticas de geometría solo se actualizan donde el avance de un glifo SVG sustituye al del emoji del sistema o cambia el redondeo subpíxel; las cajas de medidas fijas se mantienen.

Verificación: `npm run test:icons`, `npm run test:small`, `npm run test:moments`, `npm run test:sharing`, `npm run test:play`, `npm run test:seals`, build y entrega. La prueba de iconos compara todos los archivos generados con la referencia, verifica cada símbolo, decoración y límites, recorre pestañas/pantallas secundarias, comprueba sellos de color/grises y busca emojis de interfaz en los nodos de texto. Usa deliberadamente 🧀 en una pregunta, 🪙/🌲 en su dato y en las opciones de un dilema, y las cartas reales del álbum que coinciden con la tabla, para verificar que siguen siendo contenido. Comprueba además que administración no contiene los nuevos símbolos y que los motores de imágenes no han cambiado. Las pruebas de compartir mantienen la privacidad, PNG, descarga, nueve cartas y premios guardados.

Las capturas de Inicio, ruleta, pregunta, tienda y regalo a 390×844, 375×667 y escritorio están en `output/iconos/{chromium,webkit}/`, junto a las cinco referencias de `pantallas.html`, `comparacion.html`/`comparacion.png` y el catálogo completo sobre superficies claras/oscuras. Se prueba el contraste de los dibujos sin cambiar el ajuste de apariencia existente. Para probar manualmente: recargar, revisar esas cinco pantallas, abrir un pasaporte, elegir sello, usar un comodín y consultar un dato/carta; los dibujos de interfaz deben ser SVG y el contenido conservar sus emojis. Queda la comprobación con VoiceOver/TalkBack y los dispositivos físicos.
