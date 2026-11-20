# Activar las nuevas pantallas y funciones de Suizamente

Preparado el 20 de noviembre de 2026 en la rama `suizamente-social`, sobre `1210637`. La publicación autorizada sincroniza `suizamente-social` y la rama de producción `suizamente` con el mismo código verificado. El push a `suizamente` activa el despliegue del proyecto Vercel existente; no modifica `main` ni despliega funciones de Supabase.

Esta versión incluye las pantallas sociales de Latido, Retos y Duelo, el panel para compartir, la búsqueda de amigos, resultados compactos con la elección del jugador primero y porcentajes estables, y los cinco iconos maskable de Suizamente para su PWA independiente. Antes de publicar se han comprobado el build, los iconos y la caché, la autenticación simulada, las funciones sociales con una base de pruebas y el juego de referencia en móvil y escritorio.

El SQL social ya fue ejecutado manualmente por el propietario. La función `suizamente-social` se ha desplegado con autorización en el Supabase existente y admite el origen exacto `https://suizamente.latido.ch`: su preflight responde 204 y una solicitud sin identidad responde 401 con las cabeceras CORS correctas. El cliente espera la confirmación de Latido antes de enviar mensajes de conexión, usando el origen confirmado tras cualquier redirección. La ruta de conexión de cuenta en Latido sigue requiriendo su publicación en `main` para activar el acceso automático desde Latido; Google y correo funcionan de forma independiente.

## Qué incluye

Inicio, bienvenida, ayuda, retos diarios, duelos y revancha, solicitudes de amistad, tres rankings, libreta, perfil, niveles, nueve medallas, propuestas, revisión por administradores, avisos y ajustes. La navegación inferior tiene cinco pestañas con emojis. Los colores de las pantallas nuevas se adaptan a Latido; el bocadillo de pregunta, las opciones y los resultados conservan el diseño existente. El banco de 2000 preguntas, sus identificadores y el orden de sus opciones permanecen intactos.

Las dos aplicaciones comparten `public/suizamente/`. No hay una segunda copia editable del juego ni otra base de datos. Los datos de ejemplo del ZIP no se incorporan.

Retos muestra la fecha abreviada y una sola etiqueta «Hoy» en la semana. El resultado de duelo presenta el marcador, la coincidencia en dilemas y cuatro preguntas iniciales, con un control para desplegar las diez. «Compartir» abre un panel con vista previa, imagen para historias, compartir mediante las aplicaciones del dispositivo, copiar texto y crear un duelo del mismo modo. Este último crea diez preguntas nuevas de ese modo; no promete reutilizar la ronda actual. Las imágenes usan los porcentajes reales, el logo oficial de Latido y «Juega en suizamente.latido.ch», sin el nombre del jugador. Si el dispositivo no permite compartir, se descarga la imagen o se copia el texto. Estos ajustes no requieren otro SQL ni alteran las preguntas y opciones publicadas.

## Orden de activación

Los pasos siguientes modifican producción y se ejecutan únicamente con autorización. La autorización anterior para corregir CORS en `suizamente-votos` no publica esta ampliación.

### 1. Ejecutar un único SQL

En el proyecto Supabase **Latido**, referencia `zmievixfjefjppofebbh`, abre **SQL Editor → New query**, pega el contenido completo de [suizamente_social_instalar.sql](../../supabase/suizamente_social_instalar.sql) y pulsa **Run**. No ejecutes también sus cuatro archivos fuente: ya están incluidos en ese instalador.

El archivo contiene una única transacción y puede repetirse. Crea el esquema privado `suizamente_social`, sus tablas, el catálogo de metadatos y la RPC `public.suizamente_social_api`. Conserva los votos existentes y la API anterior. También amplía el CHECK de `app_notifications.kind` para admitir `suizamente`, conservando los tipos anteriores. No elimina cuentas, respuestas ni notificaciones.

Las tablas privadas tienen RLS y no admiten acceso directo desde `anon` o `authenticated`. Solo la Edge Function, con las credenciales de servicio del servidor, puede invocar la RPC. No añadas este esquema a los esquemas públicos de la API.

Comprobación de solo lectura tras ejecutar:

```sql
select count(*) as preguntas from suizamente_social.preguntas; -- 2000
select count(*) as cantones from suizamente_social.cantones; -- 26
select has_function_privilege(
  'anon', 'public.suizamente_social_api(text,text,jsonb,text)', 'EXECUTE'
) as acceso_anon; -- false
select has_function_privilege(
  'service_role', 'public.suizamente_social_api(text,text,jsonb,text)', 'EXECUTE'
) as acceso_servidor; -- true
```

No hace falta volver a ejecutar `suizamente_votos.sql` ni cambiar el catálogo de votos de producción para esta instalación. Sus tablas y RPC ya existen. Los votos anteriores se incorporan al progreso social al volver a entrar, usando sus fechas originales y evitando premios duplicados.

### 2. Desplegar únicamente la función nueva

Desde la raíz de esta rama, con la CLI autenticada en la cuenta propietaria:

```powershell
supabase functions deploy suizamente-social --project-ref zmievixfjefjppofebbh --no-verify-jwt --use-api
```

Este despliegue ya se ha realizado con autorización. No desplegar todas las funciones ni volver a desplegar `suizamente-votos`. El modo `--no-verify-jwt` permite invitados; el handler verifica explícitamente los tokens de las cuentas con `auth.getUser`. El servidor calcula los puntos, valida respuestas y contextos, comprueba administradores, limita peticiones y oculta las respuestas del rival hasta terminar ambos.

Utiliza las variables de servicio que Supabase ya proporciona a sus funciones. No hay nuevos secretos que copiar a Vercel.

### 3. Publicar la conexión de cuenta en Latido

La aplicación raíz incorpora `/suizamente/conectar` y el enlace administrativo `/admin/suizamente/propuestas`. Para que el acceso automático funcione desde el subdominio, esos cambios deben publicarse también en **Latido** mediante su proceso habitual de revisión e integración en `main`.

No cambies la rama de producción ni el Root Directory del proyecto Vercel de Latido. Esta rama parte de `1210637`; integra los cambios revisados y resuelve cualquier conflicto con el `main` vigente. No reemplaces `main` por esta rama ni hagas un push forzado.

Hasta publicar esa ruta en Latido, Suizamente puede seguir entrando directamente con Google o correo. El acceso automático a una sesión de Latido necesita la ruta nueva.

### 4. Publicar Suizamente

Integra los cambios aprobados en la rama de producción **actual** del proyecto Suizamente, `suizamente`, y despliega ese proyecto. No hace falta crear otro proyecto Vercel ni volver a configurar DNS.

Conserva estos ajustes existentes:

| Ajuste | Valor |
| --- | --- |
| Root Directory | `apps/suizamente` |
| Framework | Vite |
| Node.js | 22.x |
| Install / Build / Output | `npm ci` / `npm run build` / `dist` |
| Include files outside Root Directory | Activado |
| Dominio | `https://suizamente.latido.ch` |
| Variables públicas | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL` |

`VITE_SITE_URL` sigue siendo `https://suizamente.latido.ch`. La URL y clave pública de Supabase son las mismas de Latido. No añadir `service_role`, claves secretas, secretos de Google ni contraseñas a variables `VITE_*`.

Las dos redirecciones de Supabase Auth ya configuradas deben conservarse, junto a las de Latido:

```text
https://suizamente.latido.ch/auth/callback
https://suizamente.latido.ch/auth/restablecer
```

El Site URL global sigue siendo `https://latido.ch`. Google reutiliza el proveedor existente; no requiere otro cliente OAuth.

### 5. Comprobar el resultado publicado

Entrar con una cuenta de Latido y comprobar el nombre existente; iniciar sesión también mediante Google y correo; enviar y aceptar una amistad entre dos cuentas; completar un duelo y un reto diario; revisar la media de cada cantón; guardar un dato en la libreta; comprobar que cerrar sesión en Suizamente conserva la sesión de Latido. Estas comprobaciones reales se hacen después de autorizar la publicación; las pruebas automatizadas utilizan cuentas ficticias y una base local.

## Acceso y privacidad

Las sesiones de dos dominios no se comparten automáticamente por localStorage. Suizamente solicita la sesión a una ventana de Latido mediante `postMessage`, validando origen, ventana y nonce. La función nueva verifica el acceso de esa cuenta y genera un token de un solo uso sin enviar correo. Suizamente lo canjea por una sesión propia. El token de renovación de Latido no se copia y no hay credenciales en los enlaces.

El acceso automático depende de que el navegador permita la sesión de Latido en el iframe. Si la bloquea, el botón **Entrar con mi cuenta de Latido** abre Latido en una ventana; Google y correo siguen disponibles. Cerrar sesión guarda una preferencia local que impide entrar automáticamente otra vez hasta elegir conectar la cuenta.

El nombre autenticado viene de `profiles.name`; no se pide un segundo nombre ni se cambia su escritura. Las fotos utilizan `profiles.avatar_url`, igual que las tarjetas públicas de Latido. No se usan imágenes automáticas del proveedor de acceso. Si falta la foto o no carga, el avatar utiliza la misma paleta de Latido, su color calculado por el nombre y la inicial siempre en mayúscula. Las imágenes se ajustan sin recortar los logos. La función añade únicamente la URL pública a las identidades que la RPC ya permite ver; no devuelve correos ni otros metadatos privados. No requiere otro SQL. La búsqueda de amigos se actualiza al escribir, desde dos letras, y cancela las búsquedas anteriores. El cantón existente se reutiliza al iniciar el perfil. Las preferencias de Suizamente no modifican el perfil general de Latido. Los invitados pueden jugar, guardar datos y aceptar una invitación de duelo; crear duelos, solicitar amistades, publicar propuestas y participar en rankings requiere cuenta.

Al entrar, el progreso invitado del mismo dispositivo se vincula una vez. Si la cuenta ya respondió la misma pregunta, prevalece su respuesta. El identificador de invitado es una credencial opaca y no se expone a los rivales. Los grupos demográficos necesitan al menos 20 votos. Borrar datos de Suizamente exige doble confirmación, anonimiza los votos y conserva la cuenta de Latido.

## Puntos y liga

La puntuación se calcula en el servidor: respuesta correcta +10, desde el tercer acierto seguido +15, dilema +5, reto completado +30, duelo ganado +20 o empatado +10, propuesta publicada +100. Una primera respuesta se premia una vez; repetirla en otros contextos no vuelve a sumar puntos de respuesta. Los bonus de reto, duelo y publicación tienen claves únicas.

La liga usa **puntos semanales del cantón / cuentas activas del cantón**. Se incluyen quienes respondieron y obtuvieron cero puntos; también quienes recibieron puntos de un reto, duelo o publicación. Solo cuentan las cuentas que aceptan aparecer en el ranking. Los puntos conservan el cantón de cuando se obtuvieron; cambiarlo no mueve los puntos anteriores. La semana empieza el lunes y los días cambian según `Europe/Zurich`, incluidos los cambios de horario.

## Propuestas y avisos

Los administradores existentes de `admin_users` revisan propuestas en `/admin/suizamente/propuestas` dentro de Latido o `/moderacion` en Suizamente. Pueden editar el texto, las opciones, la respuesta correcta, la explicación y la fuente antes de publicar; aprobar, rechazar y dejar una nota. Estas ediciones se limitan a la propuesta, sin modificar las preguntas ya publicadas. Aprobar no modifica automáticamente el banco. Para publicar, el equipo incorpora la pregunta revisada en las fuentes existentes con un ID nuevo, mantiene los IDs y opciones anteriores, sincroniza los catálogos y despliega el banco. Después asocia el ID publicado en la revisión: entonces se concede el bonus y se muestra el crédito de autor.

Los avisos de amistades, duelos y propuestas se guardan en `app_notifications` y aparecen en ambas aplicaciones. **No se han activado tareas programadas ni push de recordatorios a las 19:00 o resúmenes semanales.** El ajuste de avisos de esta versión controla las novedades sociales dentro de la aplicación.

## Preview y desarrollo

La aplicación integrada puede abrirse en `http://localhost:8080/suizamente` ejecutando el servidor raíz en la carpeta de la rama `suizamente-social`. Vite sirve también `/api/suizamente/social` mediante un adaptador local del mismo handler de la Edge Function: permite probar el SQL instalado antes de desplegar esa función. Utiliza las credenciales de servidor existentes en `.env.local`, sin enviarlas al navegador. Las operaciones usan el Supabase configurado y pueden guardar datos reales; iniciar este servidor no publica la web ni despliega funciones. Los cambios de `public/suizamente/` se reflejan al recargar.

Las pruebas locales usan los orígenes de desarrollo ya admitidos. Un Preview remoto necesita incluir su origen HTTPS exacto, sin rutas ni barra final, en `SUIZAMENTE_ALLOWED_ORIGINS` de la función nueva. Para probar también la conexión con Latido, añadir el mismo origen a `VITE_SUIZAMENTE_SSO_ORIGINS` del build de Latido y publicar ese build bajo autorización. Para Google o enlaces de correo, añadir además sus callbacks exactos a Supabase Auth. Evitar comodines que admitan previews de terceros.

No configurar esos permisos de Preview si no se necesita probar autenticación/API en un Preview remoto. Un build aislado conserva el modo de juego normal aunque el servicio social no esté disponible; los retos y duelos requieren conexión.

## Validación y mantenimiento

```powershell
npm ci --prefix apps/suizamente
npm run suizamente:comprobar
npm run suizamente:social:generar
npm run test:suizamente:social
npm run test:suizamente:votos
npm run lint
npm run build
npm --prefix apps/suizamente run lint
npm --prefix apps/suizamente test
npm --prefix apps/suizamente run build
npm --prefix apps/suizamente run test:build
npm --prefix apps/suizamente run test:social
npm --prefix apps/suizamente run test:browser
```

El generador reconstruye los metadatos y el instalador a partir del banco publicado; no lo modifica. Las pruebas SQL y de navegador verifican puntos únicos, privacidad, permisos, dos jugadores, vinculación, media incluyendo ceros, formularios y móvil claro/oscuro. La función nueva está desplegada y su CORS se ha comprobado en producción sin crear cuentas ni respuestas de prueba.
