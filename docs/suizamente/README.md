# Suizamente de Latido

La ruta `/suizamente` muestra la referencia entregada por Latido, aislada en un
iframe del mismo origen para conservar su aspecto, Poppins, modo oscuro y revelado
a pantalla completa. Usa el logo oficial `/favicon.svg`, también utilizado por la
portada de Latido. Los accesos de Inicio, Perfil y Explorar llevan al nuevo juego.

## Archivos

- `public/suizamente/juego.html`: estilos y estructura originales.
- `public/suizamente/juego.js`: inicio, rondas, resultado, resumen y compartir.
- `public/suizamente/votos.js`: sesión, recuentos, recuperación y reintentos.
- `public/suizamente/data/preguntas.json`: las 100 preguntas originales, con los
  mismos identificadores e índices de opciones; no modificar su orden.
- `src/pages/Suizamente.jsx`: ruta React y puente de sesión del mismo origen.
- `api/suizamente.js`: los tres endpoints HTTP. En Vite también se sirven localmente.
- `supabase/suizamente_votos.sql`: tablas, catálogo de opciones, RPC restringida
  al servidor y límites persistentes por jugador/IP.
- `openapi.yaml`: contrato entregado por Latido. La sesión de esta integración
  usa `Authorization: Bearer <access_token>` de Supabase, con prioridad sobre
  `X-Jugador-Id`. Las respuestas de recuentos tienen tres posiciones (0–2).

Esta rama parte de `origin/main` e incorpora solo este juego. Los commits del
juego anterior y los scripts de desinstalacion no forman parte de esta rama.
`/perfil/suizometro` y los enlaces `/suizamente/*` abren el nuevo juego.

## Probar localmente

```powershell
npm run dev
```

Abre `http://localhost:8080/suizamente` (o el puerto indicado por Vite).
También puede probarse directamente `/suizamente/juego.html`, sin sesión de Latido.

El juego permite jugar y guardar respuestas en el navegador si la API falla;
en ese caso muestra el aviso de conexión, sin porcentajes. Reintenta al volver
la conexión, al recargar o cada minuto mientras la página está visible.
No se incluyen votos simulados en producción.

Para habilitar los votos reales:

1. Ejecutar **solo** `supabase/suizamente_votos.sql` completo en Supabase SQL Editor.
   La instalación es aditiva e idempotente, independiente del juego anterior.
2. Configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como variables de
   servidor en Vercel; localmente pueden ir en `.env.local`. Se acepta
   `VITE_SUPABASE_URL` como alternativa para la URL. La clave secreta nunca debe
   tener el prefijo `VITE_` ni incorporarse al navegador.
3. Desplegar por el flujo habitual del repositorio. `vercel.json` enruta
   `/api/suizamente/votos`, `/votos/resumen` y `/votos/mios` a la función.

No se ha ejecutado la migración ni desplegado contra servicios remotos. En el
entorno local encontrado solo estaba configurada la clave pública de Supabase.

## Identidad y privacidad

El servidor verifica el token con Supabase antes de usar el usuario de la sesión;
sin sesión exige un UUID v4 anónimo. Las identidades autenticadas y anónimas
usan espacios separados. La clave primaria impide modificar el primer voto.
Las respuestas locales de cuentas diferentes también se guardan por separado.
Las tablas tienen RLS y no están disponibles a los roles `anon`/`authenticated`;
solo la RPC del servidor devuelve resúmenes o los votos del jugador actual.
Al eliminar una cuenta, sus votos autenticados se eliminan por clave foránea.
Los límites almacenan el hash de la IP, no su valor original, y expiran tras un día.

## Comprobaciones

```powershell
npm run suizamente:validar
npm run test:suizamente:votos
npm run test:suizamente:referencia
npm run build
```

El test de votos ejecuta la SQL real en PostgreSQL con PGlite y comprueba el
contrato HTTP: primer voto, repetidos, reparto, validación 400, identidad 401,
privacidad, permisos, borrado de cuenta y límite 429 por IP y jugador.
El test visual usa Chromium instalado con Playwright, recorre los tres modos y
guarda capturas en `output/suizamente-referencia/`. Comprueba móvil de 320/390 px,
escritorio, tema claro/oscuro, teclado, foco, copia, persistencia, preguntas nuevas
primero, ausencia de porcentajes sin API y recuperación del voto al reconectar.

Las comprobaciones `test:suizamente:votos` y `test:suizamente:referencia` son
las del juego integrado en esta rama.
