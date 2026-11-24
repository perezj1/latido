# Suizamente independiente

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
