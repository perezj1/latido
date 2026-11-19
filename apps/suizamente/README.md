# Suizamente independiente

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
