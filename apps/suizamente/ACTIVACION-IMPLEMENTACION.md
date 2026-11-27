# Activación de las mejoras

La publicación solicitada enciende `minuto`, `espejo`, `misterio`, `decorar` y
`unToque`, además de `negocios.activo`. Conserva `mapa.barraCanton=false` y
`negocios.cobroAutomatico=false`. No cambia ninguna otra cifra de juego.

Los prompts 32–39 estaban implementados. Antes de activar se terminó el código
del 40 y sus pruebas locales; la prueba en la cuenta de Stripe se deja pendiente
por indicación expresa del usuario. Su configuración está en
[PAGOS-IMPLEMENTACION.md](PAGOS-IMPLEMENTACION.md).

La migración `supabase/suizamente_v38_activar_mejoras.sql` sincroniza los mismos
interruptores privados, sin reescribir funciones, permisos, contenido ni las
migraciones publicadas. Se aplica después de v37. La prueba `test-activacion`
compara el JSON con la entrega anterior, aplica dos veces la migración y vuelve
a apagar las mejoras para comprobar que los interruptores son reversibles.

## Ajustes al revisar

- El botón del momento «¡Decoración nueva!» necesita su fondo azul explícito:
  el portal del momento está fuera de la raíz que define las variables del tema.
- Las opciones de pago se mantienen en filas compactas; una regla general de
  formularios las estaba colocando en columnas. Este ajuste solo se ve con el
  cobro automático activado en local.
- Resumen de mejoras, decoraciones y negocios reutilizan las lecturas durante
  1,5 segundos. Se evitan consultas repetidas al navegar entre Inicio, Menú y
  Mapa. La caché distingue la cuenta y se invalida con cada escritura; no incluye
  preguntas ni relojes de partidas.
- El servidor de pruebas permite encender negocios y las cinco mejoras juntos;
  sus valores por defecto siguen apagados para las regresiones anteriores.

## Revisar y reproducir

Desde `apps/suizamente`:

```sh
node scripts/test-negocios-pagos.mjs
node scripts/test-negocios-pagos-browser.mjs
node scripts/test-activacion.mjs
node scripts/test-activacion-navegacion.mjs
node scripts/capturar-mejoras-final.mjs --activadas
node scripts/test-negocios-browser.mjs --activadas
node scripts/test-negocios-mapa-combinado.mjs
node scripts/comparar-activacion.mjs
npm run test:mejoras:servidor
npm run test:negocios:servidor
npm run test:mejoras:contenido
npm run test:negocios:datos
npm run build
```

La galería `output/activacion/index.html` reúne cada captura junto al diseño,
con tamaños 390 × 844 y 375 × 667. `output/pagos/comparacion.html` muestra las
tres pantallas de pago. Las capturas y bases de pruebas son locales y están
excluidas del repositorio. Las referencias proceden de los HTML originales.

La suite general conserva dos fallos anteriores ya documentados:
`datos-demo.test.mjs` y `service-worker-update.test.mjs`. No se cambian ni se
ocultan para dar por aprobada esta entrega.

## Lo que necesita contenido o configuración real

- Minuto y Espejo reutilizan las preguntas actuales: no necesitan preguntas
  nuevas ni SQL de contenido.
- Misterio está encendido, pero permanece oculto en días sin contenido aprobado.
  `fuentes/misterios.txt` conserva únicamente el ejemplo comentado. Latido debe
  escribir/aprobar fechas, tres pistas, cuatro opciones, correcta y dato. Después:
  `node herramientas/generar-misterios.js --escribir` y
  `node scripts/generar-mejoras-sql.mjs` generan los datos privados y
  `supabase/suizamente_mejoras_datos_actualizar.sql`, listo para revisar y aplicar.
  Nunca ejecutar como contenido real las fixtures de las pruebas.
- No hay negocios publicados hasta que Latido revise y apruebe uno real. Café
  Cumbia solo vive en PostgreSQL temporal, se aprueba y marca pagado allí, y
  desaparece al cerrar las pruebas. No se añade a producción.
- El alta real necesita que Latido publique las condiciones y su URL privada.
  No se inventan condiciones, IBAN ni facturas QR. La vía manual sigue disponible
  para Latido; Stripe sigue apagado y pendiente de su sandbox, variables y cron.
- Compartir nativo, push, VoiceOver/TalkBack y fluidez en teléfonos físicos quedan
  como comprobaciones de dispositivo; las pruebas locales no las sustituyen.

Para apagar una mejora, cambiar su JSON y el mismo campo `activo` en
`suizamente_private.mejoras_configuracion.mejoras`; para negocios, en
`suizamente_private.negocios_configuracion.config`. No hay que borrar datos ni
desinstalar migraciones. La barra antigua vuelve con `mapa.barraCanton=true`.

## Publicación comprobada

V37 y v38 aplicadas en producción. Los dos despliegues de Vercel terminaron
correctamente. La API pública devuelve los cinco modos y negocios activos,
barra de cantón y cobro automático apagados; el service worker tiene su versión
de compilación y cabecera `no-cache, no-store, must-revalidate`.
Las funciones y permisos anteriores conservan la huella
`a5e6369e6b3292545f587158078f0d06`. No hay misterios ni negocios de prueba en la
base real. Las cinco tablas nuevas de cobro tienen RLS y cero permisos de acceso
directo para personas anónimas o autenticadas; la RPC de Stripe solo permite
`service_role`.
