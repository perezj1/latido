# Carga, calendario y decoración · 28 de noviembre de 2026

## Cambios

- V41 añade `suizamente_lectura` para Tienda, Álbum, Amigos y una lectura conjunta
  de Nueva partida. Mantiene identidad, moderación, límite, bloqueos y preparación
  de misiones/recompensas originales. Las compras, invitaciones y partidas siguen
  usando sus acciones originales.
- El serializador del mapa calcula una vez el factor de vuelta y el evento, en
  lugar de recalcularlos para cada precio. `v5_mapa` usa este lector; el anterior
  se conserva como `v41_mapa_anterior`. Los JSON coinciden en las vueltas
  1, 2, 3, 6 y 9, con y sin descuento de obras.
- La navegación aprovecha las lecturas precargadas de Tienda y Álbum. La precarga
  espera a las invitaciones para que sus escrituras no invaliden lo recién leído.
  Solo adelanta los tres destinos necesarios y mantiene dos peticiones simultáneas
  como máximo. La caché sigue separada por cuenta e invalidada tras escrituras.
- Nueva partida reúne amigos, partidas abiertas y disponibilidad en una petición.
  El texto de azar indica «Compite con alguien al azar», conectado ahora o con
  menos partidas empezadas en espera. No cambia la elección del servidor.
- V42 devuelve al inventario las decoraciones de un cantón cuando su nivel pasa
  a 0, dentro de la misma transacción del ataque. Conserva propiedad, fecha de
  desbloqueo y momento visto. Corrige también colocaciones antiguas inválidas.
- «Decorar» aparece solo con un cantón seleccionado y nivel ≥1. El editor monta
  ese único cantón y sus puntos. Un acceso sin cantón vuelve al Mapa para elegir;
  uno de nivel 0 ofrece construirlo. Los accesos desde inventario y momentos
  llevan a elegir un cantón.
- Los gestos sobre los puntos y chinchetas llegan al mismo control de cámara que
  el lienzo. El pinch y Ctrl+rueda en el mapa no amplían la página. Fuera del mapa
  se conserva el zoom del navegador y los botones conservan teclado y etiquetas.

## Medición

La comparación local con PostgreSQL desechable, mismo JSON y misma cuenta dio:

| Lectura | Antes | Después |
| --- | ---: | ---: |
| Jugador / arranque | 507 ms | 30 ms |
| Tienda | 519 ms | 21 ms |
| Álbum | 522 ms | 20 ms |
| Nueva partida, conjunto | 1229 ms | 29 ms |

Son tiempos del trabajo del servidor en la prueba, sin red ni descarga inicial.
No son una garantía del tiempo total en cualquier dispositivo. No se añaden
vistas materializadas de saldos, inventarios o recompensas que puedan quedar
desactualizadas.

## Misterios: funcionamiento y calendario

Hay 366 fechas continuas del **28-11-2026 al 28-11-2027**, sin repetir un misterio
idéntico. Se conserva el día ya publicado. Las 365 adaptaciones nuevas se basan
en el banco existente de Latido y en las siluetas del mapa: vocabulario en ambas
direcciones, personajes, lugares, inventos y tradiciones. No se modifica el banco
de preguntas, sus identificadores ni sus índices. El manifiesto
`fuentes/misterios-calendario-2026-2027.json` registra origen y hash de cada entrada.

No se genera contenido al entrar ni se hace una petición a una IA. El servidor
elige la entrada de la fecha local de Zúrich y cambia a las 00:00, también al
cambiar la hora de verano. El navegador recibe la primera pista y cuatro
opciones; las otras pistas permanecen en el servidor hasta abrirlas. Un fallo
abre la siguiente; fallar con tres abiertas cierra el día. La solución y el dato
solo llegan al terminar. Los premios salen de `juego.json`, tienen su movimiento
único diario y bajan al usar más pistas. Resolver días seguidos mantiene la racha;
el porcentaje comunitario solo se enseña con el mínimo de respuestas configurado.

Proceso editorial:

1. `fuentes/misterios.txt`: calendario legible con una línea por fecha y referencia
   de origen en un comentario. El ejemplo incompleto del diseño sigue comentado.
2. `node herramientas/generar-misterios.js`: valida fechas, textos, opciones y
   siluetas. Con `--escribir` genera los JSON de contenido, incluida la copia
   privada del servidor.
3. `node scripts/generar-misterios-publicacion.mjs --salida supabase/NUEVA_PUBLICACION.sql`:
   prepara SQL aditivo. Nunca cambia una fecha ya publicada ni su orden de opciones.
4. Aplicar esa publicación a Supabase y desplegar los JSON privados para que la
   disponibilidad pública coincida. V43 es la publicación del año actual.

`node herramientas/generar-calendario-misterios.mjs` permite reproducir y auditar
el lote anual; `--escribir` lo incorpora si todavía no existe. Si el contenido de
origen cambia, rechaza sobrescribir el lote congelado. Para después del
28-11-2027 se prepara otro lote editorial con nuevas fechas. No se recicla
silenciosamente el calendario al agotarse ni se altera un día que alguien jugó.

## Verificación

```sh
node scripts/test-lecturas-rapidas.mjs
node scripts/test-misterios-calendario.mjs
node scripts/test-carga-canton-browser.mjs
npm run test:mejoras:contenido
npm run test:mejoras:servidor
npm run test:new-game
npm run build
```

Las pruebas cubren igualdad de datos/precios, permisos, suplantación, límite de
peticiones, cobro único, ataque real hasta nivel 0 y reconstrucción; las 366 fechas
y la privacidad de sus pistas; 390 × 844 y 375 × 667; zoom iniciado sobre un ＋,
editor limitado a un cantón y selector por teclado. Las capturas y mediciones
están en `output/carga-rapida/`, y las de Nueva partida con tres amigos y su
referencia en `output/nueva-partida/`.

La suite general conserva dos fallos anteriores a este cambio:
`test/datos-demo.test.mjs` espera campos del formato antiguo y
`test/service-worker-update.test.mjs` espera otro prefijo de caché. No se han
cambiado esos datos ni ese service worker para esta entrega.

Archivos principales: `server/suizamente/http.mjs`, `game/src/components/suizamente/v2/`
(`Economy.jsx`, `Rewards.jsx`, `Lobby.jsx`, `SuizamenteApp.jsx`, `preload.js`,
`MapPage3D.jsx`, `MejorasDecorar.jsx`, `WorldMap.jsx`) y
`game/src/lib/suizamenteInvitations.js`; fuentes, manifiesto y JSON del calendario;
`herramientas/generar-calendario-misterios.mjs`; migraciones
`supabase/suizamente_v41_lecturas_rapidas.sql`,
`supabase/suizamente_v42_decoraciones_nivel_cero.sql` y
`supabase/suizamente_v43_misterios_anual.sql`; pruebas y sus adaptadores de SQL.

## Despliegue

Aplicar V41, V42 y V43 en ese orden antes del código que usa la lectura nueva.
No requiere claves nuevas ni cambiar interruptores. Stripe continúa apagado;
los pagos de prueba de una cuenta Stripe y la aprobación de las condiciones de
negocios siguen siendo asuntos separados de esta entrega.

Las tres migraciones se aplicaron a Supabase el 28-11-2026. La comprobación
`scripts/verificar-carga-calendario.sql` confirmó igualdad de mapas de todas las
cuentas existentes, 366 días sin huecos, misterio de hoy disponible, calendario
privado, ninguna decoración colocada en nivel 0 y cobro automático apagado.
