# Suizamente: pruebas con personas reales

## Base de datos

Actualizada el 24 de noviembre de 2026 en el proyecto Supabase de Latido
`zmievixfjefjppofebbh`. No hace falta ejecutar SQL manualmente para esta entrega.
Se ha importado el banco canónico y aplicado Comunidad, administración, Economía,
eventos, ligas, misiones, vueltas y v14. No se reinstaló el motor base ni se borraron
perfiles, partidas, votos o movimientos. Las tareas de progreso y plazos están
activas; la función de avisos push está desplegada.

Comprobación de lectura desde este equipo, sin imprimir credenciales:

```powershell
npm run suizamente:production:check
```

En el editor SQL de Supabase se puede comprobar, sin modificar datos:

```sql
SELECT public.suizamente_v2('config')->>'apiVersion' AS version; -- 14
SELECT jobname, schedule, active FROM cron.job
WHERE jobname IN ('suizamente-progreso', 'suizamente-turnos');
SELECT j.jobname, r.status, r.start_time
FROM cron.job j JOIN cron.job_run_details r ON r.jobid=j.jobid
WHERE j.jobname IN ('suizamente-progreso', 'suizamente-turnos')
ORDER BY r.start_time DESC LIMIT 10;
```

Las migraciones futuras van después de `suizamente_v14_cuentas.sql`; no hay que
reaplicar v2 por separado. `scripts/suizamente-production.ps1 aplicar` conserva una
copia privada previa y omite fases instaladas. Está limitado al proyecto de Latido.

## Publicar

La producción de `www.latido.ch` está vinculada a `main` en GitHub; la sesión local
de Vercel pertenece a otro espacio. Usar el proyecto existente del dominio, no crear
otro ni cambiar DNS. Publicar juntos el frontend y `api/suizamente.js`.
El proyecto utiliza `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` existentes; la API
acepta además `SUPABASE_URL` y `SUPABASE_ANON_KEY`. No requiere clave de servicio.

Tras publicar, `/api/suizamente/config` debe responder JSON con `apiVersion:14`,
no el HTML de la aplicación. No dar por publicado el juego hasta comprobarlo.
El Service Worker actualiza los recursos de la interfaz; recargar una vez si sigue
abierta una versión antigua. Las respuestas de la API y los votos no se cachean.

## Probar

1. Entrar desde dos cuentas reales diferentes, cada una en una ventana o dispositivo.
   Crear sus apodos en Suizamente. Solo se muestran apodos, niveles y estado disponible.
2. En Nueva partida: buscar por apodo arriba, compartir una invitación debajo,
   volver a una partida en «Seguir jugando» y comenzar otra en «Iniciar una partida».
   Sin otra cuenta disponible, «Rival al azar» queda desactivado. En una instalación
   con una sola cuenta esto es el comportamiento esperado.
3. Con la otra cuenta abierta, el vestíbulo se actualiza al recuperar el foco o en
   su siguiente refresco. Al azar elige una cuenta activa durante el período
   `comunidad.presenciaSegundos`, dentro de `partida.rivalAlAzar.margenNivel`, con
   espacio para partidas y sin otra partida abierta entre las mismas personas.
   La API vuelve a comprobarlo antes de crear la partida. Buscar y elegir un apodo
   o aceptar una invitación permite el juego por turnos aunque la otra persona esté
   desconectada. Las partidas antiguas sin rival se conservan, pero no permiten jugar.
4. Revisar la ruleta grande, ambos jugadores, sellos y existencias de comodines.
   El centro gira la ruleta; los comodines se activan al responder una pregunta,
   siguiendo las restricciones existentes. En la ruleta sus botones explican su uso.
5. Comprobar que la barra inferior permanece al desplazarse en todas las pantallas,
   incluidos menú, perfil, misiones, cofres y resultados. Solo desaparece mientras
   hay una pregunta pendiente, también en asaltos y pregunta del día.
6. En Inicio, girar y ampliar la misma maqueta 3D del Mapa. En Mapa, elegir una
   tarjeta con su miniatura del nivel actual: elegir no cobra. Construir actualiza
   ambas maquetas. «Toda Suiza» restaura el mapa completo. Sin WebGL queda el SVG.
7. Probar móvil físico: Safari/iPhone y Chrome/Android, instalación, giro de pantalla,
   teclado, zona inferior segura, sonido tras un toque y reconexión. Con «Menos
   animaciones» se detienen también las maquetas. Solo se montan miniaturas visibles;
   cada miniatura genera un cantón y libera su contexto al salir de la zona visible.

Pruebas automáticas:

```powershell
npm run test:suizamente:v13
node scripts/test-suizamente-production-browser.mjs
node scripts/test-suizamente-production-browser.mjs --webkit
npm run test:suizamente:accessibility
npm run test:suizamente:final:browser
npm run build
npm run test:suizamente:install
```

El recorrido de punta a punta usa dos cuentas aisladas y el SQL real: partida
completa, duelo, asalto, cofre, sobre, compra y construcción. Para revisar el cierre
de liga sin afectar a personas reales: `npm run suizamente:simulate:week`.

## Decisiones y seguimiento

- Las reglas nuevas de disponibilidad, navegación e Inicio 3D corresponden a la
  petición del 24 de noviembre y sustituyen las decisiones anteriores sobre esperar
  rival jugando y conservar el SVG en Inicio. Los importes y premios no cambian.
- El diseño de vestíbulo y ruleta usa la organización solicitada y los componentes,
  colores, logo y recursos propios de Suizamente. No incorpora publicidad, energía,
  cuentas sociales ni personajes del juego mostrado como referencia.
- Las colecciones permanentes están disponibles ahora. Las mensuales conservan las
  fechas canónicas de 2027; se ocultan hasta su mes. Latido debe decidir si desea
  adelantar su calendario editando la fuente y regenerando el banco, nunca a mano.
- Falta la validación humana en dispositivos físicos y revisar el contenido y las
  fechas antes de invitar a toda la comunidad. Las pruebas de WebKit son automáticas,
  no una ejecución en un iPhone físico.


## Acceso obligatorio y ajuste de textos

La entrada pública tiene una ilustración propia de Suizamente y tres opciones,
por este orden: cuenta de Latido, Google y email. No se crean perfiles invitados
nuevos ni se permite votar, construir o jugar sin sesión. La API HTTP y Supabase
rechazan estas peticiones con 401; administración mantiene 403. Las preguntas y
los enlaces de invitación también pasan por el acceso, conservando su destino.
Los datos de invitados anteriores se pueden vincular al iniciar sesión.

La migración incremental es `supabase/suizamente_v14_cuentas.sql`, después de v13.
El transporte de sesión comparte una recuperación entre peticiones rechazadas,
reintenta una sola vez y cierra localmente las sesiones inválidas. No se toma como
usuario conectado una cuenta encontrada en el almacenamiento de otro proyecto.

El filtro muestra «Todas», «Mi turno» y «Su turno». La cabecera se adapta en dos
filas cuando hace falta, los apodos largos caben en sus tarjetas y los botones
permiten texto en varias líneas. Se comprueban 320, 390 y escritorio.

```powershell
npm run test:auth:session
npm run test:suizamente:v14
npm run test:suizamente:login:browser
node scripts/test-suizamente-login-browser.mjs --webkit
node scripts/check-suizamente-live.mjs
```
