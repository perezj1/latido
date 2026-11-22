# Suizamente Conquista

Implementación en la rama de desarrollo `suizamente-social`. La promoción de
esta rama a `suizamente` es una publicación independiente; `main`, `development`
y `latidoCard` siguen su ciclo propio.

Conquista añade Mapa, Tienda, Batallas y Colección, un acceso destacado en Inicio
y un sexto acceso en la navegación. Se conservan los modos, respuestas, IDs,
votos, niveles, medallas, ranking, amigos, retos y libreta existentes.

## Reglas implementadas

Cada jugador tiene su propio mapa, persistente y sin pérdida por inactividad.
Los intentos individuales cuestan 75, 125 o 200 puntos y tienen 5, 7 o 10 preguntas.
Se necesitan todos los aciertos, contando la protección de un escudo. El coste
se descuenta al empezar y no se devuelve al fallar, caducar o abandonar.
Se puede retomar un intento durante 24 horas. Solo hay un intento individual
activo por jugador; no se puede iniciar otro por un cantón ya disputado.

La XP anterior sigue calculándose con `suizamente_social.puntos`. El saldo
gastable está en otra tabla y acredita una vez, a razón de 1:1, la XP histórica
que aún no haya acreditado. No hay modificación ni resta del libro de XP.
Las recompensas futuras del juego se acreditan por la misma diferencia,
bajo bloqueo de la cuenta. Ganar una apuesta no genera XP nueva.

La tienda vende Escudo (60), Pista 50/50 (35) y Segunda oportunidad (50).
Se pueden equipar dos ventajas distintas y se consumen al empezar o aceptar
la batalla. Escudo cubre automáticamente el primer fallo que corresponda.
Segunda oportunidad deja reintentar el primer fallo, excluyendo la opción ya
elegida. 50/50 descarta dos opciones incorrectas una vez, a petición del jugador.
La puntuación nunca supera el número de preguntas. Tiempo extra y Pregunta de
presión quedan fuera de este catálogo inicial, como recomienda la propuesta.

Las batallas requieren amistad aceptada y activación voluntaria de ambos.
Solo se pueden disputar cantones del amigo que el atacante no posea.
Cada invitación corresponde a un atacante y un defensor; caduca en 24 horas
sin coste. Al aceptar se reservan 100 puntos del atacante, se consumen las
ventajas y ambos reciben las mismas diez preguntas. Hay 48 horas para terminar.

| Resultado | Cantón del defensor | Apuesta |
| --- | --- | --- |
| Gana atacante | Pasa al mapa del atacante y queda perdido en el defensor | Devuelta al atacante |
| Gana defensor | Se conserva | Acreditada al defensor |
| Empate | Se conserva | Devuelta al atacante |
| Solo uno termina a tiempo | Gana quien termina | Se aplica la regla del ganador |
| Ninguno termina | Se conserva | Devuelta al atacante |
| Rechazo o caducidad de invitación | Se conserva | Nunca se reserva |

Las caducidades se resuelven de forma transaccional al consultar o actuar sobre
Conquista. No hace falta un proceso periódico para mantener coherentes saldo y
propiedad. Desactivar la competición cancela las invitaciones pendientes y
conserva las batallas ya aceptadas. Los avisos se guardan en el esquema de
Conquista; no se envían correos ni se mezclan con el buzón de Latido.

Las insignias de posesión cambian al perder y reconquistar. Las conquistas,
defensas y logros de 5, 10, 20 y 26 territorios se guardan como historial.
Los logros históricos se conservan aunque luego se pierdan territorios;
el contador de dominio actual refleja únicamente los que se poseen ahora.

## Contenido y mapa

El mapa utiliza los 26 polígonos oficiales de `swissBOUNDARIES3D`, edición de
1 de enero de 2026, simplificados para el móvil. Conserva exclaves, utiliza
coordenadas CH1903+/LV95 y tiene selección por teclado, ampliación y un selector
de nombres como alternativa a los territorios pequeños.

La primera edición del banco contiene **1.300 preguntas**, 50 por cantón y cuatro
opciones por pregunta, sobre identidad, geografía, comparaciones territoriales
y municipios. Las preguntas se derivan de los atributos oficiales; no son un
banco de historia, gastronomía o monumentos. Ese contenido editorial puede
añadirse con nuevas fuentes sin alterar el motor ni el banco antiguo.
Los datos demográficos de la edición 2026 corresponden al 31 de diciembre de
2024, según la documentación del producto; las preguntas indican la edición
de referencia. Cada pregunta incluye explicación, fuente y fecha de revisión.

- [Producto y descarga oficial](https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d).
- [Información de actualización 2026, incluido el traslado de Moutier a Jura y la fecha de población](https://www.swisstopo.admin.ch/dam/fr/sd-web/GatZCn3GD5L7/swissBOUNDARIES3D_Release2026-FR.pdf).
- [Condiciones de uso y atribución](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices).

Fuente: **© swisstopo, swissBOUNDARIES3D 2026**. La atribución aparece junto al
mapa y el origen de cada explicación queda enlazado en la revisión de respuestas.
El archivo original se verifica con SHA-256 antes de generar el mapa.

```powershell
python scripts/preparar-mapa-conquista.py
node scripts/generar-conquista.mjs
```

El primer comando requiere Python y `shapely`. Descarga y verifica el GeoPackage,
mantiene el archivo grande en el temporal del sistema y genera la instantánea
de hechos en `data/suizamente/conquista/geografia-2026.json`. El segundo no
requiere red: genera el banco privado, el catálogo SQL y el instalador.

El repositorio de la aplicación es público. El banco real, la instantánea usada
para editarlo, su generador editorial y los instaladores que contienen respuestas
están excluidos de Git y se conservan en Supabase y en una copia editorial privada
fuera del repositorio. El mapa público y la estructura SQL no incluyen respuestas.
El comando editorial anterior requiere esa copia privada; no se distribuye con
el código abierto de la aplicación.

La estructura, que sí se puede regenerar desde un clon público, se genera con:

```powershell
node scripts/generar-conquista-estructura.mjs
```

Los IDs `cq-2026-*` y el orden de las opciones son deterministas. Una edición
posterior debe usar IDs nuevos para conservar las respuestas de partidas previas.
El instalador no sobreescribe preguntas existentes ni cambia el banco publicado
de 2.000 preguntas de los modos normales.

## Servidor y seguridad

Todo el estado nuevo está en `suizamente_conquista`. Las tablas y funciones
privadas tienen RLS y se deniega su acceso a `anon` y `authenticated`.
La única RPC pública es `suizamente_conquista_api`, ejecutable solo por
`service_role`. La Edge Function verifica el usuario mediante Supabase Auth y
determina su UUID; ignora identidades suministradas en el cuerpo.

El servidor elige las preguntas, valida cada respuesta, aplica ventajas y costes,
resuelve apuestas y cambia propiedades. El navegador recibe solo la pregunta
actual y sus opciones. Las soluciones se devuelven al terminar el intento o,
en batallas, cuando se ha resuelto la batalla completa. El banco privado y sus
soluciones no forman parte de los artefactos web.

Las mutaciones llevan UUID de solicitud. El servidor guarda y compara la
solicitud para que un reintento de red no duplique compras, apuestas, consumo ni
respuestas. Se bloquean las billeteras afectadas en orden estable y se aplican
límites por usuario. Borrar un perfil elimina su progreso de Conquista y devuelve
antes la apuesta que corresponda a otra cuenta afectada por una batalla activa.

Para activar el backend en otra base, aplicar `supabase/suizamente_conquista_estructura.sql`
después del instalador social e importar el banco desde la copia editorial privada.
El instalador local privado `supabase/suizamente_conquista_instalar.sql` combina
ambos pasos. Desplegar solo la función nueva:

```powershell
npx supabase functions deploy suizamente-conquista --remote=zmievixfjefjppofebbh --use-api
```

Utiliza la autenticación y el proyecto Supabase actuales. No requiere claves
privadas en Vercel, proveedores nuevos ni migraciones de votos.
La preview estable de `suizamente-social` está autorizada por su origen exacto
en `suizamenteConquistaGateway.js`. En una compilación Preview, el gateway
reutiliza los contratos social y de votos actuales, sin redesplegar sus funciones
de producción ni cambiar sus listas de orígenes. Para otras previews, se puede
añadir su **origen exacto** a `SUIZAMENTE_ALLOWED_ORIGINS`, conservando los
orígenes anteriores. El enlace de batalla utiliza el origen
de la app abierta: una preview comparte su propia URL y producción la suya.

## Pruebas

```powershell
npm --prefix apps/suizamente run build
npm --prefix apps/suizamente run lint
npm --prefix apps/suizamente test
npm --prefix apps/suizamente run test:build
npm --prefix apps/suizamente run test:conquista
```

Safari/WebKit desde `apps/suizamente`:

```powershell
node test/conquista-browser.mjs --webkit
```

PGlite ejecuta el SQL real, con cuentas de prueba, y comprueba permisos, XP,
saldo, idempotencia, ventajas, propiedad, aceptación, apuestas, empate, derrota,
victoria, caducidad y eliminación de perfiles. Chromium y WebKit recorren el
mapa, compras, conquista, reintento tras respuesta perdida, colección, reanudación,
abandono, enlaces de invitación y una batalla completa con dos cuentas.
Los tests no escriben en producción. Las capturas quedan en `test-results/conquista*`.
Si la copia editorial no está disponible, las pruebas usan preguntas aritméticas
exclusivamente de test en PGlite. Esto permite probar desde un clon público sin
distribuir las respuestas reales. Se puede forzar ese modo con
`SUIZAMENTE_PUBLIC_TEST_BANK=1`.
