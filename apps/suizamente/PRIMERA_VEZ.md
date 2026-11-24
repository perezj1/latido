# Primera visita

Implementa la sección 22 y MomentoBienvenida de las referencias de Suizamente. Se han retirado de los textos las expresiones «siempre real» y «siempre reales», por indicación del producto.

## Archivos

- `game/src/components/suizamente/v2/Onboarding.jsx`, `onboarding.css`: cinco pasos, preguntas en abanico, práctica, ruleta compartida, Lucerna y regalo.
- `QuestionOptions.jsx`, `FirstGameHint.jsx`, `Game.jsx`: opciones compartidas y dos pistas accesibles de la primera partida.
- `Account.jsx`, `SuizamenteApp.jsx`: primera entrada, continuación tras autenticar/crear perfil y repetición desde Ajustes.
- `LatidoBackdrop.jsx`, `WorldMap.jsx`: fondo sin escena y maqueta aislada con animación, disposición de recursos y alternativa SVG.
- `Moment.jsx`, `moments.jsx`: regalo en dos pasos con los valores del servidor y pie «Toca para jugar».
- `server/suizamente/http.mjs`, `server/suizamente/data/juego.json`: rutas de práctica y los cuatro identificadores de `primeraVez`.
- `supabase/suizamente_v20_primera_vez.sql`: migración aditiva después de v19. Guarda práctica y finalización en una tabla privada, excluye la pregunta en ambos selectores, conserva el premio y libro existentes y consume las pistas en las transacciones del juego. Repetir la migración es seguro.
- `scripts/test-suizamente-v20.mjs`, `scripts/test-suizamente-onboarding-browser.mjs`, sus dos ayudantes y `package.json`: pruebas y vista local con la migración actual.
- `scripts/test-suizamente-login-browser.mjs`, `scripts/test-suizamente-entry-profile.mjs`: conservan la regresión de acceso con cuenta y recorren la nueva bienvenida al crear un perfil.

## Comprobaciones

Desde `apps/suizamente`:

```sh
npm run test:first-visit
npm run build
node scripts/test-suizamente-delivery.mjs
```

Las pruebas usan PostgreSQL en memoria y Chromium/WebKit. No crean jugadores ni premios en producción. Comprueban que la respuesta y el dato no viajan antes de responder, que la práctica no registra votos ni premios, el traspaso con credencial HttpOnly al entrar, la clave única de bienvenida, la exclusión de preguntas, las pistas ligadas a una sola partida, su consumo persistente y el borrado de la práctica al borrar el perfil.

La prueba de navegador recorre los cinco pasos, corrección, momento, creación de perfil y primera partida. Captura 320, 390 y escritorio, comprueba foco, nombres accesibles, ausencia de desbordamiento, botón en una pantalla baja, movimiento reducido, ciclo 3D y retirada de WebGL, SVG sin WebGL, omisión y enlaces directos.

Las capturas y comparaciones con `pantallas.html` quedan en `output/primera-vez/chromium/` y `output/primera-vez/webkit/` (`comparacion.html`). Ese directorio se excluye de Git.

Para revisar sin cobrar otro regalo: Ajustes → Ver la bienvenida otra vez. Termina con «✓ Listo». Para comprobar el flujo completo: primera visita en un contexto sin sesión, abrir el regalo y crear un perfil nuevo. El servidor entrega la bienvenida al guardar ese perfil; recargar o repetir el cierre conserva una sola fila del libro.

Se conserva el acceso con cuenta de la app independiente: quien termina sin sesión pasa por el acceso antes de crear el perfil. No se reintroduce el juego como invitado. Las invitaciones y preguntas del día conservan su entrada directa.

Queda la comprobación manual con VoiceOver/TalkBack y en dispositivos físicos; las pruebas automáticas verifican la semántica accesible y WebKit, sin sustituir esa revisión.
