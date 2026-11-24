# Suizamente independiente: decisiones de presentación y acceso

Estas decisiones actualizan la especificación de Suizamente por petición expresa.
No cambian las reglas, los precios ni los premios del juego.

- **Acceso explícito:** cada arranque presenta Crear cuenta gratis, Ya tengo cuenta,
  Entrar con Google y Entrar con cuenta de Latido, aunque haya una sesión guardada.
  No se puede jugar sin cuenta. La selección permanece durante la navegación de esa
  visita. El perfil y su botón «¡A jugar!» aparecen después de identificarse.
- **Identidad:** Latido aporta el nombre y la foto inicial, mediante lectura del
  perfil y el puente SSO existente. Un apodo o foto ya elegidos en Suizamente se
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
