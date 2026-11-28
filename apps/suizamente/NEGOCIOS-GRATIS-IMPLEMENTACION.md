# Publicación gratuita de negocios

Latido ha pedido abrir el mapa a negocios gratuitos mientras haya plazas libres.
`negocios.gratis: true` oculta planes, precios, facturas y métodos de pago. Los
precios y el código anterior se conservan. `cobroAutomatico` continúa en `false`;
el modo gratuito también prevalece si alguien enciende ese interruptor por error.

## Alta y revisión

El alta tiene dos pasos:

1. Nombre, descripción, tipo, contacto y dirección. El código postal determina
   las ciudades y el cantón mediante el directorio verificado. Basta un teléfono
   o enlace público de contacto. El email privado, horario, redes y oferta son
   opcionales y están plegados.
2. Plaza libre, vista previa de la figura y color, y envío a revisión. La vista
   usa las coordenadas y escala reales de la plaza. No se piden plan, periodo,
   tarjeta, factura ni condiciones de un contrato de pago.

Se conserva la revisión de Latido, la corrección de datos y la etiqueta
«Patrocinado». El panel del negocio muestra cómo quedará antes de la aprobación,
y recoge automáticamente el cambio de estado. Al aprobarlo se publica sin crear
ninguna factura, registro de cobro o trabajo de Stripe. No caduca por impago.
Retirar un negocio gratuito lo oculta y libera su plaza de inmediato.

La reserva sigue siendo única, con bloqueo por cantón y plaza e índice único
para solicitudes en revisión, en cambios o activas. El servidor comprueba la
capacidad, la localidad y el cantón, aunque se manipule el formulario. Un cantón
lleno conserva su lista de espera. El sistema no cambia monedas, XP o comodines.

## Conservación del pago

V44 añade `negocios.alta_gratuita`. Las altas gratuitas no son suscripciones ni
aceptaciones de un plan de pago. Cambiar el interruptor no convierte por sí solo
un negocio gratuito en cliente de pago ni lo elimina por no pagar.

Se conservan el alta de pago de seis pasos, los planes, las facturas y las
funciones de cobro originales bajo sus ramas anteriores. Los lectores y el
dispatcher anteriores se guardan como `neg44_*_base`. Las funciones de Stripe y
sus tablas no se eliminan. La prueba de reversión vuelve a dar de alta, aprobar y
registrar una factura con el flujo original.

Para volver al alta de pago en el futuro, cambiar `negocios.gratis` a `false` en
`server/suizamente/data/juego.json` y en `negocios_configuracion.config`, y
desplegar. Las condiciones de pago deben estar publicadas, como exigía el flujo
anterior. Stripe tiene su interruptor separado. Los negocios que entraron gratis
necesitarán aceptar expresamente un plan si Latido decide ofrecerles el cambio;
no hay conversión ni cargo automático en esta entrega.

## Archivos y SQL

- `NegociosGratis.jsx`: presentación, formulario, vista previa y panel gratuito.
- `Negocios.jsx`: selección de modo, contacto público y revisión sin facturación;
  conserva todos los componentes del modo de pago.
- `negocios.css`: campos opcionales y plazas del formulario compacto.
- `server/suizamente/data/juego.json`: interruptor `negocios.gratis`.
- `server/suizamente/http.mjs`: el modo gratuito no deriva las altas a cobros.
- `supabase/suizamente_v44_negocios_gratis.sql`: columna, validación, publicación
  y retirada gratuitas, con el motor anterior conservado.
- `supabase/suizamente_v45_activar_negocios_gratis.sql`: activa el modo y mantiene
  apagado el cobro automático, sin modificar precios ni datos de negocios.
- Pruebas y adaptadores de la base temporal en `scripts/`.

El email opcional es privado, para contacto entre el negocio y Latido. La ficha
pública muestra teléfono y enlaces publicados voluntariamente. Nunca se muestra
el email de una cuenta jugadora. Sin horario informado no se inventan días de
cierre.

## Pruebas

```sh
node scripts/test-negocios-gratis.mjs
node scripts/test-negocios-gratis-browser.mjs
node scripts/test-negocios-gratis-browser.mjs --webkit
node scripts/test-negocios-servidor.mjs
node scripts/test-negocios-pagos.mjs
node scripts/test-negocios-datos.mjs
npm run build
```

Se comprueban alta sin email de factura ni condiciones de pago, vista previa,
moderación, cero cobros, privacidad, capacidad y espera, baja inmediata,
reversión al flujo de pago e instalación repetida. Capturas en 390 × 844 y
375 × 667: `output/negocios-gratis/`. Los negocios de ejemplo solo se usan en
PostgreSQL temporal; no se publican datos ficticios en producción.

V44 y V45 se aplicaron en Supabase el 28-11-2026. La consulta
`scripts/verificar-negocios-gratis.sql` confirmó el modo gratuito activo, el cobro
automático apagado, las 85 plazas originales, los precios conservados y el motor
anterior privado. No se crearon negocios de ejemplo ni pagos en producción.
