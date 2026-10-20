# Fase de captación de negocios

La experiencia para socios queda desactivada por defecto. El control central está
en `src/lib/latidoCardLaunch.js`: `VITE_LATIDO_CARD_MEMBERS_ENABLED` solo abre esa
experiencia cuando vale exactamente `true`. No hay un umbral automático de negocios.

En esta fase:

- Inicio muestra la invitación a promocionar el negocio solo a propietarios.
- `/tarjeta-latido` presenta únicamente la información para negocios y abre el
  modal existente para crear ofertas del negocio seleccionado.
- `/card` y `/card/negocio/:providerId` son catálogos de consulta para propietarios.
- Se conservan la creación, edición y pausa de ofertas en Mi negocio.
- Se ocultan la membresía, su precio, las activaciones, alertas, validaciones,
  eliminación de ofertas y el material de canje. La capa `cardRpc` también rechaza
  esas acciones en esta versión de la app antes de enviar una petición.
- Los enlaces públicos, la búsqueda general y las fichas de negocios no anuncian
  las ofertas ni la tarjeta de socio.
- Para Empresas ofrece Más información y enlaza a la página para negocios.

Este control corresponde a la aplicación web: no cambia permisos ni funciones de
Supabase y no desactiva versiones antiguas de la aplicación ya instaladas. No se
modifican ofertas, membresías ni registros de uso existentes.

El listado de negocios devuelto por `lc_business_dashboard` se contrasta con
`providers.deleted_at` antes de usarlo. Algunas instalaciones antiguas aún
incluyen negocios archivados en esa respuesta, aunque `lc_can_manage` rechaza
correctamente su gestión. Se excluyen del banner, el selector y el acceso a
ofertas; no se restauran negocios eliminados ni se cambian sus permisos.
El módulo `latido_card_offer_activation.sql` también conserva ahora ese filtro
si se vuelve a instalar después del módulo de borrado.

Verificación de esta fase: `npm run test:card:preview` y
`node scripts/test-latido-card-browser.mjs --business-preview --webkit`.
Las pruebas completas de socios activan explícitamente el control en su servidor
local con datos simulados; la configuración normal continúa cerrada para socios.
