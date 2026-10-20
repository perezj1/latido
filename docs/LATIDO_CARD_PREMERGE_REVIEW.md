# Revisión previa al merge · 20 de octubre de 2026

## Estado de Git

- Rama revisada: `latidoCard`, incluidos los cambios preparados para commit.
- Base: `origin/main` en `f9ce7e8fa8258547a0c21f25ff762a5ea437a8fe`.
- `main` es ancestro de la rama; no faltan commits de `main`.
- Integración simulada con `git merge-tree` y probada en un worktree aislado,
  con instalación nueva mediante `npm ci`.
- La revisión inicial se realizó sin push ni modificar `main`. La entrega se
  prepara con commit y push a `latidoCard` y dos PR en borrador, sin fusionarlos.
- `origin/development` también es ancestro de la rama. Su PR incluye 16 commits
  que ya están en `main`, además de los cambios de Card; no se descartan cambios
  propios de ninguna de las ramas de destino.

## Validaciones que pasan

- ESLint, compilación de producción y prerender de 68 rutas.
- Autenticación y almacenamiento, notificaciones, búsqueda, guías, recursos,
  creadores y contactos de Punto Hispano.
- SQL de Card: instalación nueva, actualización de versiones antiguas, permisos,
  archivo de negocios, edición, reemplazo y conservación de usos.
- Ubicación, selección de ofertas destacadas, invitaciones y enlaces compartidos.
- Flujos completos de socios y fase de negocios en Chromium y WebKit.
- Logos locales, renovación de miniaturas de TikTok, portada de reserva,
  imágenes personalizadas y apertura del reproductor en ambos motores.
- Guías en navegador: relevancia, filtros, errores de red, navegación por cantón
  y tamaños móvil/escritorio.
- Punto Hispano en navegador: contacto, retorno del login, reintento, registro
  único, URL de WhatsApp y exportación CSV, con servicios externos simulados.
- Comprobación móvil/escritorio de Inicio, autenticación, Club, Tablón,
  Comunidades y Para Empresas, sin errores JavaScript ni desbordamiento horizontal.
- El código de Club, compra, autenticación y las variables CSS globales mantienen
  su comportamiento respecto a `main`; las variables se extrajeron a otro archivo
  sin alterar sus valores. El catálogo y selector de bolsas siguen renderizando.

No se han realizado pagos, pedidos ni envíos reales durante estas pruebas.

## Correcciones encontradas durante la revisión

- Los enlaces compartidos de `/card` consultaban y publicaban metadatos de
  descuentos incluso con la fase de socios cerrada. El servidor ahora respeta
  `VITE_LATIDO_CARD_MEMBERS_ENABLED`; la prueba comprueba que no se consulta el
  catálogo ni se publica el descuento cuando está cerrado.
- La prueba de WebKit cambiaba de documento durante peticiones simuladas
  pendientes. Ahora espera a que terminen antes de navegar o recargar, sin
  desactivar las comprobaciones de errores JavaScript.
- `brace-expansion` pasa de `5.0.9` a `5.0.12`, dentro de la versión mayor
  admitida por sus consumidores. `npm audit --omit=dev` devuelve **0 avisos**.

## Limpieza de datos de prueba en Supabase

Se verificaron los UUID, nombres y procedencia antes de cambiar datos y se guardó
un respaldo privado en `output/latido-card/merge-review/`, excluido de Git.

- 11 ofertas de prueba retiradas mediante `active=false` y `deleted_at`:
  6 `[TEST]`, 3 del script de ejemplos de negocios reales, `teste` y
  `CHF 10 en corte de pelo` de Punto Hispano, confirmada como prueba por el usuario.
- 3 negocios ficticios `[TEST]` archivados.
- 2 membresías de prueba canceladas.
- Participaciones sin ofertas desactivadas; los negocios reales conservan sus
  fichas, propietarios y estado de publicación.
- 10 usos y 2 reservas se conservan para mantener las referencias e historial.
- Verificación inmediatamente posterior a la limpieza: catálogo público y
  directorio Card respondieron HTTP 200 con **0 entradas**. Este resultado es
  histórico: posteriormente se publicó la oferta real de DANCEparadise.
  No se han ejecutado migraciones de esquema en producción.

Después de la limpieza, a petición del propietario, se dejó una única oferta
vigente de DANCEparadise: **25 % de descuento para tu primer curso de baile**,
con `usage_period=lifetime` y `usage_limit=1`. Se retiró el duplicado mensual y
se verificó que solo quedara la versión de un uso por socio. Estos cambios son
datos de Supabase; no los aplica el merge ni deben recrearse con los ejemplos.

Los scripts de ejemplos no forman parte del despliegue ni deben ejecutarse en
producción. La limpieza usa borrado lógico; no elimina cuentas de usuarios.

## Pendientes y límites antes de publicar

- La auditoría completa señala **9 dependencias de desarrollo**: 7 avisos altos
  y 2 moderados, todos en las mismas versiones presentes en `main`. Incluyen
  Tailwind 3 y su cadena de herramientas. Parte de la corrección propuesta exige
  Tailwind 4; requiere una migración y revisión propias. No se ha aplicado una
  actualización mayor automática.
- Sigue pendiente identificar la cuenta exacta de **Suiza en Español** para su
  exclusión específica. El usuario confirmó que **Suiza habla Español** es otra
  cuenta; no se ha modificado esa cuenta. Esta exclusión no debe darse por hecha.
- Mantener `VITE_LATIDO_CARD_MEMBERS_ENABLED=false` en esta fase. Las pruebas
  completas de socios lo activan únicamente en su servidor local simulado.
- Las pruebas reducen el riesgo y comprueban los flujos indicados; no sustituyen
  una revisión del despliegue ni prueban operaciones reales de cobro o email.

## Preparación de la publicación

- Los PR hacia `main` y `development` se preparan en borrador, sin auto-merge.
- Antes de fusionar, revisar la Preview de Vercel: `/`, `/tarjeta-latido`, `/card`,
  acceso propietario, creación de oferta y enlaces compartidos. Comprobar la
  configuración de Preview y Production: el indicador de socios debe estar
  ausente o ser `false`, tanto en la compilación como en la función del servidor.
- Los módulos SQL se instalan manualmente según
  [LATIDO_CARD_MINIMAL.md](LATIDO_CARD_MINIMAL.md); el merge no ejecuta SQL.
  La revisión comprobó las funciones y columnas necesarias del proyecto enlazado.
  No ejecutar los scripts de ofertas de ejemplo durante el despliegue.
- La exclusión específica de Suiza en Español sigue pendiente de identificar
  su cuenta. Debe resolverse o aceptarse expresamente antes de publicar.
- Orden recomendado: validar la Preview, integrar en `development` y comprobar
  su despliegue; después revisar e integrar el PR de `main` para producción.

Los logs, capturas y el inventario técnico están en
`output/latido-card/merge-review/` y en el worktree de revisión. No contienen claves
de administración ni se incluyen en el commit.
