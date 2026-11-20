# Suizamente como PWA independiente

Actualizado el 20 de noviembre de 2026. Destino: `https://suizamente.latido.ch`. Repositorio: `perezj1/latido`. La PWA base ya está publicada, el dominio está validado y sus retornos de Auth y CORS están configurados. La ampliación social de la rama `suizamente-social` todavía no está publicada: seguir [ACTIVAR_SOCIAL.md](ACTIVAR_SOCIAL.md) para el SQL, la función nueva y el orden de activación.

## Arquitectura y alcance real

Latido conserva su aplicación Vite/React, sus dependencias, sus rutas y su configuración de despliegue. Suizamente añade una aplicación Vite con JavaScript en `apps/suizamente/`, con `package.json`, lockfile, compilación y configuración Vercel propios. No introduce workspaces, Turborepo ni una reorganización del repositorio. Su configuración CSS evita heredar PostCSS/Tailwind de Latido, por lo que no necesita instalar las dependencias de la raíz.

El juego está implementado en HTML/JavaScript y aislado en un iframe. Ambos anfitriones usan exactamente esos archivos. La aplicación independiente añade instalación y cuenta; la ampliación compartida incorpora las pantallas sociales y conserva el diseño de preguntas y respuestas. El acceso integrado sigue en `/suizamente/*` y `/perfil/suizometro`.

| Recurso | Fuente compartida / comportamiento |
| --- | --- |
| Juego, diseño y fuentes | `public/suizamente/`, servido directamente en desarrollo y copiado sin cambios al compilar |
| Preguntas | `public/suizamente/data/preguntas.json`; mismo banco de 2000 preguntas, sin un segundo archivo editable en la app |
| Modos | ¿Qué prefieres?, Preguntas y respuestas y Mix; mismos filtros y rondas de 10 |
| Contenido jugable | 1941 preguntas: 941 dilemas de dos opciones y 1000 preguntas reales. Los 59 dilemas de tres opciones siguen conservados en los datos |
| Logo e iconos | Recursos oficiales de Latido ya existentes en `public/`; sin recursos provisionales |
| Identidad del iframe | `src/lib/suizamenteSessionBridge.js`, compartido entre React y la app independiente |
| Almacenamiento de sesión | `src/lib/authStorage.js` y `storageBudget.js`, reutilizados sin modificar su implementación |
| Usuarios | Supabase Auth del proyecto `zmievixfjefjppofebbh`, los mismos identificadores de usuario |
| Votos y respuestas | `suizamente-votos`, misma RPC y tablas; la función nueva `suizamente-social` integra votos y puntos en una transacción |
| Retos, duelos, amigos y progreso | Esquema privado `suizamente_social`, compartido por ambos anfitriones tras su instalación |

La versión publicada tiene respuestas, aciertos y votos en `public.suizamente_catalogo_votos`, `public.suizamente_votos` y `public.suizamente_votos_limites`. La ampliación prepara las tablas privadas de niveles, rankings, retos, duelos, amistades y libreta en el instalador social; todavía no se han aplicado en producción.

La edición del banco sigue realizándose con los generadores y fuentes existentes en la raíz. Antes de compilar ambas aplicaciones, ejecutar `npm run suizamente:comprobar`. Los IDs y el orden de opciones no cambian. La ampliación social sí requiere su instalador SQL, que añade metadatos sin sustituir el banco ni sus votos.

## Sesiones, progreso y permisos

`https://www.latido.ch` y `https://suizamente.latido.ch` son orígenes diferentes y conservan sesiones independientes de las mismas cuentas Supabase. La ampliación prepara una conexión verificada con Latido mediante `/suizamente/conectar` y la función social: intenta acceder automáticamente cuando el navegador permite el iframe y ofrece una ventana de conexión si lo bloquea. No copia el refresh token ni coloca credenciales en enlaces. Requiere publicar también la ruta de conexión de Latido.

La nueva app permite jugar como invitado, entrar con correo/contraseña o Google, crear una cuenta y recuperar la contraseña. Usa PKCE y el intercambio automático del SDK; no duplica el intercambio del código. El código se elimina de la URL al terminar. Los enlaces de confirmación/recuperación deben abrirse en el mismo navegador y dispositivo donde se inició el proceso; una PWA instalada y otro navegador pueden tener almacenes distintos. Esto es una [limitación del flujo PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

Al entrar con la misma cuenta, `/votos/mios` recupera las respuestas registradas y permite reconstruir las estadísticas existentes en ambos orígenes. La ampliación vincula una vez el progreso invitado del mismo dispositivo, conservando la respuesta de la cuenta si hay conflicto. Una ronda abierta y respuestas pendientes siguen siendo locales hasta sincronizarse; no se transfieren invitados entre dominios. Cerrar sesión usa `scope: local`, conserva las demás sesiones y evita una reconexión automática no solicitada.

El iframe solo recibe la sesión de su anfitrión cuando coinciden origen, ventana y solicitud; obtiene una sesión actualizada antes de cada petición. La API verifica el JWT y toma el usuario real del token. El identificador anónimo no sustituye a un usuario autenticado.

Se conservan RLS, restricciones y permisos existentes. `anon` y `authenticated` no tienen acceso directo a las tablas ni a la RPC de votos; solo el backend con `service_role` puede ejecutarla. La nueva aplicación no consulta ni escribe esas tablas directamente. Las pruebas de PostgreSQL verifican permisos, privacidad, identidad, duplicados y límites. No se debilitaron políticas para permitir el subdominio.

## PWA y SEO

La app tiene su propio `manifest.webmanifest`, nombre **Suizamente**, `id`, `start_url` y `scope` `/`, `display: standalone`, color azul `#4A76EF`, fondo blanco e iconos 192, 512, maskable y Apple Touch. La identidad de instalación se resuelve respecto a su propio dominio, por lo que es independiente de la instalación de Latido.

El service worker `/sw.js` se registra únicamente en la compilación de producción y solo en el origen donde se sirve. Su caché versionada contiene ocho recursos públicos: manifiesto, logo, cinco iconos y aviso sin conexión. No almacena páginas de cuenta, callbacks, sesiones, tokens, respuestas de Supabase, votos ni navegación HTML. Tampoco guarda el juego completo ni las preguntas para uso offline. Sin conexión al abrir la app se presenta un aviso; una partida ya abierta mantiene el comportamiento de reintento del juego existente.

La portada tiene HTML público con título, descripción, canonical, Open Graph, favicon y explicación de los modos. `sitemap.xml` incluye `/` y `/instalar`. Cuenta y callbacks tienen HTML propio `noindex`, política `no-referrer` y cabeceras `no-store`/`X-Robots-Tag` en Vercel. Las URL desconocidas no se reescriben a la portada: mantienen el 404. Los Preview de Vercel usan `noindex` y `robots.txt` bloqueante; el canonical siempre apunta al dominio de producción.

El manifest de Latido se conserva. Su service worker excluye la ruta de conexión de cuenta de la caché; SEO y cabeceras de Vercel la marcan privada y no almacenable. Las demás modificaciones raíz se limitan a rutas de Suizamente, conexión, avisos sociales y enlace de moderación.

## Configuración del proyecto Vercel existente

El proyecto `suizamente` ya existe en el equipo propietario de Latido. Conservar sus ajustes; no crear otro proyecto ni cambiar el proyecto principal.

| Ajuste | Valor |
| --- | --- |
| Project name | `suizamente` |
| Git repository | `perezj1/latido`, el mismo repositorio |
| Root Directory | `apps/suizamente` |
| Framework Preset | `Vite` |
| Node.js | `22.x`, también fijado en el package de la app |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Include source files outside of the Root Directory in the Build Step | **Activado**: necesita `public/suizamente`, iconos y `src/lib` de la raíz |
| Configuración de rutas/cabeceras | `apps/suizamente/vercel.json` |
| Dominio | `suizamente.latido.ch`, ya validado |
| Production Branch actual | `suizamente` |

Vercel documenta la [inclusión de archivos fuera del Root Directory](https://vercel.com/docs/monorepos/monorepo-faq) y las [versiones de Node disponibles](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). No hace falta ejecutar `npm ci` en la raíz para construir Suizamente.

La ampliación está en `suizamente-social`. Integrarla en `suizamente` puede activar el despliegue de Suizamente; integrar en `main` puede activar Latido. Ambas publicaciones requieren autorización. No modificar la rama de producción de Latido para probar el juego.

Variables para Production y, si se prueba, Preview, en el proyecto **suizamente**:

```dotenv
VITE_SUPABASE_URL=https://zmievixfjefjppofebbh.supabase.co
VITE_SUPABASE_ANON_KEY=<misma clave publica anon o publishable de Latido>
VITE_SITE_URL=https://suizamente.latido.ch
```

La tercera es opcional, con ese valor por defecto. No usar el dominio de Preview como canonical. No copiar el `.env.local` completo de Latido ni añadir `SUPABASE_SERVICE_ROLE_KEY`, claves secretas, contraseñas o secretos de OAuth al proyecto frontend. El build valida el tipo de clave y rechaza claves `service_role`/secretas.

## Configuración manual pendiente en Supabase

Proyecto existente: **latido**, referencia `zmievixfjefjppofebbh`. No crear otro proyecto. La separación base no requirió SQL; las funciones sociales sí necesitan [el instalador y los pasos nuevos](ACTIVAR_SOCIAL.md).

La inspección de Auth fue de solo lectura. El `Site URL` sigue siendo `https://latido.ch`; la lista conserva las URL de Latido y ya incluye los dos retornos de Suizamente siguientes. Google está habilitado y tiene sus credenciales existentes; no se mostraron ni copiaron esos secretos.

1. En **Authentication → URL Configuration → Redirect URLs**, conservar estas dos URL sin eliminar las actuales ni sustituir el **Site URL** de Latido:

   ```text
   https://suizamente.latido.ch/auth/callback
   https://suizamente.latido.ch/auth/restablecer
   ```

2. Para desarrollo local, si se quiere probar OAuth o enlaces de correo, añadir los retornos exactos del navegador utilizado:

   ```text
   http://127.0.0.1:5270/auth/callback
   http://127.0.0.1:5270/auth/restablecer
   ```

   Si se usa `localhost` o el preview local de puerto `5271`, añadir esos equivalentes exactos. El juego y el acceso por contraseña no dependen de esa lista para mostrar la portada.

3. Para un Preview remoto, añadir solo las URL exactas `/auth/callback` y `/auth/restablecer` de ese despliegue. No abrir una regla general para cualquier dominio de Vercel. El frontend usa `location.origin` para el retorno, por lo que no manda el login de Preview a producción.

4. Mantener el proveedor Google y sus credenciales actuales. Este frontend usa OAuth mediante Supabase, con el callback del proveedor ya existente `https://zmievixfjefjppofebbh.supabase.co/auth/v1/callback`; el subdominio es el retorno posterior de Supabase. No requiere otro cliente OAuth ni secretos de Google en Vite.

5. Las plantillas actuales de confirmación y recuperación usan `{{ .ConfirmationURL }}` y no fuerzan `{{ .SiteURL }}`: se conserva el enlace de verificación de Supabase y su retorno. No necesitan editarse para esta preparación. Comprobar con correos reales en el Preview autorizado que mantienen los retornos nuevos y los flujos existentes de Latido. No se han enviado correos ni editado plantillas. Si se personalizan en el futuro, evitar una ruta exclusiva de Latido que ignore el retorno. Véase la [documentación de redirecciones y plantillas](https://supabase.com/docs/guides/auth/redirect-urls).

6. El CORS de `suizamente-votos` ya se desplegó con autorización para el origen exacto `https://suizamente.latido.ch`, conservando los orígenes previos. No hace falta volver a desplegarlo. Para esta ampliación se prepara una función distinta, `suizamente-social`; su despliegue todavía está pendiente y se documenta en la guía de activación.

7. Solo para permitir votos en Preview remotos, la función admite el secreto opcional `SUIZAMENTE_ALLOWED_ORIGINS`: lista separada por comas de **orígenes HTTPS exactos**, sin rutas ni barra final. Configurarlo manualmente tras autorización con los dominios de Preview realmente utilizados. No hacen falta orígenes extra para producción o desarrollo local. Un Preview sin esa configuración permite ver el juego, pero los votos mostrarán el aviso de indisponibilidad; no es un error de variables Vite.

Los secretos de servicio siguen únicamente en el entorno existente de Supabase. Las URL de retorno de Auth y la lista de orígenes de la API son configuraciones distintas: para probar ambos flujos en Preview se necesitan ambas.

## Comprobaciones y publicación pendiente

Ejecutado localmente con Node 22:

| Comprobación | Resultado |
| --- | --- |
| `npm run lint` en la raíz | Correcto |
| `npm run build` en la raíz | Correcto; prerender de 69 páginas y SEO de Latido |
| `npm --prefix apps/suizamente run build` | Correcto; compilación independiente |
| Instalación y build en carpeta temporal sin package ni dependencias raíz | Correcto; `npm ci` y build con solo los recursos compartidos necesarios |
| `npm --prefix apps/suizamente run lint` | Correcto |
| `npm --prefix apps/suizamente test` | Configuración pública y seguridad del puente de sesión |
| `npm --prefix apps/suizamente run test:build` | Fuentes compartidas idénticas, SEO privado, cabeceras, sitemap, iconos y ausencia de secretos de servidor |
| Preview con `VERCEL_ENV=preview` y servidor dev | `noindex` conservado tras ejecutar JavaScript, 404 real y rutas/recursos compartidos accesibles |
| `npm --prefix apps/suizamente run test:browser` | Tres modos, votos, login, alta, recuperación, logout local, PKCE/Google, aislamiento por origen, caché y aviso offline; vistas móvil/estrecha/oscura |
| `npm run test:suizamente:referencia` | Regresión del juego integrado, modos, porcentajes, compartir, teclado y persistencia |
| `npm run test:suizamente:votos` | PostgreSQL/RLS y HTTP/CORS, con el nuevo subdominio |
| `npm run test:auth` y `npm run test:pwa` | Almacenamiento/Auth y PWA existente de Latido |
| `npm run suizamente:comprobar` y `npm run test:suizamente:redaccion` | Banco de 2000 preguntas y correcciones editoriales conservados |
| `deno check --no-config supabase/functions/suizamente-votos/index.ts` | Correcto |

No hay un comprobador TypeScript de frontend en estos paquetes JavaScript; ESLint y las compilaciones validan ese código. La entrada TypeScript de la Edge Function sí se comprobó con Deno. El build de Latido mantiene avisos existentes por tamaño de algunos chunks y antigüedad de Browserslist; no impiden compilar. El navegador de la prueba raíz puede advertir sobre fuentes externas por la unión local de `node_modules` del worktree; el juego carga sus propias fuentes compartidas y la prueba funcional pasa.

Las pruebas de autenticación usan respuestas simuladas y las sociales ejecutan SQL real en PostgreSQL local mediante PGlite: no crean usuarios reales, no mandan correos ni escriben en producción. La ampliación añade pruebas de dos jugadores, amigos, duelos, retos, puntos, media por cantón, libreta y SSO. La instalación real en Android/iOS, Google real, correos de Auth y cabeceras/rutas en Vercel requieren validación final tras la publicación autorizada.

Orden actual de activación: ejecutar el instalador social, desplegar únicamente la función nueva y publicar los cambios revisados de Latido y Suizamente. Los detalles están en [ACTIVAR_SOCIAL.md](ACTIVAR_SOCIAL.md). El proyecto, DNS y retornos de producción ya existen; no hay que repetir su creación.

## Archivos de la separación base

- Nuevos en `apps/suizamente/`: `package.json`/lock, `.env.example`, `.gitignore`, `index.html`, `vite.config.js`, `vercel.json`, `eslint.config.js`, `src/main.js`, `src/config.js`, `src/style.css`, `public/manifest.webmanifest`, `public/sw.js`, `public/sin-conexion.html`, pruebas y README.
- Nuevo compartido: `src/lib/suizamenteSessionBridge.js`.
- Ajustados: `src/pages/Suizamente.jsx` para usar el mismo puente, `public/suizamente/juego.js`/`juego.html` para los enlaces exclusivos de la nueva app, el CORS de `supabase/functions/_shared/suizamenteHttp.js` y `supabase/functions/suizamente-votos/index.ts`, y la prueba HTTP correspondiente.
- La ampliación social añade `public/suizamente/experiencia*`, el módulo de compartir historias, la función `suizamente-social`, su instalador privado y los puentes de conexión de cuenta. Conserva las preguntas y el manifest de Latido. Los cambios concretos de permisos, rutas y caché están explicados en la guía de activación.
