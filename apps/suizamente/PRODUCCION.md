# Suizamente independiente

## Compartir imágenes y colecciones (v19)

La migración `supabase/suizamente_v19_compartir.sql` se aplicó al proyecto Latido
el 24 de noviembre de 2026. Añade la instantánea privada de colecciones recién
cobradas a cada sobre y a su respuesta. No modifica datos de Latido, reglas ni
el cobro existente; se puede repetir. La API pública conserva sus rutas.

En otra base, aplicar después de v18 y antes del frontend:

```powershell
npx --yes supabase@3.4.0 db query --remote=REFERENCIA_DEL_PROYECTO --file supabase/suizamente_v19_compartir.sql --yes
```

Verificación local: `npm run test:sharing`, `npm run test:moments`, `npm run build`
y `node scripts/test-suizamente-delivery.mjs`. Los tests usan exclusivamente SQL
temporal y cuentas locales. Las imágenes se crean en el dispositivo. En móvil se
prepara el PNG antes de pulsar Compartir para mantener el gesto del usuario;
la descarga de escritorio y la alternativa SVG no necesitan WebGL.

La aplicación del juego se publica desde esta carpeta en **suizamente.latido.ch**.
No usa el frontend de Latido ni necesita cambios en sus pantallas, rutas o botones.
Las cuentas siguen perteneciendo al mismo proyecto Supabase de Latido.

## Código y publicación

- `game/`: aplicación React del juego, acceso con cuenta, ruleta, mapa 3D y panel.
- `server/suizamente/` y `api/suizamente.js`: API privada y bancos canónicos.
- `public/suizamente-assets/`: logo, iconos y geometría de los cantones.
- `supabase/`: migraciones del juego. v14 exige cuenta; v15 separa los avisos,
  preferencias y suscripciones del juego de la bandeja y los dispositivos de Latido.
- `vite.game.config.js`, `vercel.json`: compilación y enrutamiento independientes.
- Los archivos originales de la aplicación anterior se conservan. La entrada
  anterior y su configuración están en `index.legacy.html` y `vercel.legacy.json`.

En Vercel, el proyecto **suizamente** debe usar:

```text
Root Directory: apps/suizamente
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
Production Branch: suizamente
```

Las ramas `suizamente` y `suizamente-social` reciben el mismo código comprobado.
No hay que fusionar estas ramas en `main` para publicar el juego.

Se reutilizan `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y, para avisos,
`VITE_VAPID_PUBLIC_KEY` del proyecto. Nunca incluir claves de servicio en Vite.
La API acepta también `SUPABASE_URL` y `SUPABASE_ANON_KEY` en el servidor.
Google y los enlaces de email vuelven a `/auth/callback`; la recuperación de
contraseña vuelve a `/auth/restablecer`. Son los destinos ya autorizados en
Supabase. El destino del juego se guarda durante el acceso sin modificar la
configuración de autenticación de Latido.

## Probar en teléfonos

Abrir `https://suizamente.latido.ch`. La raíz abre el juego en `/suizamente`.
Entrar desde dos cuentas diferentes, una en cada teléfono. Sin cuenta, las
acciones y lecturas del juego devuelven 401; el panel devuelve 403 para quien
no sea administrador. No hay juego como invitado.

En Safari usar «Añadir a pantalla de inicio»; en Chrome, «Instalar aplicación».
El manifiesto cubre este dominio completo, incluido el acceso. El worker nuevo
retira las cachés del juego anterior y no almacena peticiones de la API.

```powershell
npm ci
npm run build
npm run test:accounts
npm run test:entry
npm run test:photos
npm run test:game
```

Los tests usan PostgreSQL temporal y cuentas ficticias locales; nunca crean
perfiles de prueba en producción. El mapa 3D y las miniaturas conservan el
respaldo SVG y las preferencias de menos movimiento.

Los avisos usan `suizamente_notificaciones`, `suizamente_push_subscriptions` y
`suizamente_push_preferences`, con permisos propios. La función de entrega es
`suizamente-push`. v15 conserva los registros del juego al trasladarlos, mantiene
intactas las notificaciones de Latido y reutiliza los secretos VAPID existentes.

## Acceso, tema y foto del perfil

Cada visita nueva muestra cuatro opciones: Crear cuenta gratis, Ya tengo cuenta,
Entrar con Google y Entrar con cuenta de Latido. Una sesión guardada permite
reutilizar la cuenta al elegir Latido, pero no salta este menú. El acceso de
Latido sin sesión local abre el puente SSO existente y obtiene una sesión propia
de Suizamente. Google y email también terminan en «Tu perfil» y «¡A jugar!».
Los enlaces de invitación se conservan hasta guardar el perfil.

El tema es siempre claro: se ignoran las preferencias oscuras anteriores y las
del sistema, y se ha retirado el selector de Apariencia.

Aplicar una vez `supabase/suizamente_v16_fotos.sql`, después de v15. Crea únicamente
el bucket público `suizamente-avatars` y sus permisos por propietario; no altera
los perfiles ni el almacenamiento de Latido. Las fotos se recortan a 512 × 512,
se convierten a JPEG sin metadatos y se guardan en el perfil del juego al pulsar
«¡A jugar!» o «Guardar cambios». El bucket admite solo JPEG de hasta 200 KB.

En un teléfono, comprobar: abrir el dominio con sesión guardada → ver las cuatro
opciones → Latido → nombre/foto y cámara → elegir foto → ¡A jugar! → Ajustes sin
Apariencia. Repetir con el dispositivo en modo oscuro: sigue claro. Una recarga
presenta de nuevo las opciones; cambiar de pestaña dentro del juego no las repite.

## Actualización de partida y ataques (v17)

Antes de publicar este cambio, aplicar `supabase/suizamente_v17_ataques.sql` después
de v15/v16. La migración añade el progreso privado del ataque, selecciona cinco
preguntas y liquida robo, escudo y bajada de nivel de forma atómica. No modifica
tablas ni notificaciones de Latido. Conserva partidas y asaltos anteriores.

La regla nueva usa los valores de `asaltos`: cinco preguntas, 100 monedas sin
escudo y 70 con escudo. El cantón siempre baja un nivel tras los cinco aciertos.
La víctima pierde exactamente lo que gana el atacante, limitado a su saldo.

```powershell
npm run test:rules
```

Esta prueba usa PostgreSQL temporal y Chromium/WebKit: tres aciertos, elección y
pregunta de sello, victoria con seis, elección del cantón, cinco preguntas,
transferencia de monedas, escudo, fallos, tiempo agotado, límite diario, duplicados,
contador de turnos, mapa bloqueado/activo, instalación y modo PWA de iPhone.
Las capturas quedan en `output/v17/`. Probar además en un iPhone físico el retorno
desde segundo plano y el gesto Compartir → Añadir a pantalla de inicio.

La migración v17 debe acompañar al despliegue del código. No ejecutarla como un
cambio aislado del flujo de juego todavía publicado.

## Avatares y vídeo de instalación (v18)

Para esta actualización, aplicar `supabase/suizamente_v18_avatares.sql` después
de v17 junto al nuevo despliegue. Solo añade funciones propias del juego: lee
la foto pública de Latido como respaldo y no modifica perfiles, sesiones ni datos
de esa app. Los emails y el resto de los metadatos de acceso no se devuelven.

El recurso `public/suizamente-assets/install-ios.mp4` es una copia independiente
del vídeo de Latido. No depende de sus rutas para reproducirse y se descarga
únicamente al pulsar «Ver vídeo».

```powershell
npm run test:avatars
```

Comprueba fotos recíprocas entre dos cuentas con el mismo apodo, fotos propias y
de respaldo, ausencia de emails, círculo del avatar, formulario completo antes
de «¡A jugar!», banner inferior y reproducción del vídeo real en Chromium/WebKit.
Las capturas quedan en `output/v18/`.

## Ruleta y fondos de la partida

Este cambio visual no requiere una migración adicional. La v18 sigue siendo
necesaria para los avatares compartidos del cambio anterior.

```powershell
npm run test:play
npm run build
```

La prueba de navegador usa SQL temporal y ejecuta el giro real del servidor en
Chromium y WebKit. Comprueba 320 px, 390 px y escritorio: rueda fija, centrado,
arco accesible, inventario real, frenado y dos parpadeos, turno del rival,
movimiento reducido y pies transparentes que no cubren contenido. Recorre también
elección de sello, duelo, fin, cofre, sobre, vuelta y asalto.

Las capturas y la hoja de comparación se guardan en `output/play/<navegador>/`.
La comparación opcional necesita el directorio original de diseño en
`SUIZAMENTE_DESIGN_ROOT` (por defecto, el checkout vecino `latido/suizamente`).
La prueba lo sirve en HTTP, juega la referencia y copia las capturas de
`pantallas.html`; no modifica ese checkout.

Prueba manual: abre una partida con dos cuentas, gira desde el botón central y
comprueba la pantalla del rival. Activa «Menos animaciones» y repite. Revisa el
scroll de las pantallas de premio y asalto a 320 px y en un iPhone físico.

## Carga, mapa y ataque aplazado

No añade SQL. Se conserva la dependencia v18 de los avatares preparada antes.

```powershell
npm run build
npm run test:ux
npm run dev:qa
```

`test:ux` comprueba Chromium y WebKit con SQL temporal: carga de rutas al abrirlas,
recuperación de un 503 sin aviso amarillo, compra sin saldo con aviso breve y sin
repetir la acción, gestos del mapa sin herramientas adicionales, ataque aplazado
que sigue disponible al volver a entrar y aislamiento de caché entre cuentas.
Valida también que el service worker no descargue todas las rutas al instalarse,
que guarde las visitadas y que excluya API y autenticación de la caché.

En la compilación de esta revisión el bloque `SuizamenteApp` pasa de 202,53 kB a
84,20 kB antes de gzip (aproximadamente un 58 % menos). Es una medida del bloque
principal del juego; las pantallas necesarias se descargan al abrirlas.

La vista temporal usa `http://127.0.0.2:8080`, porque `127.0.0.1:8080` está ocupado
por Latido. No detiene ni modifica ese servidor. El comando muestra además la
dirección de la Wi-Fi para abrir la misma partida desde el teléfono. Todo usa
cuentas de prueba y PostgreSQL en memoria; no se conecta a datos de producción.
«Alex» y «Lu» en la franja superior permiten probar con dos ventanas o dispositivos.
Los datos se pierden al detener la vista temporal. La instalación PWA real en iOS
se comprueba en el dominio de producción con HTTPS.
