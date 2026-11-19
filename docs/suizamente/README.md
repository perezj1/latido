# Suizamente de Latido

La ruta `/suizamente` muestra la referencia entregada por Latido, aislada en un
iframe del mismo origen para conservar su aspecto, Poppins, modo oscuro y revelado
a pantalla completa. Usa el logo oficial `/favicon.svg`, también utilizado por la
portada de Latido. Los accesos de Inicio, Perfil y Explorar llevan al nuevo juego.

«¿Qué prefieres?» usa solo dilemas de dos opciones (941). «Preguntas y respuestas»
usa solo preguntas de tipo `real` (1.000). Mix combina cinco de cada tipo por ronda
de diez, en orden aleatorio. Se priorizan las no respondidas dentro de cada tipo.
Los 59 dilemas de tres opciones se conservan sin modificar en el JSON y en la
base de datos, pero no se incluyen en las rondas. Hay 1.941 preguntas jugables.

## Archivos

- `public/suizamente/juego.html`: estilos y estructura originales.
- `public/suizamente/juego.js`: inicio, rondas, resultado, resumen y compartir.
- `public/suizamente/votos.js`: sesión, recuentos, recuperación y reintentos.
- `public/suizamente/data/preguntas.json`: banco de 2.000 preguntas del ZIP de Latido,
  incluidas las 100 anteriores intactas; no modificar los índices de sus opciones.
- `data/suizamente/fuentes/`: fuentes editoriales originales entregadas en el ZIP.
- `scripts/generar-suizamente-preguntas.cjs`: generador determinista entregado por
  Latido, adaptado a las rutas del repositorio; permite regenerar el mismo banco.
- `src/pages/Suizamente.jsx`: ruta React y puente de sesión del mismo origen.
- `api/suizamente.js`: adaptador de los tres endpoints HTTP para Vite/Vercel.
- `supabase/functions/suizamente-votos/index.ts`: API de producción desplegada
  en Supabase. El navegador la usa directamente en la compilación de producción.
- `supabase/functions/_shared/suizamenteHttp.js`: contrato HTTP, identidad,
  validación y privacidad compartidos por ambos adaptadores.
- `supabase/suizamente_votos.sql`: tablas, catálogo de opciones, RPC restringida
  al servidor y límites persistentes por jugador/IP.
- `supabase/suizamente_actualizar_catalogo.sql`: actualización aditiva para una
  instalación existente, sin modificar votos ni cambiar opciones publicadas.
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

## Producción

La compilación de producción conecta a
`${VITE_SUPABASE_URL}/functions/v1/suizamente-votos`. Reutiliza la URL pública
que ya utiliza Latido: **no requiere añadir una clave secreta a Vercel**.
Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` dentro de la
Edge Function. La clave permanece en el servidor.

La función permite jugadores anónimos por UUID y valida con Supabase cada token
de sesión recibido. Su configuración `verify_jwt = false` permite ese acceso
anónimo; el código valida la identidad de las personas con sesión. CORS admite
`latido.ch`, `www.latido.ch`, los previews de `latidoch` y localhost.

Instalación en otro proyecto o restauración:

1. Ejecutar `supabase/suizamente_votos.sql` completo en Supabase SQL Editor.
2. Desplegar únicamente la función nueva:

   ```powershell
   supabase functions deploy suizamente-votos --project-ref <referencia> --no-verify-jwt --use-api
   ```

3. Desplegar la web por el flujo habitual de la rama Git.

El 19 de noviembre de 2026 se verificaron la instalación SQL, las 2.000 preguntas,
los permisos y RLS en el proyecto Supabase de Latido; se desplegó la función y
se comprobaron los endpoints reales. No se insertaron votos ficticios.
`supabase/suizamente_verificar_produccion.sql` permite repetir las comprobaciones
de base de datos sin modificar datos. Si pasan, no hace falta ejecutar otra migración.

En desarrollo la ruta `/api/suizamente` utiliza `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` de `.env.local`, que está excluido de Git. Se acepta
`VITE_SUPABASE_URL` como alternativa para la URL. La clave secreta nunca debe
tener el prefijo `VITE_`. Los entornos locales usados durante la integración
ya están configurados. La URL directa `/suizamente/juego.html` usa este adaptador;
la entrada de producción es `/suizamente`.

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
npm run suizamente:comprobar
npm run test:suizamente:votos
npm run test:suizamente:referencia
npm run build
npm run test:suizamente:produccion
```

El test de votos ejecuta la SQL real en PostgreSQL con PGlite y comprueba el
contrato HTTP: primer voto, repetidos, reparto, validación 400, identidad 401,
privacidad, permisos, borrado de cuenta y límite 429 por IP y jugador.
El test visual usa Chromium instalado con Playwright, recorre los tres modos y
guarda capturas en `output/suizamente-referencia/`. Comprueba móvil de 320/390 px,
escritorio, tema claro/oscuro, teclado, foco, copia, persistencia, preguntas nuevas
primero, ausencia de porcentajes sin API y recuperación del voto al reconectar.
El test de producción abre el resultado de `npm run build` y consulta la Edge
Function real: verifica CORS, conexión y los tres modos sin enviar votos.

Las comprobaciones `test:suizamente:votos` y `test:suizamente:referencia` son
las del juego integrado en esta rama.

## Actualizar el contenido

Editar las fuentes de `data/suizamente/fuentes/` según `LEEME-FUENTES.md`,
conservando `base.json`, y ejecutar `npm run suizamente:generar`. El comando
genera el JSON público, lo valida y sincroniza el catálogo de la Edge Function
y los SQL de instalación y actualización. `npm run suizamente:comprobar` verifica
que el banco publicado coincide exactamente con sus fuentes sin escribir archivos.

Después se aplica `supabase/suizamente_actualizar_catalogo.sql` a la base de datos,
se despliega de nuevo `suizamente-votos` y se publica la web. El ZIP importado
solo aporta contenido y herramientas editoriales: no se incorpora su HTML,
sus estilos ni sus instrucciones de diseño al juego actual.
