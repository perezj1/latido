# Suizamente independiente

La rama `suizamente-social` incorpora **Suizamente Conquista**: mapa oficial,
conquistas individuales, saldo separado de XP, tienda, batallas voluntarias
entre amigos y colección. La arquitectura, reglas, fuentes, instalación y
pruebas están en [CONQUISTA.md](../../docs/suizamente/CONQUISTA.md).

PWA para `https://suizamente.latido.ch`, dentro de `perezj1/latido`. Usa el mismo juego que `/suizamente` en Latido, el mismo banco de preguntas y el proyecto Supabase existente. No requiere instalar las dependencias de la aplicación raíz para compilar.

Desde la raíz del repositorio:

```powershell
npm ci --prefix apps/suizamente
Copy-Item apps/suizamente/.env.example apps/suizamente/.env.local
```

Completa `.env.local` con la **clave pública** de Supabase utilizada por Latido. El archivo está excluido de Git. Nunca añadas una clave `service_role`, `sb_secret_…` ni contraseñas de base de datos.

```powershell
npm --prefix apps/suizamente run dev
```

Desarrollo: `http://127.0.0.1:5270`. El juego funciona como invitado. Los votos utilizan la Edge Function existente; no hay un segundo backend ni una base de datos local automática.

```powershell
npm --prefix apps/suizamente run build
npm --prefix apps/suizamente run preview
```

Vista de la compilación: `http://127.0.0.1:5271`. El service worker solo se registra en la compilación de producción. Las rutas `/cuenta`, `/instalar`, `/auth/callback` y `/auth/restablecer` están disponibles también en desarrollo y preview.

```powershell
npm --prefix apps/suizamente run lint
npm --prefix apps/suizamente test
npm --prefix apps/suizamente run test:build
npm --prefix apps/suizamente run test:browser
```

`test:build` y `test:browser` requieren compilar antes. La prueba de navegador necesita Chromium instalado mediante Playwright y simula toda la autenticación y los votos: no crea usuarios ni envía correos. Guarda capturas en `test-results/`, excluido de Git. Las pruebas de artefactos esperan el dominio canónico de producción y una compilación normal, sin `VERCEL_ENV=preview`.

El manual completo de arquitectura, Vercel, Supabase y puesta en marcha está en [PWA_INDEPENDIENTE.md](../../docs/suizamente/PWA_INDEPENDIENTE.md). No se ha creado ni desplegado ningún proyecto externo durante esta preparación.

La ampliación social añade retos, duelos, amigos, liga de cantones por media, libreta, niveles y medallas. Conserva el diseño de preguntas y respuestas. Su instalación requiere el SQL y la función nuevos: sigue [ACTIVAR_SOCIAL.md](../../docs/suizamente/ACTIVAR_SOCIAL.md) antes de publicar esta versión. Las variables públicas de Vercel son las mismas; no hace falta otra cuenta ni otro proyecto Supabase.

```powershell
npm run test:suizamente:social
npm --prefix apps/suizamente run test:social
```

El primer comando prueba el SQL completo en PostgreSQL local mediante PGlite. El segundo comprueba las pantallas en Chromium con dos cuentas y esa base de pruebas; necesita una compilación previa. Ninguno escribe en producción ni envía correos.
