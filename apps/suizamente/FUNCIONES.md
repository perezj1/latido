# Suizamente independiente: decisiones de presentación y acceso

Las cinco mejoras opcionales de los prompts 32–36 se documentan en [MEJORAS-IMPLEMENTACION.md](MEJORAS-IMPLEMENTACION.md), con sus migraciones v27–v33, datos, pruebas y activación. Se añaden con todos los interruptores apagados; las decisiones anteriores siguen vigentes.

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

Verificación: `npm run test:icons`, `npm run test:small`, `npm run test:moments`, `npm run test:sharing`, `npm run test:play`, `npm run test:seals`, `npm run test:tabs`, `node scripts/test-suizamente-moments-browser.mjs --small`, build y entrega. La prueba de iconos compara todos los archivos generados con la referencia, verifica cada símbolo, decoración y límites, recorre pestañas/pantallas secundarias, comprueba sellos de color/grises y busca emojis de interfaz en los nodos de texto. Usa deliberadamente 🧀 en una pregunta, 🪙/🌲 en su dato y en las opciones de un dilema, y las cartas reales del álbum que coinciden con la tabla, para verificar que siguen siendo contenido. Comprueba además que administración no contiene los nuevos símbolos y que los motores de imágenes no han cambiado. Las pruebas de compartir mantienen la privacidad, PNG, descarga, nueve cartas y premios guardados.

Las capturas de Inicio, ruleta, pregunta, tienda y regalo a 390×844, 375×667 y escritorio están en `output/iconos/{chromium,webkit}/`, junto a las cinco referencias de `pantallas.html`, `comparacion.html`/`comparacion.png` y el catálogo completo sobre superficies claras/oscuras. Se prueba el contraste de los dibujos sin cambiar el ajuste de apariencia existente. Para probar manualmente: recargar, revisar esas cinco pantallas, abrir un pasaporte, elegir sello, usar un comodín y consultar un dato/carta; los dibujos de interfaz deben ser SVG y el contenido conservar sus emojis. Queda la comprobación con VoiceOver/TalkBack y los dispositivos físicos.

## Invitar a un amigo por enlace (25 de noviembre de 2026)

La pestaña Amigos muestra «Invitar a un amigo» y, si está vacía, «¿Con quién quieres jugar?». El buscador habla de jugadores de Suizamente. La hoja permite compartir con la hoja nativa del dispositivo, copiar el enlace y abrir WhatsApp o email; también funciona sin Web Share y al cancelar el envío. No se envía nada sin que la persona elija la acción. El enlace usa siempre `https://suizamente.latido.ch/suizamente/amigo/{codigo}`, sin nombres, emails ni ids de cuentas.

Es una invitación a amistad, independiente de las invitaciones de partida existentes. La persona puede tener cuenta o crear una desde el propio Suizamente: se conserva el destino durante el acceso, el registro y la creación del perfil. Al entrar con su perfil, el servidor guarda las dos relaciones como aceptadas en una transacción y abre Amigos. La lista se renueva al volver al dispositivo y cada 15 segundos mientras está visible. El enlace puede compartirse con varias personas; su plazo es el mismo `partida.invitacionDias` de la configuración. No crea una partida ni entrega premios. Para jugar se sigue tocando «Jugar».

La migración aditiva `supabase/suizamente_v25_invitaciones_amigos.sql`, después de v24, añade una tabla privada con códigos aleatorios de 128 bits. Expiración, cuenta, perfil y moderación se comprueban en el servidor. La aceptación es idempotente y convierte también una solicitud previa en amistad recíproca. Se coordinan las dos cuentas en orden antes de bloquear filas, para que las invitaciones cruzadas no provoquen interbloqueos. La tabla y el helper interno no son accesibles directamente desde los roles cliente. Las invitaciones antiguas de ocho caracteres a una partida no cambian.

API nueva: `POST /amigos/invitaciones` devuelve `{codigo,enlace}`; `POST /amigos/invitaciones/aceptar` recibe `{codigo}` y devuelve `{aceptada,amigo}`. Las dos requieren sesión y perfil. Los demás métodos pasan al RPC anterior. La migración se ha aplicado al proyecto Supabase de producción existente. Para la confirmación de email se añade únicamente `https://suizamente.latido.ch/auth/callback[?]next=%2Fsuizamente%2Famigo%2F*` a las redirecciones autorizadas de Auth; se conservan todas las entradas y el Site URL anteriores. El cliente solo agrega ese destino si coincide con la ruta de amistad y un código válido.

Archivos: `v2/Community.jsx`, `v2/Sharing.jsx`, `v2/SuizamenteApp.jsx`, `game/src/hooks/useAuth.jsx`, `server/suizamente/http.mjs`, la migración v25, los dos helpers de pruebas locales, `scripts/test-suizamente-friend-invites*.mjs`, `package.json` y este documento. No se cambian reglas de partida, contenido, economía, bancos ni imágenes compartidas.

Validación: `npm run test:friend-invites` (SQL local, PostgreSQL en un contenedor aislado, Chromium y WebKit), `npm run test:entry`, build y prueba de entrega. Comprueba registro real de la interfaz con Auth simulado, creación de perfil, destinos de confirmación, amistad en ambos lados, enlaces antiguos, repetición/recarga, enlaces caducados, cuenta bloqueada, permisos, ausencia de premios y partidas automáticas, compartir/cancelar/copiar/WhatsApp/email, ausencia de Web Share y anchos 320/375/390/escritorio. Ninguna prueba crea cuentas ni manda mensajes reales. Capturas y resultados: `output/invitar-amigos/`. Para probar en dispositivos: Amigos → Invitar a un amigo → compartir/copiar → abrir desde otra cuenta o registrarse → comprobar ambas listas → Jugar. Queda la comprobación manual de los selectores nativos de compartir y del correo real en iPhone y Samsung.

## Acceso al perfil con ajustes antiguos y cambio de cuenta (25 de noviembre de 2026)

Se reproduce y corrige «Ajustes no válidos» al guardar el perfil después del onboarding. La versión anterior (`public/suizamente/experiencia.js`) guardaba `avisos` como un checkbox booleano en la misma clave local `suizamente:ajustes`; el juego actual exige un objeto de preferencias. La API de producción conserva esa validación. No se relaja el servidor: `lib/suizamenteSettings.js` convierte `avisos: false/true` en `{turnos: false/true}`, normaliza los booleanos conocidos y conserva la apariencia clara. Las preferencias se normalizan al leerlas, al recibir al jugador, al cambiar ajustes y antes de enviar el perfil. No hace falta borrar los datos del navegador.

El almacenamiento local de ajustes contiene solo preferencias del dispositivo. La foto, las marcas de onboarding y las pistas permanecen en el registro del jugador del servidor. Al editar se conservan mediante la combinación JSON existente en el servidor; al crear otro perfil no se copian de la cuenta anterior ni se envían campos antiguos o imágenes locales grandes dentro de los ajustes.

Crear perfil muestra «Perfil reconocido de Latido» junto al logo y, debajo de «¡A jugar!», «Usar otro perfil». Este segundo botón no envía el formulario, aunque sus campos estén incompletos. Cierra la sesión local y la credencial de invitado de Suizamente, elimina los destinos y marcas locales pendientes y vuelve a la bienvenida con Crear cuenta, email, Google y Latido. No borra el perfil ni el progreso guardados en el servidor. Recargar la bienvenida mantiene la sesión cerrada; entrar con otra cuenta utiliza su propio nombre, foto y perfil.

Archivos: nuevo `game/src/lib/suizamenteSettings.js`; `lib/suizamenteV2.js`; `v2/SuizamenteApp.jsx`, `v2/Account.jsx`, `v2/production.css`; nueva regresión `scripts/test-suizamente-profile-settings.mjs`; ampliación de `scripts/test-suizamente-entry-profile.mjs`, `package.json` y este documento. Sin migraciones ni cambios de API, reglas o premios.

Validación: regresión SQL real que reproduce el rechazo antiguo y verifica el guardado normalizado, metadatos propios conservados, metadatos ajenos excluidos y ausencia de premios; navegador en Chromium y WebKit con preferencias antiguas, onboarding, perfil reconocido, foto, «¡A jugar!», cambio de cuenta con formulario incompleto, bienvenida tras recargar y segunda cuenta sin datos de la primera; build, entrega y pruebas de ajustes de audio. `npm run test:entry` agrupa las pruebas de acceso y perfil. Capturas y resultados en `output/entrada-perfil/{chromium,webkit}/`, incluida `usar-otro-perfil-375.png`. Para probar: recargar la app, guardar el perfil y, si quieres cambiar de cuenta, tocar «Usar otro perfil». Queda revisar el dispositivo físico que mostraba el error.

## Respuesta al toque y menos viajes de red (26 de noviembre de 2026)

Después de confirmar la cuenta, el perfil y el onboarding, se preparan en segundo plano los resúmenes de Álbum, Tienda, Amigos, Nueva partida y Mapa que todavía no estén guardados. Hay como máximo dos lecturas de baja prioridad a la vez, y dos importaciones de pantallas en los huecos del navegador. Se cancela el trabajo pendiente al salir de la cuenta y se retoma al volver a una pestaña visible. Con ahorro de datos o conexión 2G no se precarga. No se abren preguntas, partidas, sobres, cofres, administración ni contextos WebGL. Los enlaces dentro de las pantallas también preparan su destino al recibir foco o comenzar el toque.

El primer acceso usa solo la última respuesta real de esa cuenta, con los plazos de frescura y revalidación existentes. No se guarda información privada en disco ni en el service worker. Los cambios de cuenta y las acciones siguen invalidando la caché. Las respuestas anteriores que terminan después de cambiar de cuenta, o después de iniciar una acción, ya no emiten eventos globales que puedan restaurar datos viejos.

Crear partida y abrir sobre reutilizan durante dos segundos su respuesta de creación para cargar la pantalla siguiente, evitando volver a pedir exactamente el mismo registro guardado. Esta entrega breve es independiente de marcar avisos como leídos, porque esa acción no modifica una partida ni un sobre. Cualquier otra escritura o cambio de cuenta la descarta; una escritura concurrente o de resultado desconocido obliga a consultar de nuevo. No se precargan partidas ni preguntas a partir de enlaces.

Al tocar GIRAR la luz empieza a recorrer casillas mientras llega el servidor y se muestra «Preparando giro…», sin seleccionar ni anunciar una categoría. La animación de llegada conserva el destino y la duración configurados del servidor. Con menos animaciones no se mueve la luz. Al tocar una respuesta se marca la opción en azul y aparece un indicador de espera de 18 px, con `aria-busy` y «Comprobando tu respuesta…». No se indica acierto/fallo antes de recibirlo, no se cambia el tamaño de las opciones y el reloj sigue funcionando. El indicador queda quieto con cualquiera de las dos opciones de movimiento reducido. No se añaden sonidos.

Desde Álbum se aprovecha su respuesta actual al abrir un sobre; si otro dispositivo dejó uno pendiente, el conflicto se resuelve consultando al servidor y retomándolo. El endpoint existente `POST /sobres/{id}/girar` admite el indicador opcional `todas: true`. El servidor consulta el sobre y ejecuta las mismas operaciones RPC de revelado, en orden y con las mismas comprobaciones de propiedad, dentro de una sola petición del móvil. Cada carta ya estaba cobrada al abrir: no se recalcula ni se entrega ningún premio. Repetir la petición de un sobre completo solo lo lee. Si se interrumpe a mitad, la siguiente continúa desde la posición guardada. El cliente conserva también `indice`, por compatibilidad con el servidor anterior. No hay migración SQL ni cambios de reglas, premios, precios, tiempos de pregunta o contratos existentes.

Medición comparable de React/SQL locales con 700 ms añadidos a cada petición: primera apertura de Tienda 1433 → 16 ms, primera apertura de Álbum 1548 → 1113 ms, entrada en Nueva partida 1745 → 1580 ms; volver a las pestañas sigue por debajo de 20 ms. Son medidas de esa prueba, no una garantía para cada dispositivo. Con la precarga completada las pruebas de toque de Chromium/WebKit comprueban menos de 500 ms para la primera visita a Álbum/Tienda, reacción visual inmediata aun reteniendo el servidor, y dos peticiones móviles para abrir/presentar un sobre desde Álbum. La red y el servidor siguen determinando cuándo llega un resultado real.

Archivos de producto: `v2/preload.js`, `v2/SuizamenteApp.jsx`, `lib/suizamenteV2.js`, `v2/Game.jsx`, `v2/MatchWheel.jsx`, `v2/QuestionOptions.jsx`, `v2/answers.css`, `v2/Rewards.jsx`, `server/suizamente/http.mjs`. Pruebas: nuevos `scripts/test-suizamente-pack-batch.mjs` y `scripts/test-suizamente-responsiveness-browser.mjs`, `test:responsiveness` en `package.json`, y separación del escenario de cofres de las llamadas anteriores del escenario de momentos mediante el contador de la base temporal (el límite real de producción no cambia).

Verificación: `npm run test:responsiveness`, `npm run test:play`, `npm run test:tabs`, `npm run test:moments`, `node scripts/test-suizamente-retry.mjs`, build y entrega. Las pruebas usan SQL y cuentas temporales locales; verifican respuestas retenidas, ausencia de resultado anticipado, reloj activo, movimiento reducido, permisos, repetición y recuperación de sobres, continuidad de las animaciones originales, cambio de cuenta con precarga en vuelo y ahorro de datos. Resultados y capturas en `output/respuesta-inmediata/`, y comparación de tiempos en `output/velocidad/{antes,despues}-20261126.json`. Para probar: recargar, abrir las pestañas, iniciar una partida, tocar GIRAR/responder y abrir un sobre. Queda medir la red y fluidez en los iPhone y Samsung físicos.

## Aviso inicial de notificaciones y control de música (26 de noviembre de 2026)

Al terminar el alta y llegar por primera vez a Inicio aparece un diálogo centrado «¿Te avisamos cuando te toque?». Espera a que terminen el regalo diario y los avisos de ausencia, y no abre dos diálogos a la vez. No se solicita permiso del navegador hasta tocar «Activar notificaciones». «Activar después», Escape o cerrar el diálogo aplazan el recordatorio tres días; la activación sigue disponible en la campana. El recordatorio se guarda por cuenta y dispositivo y vuelve solo en Inicio. Si hay una suscripción activa de esa cuenta, no se muestra. Un permiso denegado explica cómo cambiarlo; los dispositivos incompatibles y la vista previa local muestran ayuda sin simular una activación real. Se conservan los enlaces de las notificaciones a sus partidas.

Un botón de música de 44 × 44 px aparece solo en las cinco páginas principales: Inicio, Mapa, Álbum, Tienda y Amigos. Los diálogos, las cartas, los momentos, el onboarding y las partidas no llevan ese control. Indica su estado con una nota tachada y etiquetas «Activar música» / «Desactivar música». El cambio se refleja antes de esperar a guardar la preferencia existente en el servidor; no cambia los efectos. Las cabeceras principales permanecen visibles al hacer scroll. Por debajo de 361 px se oculta la ficha de racha de la cabecera de Inicio para que los controles sigan siendo accesibles; la racha continúa en el perfil.

Tocar un logro abre su explicación en la misma hoja inferior accesible que las cartas, por encima de la navegación, con su icono, condición y progreso del servidor. Se puede cerrar con «Cerrar», Escape o el fondo y se devuelve el foco al logro elegido. Se elimina la tarjeta de explicación al final de la lista. El bloque «Un juego de Latido» del menú muestra el recurso oficial `latido.svg`, también usado en el acceso con cuenta de Latido; el logo del juego sigue en sus otros lugares.

Archivos: nuevos `v2/PushPrompt.jsx`, `v2/MusicButton.jsx`, `v2/topControls.css` y `lib/suizamentePushReminder.js`; integración en `SuizamenteApp`, `MomentArrival`, `NotificationBell`, `Shared` y las cabeceras particulares de `Home`, `Economy`, `Community`, `MapPage3D` y `Rewards`. `Account` corrige el logo de Latido y `Economy` abre el detalle de los logros en `Sheet`. `Game` elimina el aviso antiguo al finalizar el primer turno. `usePushActivation` espera a conocer el estado y descarta respuestas de otra cuenta; `pushNotifications.js` comprueba permiso y propietario de la suscripción. El guardado de preferencias comprueba la sesión actual y utiliza el perfil más reciente. Las preferencias de avisos se combinan con los ajustes actuales después del diálogo nativo, para conservar cualquier cambio de música realizado durante la espera. Pruebas nuevas en `scripts/test-suizamente-{push-reminder,top-controls-browser}.mjs`, opción de escenario en el helper de vista previa, `test:top-controls` en `package.json` y este documento. Sin migraciones SQL, cambios de API ni cambios de reglas, premios o datos del juego.

Verificación: `npm run test:top-controls`, pruebas de sesión, de momentos y ajustes de audio, build y entrega. La prueba específica usa React y SQL locales, con permisos y suscripciones nativos simulados, sin enviar notificaciones reales. Comprueba consentimiento, prioridad del regalo, aplazamiento y recarga, recordatorio vencido solo en Inicio, cuenta con suscripción, permiso denegado, música con el guardado retenido, presencia solo en las cinco páginas principales y ausencia en diálogos, regalo, onboarding, ruleta y pregunta. Comprueba también el detalle de logros por encima de la barra, cierre y devolución del foco, cartas sin control musical y el recurso correcto del logo de Latido. Tamaños: 320 × 568, 375 × 667, 390 × 844 y escritorio. Capturas y resultados: `output/avisos-musica/{chromium,webkit}/`.

Para revisar: recargar `http://127.0.0.2:8080/suizamente`, terminar u omitir el regalo, probar el diálogo y la campana, y tocar la nota musical en Inicio y en las otras cuatro pestañas principales. Desde Menú, abrir Logros y tocar una insignia; comprobar la hoja inferior y el logo de Latido al volver al Menú. Si ya se aplazó el aviso, esperar tres días o eliminar solo la clave `suizamente:push-recordatorio:<id>` del almacenamiento local de esa cuenta para volver a revisarlo. La vista previa local permite comprobar el diseño, pero la activación push real requiere la app publicada en HTTPS. Queda la revisión del usuario y la comprobación de los permisos nativos en iPhone/Samsung físicos. Publicación autorizada por el usuario el 26 de noviembre de 2026 en las ramas `suizamente` y `suizamente-social`, después de revisar la vista previa.

## Cabecera de Mapa y acciones del sobre (26 de noviembre de 2026)

La cabecera del mapa deja el nombre de la región en una fila propia con la música a la derecha. Vuelta, región, escudos y monedas se muestran debajo como pills, con texto compacto y sin comprimir el título entre los controles. Los enlaces y botones conservan un objetivo táctil de al menos 44 px. Las pills pueden pasar a otra línea si las cantidades necesitan más espacio; no se recortan los números.

Sobre y Cofre funcionan como pantallas de premio independientes: no muestran la navegación inferior ni el banner de instalación. Al seguir o volver al Álbum reaparece la navegación normal. Sobre y Cofre conservan el tinte de su fondo y ocultan la escena decorativa de abajo, incluido el cable que cruzaba el contenido. El título del sobre y su contador se compactan para 320 px. «Ver el álbum» y «Seguir» quedan juntos como pills de 48 px, con texto de 13 px, sin sombras que aparenten otra barra ni una línea superior. El pie permanece al fondo y el contenido puede desplazarse sin quedar tapado.

Archivos: `v2/MapPage3D.jsx`, `v2/SuizamenteApp.jsx`, `v2/Rewards.jsx`, `v2/screenChrome.css`, ampliación de `scripts/test-suizamente-screen-chrome.mjs` y este documento. Sin migraciones, cambios de premios, reglas, precios, API o datos. Verificación: `npm run test:screen-chrome` en Chromium y WebKit a 320 × 568, 375 × 667, 390 × 844 y escritorio; cabecera con 5340 monedas, objetivos táctiles, títulos legibles, ausencia de desbordamiento, dos acciones accesibles, navegación oculta solo en premios y recuperada en Álbum, inset superior simulado y colores de pantalla. Capturas: `output/barras-sistema/{chromium,webkit}/mapa-*.png` y `sobre-*.png`. Build y entrega sin cambios en el presupuesto de carga. Para revisar: recargar la vista previa local, abrir Mapa, abrir un sobre y usar ambos botones. Queda la comprobación en los dispositivos físicos del usuario. Publicación autorizada el 26 de noviembre de 2026 en `suizamente` y `suizamente-social`.

## Inicio con escena e isla regional (26 de noviembre de 2026)

Inicio sustituye la composición anterior por el SVG `ESCENA_INICIO` de la referencia, copiado literalmente en `v2/homeScene.js`, detrás del marcador, cartel, isla e insignias. El SVG usa `preserveAspectRatio="xMidYMax slice"`, se funde con #FBF9F6 y adapta también el color de la barra del teléfono al cielo. El marcador es una píldora con avatar/nivel, racha, monedas, música y menú; la campana de avisos se conserva en la cabecera de Menú. Los iconos `musica` y `musica-no` y el sprite se copian del catálogo generado. El botón de Inicio se llama «Música», expone `aria-pressed`, comparte `ajustes.musica` con Ajustes y confirma el cambio con un aviso; los sonidos siguen independientes.

El cartel enlaza al Mapa, muestra el nombre de la región, la minisuiza con la región activa en el color de la vuelta, las anteriores en su tinte y las futuras grises, los niveles guardados, el cofre y la ficha de construcción. Las insignias son círculos, con sus fichas, nombres y avisos reales del servidor. Se reutilizan regalo diario, misiones, pregunta del día, evento, liga, sobres y escudos. «Nueva partida» tiene el aro de colores giratorio; queda quieto con la preferencia del sistema o el ajuste de menos animaciones.

`world3d.js` incorpora `verRegion`, el recorte alfa de `foto` y `recortar`, siguiendo los ángulos y encuadre de la referencia. `fotoInicio` monta solo la geometría de los cantones de la región para no construir las decoraciones de regiones que no se van a dibujar, deja solo esa región visible y sin nubes, captura PNG transparente y destruye inmediatamente el contexto WebGL. `HomeMapPhoto` conserva su caché de sesión por cuenta, vuelta, región y niveles: volver a Inicio reutiliza la foto; construir, cambiar de región o empezar una vuelta la renueva una sola vez. Mientras carga o sin WebGL, se conserva el SVG con la región marcada. La isla no captura gestos; tocarla abre Mapa.

Las dos filas usan tarjetas de 112 × 124 y acciones de 86 px, scroll-snap, toque, arrastre con ratón y foco de teclado. Se ajustan a la tarjeta más cercana aunque las anchuras sean distintas. «Invitar a alguien» va siempre primero en Seguir jugando y abre la hoja existente de invitación. Las partidas de tu turno van por plazo; su etiqueta incluye rival, marcador, aciertos pendientes y tiempo. «Partidas terminadas» va primero en Esperando y abre la lista en Amigos, con resultado, fecha y Revancha mediante la API existente; se conserva el enlace antiguo `?terminadas=1`. Los estados sin partidas y al día usan los textos definitivos. Se eliminan las olas, la maqueta de Suiza entera y los puntos de carrusel del Inicio anterior.

Las medidas normal/baja de Inicio y `--sz-mapa-llega` viven en las dos declaraciones de variables de `compact.css`; se retiran las variables de Inicio antiguas. Se conserva la escena de 574/424 px. Solo en Inicio se ajusta el espacio transparente de la navegación y su globo central para que las tarjetas completas no queden debajo; las otras pestañas mantienen su barra. En 390 × 844 y 375 × 667 la primera fila queda entera; Esperando se alcanza al desplazar. En 320 × 568 puede asomar la fila y se desplaza verticalmente sin desbordamiento horizontal.

Archivos: `v2/Home.jsx`, nuevos `HomeSceneParts.jsx`, `MatchHistory.jsx` y `homeScene.js`, `home.css`, `HomeMapPhoto.jsx` reutilizado, `Map.jsx`, `world3d.js`, `MusicButton.jsx`, `Account.jsx`, `Community.jsx`, `compact.css`, `lib/suizamenteChrome.js` y los tres recursos SVG de música/sprite. La prueba `test-suizamente-home-browser.mjs` comprueba la transparencia, creación/destrucción del contexto y caché, construcción y cambios de región/vuelta en la misma sesión, acciones, estados vacíos, plazos, arrastre/foco, música/Ajustes y movimiento reducido. Se actualiza `test-suizamente-top-controls-browser.mjs` para la campana en Menú y el nombre accesible Música. Capturas y comparación con Inicio/InicioBaja: `output/inicio/{chromium,webkit}/comparacion.html`, `comparacion.png`, `inicio-390.png`, `inicio-375.png` e `inicio-completo-390.png`.

## Precios juntos y fichas de cantón (26 de noviembre de 2026)

`Icono.jsx` agrupa los textos de interfaz convertidos en un solo elemento para rejillas/flex; las parejas cortas tienen inline-flex, centrado y separación. Las cantidades de Tienda, tarjetas y construcción se agrupan expresamente con su moneda, sin pasar por la conversión de contenido. El banco, los dilemas, los datos curiosos y los emojis de las cartas permanecen intactos. Las tarjetas de cantón son de 108 × 175 px: placa de silueta SVG 72 × 52, nombre de dos líneas con alto fijo, tres barritas, nivel y pie de 30 px con moneda de 18 px. Todas las cantidades son las del servidor, incluidas oro y cristal; la ficha elegida, las completas y la falta de monedas tienen sus estados de la referencia. El nombre accesible incluye nombre, nivel, coste y falta de monedas o estado completo.

Mapa mantiene solo «Toda Suiza» cuando hay selección. Se retiran la indicación «Gira, amplía y toca», los botones de compartir/ayuda sobre la maqueta y la ruta/pantalla MapaAyuda. El compartir de MomentoCanton, VueltaCompleta y Perfil permanece. El botón de construcción está en la ficha casi opaca del cantón: nombre, barritas, nivel, lo que tiene y lo que llega; la última línea se oculta por la variable en pantallas bajas. Nombre y textos largos terminan en puntos suspensivos; las etiquetas completas permanecen accesibles. La ficha ofrece el coste y nivel siguiente del servidor, o Completo. Si faltan monedas muestra el aviso existente sin escribir; si llegan, utiliza la misma petición de construcción y los mismos momentos/cofres ya guardados. La maqueta elegida crece 46 px y sustituye el hueco de la indicación inferior, sin mover las tarjetas. Se quitan el botón grande inferior y las antiguas miniaturas WebGL de las tarjetas. Si el controlador gráfico falla al dibujar, la maqueta pasa al respaldo SVG; los contextos ya cerrados se limpian sin propagar errores de liberación del controlador. En la maqueta interactiva se conserva una copia 2D del fotograma para evitar que WebKit deje el modelo vacío al redimensionarlo; los gestos siguen llegando al modelo y la copia se actualiza con el mismo presupuesto de fotogramas del modelo. Las maquetas con menos animaciones conservan igualmente su fotograma quieto.

Archivos: `v2/MapPage3D.jsx`, nuevo `mapCards.css`, `WorldMap.jsx`, `Map.jsx`, `SuizamenteApp.jsx`, `screenChrome.css`, `compact.css`, `Icono.jsx`, `icons.css` y `Economy.jsx`. Los marcadores `sv-chip` separan 5 px el icono y la cifra también cuando reciben el SVG directamente. Se conserva la cabecera compacta, con el saldo al lado del nombre y las pills de vuelta/región/escudos debajo. Prueba nueva `scripts/test-suizamente-map-layout.mjs`, comando `test:map-layout` en `package.json`; pruebas de compartir y de pantallas pequeñas adaptadas a VueltaCompleta y MomentoCanton, sin acceso de compartir desde Mapa. Las métricas antiguas de Inicio/Mapa se sustituyen por las comprobaciones específicas de estos encargos; las del resto de pantallas se siguen comparando con sus medidas anteriores, salvo el ancho del saldo que incorpora la separación pedida entre moneda y cifra. Las pruebas usan SQL temporal, no producción, y verifican filas estables, moneda/número en línea, construcción cobrada una sola vez al coste del servidor, falta de monedas sin cambios, cantón completo, nombres largos en oro/cristal, sin mini-WebGL, y 390/375/320/escritorio. Los documentos de referencia usan los mismos Poppins locales para que su captura no dependa de Google Fonts. Comparaciones Mapa/MapaCanton/MapaBaja/Tienda: `output/mapa-fichas/{chromium,webkit}/comparacion.html` y sus PNG.

Comprobaciones de entrega de ambos encargos: `npm run test:home`, `npm run test:map-layout`, `npm run test:icons`, `npm run test:moments`, `npm run test:sharing`, `npm run test:top-controls`, `npm run test:screen-chrome`, las comprobaciones de pantallas pequeñas en Chromium/WebKit, build, presupuesto de entrega y revisión de sintaxis. No hay migraciones SQL, cambios de API, bancos, reglas, premios, precios ni plazos. Para probar: recargar la aplicación, tocar Música y revisar Ajustes, pasar las dos filas de Inicio con dedo/ratón/Tab, construir desde la ficha de un cantón y volver a Inicio, revisar un precio de Tienda y abrir un regalo. Queda la comprobación de gestos, lectura con VoiceOver/TalkBack y rendimiento en los teléfonos físicos. Publicación autorizada por el usuario en las ramas `suizamente` y `suizamente-social`.

## Mapa grande también en pantallas pequeñas (26 de noviembre de 2026)

Por petición expresa del usuario, la maqueta de la pestaña Mapa conserva 380 px de alto en todas las alturas de pantalla; con un cantón elegido mide 426 px, incluida la ficha superpuesta. Esto sustituye la reducción anterior a 205 px de 23.18. En pantallas bajas se permite desplazar la página hasta las tarjetas, con espacio suficiente para que al llegar abajo queden por encima de la navegación. Se elimina «Gira, amplía y toca»; sin selección la maqueta queda limpia y con selección conserva «Toda Suiza». Las demás maquetas, incluida la del onboarding, mantienen sus medidas anteriores. `test:map-layout` verifica las alturas, el desplazamiento hasta las tarjetas, la ausencia de scroll horizontal y los píxeles visibles del modelo en Chromium y WebKit; `test-suizamente-small-browser.mjs` permite ahora el scroll de Mapa y MapaCanton. Los costes, las peticiones y las reglas no cambian.

## Giro visible de Nueva partida e invitación simple (26 de noviembre de 2026)

El aro de «Nueva partida» rota mediante `transform` en una capa decorativa recortada, con un degradado de los seis colores de Latido. Da una vuelta cada tres segundos; el botón, el signo más y el texto permanecen quietos, sin alterar sus medidas ni el área táctil. Sustituye la animación de la variable CSS para que el movimiento se pinte de forma fiable también en WebKit. Con «Menos animaciones» o la preferencia del sistema, el aro permanece quieto. La regresión de Inicio comprueba que cambian tanto la transformación como los píxeles visibles del borde entre dos ángulos, y que el contenido no gira.

La hoja «Invitar a un amigo» ofrece solo «Compartir enlace» y «Copiar enlace». Se retiran los accesos propios de WhatsApp y correo: el menú nativo de compartir ofrece las aplicaciones disponibles. Si el navegador no dispone de ese menú, «Compartir enlace» copia el enlace y lo confirma. Se conserva el enlace de invitación del servidor y su aceptación recíproca. El botón grande «Cerrar» se sustituye por una × de 44 × 44 px junto al título, con nombre accesible «Cerrar»; siguen disponibles Escape, el fondo y el gesto de la hoja.

Archivos: `v2/Home.jsx`, `home.css`, `Sharing.jsx`, `community.css`, `scripts/test-suizamente-home-browser.mjs`, `scripts/test-suizamente-friend-invites-browser.mjs` y este documento. Verificación en Chromium/WebKit: giro visible, movimiento reducido, dos acciones en 320/375/390/escritorio, compartir nativo, cancelación, copia y alternativa sin Web Share; se conserva la prueba de aceptación del enlace y amistad en ambos perfiles. Sin cambios de API, migraciones, reglas ni premios. Publicación autorizada por el usuario en `suizamente` y `suizamente-social`.

## Isla de Inicio más centrada (26 de noviembre de 2026)

Por petición del usuario, se sube la isla de Inicio 28 px en pantallas normales y 20 px en pantallas bajas. La variable `--sz-ini-isla-arriba` pasa a 240/144 px en `v2/compact.css`. Se conservan el tamaño de la isla, el cartel, las insignias, el botón y las filas de partidas. Verificación con `test:home` en Chromium/WebKit a 320/375/390 px y escritorio, capturas en `output/inicio/`, build y presupuesto de carga. Sin migraciones ni cambios de API, reglas o premios. Publicación autorizada en `suizamente` y `suizamente-social`.

## Isla completa, sin recorte delantero en la PWA (26 de noviembre de 2026)

El corte del cantón delantero estaba en el PNG generado: el encuadre anterior estimaba la altura sin considerar toda la proyección de los dos ejes del suelo ni el aumento de los objetos cercanos por la perspectiva. `world3d.js`, en `verRegion`, calcula ahora la distancia de cámara a partir de las ocho esquinas del volumen de la región, transformadas al espacio de la cámara. Incluye la profundidad de cada esquina y mantiene el margen del 10 %, con los mismos ángulos. Después se aplica el recorte transparente habitual, con el modelo entero. La posición y la caja de la isla en Inicio, la caché y la destrucción inmediata del contexto siguen igual.

Archivos: `v2/world3d.js`, nueva regresión `scripts/test-suizamente-home-framing.mjs`, comando `test:home-framing` en `package.json` y este documento. La regresión reproduce el fallo anterior con 148 píxeles opacos tocando el borde exterior; después exige que los cuatro bordes sean transparentes. Prueba seis combinaciones de regiones, niveles y proporciones de pantalla con densidad 3 y entorno de navegador similar a una PWA, en Chromium y WebKit. Comprueba también que no queden lienzos montados tras capturar. Capturas en `output/encuadre-inicio/{chromium,webkit}/`; la prueba general de Inicio mantiene las capturas de la composición real en 320/375/390 px y escritorio. Sin cambios de API, migraciones, reglas o premios. Publicación autorizada en `suizamente` y `suizamente-social`.

## Seis iconos con dos colores (26 de noviembre de 2026)

Se copian literalmente los seis SVG oficiales `sobre`, `otra`, `cambiar`, `compartir`, `escudo` y `amigos`, y el sprite completo `iconos.svg`, desde `suizamente/disenos/iconos/` a `public/suizamente-assets/iconos/`. Solo cambia el color indicado en 23.22: carta delantera amarilla, flecha inferior amarilla de Otra oportunidad, flecha superior naranja de Cambiar pregunta, flecha roja de Compartir, centro naranja del escudo y persona trasera naranja de Amigos. No se redibujan, no cambian tamaños, usos ni textos por esta actualización. Música, música desactivada, glaciar y medalla de cristal permanecen iguales. La prueba compara todos los recursos con los originales y conserva los emojis de preguntas, datos y cartas. `test:icons` comprueba Chromium/WebKit en 390 × 844, 375 × 667 y escritorio; añade capturas de Mapa y respuesta acertada a las existentes en `output/iconos/`.

## Menú: lo tuyo primero (27 de noviembre de 2026)

Se aplica la referencia de la sección 23.24: perfil; «Lo tuyo», con Logros y Libreta en tarjetas grandes; mochila sin monedas; «Juega y participa» y «Ayuda y ajustes», con filas de 60 px; y la tarjeta de Latido existente. Se conservan la campana de avisos y el acceso a Administración solo para las cuentas autorizadas.

Los contadores y resúmenes proceden de `logros`, `libreta`, `misiones` y del inventario del perfil. El logro más cercano es el pendiente con mayor proporción `avance/meta`; el último dato es el primero de la lista que ya devuelve el servidor por fecha de guardado. No se calculan premios ni se modifican reglas o definiciones. La barra anima su proporción real al entrar; con menos animaciones queda estática. Durante la carga se muestran indicadores de espera y los fallos permiten reintentar.

Archivos: `v2/Menu.jsx`, `v2/menu.css`, reexportación desde `Account.jsx`, título de Libreta en `Community.jsx`, mapeo en `Icono.jsx` y copias literales de `libreta.svg`, `lapiz.svg`, `ayuda.svg`, `ajustes.svg` y el sprite. Los iconos se aplican también al título de Crea preguntas y al logro Autoría mediante los componentes compartidos, conservando literalmente los emojis del contenido.

Verificación: `npm run test:menu` ejecuta React y PostgreSQL temporales en Chromium y WebKit. Comprueba datos y destinos reales, cero/todos los logros, libreta vacía, inventario, misiones, animación y movimiento reducido, acceso administrativo y los iconos de otras pantallas. Tamaños: 390 × 844, 375 × 667 y 320 × 568. Capturas y comparación con `#p-Menu` en `output/menu/{chromium,webkit}/`. Para probar manualmente: Inicio → ☰ → Logros/Libreta, revisar mochila y abrir las filas y Tienda. Sin migraciones ni cambios de API, permisos, premios o reglas.

## Isla animada e invitaciones preparadas (27 de noviembre de 2026)

La isla de Inicio flota suavemente mediante una transformación CSS del PNG de alta resolución. Conserva la captura por región, su caché y la liberación inmediata de WebGL; no se redibuja la maqueta en cada fotograma. El SVG de respaldo usa el mismo movimiento. Tanto la preferencia del sistema como «Menos animaciones» dejan la isla quieta.

Al entrar en Inicio con cuenta y perfil completos se preparan en segundo plano los dos enlaces existentes: partida e invitación de amistad. Nueva partida y la hoja de amigos reutilizan las peticiones pendientes o el enlace listo, sin esperar otra petición al abrirlas. La caché vive solo en memoria, está separada por cuenta y tipo, caduca con los días de configuración y se borra al cambiar de cuenta o salir. Los fallos de preparación no muestran avisos espontáneos y permiten reintentar desde la invitación. Una invitación de partida compartida se renueva al salir de Nueva partida para la siguiente visita; copiar y compartir dentro de la misma pantalla conservan el mismo enlace. Compartir recibe el gesto original del botón. Los códigos, permisos, vigencia y aceptación siguen decidiéndose en el servidor.

Archivos: `v2/home.css`, `v2/SuizamenteApp.jsx`, `v2/Lobby.jsx`, `v2/Sharing.jsx`, `lib/suizamenteInvitations.js` y la opción silenciosa de `szApi`. Sin migraciones ni cambios de reglas o API. Para probar: entrar en Inicio, observar la isla, abrir Invitar a alguien y Nueva partida, copiar y compartir; activar Menos animaciones en Ajustes. `npm run test:home-motion-invites` comprueba Chromium/WebKit, movimiento visible, nitidez, tamaños 390/375, ambas preferencias de movimiento, apertura sin nuevas peticiones aun simulando fallos de red, gesto nativo, renovación, caducidad y limpieza al cerrar sesión. Capturas en `output/inicio-animado/{chromium,webkit}/`. Se conservan las pruebas de Nueva partida y del recorrido real de invitaciones de amistad.

## Emparejamiento asíncrono con cuentas reales (26 de noviembre de 2026)

Petición expresa del usuario, que sustituye el requisito anterior de presencia online para «Rival al azar». El servidor selecciona entre perfiles registrados de Suizamente, conectados o desconectados, excluyendo el propio perfil, invitados antiguos, cuentas bloqueadas o pendientes de renombrar, usuarios con bloqueo global, personas al límite de partidas y parejas que ya tengan una partida buscando rival o en juego. Cuenta las partidas abiertas en ambos lados de la partida, incluidas las búsquedas antiguas. Entre las cuentas elegibles elige la que menos partidas abiertas tenga; los empates se resuelven al azar. Conserva el máximo de partidas, los plazos, los premios y los turnos existentes. Sin candidatos devuelve el 409 existente sin insertar una partida vacía.

La recomendación visible en «Iniciar una partida» es independiente: una persona realmente online, dentro del margen de nivel ya configurado, priorizando el nivel más cercano. Se muestra antes de «Rival al azar», con su apodo, avatar, nivel y «En línea». Si solo hay personas desconectadas, se sigue pudiendo iniciar una partida al azar. La explicación dice que cada rival puede estar desconectado; ya no exige que pertenezca a Latido. Si la persona recomendada se desconecta antes de tocarla, la selección explícita sigue permitiendo jugar por turnos. Se conservan las rutas `GET /emparejamiento` y `POST /partidas` y el cuerpo `{ rival }`; la respuesta del vestíbulo añade `asincrono: true` y mantiene los avatares. La configuración identifica esta revisión con `apiVersion: 26`.

La migración `supabase/suizamente_v26_emparejamiento_asincrono.sql` se aplica después de v25, antes de publicar el frontend. Es transaccional e idempotente: añade el selector privado, actualiza la elección al azar en el motor existente y conserva todas las capas de autenticación, moderación, límites y permisos. Coordina las creaciones autenticadas antes de tomar bloqueos de cuenta; dos peticiones simultáneas reevalúan las parejas, la carga y la capacidad en el servidor. No añade tablas ni cambia partidas guardadas, saldos, votos, bancos o datos personales. Aplicada en producción el 26 de noviembre de 2026: se verifican el selector del motor, sus permisos privados y la respuesta HTTP pública de configuración con `apiVersion: 26`. Las definiciones anteriores se guardaron en `output/emparejamiento/produccion/antes-funciones.json` como respaldo local.

Archivos de emparejamiento: `v2/Lobby.jsx`, la migración v26, `scripts/lib/suizamente-v2-test-db.mjs`, `scripts/lib/suizamente-v2-preview.mjs`, tres pruebas `test-suizamente-matchmaking*.mjs`, comando `test:matchmaking` en `package.json` y este documento. `npm run test:matchmaking` valida SQL real, PostgreSQL simultáneo en un contenedor aislado, selección offline con menor carga, exclusión en ambos sentidos, sugerencia online del nivel más cercano, avatares, límites, moderación, privacidad y migración repetida; Chromium/WebKit prueban las dos tarjetas, la desconexión entre propuesta y clic, una comunidad enteramente offline y la falta de candidatos. Capturas en `output/emparejamiento/`. Para probar manualmente: abrir Nueva partida, elegir la propuesta online o Rival al azar, jugar el primer turno y regresar; el azar no vuelve a elegir un rival con partida en curso. Publicación autorizada por el usuario en `suizamente` y `suizamente-social`.


## Mapa y negocios (37–39)

Mapa sin barra por defecto, controles separados para acercar y construir, huecos compartidos generados con Huecos3D y módulo de negocios revisados por Latido, con factura manual. Negocios y cobro automático quedan apagados. Latido ha aplazado Stripe: el pago automático muestra «Próximamente disponible». Se mantienen las funciones anteriores, los bancos y la economía. Migraciones aditivas v34, v35 y v36 aplicadas el 27 de noviembre de 2026. Detalles, archivos, verificación y operación en [NEGOCIOS-IMPLEMENTACION.md](NEGOCIOS-IMPLEMENTACION.md).

## Inicio y decoración por cantón (28 de noviembre de 2026)

Las mejoras y negocios ya están activados; el cobro automático sigue apagado. «Juega ahora» se dibuja al cargar la configuración, mientras llegan los datos personales. El resumen reutiliza los lectores existentes sin cargar tres veces más el estado completo. La pastilla «Decorar» del Mapa transmite el cantón elegido: el decorador muestra solo su maqueta, huecos y contador. Su flecha vuelve a la región. Se conserva la colocación y validación del servidor. El misterio del 28 de noviembre está publicado desde el calendario editorial, con las pistas cerradas y la solución privadas. Implementación, migraciones v39/v40, pruebas y operación: [INICIO-RAPIDO-IMPLEMENTACION.md](INICIO-RAPIDO-IMPLEMENTACION.md).
