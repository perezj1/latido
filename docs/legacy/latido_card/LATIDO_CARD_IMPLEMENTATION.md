> ARCHIVADO: sistema anterior. No seguir estos pasos. [Guía vigente](../../LATIDO_CARD_MINIMAL.md).

# Latido Card — guía de implementación

Fecha: 14 de octubre de 2026. Rama: `latidoCard`, creada desde `main` en
`f9ce7e8fa8258547a0c21f25ff762a5ea437a8fe`.

Esta guía integra las tres propuestas. Especifica el producto completo y
distingue la primera entrega del trabajo pendiente. No se ha desplegado la
migración, creado datos reales ni activado pagos. Los cambios locales previos
de la tienda Latido Club se conservan y no forman parte de esta funcionalidad.

## 1. Entender el producto

Una cuenta tiene una membresía. Una tarjeta identifica esa membresía; nunca
contiene descuentos. La física y la digital usan credenciales distintas:
la física es estable hasta su bloqueo; la digital dura cinco minutos.

El socio explora negocios, recibe automáticamente sus ventajas incluidas y
solo reclama promociones especiales. El comercio aplica el beneficio en su
caja habitual. Latido no procesa la venta del comercio ni conoce su importe.

Scanner es una PWA operativa de `/scanner/`, independiente de la cuenta
personal de Latido para las consultas y canjes. El personal inicia sesión en
su cuenta de Latido al vincular el dispositivo: el servidor obtiene su nombre
del perfil. El QR privado del negocio concede conexión permanente, sin
aprobación adicional, hasta revocación, eliminación o desconexión. No requiere
membresía de pago. El propietario usa su cuenta para gestionar ofertas y accesos.

## 2. Alcance y estado de esta entrega

| Parte | Estado |
| --- | --- |
| Membresías manuales para piloto | Implementada, administradores autorizados |
| Catálogo, reclamación y liberación de reservas | Implementados |
| QR digital y emisión/revocación del físico | Implementados |
| Scanner con cámara y entrada separada | Implementado |
| Conexiones permanentes e identificación del usuario | Implementadas |
| Límites, stock, idempotencia e historial | Implementados en PostgreSQL |
| Alta directa de negocios, ofertas y suspensión por Latido | Implementadas |
| QR digital automático, QR de negocio automático y compartir ofertas | Implementados |
| Anulación de canjes por propietario/admin | Implementada |
| Instalación y manifiesto de Scanner | Preparados; verificar móviles reales |
| Cobro, renovación y sincronización Stripe | Pendientes |
| Solicitud, preparación y seguimiento de tarjeta física | Implementados; impresión/transporte reales son manuales |
| Avisos a Latido y socio, cola email y auditoría | Implementados; activar función/cron en desarrollo |
| Informes mensuales, buscador avanzado y panel integrado | Pendientes |
| Verificación con cámaras físicas y carga concurrente | Pendiente antes de piloto |
| Wallet de Apple/Google | Fase posterior |

## 3. Decisiones por cerrar

Precio confirmado por el usuario: **CHF 6,90 al mes para los socios que usan
los beneficios**. Los negocios participan gratuitamente y no necesitan una
membresía de pago para publicar descuentos ni utilizar Scanner. La admisión
al programa es directa por el propietario; Latido puede retirarlo por incumplimiento.

Antes de implementar cobros reales: renovación, cancelación, política de
impagos, reembolsos y periodo de acceso pagado.
Definir tarjeta física incluida/opcional, entrega, reposición y coste.
El propietario incorpora su negocio y publica directamente dentro de los límites
permitidos. La suspensión por incumplimiento corresponde a Latido; el propietario
no puede revertirla.

Valores actuales del piloto: Scanner permanente hasta revocar o desconectar; QR digital de 5 minutos;
reserva de 7 días configurable entre 1 y 90; meses naturales en Europe/Zurich;
una ventaja incluida y dos especiales vigentes por establecimiento; una
reclamación utilizable por socio/oferta especial. No son tarifas comerciales.

Accesos actuales: **Perfil → Mi Tarjeta Latido** abre `/card` para el socio;
`/card/negocios` es el panel del propietario y `/card/admin` el de Latido.
Falta añadir **Mi negocio en Tarjeta Latido** a Perfil e integrar la contratación
y el cobro mensual de CHF 6,90. El alta de negocios ya es directa. El catálogo actual muestra
las ofertas vigentes de negocios participantes; no es todavía un directorio
independiente de todos los participantes.

## 4. Preparar el entorno

El orden exacto de SQL, cuentas y ejemplos está en
[SQL manual y pruebas](LATIDO_CARD_SUPABASE_AND_TESTS.md). Empezar por su
comprobación de solo lectura para no reinstalar esquemas de otras funciones.

1. Trabajar en `latidoCard`: `git switch latidoCard`.
2. Ejecutar `npm ci`. Se mantiene el requisito Node >=20.19 del proyecto.
3. Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para un proyecto
   de desarrollo. Nunca colocar una clave `service_role` en el frontend.
4. El proyecto debe tener `profiles`, `providers`, Supabase Auth y
   `is_business_promotion_admin()` de `business_promotion_plans.sql`.
5. Revisar los administradores de `business_promotion_admins`. La variable
   frontend `VITE_ADMIN_EMAILS` solo controla la presentación; el servidor
   determina el permiso real. Ambos listados deben ser coherentes.
6. Instalar `supabase/latido_card.sql` en la base de desarrollo. Después de
   `app_notifications.sql`, instalar `supabase/latido_card_physical_requests.sql`.
   Ambas admiten repetición. No crean socios ni negocios activos.
   Instalar después `supabase/latido_card_self_service.sql` para alta directa,
   QR automático y favoritas. Si las dos anteriores ya están instaladas, ejecutar
   solamente esta actualización.
   Instalar después `supabase/latido_card_scanner_accounts.sql`: identidad del
   usuario, conexiones permanentes y eliminación. Por último, instalar
   `supabase/latido_card_scanner_multibusiness.sql` para empleados con varios negocios.
   En instalaciones existentes, ejecutar solamente los archivos que falten, en orden.
   Instalar también `supabase/latido_card_manual_codes.sql` al final para consulta de
   clientes mediante código temporal sin cámara.
7. Ejecutar `npm run dev`. Abrir `/card`, `/card/negocios`, `/card/admin` y
   `/scanner/` según el rol. No aplicar primero en producción.

## 5. Modelo de datos

| Tabla | Responsabilidad |
| --- | --- |
| `latido_card_memberships` | Socio, número público, estado y vigencia |
| `latido_card_credentials` | Huellas de credenciales físicas/digitales |
| `latido_card_businesses` | Establecimientos admitidos al programa |
| `latido_card_offers` | Beneficio, condiciones, vigencia, límites y stock |
| `latido_card_claims` | Reserva de promoción especial y caducidad |
| `latido_card_scanner_links` | Huella del QR privado de vinculación |
| `latido_card_scanner_sessions` | Permiso de cada navegador/instalación |
| `latido_card_redemptions` | Canje, petición única, condiciones y anulación |
| `latido_card_physical_requests` | Solicitud, dirección, entrega, tarjeta emitida y notas |
| `latido_card_physical_events` | Historial de cada solicitud con actor y fecha |
| `latido_card_physical_email_queue` | Avisos persistentes, reintentos y resultado de envío |
| `latido_card_admin_audit` | Cambios de membresía, participación y credenciales físicas |

No reutilizar `club_orders`: son pedidos de ropa. Tampoco reinterpretar los
planes de promoción del directorio como ofertas de socios.

Las credenciales son aleatorias de 64 caracteres hexadecimales; solo se
guarda SHA-256. No incluir email, UUID del usuario ni número secuencial en
la credencial. Los tokens emitidos se muestran una sola vez. El Scanner
necesita conservar su propia credencial en el navegador: solo se guarda en
localStorage tras la vinculación autenticada del servidor. La conexión no tiene
caducidad horaria; el servidor comprueba revocación y estado del negocio en cada uso.
Estas áreas son accesibles a JavaScript;
mantener protección frente a XSS y no introducir scripts externos en Scanner.

## 6. API y autorización

Todas las tablas nuevas tienen RLS y carecen de permisos directos para
`anon`/`authenticated`. El frontend solo llama funciones RPC revisadas.
Las funciones `SECURITY DEFINER` fijan `search_path`; los helpers internos
no son ejecutables por usuarios de la API.

| Actor | RPC |
| --- | --- |
| Público | `lc_catalog` |
| Socio autenticado | `lc_member_home`, `lc_issue_digital_card`, `lc_report_lost_card`, `lc_claim_offer`, `lc_release_claim`, `lc_save_favorite` |
| Usuario autenticado con QR privado de negocio | `lc_open_scanner` |
| Scanner con credencial | `lc_scanner_status`, `lc_scan_card`, `lc_redeem`, `lc_close_scanner` |
| Propietario/admin autenticado | `lc_business_dashboard`, `lc_business_setup`, `lc_save_offer`, `lc_set_offer_active`, `lc_rotate_scanner_link`, `lc_manage_scanner`, `lc_reverse_redemption` |
| Admin de Latido | `lc_admin_enroll`, `lc_admin_business`, `lc_admin_physical_card` |

En `lc_redeem`, el establecimiento procede de la sesión validada. Nunca
confiar en un `provider_id` elegido por el Scanner. El canje vuelve a validar
credencial, membresía, oferta y límites. El nombre mostrado es solo el primer
nombre del socio y su número; no se entregan datos de contacto.

## 7. Probar un recorrido completo

1. Crear tres usuarios de prueba: admin, propietario y socio. Crear un negocio
   de desarrollo asociado al propietario.
2. Admin abre `/card/admin`, introduce el UUID del socio y una vigencia futura.
3. El propietario selecciona su negocio: se incorpora sin aprobación previa y
   obtiene automáticamente el QR para sus trabajadores. Latido puede emitir el
   QR físico del socio y retirar negocios del programa por incumplimiento.
4. Propietario abre `/card/negocios` y selecciona su establecimiento.
5. Crea una oferta incluida: 15 %, desde CHF 50, un uso mensual y fecha futura.
6. Crea una promoción especial: café gratis, 200 unidades, reserva de 7 días,
   un uso total. Esta promoción requiere reclamar.
7. El QR interno se genera automáticamente y aparece al final de la página.
   Al regenerarlo expresamente se revocan tanto el enlace
   anterior como todos los Scanners asociados. Guardarlo detrás de la barra.
8. Propietario pulsa el botón flotante **Scanner** en «Mi negocio»: se vincula
   al establecimiento seleccionado y abre la cámara. El personal abre `/scanner/`,
   pulsa **Scanner** y escanea el QR privado del negocio. La vinculación usa su
   cuenta de Latido; si falta sesión, se solicita login y se conserva el enlace.
   El nombre opcional del dispositivo y la entrada manual quedan plegados.
9. El acceso es permanente desde el inicio. El panel muestra el nombre de usuario;
   propietario puede revocar o eliminar, y el trabajador desconectar su dispositivo.
10. Socio abre `/card` y ya ve su QR digital listo. Activa el café; puede presentar
    la tarjeta digital o física. Compartir una oferta abre el menú del móvil o copia
    su enlace público. El destinatario puede crear su cuenta conservando esa oferta.
11. Empleado escanea dentro de Scanner, comprueba condiciones y selecciona la
    ventaja. No vuelve a introducir el importe de la caja.
12. Empleado pulsa Canjear y espera confirmación antes de entregar la ventaja.
13. Comprueba historial del socio y negocio. Un segundo uso limitado se rechaza.
14. Prueba bloqueo del físico: la digital sigue funcionando; la perdida no.

## 8. Stock, tiempo y canjes

Reclamar reserva stock. Se contabilizan reservas vigentes y promociones usadas;
las reservas caducadas o liberadas dejan de consumir stock automáticamente al
consultar o reclamar, sin depender de cron. Caducan antes si termina la oferta.
La pausa o caducidad de membresía impide canjear, aunque la reserva siga
ocupando su unidad hasta caducar o liberarse.

El servidor bloquea la membresía y la oferta durante las operaciones de uso;
la oferta también se bloquea al reservar la última unidad. Los meses se
calculan con Europe/Zurich, incluyendo cambio de horario. Anular un canje
restituye el límite y la reserva original, sin ampliar su caducidad.

El cliente genera `request_id` una vez por intento lógico. Ante un fallo de
transporte conserva ese identificador, incluso al recargar la pestaña, y
reintenta la misma operación. El servidor devuelve el recibo previo en vez
de consumir otra unidad. No permitir que el usuario cambie de cliente/oferta
mientras haya un resultado ambiguo pendiente. Si Scanner se revoca antes de
resolverlo, el propietario debe consultar el historial; no conceder otra
ventaja basándose en un error de conexión.

Una oferta con reservas o canjes no puede cambiar de condiciones. Pausarla y
crear otra versión. Las condiciones originales quedan en `offer_snapshot`.
Pausar una oferta impide también canjear sus reservas: el propietario debe
tener presente este efecto y comunicarlo en caso de retirada.

## 9. PWA e instalación

`scanner/index.html` es una segunda entrada de Vite. Tiene su propio
manifiesto, sesión y cliente Supabase sin autenticación persistente de usuario.
No cargar presencia, notificaciones, analítica o la navegación de Latido allí.

Una sola cámara distingue las rutas `/scanner/link/<token>` (vincular negocio)
y `/c/<token>` (consultar tarjeta). Un QR de tarjeta sin acceso al negocio muestra
una indicación para vincular primero, sin consultar datos del socio. Rechazar
otros dominios y tokens sin ruta en la cámara. La entrada manual de vinculación
del negocio permanece plegada; se retira «Usar enlace de tarjeta» de clientes.
Escanear nunca canjea solo:
el trabajador comprueba las condiciones y pulsa **Canjear**.

El acceso flotante del propietario usa el enlace privado del negocio seleccionado
con `?camera=1`. Scanner retira inmediatamente el token y el parámetro de la URL.
Reutiliza la sesión del mismo enlace mediante su huella SHA-256 local, verificando
primero que el servidor todavía acepta el token; para otro
negocio obtiene un nuevo acceso y limpia la tarjeta consultada. La huella solo
evita repetir la vinculación; el servidor sigue validando cada consulta y canje.
Si hay un canje pendiente, no abrir la cámara ni sustituir el acceso: resolver el
mismo intento primero. La ventana de cámara usa un diálogo modal, permite cerrar
con el botón o Escape y libera la cámara al cerrar o detectar un QR.

La vinculación autenticada se completa en `/card/scanner/vincular`, protegida por
login. El QR pendiente se conserva solo en sessionStorage, durante un máximo de
una hora; no aparece en la URL de login ni en la del enlace de vuelta. La página
de vinculación llama `lc_open_scanner` con Auth; Scanner sigue usando su cliente
separado sin Auth. El SQL necesario es `latido_card_scanner_accounts.sql`.
Los accesos históricos sin cuenta no permiten inferir un nombre: se conservan
como «Usuario sin identificar» hasta que el dispositivo vuelva a vincularse.

«Mi negocio» también muestra **Scanner** cuando el usuario no es propietario.
**Compartir enlace con el personal** abre el menú nativo o copia un enlace
privado `/scanner/link/<token>?camera=1`. Si el portapapeles está bloqueado,
muestra un campo para copiarlo. Al abrir el enlace, el trabajador inicia sesión
o crea su cuenta gratuita y se conecta sin escanear. No necesita membresía.
Si confirma el email en otra ventana, puede volver a abrir el mismo enlace.

Para recuperar la invitación si una PWA abre Auth en otro contexto del navegador,
Scanner la transporta además en un fragmento temporal de la ruta de vinculación.
`src/main.jsx` lo captura y borra antes de Auth, onboarding y analítica. El fragmento
no se envía al servidor HTTP ni se incluye en el `next` del login.

Cada apertura llama `getUserMedia` sin cachear rechazos. El navegador muestra su
solicitud nativa si procede y decide si recuerda el permiso. No hay botón «Volver
a pedir permiso»: un rechazo muestra «Cómo activar los permisos de la cámara».
La guía detecta iPhone/iPad (incluido iPad con agente de escritorio) o Android y
ofrece tres opciones: Safari, Chrome/Brave y Firefox en iOS; Chrome, Brave y Firefox
en Android. La guía principal tiene tres pasos cortos; los ajustes avanzados del sitio
están plegados. El bloqueo del sistema o del sitio se cambia en sus ajustes, nunca por
JavaScript. Después se recarga y vuelve a abrir Scanner; no se pide micrófono.
Los pasos se contrastaron con la documentación de
[Apple](https://support.apple.com/guide/iphone/control-access-to-hardware-features-iph168c4bbd5/ios),
[Safari](https://support.apple.com/en-il/guide/iphone/iphb01fc3c85/ios),
[Chrome iOS](https://support.google.com/chrome/answer/2693767?co=GENIE.Platform%3DiOS&hl=es),
[Chrome Android](https://support.google.com/chrome/answer/2693767?co=GENIE.Platform%3DAndroid&hl=es),
[Brave](https://support.brave.app/hc/en-us/articles/360018205431-How-do-I-change-site-permissions)
y [Firefox](https://support.mozilla.org/es/kb/como-administrar-los-permisos-de-tu-camara-y-micro).

«Conectar con código» abre un modal para pegar el código privado de conexión
(el mismo token aleatorio de 64 caracteres del QR) o el enlace del encargado.
Debajo del QR del propietario aparecen el código y «Copiar código de conexión».
No es un identificador público ni un PIN adivinable; regenerar el QR invalida
también el código. Se mantiene el paso de identificación con cuenta gratuita.

En «Mi negocio», «Conectado a» lista los negocios con conexiones vigentes de la
cuenta actual. Pulsar un negocio valida y reutiliza su credencial local; en un
nuevo navegador, `lc_resume_scanner` crea una credencial desde un acceso vigente
de esa misma cuenta. El listado no concede gestión de ofertas o permisos de dueño.
Se guardan varias credenciales operativas para cambiar de negocio sin desconectar
los demás. Los canjes pendientes bloquean el cambio; la revocación se valida en
servidor. Ejecutar `supabase/latido_card_scanner_multibusiness.sql` después de accounts.

### Consulta manual del cliente

Al abrir «Mi tarjeta», el socio activo recibe automáticamente 6 cifras (dos grupos
de tres). Cada nueva apertura o regreso desde segundo plano genera un código distinto.
No se renueva automáticamente al pasar cinco minutos: al caducar aparece
«Generar nuevo código» para renovarlo sin cerrar la tarjeta. También se puede reabrir.
No se utiliza el número de socio público. El personal ya conectado pulsa
«Introducir manualmente», escribe el código y consulta las mismas ventajas del QR.
También se ofrece este botón desde la cámara, aunque sus permisos estén bloqueados.

`lc_issue_card_code` exige cuenta y membresía activa, genera un código aleatorio
desde UUID v4, almacena solo su hash y lo limita a cinco minutos. Emitir otro código
revoca los anteriores y sus credenciales manuales. Máximo 30 emisiones por socio/hora.
Solo los hashes de códigos vigentes son únicos: se conserva el historial por UUID
y se pueden reutilizar combinaciones caducadas sin agotar las seis cifras. El código
nuevo no repite el último del socio, y la búsqueda de uno libre tiene un límite.
`lc_scan_card_code` exige un Scanner vigente; limita a 5 intentos fallidos por cuenta/minuto
y 30 fallidos por negocio/minuto. Las consultas válidas no gastan ese presupuesto;
tienen un límite aparte de 60 por cuenta/minuto y 300 por negocio/minuto. Los errores
esperados se devuelven en JSON para que PostgreSQL no revierta los contadores.

Al validar, se emite una credencial aleatoria de 64 caracteres hexadecimales con la misma caducidad
que el código. Se obtiene el resultado desde `lc_scan_card` y se usa el flujo existente
de `lc_redeem`, con sus permisos, stock, límites y UUID de idempotencia. Consultar no
canjea. Renovar el QR del cliente no revoca estas credenciales manuales: se distinguen
por `manual_code_id` en `latido_card_credentials`. La recuperación de un canje ya
confirmado funciona aunque después caduque o se regenere el código.

La ruta de vinculación y su login no montan las notificaciones de comunidad ni la
sincronización de presencia: la conexión redirige inmediatamente a la entrada
Scanner, y WebKit puede rechazar consultas de fondo al descartar ese documento.
Las rutas habituales de Latido mantienen estas funciones.
Usar HTTPS, vídeo `muted`/`playsInline`, cámara trasera preferida y alternativa
genérica si no se encuentra. Liberar los tracks incluso si la autorización llega
después de cerrar la cámara.

Regenerar el QR bloquea los enlaces anteriores y retira las conexiones del panel
mediante `hidden_at`, conservando los canjes. Volver a ejecutar la versión
actualizada de `supabase/latido_card_scanner_accounts.sql` si ya se había instalado.

`public/scanner/manifest.json`: id `/latido-scanner`, start_url y scope
`/scanner/`. No colocar tokens en el manifiesto ni en la URL de arranque.
No cambiar la identidad de la PWA principal existente. Vercel y Vite deben
servir la entrada Scanner también para `/scanner/link/<token>`.

La instalación no concede autorización ni garantiza compartir el
almacenamiento del navegador. En el primer arranque instalado, volver a
vincular con el QR interno si falta acceso. La instalación en iPhone utiliza
la interfaz del sistema; mostrar el botón nativo solo cuando esté disponible.

El service worker de Scanner usa un espacio de caché separado. Solo conserva
la página base; no almacena RPC, tokens o disponibilidad. El acceso sin red
no permite validar ni canjear. Completar el precache de assets versionados si
se decide ofrecer arranque offline más completo.

Las rutas `/scanner/` y `/c/` no se indexan, no se envían a analítica y no
propagan referencias. Configuración en `vercel.json`; comprobar headers al
desplegar en desarrollo. Revisar permisos de cámara y accesibilidad.

## 10. Fase de pagos

Implementar solo después de cerrar la sección 3. Utilizar un sandbox Stripe
separado, clave restringida de backend y Checkout/Billing. Consultar la
documentación oficial y la habilidad Stripe vigente antes de elegir SDK/API.
No reutilizar ni sustituir secretos de Club o promociones del directorio.

Crear catálogo de planes y una tabla de eventos Stripe con event_id único.
El servidor valida el plan y relaciona el pago con el usuario autenticado.
Crear Checkout desde backend y verificar la firma del webhook.

Actualizar membresía desde eventos verificados y su periodo pagado; nunca
activarla desde la redirección de éxito. Manejar eventos duplicados,
asíncronos, fuera de orden, renovación, cancelación y fallos de pago con
una política definida. Una cancelación de renovación no debe retirar un
periodo ya pagado por accidente. No activar impuestos automáticos sin
comprobar previamente los requisitos correspondientes.

El endpoint de alta manual actual es para piloto. Cuando exista facturación,
no permitir que una edición manual sobrescriba silenciosamente la autoridad
de una suscripción; distinguir acceso promocional/manual de acceso pagado.

## 11. Fase de tarjetas físicas e informes

La petición de tarjeta física y la administración de entrega están
implementadas. Seguir [LATIDO_CARD_ADMINISTRATION.md](LATIDO_CARD_ADMINISTRATION.md)
para configurar los avisos y probar el circuito operativo. El socio puede
pedir envío en Suiza o recogida coordinada; Latido aprueba, emite el QR,
prepara y registra la entrega. La producción y transporte son manuales.
No reutilizar automáticamente el proveedor de impresión de ropa para tarjetas:
seleccionar y comprobar un proveedor específico después.

Diseño limpio, nombre mínimo y número público. Exportar QR con resolución
adecuada, margen y contraste; probar una impresión real. Registrar qué
credencial se emitió y mantener vigente solo la física actual.

Informes: canjes netos, socios distintos por negocio y oferta, reservas
caducadas y uso por periodo. No llamarlos facturación, visitas verificadas o
ahorro generado sin datos adicionales. Scanner identifica el dispositivo y la
cuenta que lo vinculó. El nombre proviene del perfil, nunca del campo opcional
de nombre del dispositivo. Eliminar conexiones conserva el historial de canjes.

## 12. Verificación y despliegue

```powershell
npm run test:card
npx playwright install chromium
npm run test:card:browser
node node_modules/playwright/cli.js install webkit
npm run test:card:webkit
npm run test:auth
deno check --node-modules-dir=auto supabase/functions/latido_card_physical_email/index.ts
npm run build
```

El test de datos usa PostgreSQL WASM/PGlite aislado con roles anon y
authenticated y funciones auth de prueba. No toca Supabase remoto. Comprueba
la migración repetible, permisos, stock, límites, canjes y revocación. No
sustituye pruebas de transacciones simultáneas en conexiones PostgreSQL reales.
El test de navegador arranca Vite en 5194, intercepta todas las peticiones
remotas con fixtures, decodifica un QR real mediante una cámara simulada
como vídeo y guarda capturas en `output/latido-card/`.
Chromium usa un perfil Android y WebKit un perfil iPhone. Windows WebKit no
expone captura de medios: la prueba inyecta tracks y fotogramas sintéticos,
manteniendo el decodificador ZXing real. Comprueba rechazos, reapertura, reintento,
cierre, enlaces compartidos, registro gratuito y eliminación de tokens de la URL.
La emulación no sustituye los permisos nativos ni cámaras físicas de móviles.
La vinculación de Scanner no monta las precargas de comunidad ni los recordatorios
de compartir negocios. La actividad del perfil se actualiza mientras la página
está abierta; se evitan fetch asíncronos desde `pagehide`/`beforeunload`, que Safari
puede bloquear al abandonar el documento.

Antes de piloto: cámaras reales Android/iPhone, tarjetas impresas, instalación
y almacenamiento independientes, dos Scanners canjeando la misma ventaja a
la vez, dos socios reclamando la última unidad, revocación de accesos y caducidad de QR,
mes natural/cambio de horario, apagado y revocación de negocios, respuestas
perdidas tras commit y correcciones de canje.

Desplegar primero en desarrollo; verificar headers, rutas y funciones.
No activar cobros ni modificar datos reales como parte de esta primera
entrega. El despliegue de producción y la fase comercial se revisan después
del piloto. Preparar backup y retirada de rutas si hay incidencias; evitar
borrar tablas que ya contengan canjes auditables.

## 13. Archivos de referencia

- `supabase/latido_card.sql`: esquema, permisos y operaciones atómicas.
- `supabase/latido_card_self_service.sql`: alta directa, moderación, QR automático y favoritas.
- `src/lib/latidoCardCore.js`: lectura segura de QR y almacenamiento Scanner.
- `src/lib/latidoCard.js`: cliente de socio/propietario.
- `src/pages/LatidoCard*.jsx` y CSS: socio, negocio y administración.
- `src/components/LatidoCardCamera.jsx`: cámara y liberación de sus recursos.
- `src/components/LatidoCardQr.jsx`: generación local de QR.
- `src/scanner/`: interfaz independiente del personal.
- `scanner/index.html` y `public/scanner/`: entrada y PWA.
- `scripts/test-latido-card*.mjs`: comprobaciones reproducibles.

Documentación oficial: [identidad PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id),
[instalación](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing),
[cámara](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia),
[ZXing](https://github.com/zxing-js/browser), [generación QR](https://github.com/soldair/node-qrcode).
