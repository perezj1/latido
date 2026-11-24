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
