# Suizamente · juego, comunidad y administración

La revisión de acceso requiere cuenta de Latido: entrada con Latido, Google o
email y API v14. Los recorridos antiguos como invitado descritos más abajo son
históricos; los datos existentes solo se recuperan después de iniciar sesión.

Esta entrega sustituye la entrada del juego de montañas por la base y las partidas
1 contra 1 de los nuevos diseños. El esquema y el historial antiguos se conservan.
La referencia local suizamente/ no forma parte del despliegue. Los efectos numéricos
de los eventos están documentados en su data/juego.json y se copian al servidor.

## Instalar

En el mismo proyecto Supabase que utiliza Latido, ejecutar en este orden:

1. supabase/suizamente_v2.sql: tablas privadas, permisos, identidad, votos y motor.
2. supabase/suizamente_v2_datos.sql: preguntas y configuración.
3. supabase/suizamente_v3_economia.sql: libro de premios, XP, niveles, racha,
   inventario, logros y avisos de progreso.
4. supabase/suizamente_v4_tienda_duelo.sql: compras, regalo diario, comodines y
   duelos de sellos.
5. supabase/suizamente_v5_mapa_asaltos.sql: mapa, cofres de región, asaltos,
   escudos, estadísticas y avisos del mapa.
6. supabase/suizamente_v6_album.sql: cartas, sobres, colecciones y cofres de victoria.
7. supabase/suizamente_v7_comunidad.sql: amigos, pregunta del día, ranking,
   libreta, propuestas, valoraciones, denuncias y avisos de datos.
8. supabase/suizamente_v9_admin.sql: panel, registro de acciones y Economía
   con versiones. Instala pg_trgm en PostgreSQL para detectar textos parecidos.
9. supabase/suizamente_v10_admin_operaciones.sql: Eventos y Ligas, efectos
   en el servidor, grupos semanales y protección de datos de contacto.
10. supabase/suizamente_v11_duracion.sql: misiones, vueltas y marcos, colección
    mensual, liga para jugadores y recuperación de compras interrumpidas.
11. supabase/suizamente_v12_progreso.sql: cierre y reparto sin visitas, tabla
    `suizamente_ligas`, avisos de ascenso/descenso y reparto diario programable.
12. supabase/suizamente_v12_tareas.sql: activa el trabajo `suizamente-progreso`
    con pg_cron, cada minuto. Ejecutarlo con la cuenta administradora de la base.
13. supabase/suizamente_v13_produccion.sql: rivales reales disponibles, consulta
    del vestíbulo y bloqueo de turnos en partidas antiguas sin rival.
14. supabase/suizamente_v14_cuentas.sql: cuenta de Latido obligatoria también
    para las llamadas directas a la RPC; conserva la vinculación de invitados antiguos.

Los SQL son transaccionales y repetibles. No requieren instalar de nuevo el
Suizamente anterior. No exponer suizamente_private en la API de Supabase.
La RPC pública comprobada es suizamente_v2; las tablas siguen inaccesibles para
anon y authenticated. La migración conserva las clases existentes de avisos
de Latido y añade las dos clases del juego si existe app_notifications.

Si ya está instalado el álbum, aplicar los archivos v7 a v12 de esta lista.
Antes de v10, aplicar la versión actual de suizamente_v2_datos.sql para cargar
eventosFinDeSemana.efectos; las modificaciones de Economía se conservan.
Si ya estaba instalado v9, volver a aplicar su versión actual y después v10.
No hay migración v8 en este checkout.
Las actualizaciones
conservan el motor comprobado y añaden sus operaciones en la misma transacción.
No volver a aplicar v2 por separado después de actualizar: si se reinstala, repetir
el orden completo hasta v12. v3 importa las recompensas de respuestas y partidas
existentes una sola vez mediante las mismas referencias del libro.

Desplegar el frontend y la función api/suizamente.js juntos en Vercel.
La API usa la conexión de Supabase existente:
SUPABASE_URL y SUPABASE_ANON_KEY, o sus equivalentes VITE_SUPABASE_*.
No necesita la clave de servicio. El JWT de Latido se verifica en Supabase.
vercel.json incluye los archivos privados de datos en el paquete de la función,
sin copiarlos a dist.

### Avisos en segundo plano

La bandeja interna de Latido recibe los avisos de turno en la misma transacción
que el cambio de turno. Los invitados conservan el estado de la partida, pero no
tienen destinatario en la bandeja de cuentas de Latido.

Para push, desplegar la actualización de latido_push_notification usando el
proyecto y los secretos VAPID/webhook que ya utiliza Latido. Después ejecutar
supabase/suizamente_v2_avisos.sql: programa cada cinco minutos la resolución de
plazos y el recordatorio de seis horas, y reutiliza un webhook push existente sin
mostrar su secreto. Si no encuentra uno, deja un aviso con la configuración
pendiente. El SQL base sigue comprobando caducidades en cada lectura/acción aunque
no se active cron. El recordatorio es único por turno.

El 24 de noviembre de 2026 se han aplicado en el proyecto Latido las migraciones
pendientes desde Comunidad hasta v13, incluida la importación actual de datos y
las tareas `suizamente-progreso` y `suizamente-turnos`. Se ha desplegado
`latido_push_notification`. Se conservan el perfil, las cuatro partidas y los
catorce movimientos anteriores. Se ha comprobado `apiVersion=13`, RLS y ausencia
de permisos de lectura de tablas privadas para anon/authenticated. La copia previa
y el informe, que no deben publicarse, están en `output/suizamente-final/produccion/`.
Los tests de juego utilizan PostgreSQL aislado; no crean usuarios ficticios en producción.

## Datos y configuración

Copias incluidas:

- server/suizamente/data/preguntas.json
- server/suizamente/data/juego.json
- server/suizamente/data/album.json
- public/suizamente-assets/logo-suizamente.svg
- public/suizamente-assets/mapa-cantones.svg

La petición de estas fases especifica el banco nuevo de data/preguntas.json.
Se conservan sus identificadores y el orden original de las opciones.
El banco revisado anterior sigue intacto, pero no se mezcla con las partidas nuevas.

El módulo único del servidor es server/suizamente/config.mjs. Carga juego,
álbum y preguntas. El importador utiliza ese mismo módulo para generar los datos
SQL. PostgreSQL guarda la configuración importada y una copia de las reglas en
cada partida: cambiar los números no altera partidas empezadas.

Para volver a copiar los cinco recursos después de actualizar la referencia:

    npm run suizamente:v2:sync

O desde otro directorio de referencia:

    node scripts/sync-suizamente-v2.mjs "C:/ruta/al/material/suizamente"

Después ejecutar el SQL regenerado supabase/suizamente_v2_datos.sql y desplegar
la aplicación. Nunca editar a mano preguntas o cartas generadas. Si se corrige
una opción publicada, conservar su significado/índice o crear una pregunta nueva.
La exclusión de Git es /suizamente/, anclada a la raíz: no debe excluir los
componentes ni el módulo de servidor que también llevan ese nombre.

## Probar en móvil y escritorio

Con las migraciones de esta lista aplicadas y la conexión habitual de Latido:

    npm run dev

Abrir http://localhost:8080/suizamente. Para un móvil en la misma red:

    npm run dev -- --host 0.0.0.0

Abrir en el móvil http://IP-DEL-ORDENADOR:8080/suizamente. Push y algunas funciones
de compartir requieren HTTPS; se prueban mejor en el despliegue de vista previa.
El servidor asigna el UUID del invitado si el navegador móvil no ofrece
crypto.randomUUID en una conexión HTTP local.

Recorrido inicial: apertura → cinco pasos → entrar con Latido o continuar como
invitado → perfil → nueva partida. Recargar conserva el perfil; volver a ver la
bienvenida desde Ajustes no concede otro regalo. El regalo es 100 monedas,
un sobre y dos «Quita una». Si la cuenta tiene respuestas del juego anterior,
el saldo inicial es 500 en lugar de 100. Inventario y monedas de bienvenida se
guardan y se pueden gastar en el juego.

Para una partida real:

1. Entrar con dos cuentas de Latido, en dos dispositivos o perfiles de navegador.
2. Crear el perfil de Suizamente en ambos.
3. En «Nueva partida», buscar el apodo de la otra cuenta y pulsar «Jugar».
   También se puede compartir una invitación, válida siete días y de un solo uso.
4. Girar y responder. Un acierto permite seguir; un fallo cambia el turno.
   La otra cuenta encuentra la partida en Inicio y recibe el aviso interno.
5. Con la barra llena o la casilla de sello, elegir una categoría pendiente.
   Se gana al conseguir los seis sellos. Al terminar se puede pedir revancha.

«Rival al azar» utiliza una cola de personas reales; no hay bots. Si no hay rival,
se puede jugar el primer turno mientras se espera. Se prioriza ±3 niveles y se
amplía el rango después de 24 horas. Los invitados pueden aceptar invitaciones y
entrar en partidas de la cola con una cuenta de Latido; no pueden buscar ni invitar.

### Vista previa aislada

    npm run preview:suizamente:v2

Para probar sin instalar las migraciones remotas, en el puerto 8080:

    npm run preview:suizamente:v2 -- --port 8080 --demo --host 0.0.0.0

Este modo necesita el puerto libre. Ofrece cuentas de prueba con recursos para
construir y abrir sobres: /__suizamente_qa?cuenta=alex y
/__suizamente_qa?cuenta=lu (abrir la segunda en una ventana privada).
La cuenta /__suizamente_qa?cuenta=caro administra únicamente la base temporal.
La franja «Prueba local» identifica esta vista. No utiliza cuentas reales ni
guarda datos al detener el proceso. En el móvil usar la IP local del ordenador
y el mismo puerto. Para volver al servidor conectado a Latido, parar la vista
aislada y ejecutar npm run dev.

Abre http://127.0.0.1:5265/suizamente. Utiliza el motor SQL real y una base
temporal en memoria, con perfiles de prueba. No se conecta al Supabase remoto.
Sirve para revisar onboarding, perfil, tienda, mapa, cofres, álbum, sobres,
comunidad y administración. Los datos
desaparecen al cerrar el proceso. Nunca desplegar este servidor de pruebas.

## Contrato y protección

- Rutas: /api/suizamente/config, /jugador, /jugador/vincular,
  /jugador/bienvenida, /inicio, /partidas, /jugadores, /invitaciones,
  /partidas/:id, y POST girar, pregunta, respuesta, rendirse.
- Economía: GET /perfil, /logros, /tienda; POST /novedades/leer,
  /tienda/comprar, /tienda/regalo; POST /partidas/:id/comodin y /duelo.
  Las compras envían articulo y clave UUID; comodines y duelos envían turnoN.
  Un comodín envía además n y tipo (quita, otra, salta, tiempo); un duelo
  envía quitar y apostar, o bien operacion: continuar para cerrar su resultado.
- Mapa: GET /mapa; POST /mapa/construir con canton, nivel actual y clave UUID.
  Cofres: GET /cofres/:id y POST /cofres/:id/abrir. Álbum: GET /album;
  POST /sobres con clave UUID, GET /sobres/:id y POST /sobres/:id/girar con indice.
  Asaltos: GET /asaltos/:id; POST empezar, respuesta, comodin y descartar.
  Las acciones del asalto usan su propio turnoN sin cambiar el de la partida.
- Votos: POST /votos, GET /votos/mios, GET /votos/resumen. Solo el primer voto
  se conserva; las respuestas reales se registran mediante la partida, para que
  /votos no pueda utilizarse como corrector adelantado.
- GET /preguntas/:id ofrece el enunciado de un dilema sin explicación;
  la explicación se revela al votar. La pregunta del día está disponible desde
  Inicio y desde su enlace compartido.
- La API conserva un UUID local y una credencial HttpOnly del invitado.
  Conocer o modificar X-Jugador-Id no concede acceso a otra identidad.
  Al entrar, la vinculación exige esa credencial, conserva el voto de la cuenta
  ante un conflicto y evita duplicar el regalo. No fusiona una partida activa
  entre la propia cuenta y su invitado: hay que terminarla antes.
- Las escrituras comprueban el origen. Respuestas privadas y API usan no-store.
  El catálogo de soluciones no está en el frontend ni se sirve en desarrollo.
- Cada acción de una partida envía turnoN, la versión de estado recibida.
  Se incrementa al modificarla. Repetir o actuar con una versión anterior da 409.
- La pregunta conserva una copia privada de su contenido y de la permutación;
  cada opción pública contiene su indice original. No se entregan correcta
  ni dato antes de responder, tampoco a través de la vista del rival.
- Tiempo: 30 segundos y tres de margen, calculados con el reloj del servidor.
  Recargar no reinicia el reloj. Al recuperar una pregunta caducada, se resuelve
  una sola vez como fallo. Si la acción descubre un plazo de turno vencido,
  confirma la caducidad y la capa HTTP responde 409 con el estado actualizado.
- Los porcentajes de acierto solo salen desde 20 votos. Los votos repetidos no
  inflan el recuento. No se exponen elecciones individuales de otras personas.
- Al finalizar la ronda 25 se comparan sellos, después aciertos y después el tiempo
  acumulado de respuesta medido por el servidor, según la decisión de Latido.
  El caso de igualdad exacta de los tres valores queda sin ganador.
- Borrar los datos del juego exige dos confirmaciones en pantalla, anonimiza los
  votos y retira los datos nuevos de Suizamente. No borra la cuenta de Latido ni
  el archivo histórico del juego anterior.

## Pruebas

    npm run test:suizamente:v2
    npm run test:suizamente:v2:browser
    npm run test:suizamente:v3
    npm run test:suizamente:v4
    npm run test:suizamente:v4:browser
    npm run test:suizamente:v5
    npm run test:suizamente:v6
    npm run test:suizamente:v6:browser
    node scripts/test-suizamente-v2-browser.mjs --webkit
    node scripts/test-suizamente-v4-browser.mjs --webkit
    node scripts/test-suizamente-v6-browser.mjs --webkit
    npm run build

La primera orden ejecuta SQL real y la API HTTP: propiedad de sesiones, regalo,
vinculación, primer voto, opciones originales, barra, sellos, fin, rendición,
invitaciones, emparejamiento, tiempo/margen, recarga sin conexión, ronda 25,
acciones repetidas, umbral de 20 votos, RLS y migraciones repetibles. Comprueba
también la bandeja de Latido y los recordatorios únicos.

Los tests de navegador usan dos cuentas de prueba contra el mismo motor SQL,
onboarding invitado, perfil, regalo, temas y tamaños 320/390/1280. Las capturas
quedan en output/latido-card/suizamente-v2/. No utilizan cuentas reales.

Las pruebas v3/v4 ejecutan el SQL completo: importes configurados, premios y
compras únicos, saldo insuficiente (402), tres escudos, regalo por fecha de Zúrich,
límites de nivel, racha a medianoche y cambios de horario, logros, vinculación,
comodines y primer voto, seis preguntas comunes, desempate por acierto o rapidez,
cambio único de sello y cancelación de un duelo al abandonar. Las nuevas capturas
de navegador quedan en output/latido-card/suizamente-v4/.

## Probar la economía y el duelo

1. En Inicio, tocar las monedas para abrir Tienda. Abrir el regalo diario;
   recargar conserva el saldo y la tarjeta queda abierta hasta la próxima fecha
   de Zúrich. Comprar y comprobar los contadores; sin saldo aparece «Te faltan 🪙 N».
2. En una pregunta de tres opciones, probar Quita una y Otra oportunidad antes
   de responder. Un primer fallo permite elegir otra vez y conserva el primer
   voto. Cada tipo se descuenta una vez por pregunta. Cambiar reinicia a 30 s
   con otra pregunta de la misma categoría; no está permitido en sello/duelo.
3. Acertar y volver a Inicio: se actualizan monedas, nivel y racha. El avatar
   abre Perfil, con desempeño y acceso a los logros definidos en juego.json.
4. Con dos cuentas, conseguir un sello distinto cada una. Al llegar a elegir
   sello aparece Duelo de sellos: elegir el sello que quieres y el que apuestas.
   Responder seis preguntas; la otra cuenta responde las mismas seis.
   El empate abre una pregunta común de desempate; si coinciden en acierto,
   decide el tiempo del servidor. Al finalizar, cada cual ve su resultado y
   se reanuda la partida con el turno de quien recibió el reto.
5. Ganar una partida da 100 monedas y 150 XP; perderla, 10 y 30. Rendirse o
   dejar caducar el turno no da premio a quien abandona (decisión de Latido);
   quien gana sí lo recibe. Un duelo pendiente se cancela sin transferir sellos.

Los premios se leen del juego.json importado. Cada recibo tiene la clave única
jugador/motivo/ref, y se escribe junto con la acción.

El invitado conserva su actividad, logros, compras y duelos al vincularse a Latido.
Se unifican los recibos de bienvenida y del mismo regalo diario. Si las dos
identidades ya gastaron esos regalos y la unificación produciría saldo o
inventario negativo, la vinculación devuelve 409 sin cambiar ningún dato; hay que
reponer lo gastado antes de vincular. No se regala un segundo saldo para resolverlo.
También se impide superar el máximo configurado de escudos al unir inventarios.

## Probar mapa, asaltos y álbum

1. Abrir Mapa desde su pestaña o desde la tarjeta de Inicio. La región actual
   tiene borde azul; los niveles de sus cantones pasan de blanco a verde.
   Tocar una tarjeta construye el siguiente nivel al precio de juego.json.
   La tira de cantones se desplaza horizontalmente. «?» abre MapaAyuda.
2. Completar los tres niveles de todos los cantones de la región abre un cofre
   y desbloquea la región siguiente. El premio se suma al abrir el cofre:
   200 monedas, un sobre y un escudo, con máximo de tres escudos.
   Los cofres pendientes siguen disponibles en Mapa y Álbum.
3. Con otra cuenta, construir al menos un nivel en su región actual. Al acertar
   en una partida puede aparecer «¡Asalto disponible!». El sorteo del servidor
   tiene probabilidad 1/8 y un máximo de tres ofertas por fecha de Zúrich.
   Sin otro mapa disponible no se crea una oferta ni se inventa una persona.
4. Abrir el asalto y responder: un acierto da 100 monedas y baja un nivel;
   si hay escudo, se consume y da 30 sin daño. Un fallo o tiempo agotado no da
   premio. Se puede usar Quita una, Otra oportunidad y +15 s según las mismas
   restricciones de las preguntas; Cambiar está apagado.
   El asalto no llena la barra, no cambia el turno y no añade el premio normal
   de acierto ni XP. Al terminar se vuelve a la ruleta de la partida.
5. Si el cantón deja de ser asaltable o la región se completa antes de resolver,
   se cancela sin premio ni daño, según la decisión de Latido. La comprobación,
   el consumo de escudo, el nivel y ambos recibos se guardan en una transacción.
   Las regiones completas no se pueden asaltar.
6. Al ganar una partida, FinPartida permite abrir su cofre: 80 monedas,
   un sobre y un comodín aleatorio, además del premio normal de victoria.
   Los cofres de victorias nuevas y anteriores se crean una sola vez.
7. Abrir Álbum. Las cinco colecciones iniciales tienen nueve cartas cada una.
   Las siete colecciones con mes permanecen preparadas para la fase de duración.
   Un sobre consume una unidad y el servidor sortea tres cartas: primero rareza
   (60/30/10), después una carta uniforme de esa rareza entre las colecciones
   disponibles. Una repetida, incluso dentro del mismo sobre, da cinco monedas.
8. Girar las cartas en orden. Recargar conserva el mismo sobre y las ya giradas;
   «Retomar el sobre» recupera uno sin terminar. Las cartas futuras del sobre
   no se incluyen en la respuesta del sobre hasta que se giran. Los premios y las cartas ya se
   guardan al abrirlo: salir sin girar no permite repetir el sorteo.
9. Al completar una colección se recibe automáticamente el premio de album.json
   (200 + 100 × id, dos Quita una y un escudo), una sola vez.
   Tocar una carta abre su detalle; las que faltan no muestran su dato.

Las tablas nuevas, dentro de suizamente_private, son suizamente_mapa,
suizamente_cofres, suizamente_asaltos, suizamente_cartas y suizamente_sobres.
Las construcciones usan recibos por operación: reconstruir un nivel después de
un asalto vuelve a cobrar su coste. Cofres de región y premios de colección
utilizan referencias naturales únicas por persona, incluso al vincular invitado.
El inventario limita a tres los escudos de cofres y colecciones, como el prototipo.

Latido todavía no tiene amistades entre jugadores. El selector ya prioriza
relaciones aceptadas si la fase de comunidad incorpora suizamente_amigos; mientras
tanto elige de forma uniforme entre personas con cantones asaltables y, después,
un cantón elegible de esa persona. No se usan seguidores de creadores como amigos.
Los avisos llegan a la bandeja de Latido y a Suizamente con «Ver mapa». Para push,
desplegar también la actualización de latido_push_notification; se reutiliza el
webhook ya documentado, sin nuevos secretos.

El SVG se lee desde public/suizamente-assets/mapa-cantones.svg, con sus 26
geometrías y sus lagos. Se conserva la atribución © swisstopo, swiss-maps (BSD-3).
La carpeta de referencia permanece fuera del despliegue; no se cambian los ids
ni el orden de las opciones del banco.

Las pruebas v5/v6 cubren todos los costes y regiones, reconstrucción, cofres
únicos, inventario, daño/escudo, cancelación concurrente, temporizador, límite
diario, prioridad de amigos, avisos, pesos de rareza, repetidas, premios,
recuperación de sobres, vinculación y permisos. El navegador usa dos cuentas
contra SQL real, claro/oscuro y 320/390/1280. Capturas:
output/latido-card/suizamente-v6/.

Pantallas no dibujadas: se reutilizan las tarjetas y mensajes existentes para
asalto fallido/cancelado, mapa completo, cofres pendientes y sobre pendiente.
No se concede todavía un premio de vuelta del mapa ni se activan colecciones
mensuales o eventos.

## Comunidad y administración

Las cinco pestañas Mapa, Álbum, Inicio, Tienda y Amigos están disponibles.
Las pantallas nuevas están en src/components/suizamente/v2/Community.jsx,
Sharing.jsx, LatidoCards.jsx y Admin.jsx, con estilos compartidos y modo oscuro.
Las tarjetas mini sustituyen la entrada anterior en Inicio y Perfil de Latido.
Usan la sesión real de quien entra, también si es colaborador de otra cuenta.
No se reutilizan los seguidores de creadores como amistades de jugadores:
Latido tiene ese seguimiento editorial, pero no una red de amistades personales.
Las relaciones de juego se guardan en suizamente_amigos.

Rutas web: /suizamente/amigos, /ranking, /jugador/:id, /pregunta-del-dia,
/pregunta/:id, /libreta, /crea-preguntas y /proponer. Los sufijos se entienden
bajo /suizamente. Los enlaces compartidos con ?p= conservan el dilema concreto.
El resultado y los desgloses por país/años exigen 20 votos, también en el panel.
Los votos anteriores sin metadatos conservan su total; no se les atribuye un
país posterior. La libreta y las respuestas finales no revelan soluciones
pendientes. Los premios diarios y de valoraciones usan el libro de movimientos.
Las semanas y los límites diarios se calculan en Europe/Zurich, incluido el
cambio de hora. Desempata el número de sellos realmente ganados esa semana.

La API añade GET portada/capacidades/dia/amigos/amigos/buscar/ranking/libreta/
propuestas/valoraciones, GET perfiles/:id y resultados/:id, POST dia/voto,
POST amigos/propuestas/valoraciones/denuncias/reportes y PUT libreta.
POST votos también admite contexto.tipo=dia con su fecha. El primer voto
conserva el índice original aunque se vuelva a pedir la misma pregunta.
Los invitados pueden votar antes de crear un perfil, guardar datos al crearlo,
aceptar invitaciones y jugar con la cola; para seguir, invitar, proponer, valorar
y aparecer en rankings se exige cuenta. Al vincular se unen libreta y recibos
diarios sin duplicar premios. El borrado elimina propuestas pendientes y datos
personales de comunidad, conservando agregados sin vincularlos al perfil.

### Acceso al panel

/suizamente/admin abre el resumen. En móvil hay navegación inferior y un detalle
de propuesta separado; en escritorio, menú lateral y lista/detalle.
Desde Menú y el panel general de Latido solo aparece el enlace si capacidades
confirma el permiso del servidor. Las rutas /api/suizamente/admin/* comprueban
el rol de nuevo y devuelven 403 al resto, incluso sin perfil de juego.

Se reutiliza suizamente_private.is_admin() del Suizamente anterior y el permiso
servidor public.is_business_promotion_admin() de Latido. La lista privada admins
existente también se conserva. No se usa la lista de emails del navegador para
autorizar la API. Si el entorno no tiene ninguno de esos roles, administración
puede añadir un UUID autorizado a suizamente_private.admins desde SQL. La
migración no concede permisos de administración a ninguna cuenta por defecto.
Solo el servidor de pruebas añade a Caro. No se devuelven emails ni contactos.

Secciones: resumen, propuestas, avisos, preguntas, jugadores, denuncias, dia,
ranking, economia, partidas, asaltos, album, eventos, ligas y registro. Los sufijos bajo
/api/suizamente/admin son los de la sección 20.9, más GET/PUT economia y GET
partidas?q=, asaltos, album y registro. Las acciones guardan actor, fecha,
objeto y cambios en suizamente_admin_registro. Soporte de partidas expone
estado, turno, barra y sellos; nunca respuestas ni votos de participantes.
Quitar del ranking es una exclusión de moderación independiente de la preferencia
de privacidad: no se puede eludir editando el perfil. Devolver al ranking respeta
la elección de privacidad del jugador. La exclusión por semana se guarda aparte.

Aprobar avisa al autor. Publicar conserva el flujo editorial: copiar la línea
D/R/V a la fuente fuera del despliegue, regenerar/sincronizar el banco y después
vincular el id publicado. Solo vincular entrega 100 monedas y 100 XP y el logro
Autoría, una vez. La app no escribe en la carpeta de referencia.

### Economía en vivo

El archivo server/suizamente/data/juego.json y su copia importada en SQL son los
valores por defecto. suizamente_configuracion guarda economia_override y su
versión; el servidor combina ambos en un único v2_config(). El panel guarda
el historial completo en suizamente_economia_historial y un registro de cambios.
PUT exige la versión que se leyó: una edición simultánea devuelve 409.
Precios, premios y probabilidades se aplican a las nuevas acciones sin desplegar;
las partidas empezadas conservan sus reglas y tiempos originales. La cabecera y
la tienda refrescan su configuración cuando cambia la versión del servidor.
Se validan tipos, límites y pesos. Cambiar la estructura de niveles/cantones
requiere una migración, no una edición numérica del panel.

Volver a ejecutar npm run suizamente:v2:sync y aplicar el SQL de datos actualiza
los valores por defecto y los contenidos, conservando las modificaciones de
Economía. No volver a instalar una migración antigua de lógica por separado.
Los números de protección de comunidad están bajo comunidad en la configuración
del servidor y también se pueden consultar/editar en la vista JSON del panel.

Los avisos de solicitudes, aceptación y moderación llegan a la bandeja que ya
tiene Latido, además de Suizamente. Para recibirlos como push se debe desplegar
la actualización de supabase/functions/latido_push_notification/index.ts con el
webhook y los secretos que ya usa Latido. No hay un servicio nuevo de email.
Las historias usan el Canvas del diseño, adaptado a resultado, perfil y partida;
producen PNG 1080×1920 sin nombre y sin enviar información a terceros.

### Recorrido de prueba

1. Entrar como Alex y Lu en dos navegadores/perfiles distintos. En Amigos, buscar
   Lu, añadir y aceptar desde Lu; abrir su perfil, seguir/dejar de seguir o jugar.
2. Votar la pregunta del día: con poca muestra no aparecen porcentajes. Guardar
   el dato y comprobar Menú → Libreta. Abrir Compartir y descargar la historia.
3. Proponer contenido de los archivos: hasta tres propuestas al día. Con otra
   cuenta, valorar. Las valoraciones premian hasta 20 monedas por día.
4. Como Caro, Menú → Administración: revisar y aprobar, copiar la línea y vincular
   su id tras publicarlo. Alex ve el aviso, estado y premio de publicación.
5. En Economía, cambiar el precio de un sobre y guardar. Abrir Tienda en Alex:
   la siguiente compra usa el precio nuevo. Revisar Historial y Registro.
6. Como Alex, abrir /suizamente/admin muestra acceso restringido; la API devuelve
   403. Probar moderación, calendario futuro y exclusión de una semana como Caro.
7. Como Caro, Eventos: elegir un fin de semana futuro, programar tipo y categoría
   si corresponde, guardar y revisar Registro. Restaurar la rotación automática
   conserva una versión nueva para detectar ediciones antiguas.
8. En Ligas, elegir semana, división y grupo; comprobar puntos, ascensos y
   descensos. Sin actividad de la semana anterior, se explica que no hay grupos.

Para una prueba local aislada, ejecutar `npm run preview:suizamente:v2 -- --demo`.
Abrir `http://127.0.0.1:5265/__suizamente_qa?cuenta=caro` y después
`http://127.0.0.1:5265/suizamente/admin`. Alex y Lu están disponibles desde la
barra de prueba. La base es temporal y no utiliza cuentas ni datos remotos.

La comprobación específica del panel es `npm run test:suizamente:admin`:
permisos HTTP en todas las secciones, registro del actor, Economía aplicada a
compras sin desplegar, historial/versiones y conservación de valores al importar
los archivos. También comprueba horarios y cambios de hora, efectos y caducidad
de eventos, grupos de 30, puntos, desempates, exclusiones y premio único por liga.
`npm run test:suizamente:admin:browser` revisa las cinco pantallas dibujadas,
los formularios y las nuevas secciones a 1440, 390 y 320 px y en modo oscuro.
Para WebKit: `node scripts/test-suizamente-admin-browser.mjs --webkit`.
Las capturas de este recorrido están en `output/suizamente-admin/`.

### Eventos y ligas en administración

GET `/api/suizamente/admin/eventos?desde=AAAA-MM-DD` devuelve ocho fines de semana
con el evento elegido o su rotación automática. PUT `/admin/eventos/{viernes}`
recibe `version`, `tipo` y `categoria` para los eventos de categoría. DELETE en
esa misma ruta, con su `version`, vuelve a la rotación automática. Se exige rol,
un viernes y que el evento no haya empezado; una edición simultánea devuelve 409.
Las fechas del servidor usan Europe/Zurich, también en los cambios de hora.
La rotación usa como referencia estable el primer viernes de 2026.

Los parámetros numéricos están en `eventosFinDeSemana.efectos` dentro de
`server/suizamente/data/juego.json`, copiado de la referencia. Economía permite
cambiarlos y guarda historial. Monedas, cartas, ruleta y costes se calculan en
el servidor dentro del horario del evento; Inicio lo anuncia y los aciertos de
categoría muestran el multiplicador. Los recibos conservan el premio entregado.

GET `/api/suizamente/admin/ligas?semana=AAAA-MM-DD` muestra los grupos persistidos
de la semana, sus puntos y el destino de cada persona. Antes del cierre son
provisionales. Los grupos se forman con cuentas activas la semana anterior;
un último grupo puede tener menos de 30 personas. En grupos pequeños, las zonas
de ascenso y descenso se aplican en ese orden para evitar solapamientos.
El trabajo programado cierra las semanas pendientes aunque nadie abra la app,
aplicando los puntos de cada semana por separado. Las lecturas autenticadas
conservan la recuperación del cierre si el trabajo se interrumpe temporalmente.
Cada premio usa la referencia única `liga` + semana. Las reglas de una semana
quedan guardadas al formar sus grupos; los cambios de Economía rigen las nuevas.

Las tablas son `suizamente_eventos`, `suizamente_liga_estado`,
`suizamente_liga_semanas` y `suizamente_ligas`, todas privadas y con RLS.
v12 renombra la tabla de miembros conservando sus filas y claves; el nombre
anterior `suizamente_liga_miembros` queda como vista privada de compatibilidad.
El panel elimina campos de contacto y oculta emails que aparezcan dentro de
avisos, notas o registros. Soporte de partidas usa una lista explícita de campos
sin votos ni respuestas. Álbum cuenta las cartas repartidas desde sus recibos,
incluidas las repetidas; Asaltos muestra frecuencia y concentración de objetivos.

Pruebas nuevas: npm run test:suizamente:v7, npm run test:suizamente:v9,
npm run test:suizamente:v2 (incluye HTTP), npm run test:suizamente:v7:browser;
para WebKit: node scripts/test-suizamente-v7-browser.mjs --webkit.
Comprueban zona horaria y DST, top 50 más fila propia, desempate por sellos,
umbral por grupo, propuestas/valoraciones, permisos, borrado, autoría una vez,
registro, precios en vivo, filtros y pantallas de 320/390/1440 px.
Las capturas quedan en output/latido-card/suizamente-v7/.

## Acabado y duración

Si ya está instalado v10, aplicar primero el `suizamente_v2_datos.sql` actual y
después `suizamente_v11_duracion.sql`, `suizamente_v12_progreso.sql` y
`suizamente_v12_tareas.sql`. Si ya está v11, bastan los dos archivos v12.
La configuración nueva mantiene las
modificaciones de Economía. No volver a ejecutar versiones antiguas de lógica.
Las tres tablas nuevas son `suizamente_vueltas`, `suizamente_misiones_dias` y
`suizamente_misiones`, privadas, con RLS y sin permisos directos del navegador.
Los asaltos guardan también la vuelta de su objetivo.

El trabajo programa el reparto de misiones al cambiar el día de Zúrich; un perfil
nuevo o que faltase al reparto las obtiene también en su primera petición. Tipo,
meta y premio quedan guardados para que una edición posterior de Economía no
cambie una misión empezada. Cada acción calcula y cobra su progreso en la misma
transacción; completar las tres crea el cofre diario una sola vez. Cambiar una
misión empieza a contar desde el cambio. Un duelo cerrado cuenta como un turno
jugado por cada participante. La vinculación de invitados conserva este estado.

Completar la última región paga la vuelta y empieza la siguiente. El precio se
multiplica, se redondea con `mapa.coste.redondeo` como en la referencia y después
se aplica el descuento de obras vigente. Un asalto pendiente se cancela si su
objetivo ya ha cambiado de vuelta. La colección mensual conserva la rareza y
reserva la mitad de los sorteos al mes activo; nunca incluye meses futuros.

La maqueta 3D procede de `disenos/mapa3d.js` y `data/mapa3d.json`, con Three r128,
la versión de la referencia, incluida desde npm. Se carga al abrir Mapa y se
liberan geometrías, materiales, controles y renderer al salir. Los controles de
cámara y las tarjetas se usan con teclado. Sin WebGL hay mapa SVG y se puede
seguir construyendo. Seleccionar no gasta monedas: se confirma con el botón
«Subir». «Así crece…» muestra los cuatro niveles de ese cantón.
El confeti corresponde a una construcción confirmada y no se repite al
refrescar los niveles. Se liberan las partículas al agotarse y el contexto
WebGL al salir. Inicio conserva su mapa SVG y Three solo se importa desde Mapa.

Los sonidos se sintetizan localmente: cinco motivos propios de menos de medio
segundo, desbloqueados por un gesto. Sonido y vibración se apagan por separado y
dejan de reproducirse al ocultar la app. La preferencia del sistema y «Menos
animaciones» detienen el movimiento, también en Three. Apariencia sigue claro,
oscuro o el sistema. Se usan tonos más oscuros de los colores de acción cuando
el contraste del texto pequeño lo requiere.

`public/suizamente.webmanifest` tiene identidad `/suizamente`, iconos del logo
con fondo blanco, versión maskable y acceso directo al juego. No cambia la
identidad de la instalación de Latido. El worker conserva la interfaz y sus
dependencias básicas para reabrirla. Three y la geometría se descargan al abrir
Mapa, también después de instalar: el precache excluye ambos para mantener ligera
la entrada al juego. Las preguntas, votos y operaciones de la API no se
guardan en caché. Jugar requiere conexión. Al reconectar se consulta el resultado
del servidor sin reiniciar una pregunta ni su tiempo. Reintentar una compra con
la misma clave recupera el recibo sin cobrar otra vez.

### Verificación final

```powershell
npm run test:suizamente:admin
npm run test:suizamente:v11
npm run test:suizamente:v12
npm run test:suizamente:duration:browser
npm run test:suizamente:map3d
node scripts/test-suizamente-map3d.mjs --webkit
npm run test:suizamente:finish
npm run test:suizamente:accessibility
npm run suizamente:design:review
npm run test:suizamente:final:browser
node scripts/test-suizamente-final-browser.mjs --webkit
npm run test:suizamente:admin:browser
node scripts/test-suizamente-v7-browser.mjs
npm run test:pwa
npm run test:pwa:dev
npm run build
npm run test:suizamente:install
```

Las pruebas son locales y aisladas. El recorrido final empieza sin sellos, juega
con dos sesiones, gana sellos reales, completa un duelo, un asalto y la partida,
abre cofre y sobre, compra y construye. Fuerza solo las ramas aleatorias del
servidor y el reloj de caducidad para que sean reproducibles; nunca entrega la
solución a la app ni inventa votos. También corta una respuesta de compra después
del cobro y reconecta tras vencer una pregunta. Las capturas emparejadas con el
diseño y los informes quedan en `output/suizamente-final/`, a 390 y 1440 px.
La revisión de accesibilidad comprueba áreas de 44 px, contraste de texto,
selección con teclado, foco de las hojas, apariencia automática y mapa estático.
La prueba de instalación usa los archivos compilados y el worker real: activa
su rama de producción en un origen local, instala todas sus dependencias sin
URLs duplicadas y reabre un enlace profundo sin red, conservando la API fuera
de la caché. No contacta con cuentas ni servicios remotos.
El repaso adicional genera las pantallas de entrada, onboarding, resultados y
vuelta completa con datos de prueba separados del recorrido de la partida.
Economía rechaza metas vacías y redondeo cero. Cambiar la estructura de las tres
dificultades requiere una migración, igual que la estructura de niveles.

Los tests v2–v7 cubren los demás criterios de 19 y 23.15: identidad invitada,
primer voto, umbral de privacidad, eliminación, reloj, rondas y plazos, comodines,
desempates, cofres, repetidas, rareza y límites diarios. v10/v11 cubren 24.6:
misiones, grupos y premios de liga, vueltas, meses y eventos, incluidos cambios
de hora y recibos únicos. El panel verifica permisos, registro y Economía viva.

## Publicar y pendientes de lanzamiento

1. La base de Latido ya está actualizada hasta v13 y las dos tareas programadas
   se han ejecutado correctamente. No hace falta ejecutar SQL manual en esta
   entrega. Mantener `suizamente_private` fuera de los esquemas expuestos.
2. Desplegar en Vercel este frontend y `api/suizamente.js` juntos con las
   variables de Supabase existentes. Ejecutar `npm run build`; los recursos del
   juego se incluyen en `dist` y los bancos de preguntas quedan privados.
3. `latido_push_notification` está desplegada y el trabajo de plazos activo.
   Comprobar con consentimiento la entrega de un aviso en un dispositivo físico.
4. Probar en dos dispositivos físicos: instalación, actualización, sonido,
   vibración donde esté disponible y push con consentimiento. Las pruebas de
   Chromium y WebKit no sustituyen estas comprobaciones del sistema operativo.

El estado y los pasos concretos están en `docs/SUIZAMENTE_PRODUCCION.md`.
Latido debe confirmar el calendario y contenido de las colecciones propuestas
(enero–julio de 2027), y puede elegir los eventos concretos del lanzamiento en el
panel. Mientras tanto funcionan las fechas del archivo y la rotación escrita.

La auditoría de las dependencias heredadas informa de ocho avisos (tres altos y
cinco moderados), principalmente en herramientas de desarrollo; `minimatch`
también aparece en una dependencia transitiva. Conviene revisar su actualización
como mantenimiento del repositorio. El informe está en
`output/suizamente-final/dependencias.json`. La compilación avisa además del
tamaño de los chunks de la aplicación y de Three, que se carga bajo demanda.

## Simular el cierre de una semana

```powershell
npm run suizamente:simulate:week
```

Esta simulación crea una base PostgreSQL temporal, prepara grupos de las cuatro
divisiones y un grupo incompleto, registra actividad y puntos y ejecuta el mismo
`v12_tick` que usa cron, con el reloj lógico del cierre en el lunes siguiente a las 00:00
de Zúrich. Imprime puestos, puntos, destino, monedas y sobres. Después repite
el cierre y comprueba que el número de recibos se mantiene. Al salir elimina la
base; no cambia el reloj del equipo, las cuentas reales ni el Supabase remoto.

`npm run test:suizamente:v12` añade los límites de Pradera/Cumbre, ascensos y
descensos, inactividad, premios por división, avisos únicos y el reparto de la
semana siguiente. También interrumpe una transacción de cierre, verifica su
rollback y reintenta; comprueba los días de 23 y 25 horas y la instalación
repetida del trabajo. PGlite ejecuta el motor SQL real; el contrato de
`cron.schedule` se simula porque no incluye un proceso pg_cron.

En Supabase, comprobar la activación con:

```sql
select jobname, schedule, active
from cron.job
where jobname = 'suizamente-progreso';
```

El trabajo corre cada minuto en UTC y convierte la fecha a `Europe/Zurich`.
El domingo incluye todo el minuto 23:59: el primer tick del lunes 00:00 cierra
la semana y forma los nuevos grupos. El bloqueo de transacción compartido por
API y cron, la marca de semana cerrada y el recibo único `liga` + semana evitan
pagos repetidos. El aviso queda en la bandeja para la siguiente apertura.

Para revisar la maqueta: abrir Mapa, elegir Lucerna y construir con «Subir»;
volver a «Toda Suiza» y probar otra tarjeta, arrastre y zoom. En Ajustes,
activar «Menos animaciones» y repetir. Las pruebas de navegador comprueban
toques sobre la geometría, construcción real de los tres niveles, monumento,
movimiento, pausa al ocultar la pestaña, liberación de recursos y 390/1440 px.
La prueba de accesibilidad también fuerza el respaldo sin WebGL.

### Archivos de esta revisión

- Migraciones: `supabase/suizamente_v12_progreso.sql` y `supabase/suizamente_v12_tareas.sql`.
- Maqueta y SVG: `src/components/suizamente/v2/WorldMap.jsx`, `world3d.js`,
  `MapPage3D.jsx` y `Map.jsx`; el generador es `scripts/sync-suizamente-v2.mjs`.
- Duración: `src/components/suizamente/v2/Duration.jsx`, `Community.jsx` y
  `Rewards.jsx`. Misiones y liga se refrescan sin perder el foco; cambiar una
  misión de un día anterior devuelve 409. El evento de Misiones usa la respuesta
  actual del servidor y desaparece al caducar sin recargar toda la app.
- Carga de producción: `scripts/prerender-seo.mjs` y `scripts/test-suizamente-install.mjs`.
- Pruebas y simulación: `scripts/test-suizamente-v12.mjs`,
  `test-suizamente-map3d.mjs`, `test-suizamente-duration-browser.mjs`,
  `simulate-suizamente-week.mjs`, sus helpers de `scripts/lib/` y `package.json`.
- Especificación y guía: `suizamente/FUNCIONES.md` y este documento.
