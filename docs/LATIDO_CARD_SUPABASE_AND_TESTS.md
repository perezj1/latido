# Latido Card: SQL manual y pruebas

Esta entrega se trabaja en la rama `latidoCard`. Los SQL se ejecutan manualmente;
no se ha cambiado ninguna base remota. Los ejemplos son ficticios y están marcados
con `[TEST]`. Usar un proyecto Supabase de desarrollo para esos datos.

## 1. Comprobar la instalación existente

En Supabase, abrir **SQL Editor → New query**. Copiar el contenido completo de
`supabase/latido_card_preflight.sql` y pulsar **Run**. Es una consulta de solo lectura.

La primera tabla debe mostrar seis `OK`. La segunda puede mostrar `PENDIENTE`
si todavía no se ha instalado Card. Si un requisito muestra `FALTA`, detener la
instalación y resolver esa dependencia primero. No ejecutar todo `schema.sql`
o `business_promotion_plans.sql` sobre una base existente para intentar arreglarlo:
esos archivos también contienen configuración y datos de otras funciones de Latido.

Card reutiliza `profiles`, `providers`, la lista y función de administradores
existentes, y `app_notifications`. En una base nueva hay que preparar primero
el esquema de Latido; `app_notifications.sql` depende a su vez de
`creator_platform.sql` y `message_read_status.sql`.

## 2. Ejecutar estos SQL en este orden

| Orden | Archivo completo en SQL Editor | Qué instala |
| --- | --- | --- |
| 1 | `supabase/latido_card.sql` | Membresías, credenciales, negocios, ofertas, reservas, Scanner, canjes y permisos |
| 2 | `supabase/latido_card_physical_requests.sql` | Solicitudes físicas, estados de entrega, notificaciones, cola email y auditoría |
| 3 | `supabase/latido_card_self_service.sql` | Alta directa de negocios, suspensión por Latido y QR automático |
| 4 | `supabase/latido_card_scanner_accounts.sql` | Usuario identificado, conexiones permanentes, revocación y eliminación de Scanner |
| 5 | `supabase/latido_card_scanner_multibusiness.sql` | Lista de negocios del trabajador y reapertura autenticada sin volver a escanear el QR |

**Si ya instalaste los cuatro primeros, ejecutar únicamente
`supabase/latido_card_scanner_multibusiness.sql` para esta actualización.** Si falta el
cuarto, instalarlo antes del quinto. No hay que cargar
otra vez los ejemplos ni modificar cuentas. Esta actualización también admite repetición.
No reinstalar después los SQL anteriores: contienen las versiones previas de esos RPC.
Los accesos anteriores vigentes pasan a permanentes; los caducados o revocados no
se reactivan. Los antiguos se crearon sin cuenta: volver a vincularlos para identificar
a su usuario. Eliminar una conexión bloquea su acceso y la oculta, conservando sus canjes.
La versión actualizada también hace que regenerar el QR retire las conexiones
anteriores del listado. Si ya ejecutaste este último archivo, vuelve a ejecutar
su contenido completo actualizado. No borra los canjes.

El nuevo SQL no crea tablas ni desactiva RLS. Añade dos RPC accesibles solo a cuentas
autenticadas: uno devuelve sus negocios vinculados sin secretos, el otro abre un
Scanner en un nuevo navegador a partir de una conexión propia todavía vigente.
Un acceso revocado, eliminado o de un negocio suspendido no permite reconectar.

Para probar: conectar una cuenta de trabajador gratuita a dos negocios mediante
QR/código; abrir «Mi negocio» y comprobar «Conectado a» con ambos nombres. Pulsar
cada nombre abre su cámara. Repetir sin credenciales locales conservando la cuenta.
Revocar todas las conexiones del trabajador a un negocio: desaparece de su lista.

Ejecutar cada archivo completo en una consulta separada. Todos admiten repetición
y conservan los datos existentes de Card. No crear manualmente columnas sueltas,
quitar RLS o conceder acceso directo a las tablas para solucionar errores.

Después, volver a ejecutar `latido_card_preflight.sql`: todos los componentes deben
mostrar `INSTALADO`. Las migraciones no activan socios o negocios reales ni cobran.

## 3. Comprobar tu acceso de administrador

La autorización real procede de `business_promotion_admins`:

```sql
SELECT email FROM public.business_promotion_admins ORDER BY email;
```

Si tu cuenta registrada no aparece, añadir únicamente el email de tu cuenta
administradora, sustituyendo el texto entre comillas:

```sql
INSERT INTO public.business_promotion_admins(email)
SELECT lower(email) FROM public.profiles
WHERE lower(email) = lower('TU_EMAIL_ADMIN_REGISTRADO')
ON CONFLICT (email) DO NOTHING;
```

Si no inserta filas y tu email no estaba ya, comprobar que el perfil existe.
La lista se comparte con la administración de promociones de Latido: añadir
un email concede acceso administrativo a esas funciones también.
Configurar ese mismo email en `VITE_ADMIN_EMAILS` y reiniciar el servidor de la app.
Cerrar y abrir sesión si se ha cambiado el email. No añadir las cuentas de socio
o negocio como administradores.

## 4. Cargar los ejemplos opcionales

En **Authentication → Users → Add user**, crear estas cuentas de prueba con
contraseñas que tú elijas y **Auto Confirm User** activado. Comprobar que el
proceso de alta de Latido ha creado sus filas en `public.profiles`:

| Email de prueba | Escenario |
| --- | --- |
| `card.socio@latido.test` | Socio activo durante 30 días |
| `card.inactivo@latido.test` | Membresía pausada: ve el catálogo y no puede usar ventajas |
| `card.negocio@latido.test` | Propietario de tres negocios, sin membresía de pago |

El dominio `.test` no recibe correos. Estas cuentas sirven para pruebas de interfaz,
base de datos y permisos. Para probar entregas SMTP, usar después otra cuenta de
prueba con un buzón controlado y autorizarla desde el panel de administración.

Ejecutar **`supabase/latido_card_test_examples.sql`** completo. Se detiene sin crear
datos si faltan las cuentas/perfiles o detecta una colisión con otros registros.
No crea solicitudes físicas, QR ni emails. Es idempotente: repetirlo conserva
las reservas, canjes, estados y fechas anteriores; no reinicia el escenario.

| Negocio ficticio | Ventaja incluida | Promoción especial |
| --- | --- | --- |
| Restaurante Sabor Latino, Zürich | 15 % desde CHF 50, una vez por mes natural | Café gratis, 20 reservas |
| Peluquería Brisa Latina, Luzern | 10 % en tu corte, sin límite de visitas | Asesoría capilar, 5 reservas |
| Tienda Raíces, Bern | CHF 10 desde CHF 80, una vez por mes natural | 2×1 en productos seleccionados, 10 reservas |

Todas duran 60 días desde la primera carga. Las especiales deben reclamarse,
reservan stock durante 7 días y se usan una vez por socio/oferta. No son ofertas
comerciales reales. Los tres negocios aparecen en el directorio de esta base
de desarrollo y participan gratis, sin cambiar ningún plan de publicidad.

## 5. Recorrido manual de prueba

1. Ejecutar `npm run dev` con las variables Supabase de desarrollo.
2. Entrar como socio activo. **Perfil → Mi Tarjeta Latido** abre `/card`.
   Comprobar seis ventajas, nombre, número de socio y membresía activa.
3. El QR digital aparece automáticamente en la tarjeta, arriba de la página;
   se renueva cada cinco minutos. En **Disponibles**, activar el café: baja la
   disponibilidad de 20 a 19 y aparece en **Activas**. Desactivar la reserva
   devuelve la unidad mientras la oferta sigue vigente.
4. Entrar con la misma cuenta que registró el negocio y abrir `/card/negocios`.
   Su negocio se abre automáticamente, sin una selección inicial. Cuando hay
   varios, el selector está al final de la página. Con uno solo no hay selector.
   Comprobar que puede gestionar ofertas y Scanner sin tener membresía.
   El QR privado aparece centrado abajo, en **Tu QR de negocio para los
   trabajadores**. Vincular otro navegador/dispositivo y
   abrir `/scanner/`. Ese acceso tiene sesión propia.

   El propietario puede pulsar el botón flotante **Scanner**: se conecta al
   negocio seleccionado y abre directamente la cámara. El personal pulsa
   **Scanner** y escanea primero el QR privado del negocio, luego el de un cliente
   desde la misma cámara. Los campos de vinculación manual están plegados.
   Comprobar que una tarjeta sin negocio vinculado no consulta datos del socio;
   cerrar la cámara libera el dispositivo. Un canje pendiente bloquea nuevos
   escaneos y cambios de negocio. Para identificar usuarios y hacer permanente
   el acceso, instalar `latido_card_scanner_accounts.sql` como se indica arriba.

   Probar **Compartir enlace con el personal**: conecta sin escanear tras login
   o registro gratuito. Confirmar que mantiene el destino durante el registro.
   No requiere suscripción del trabajador. Probar también el campo para copiar
   si compartir/portapapeles no están disponibles. Un usuario sin negocios propios
   debe ver **Scanner** en «Mi negocio». No aparecen «Usar enlace de tarjeta» ni
   «Solicitar acceso habitual». Rechazar la cámara y abrir **Cómo activar los
   permisos de la cámara**. Verificar las tres opciones de navegador y los pasos
   del sistema detectado. Permitirla en ajustes, recargar y reabrir Scanner.
   Probar **Conectar con código**, tanto con código completo como con enlace.
   Confirmar que cerrar libera la cámara y que aceptar no añade diálogos propios.

   La primera vinculación requiere iniciar sesión en una cuenta de Latido con nombre
   en su perfil; no necesita membresía ni pago. Scanner mantiene después su acceso
   propio en localStorage, sin caducidad horaria. Abrir otra pestaña y comprobarlo.
   **Scanners vinculados** empieza plegado y muestra el nombre de la cuenta conectada
   y «Conexión permanente». **Revocar** bloquea el dispositivo; **Eliminar** también
   lo retira del listado. **Desconectar este dispositivo** cierra el acceso desde Scanner.
   Verificar que las tres acciones impiden nuevas consultas y canjes con el token anterior.
   **Crear oferta** también empieza plegado. Abrirlo y completar los tres pasos:
   **Tu oferta** (tipo, valor, título y descripción), **Cómo se usa** (ventaja incluida
   o promoción, compra mínima, límites, unidades y vigencia) y **Revisar**.
   El último paso permite comprobar los datos antes de **Publicar oferta**.
   **Anterior** conserva el borrador; un fallo de publicación conserva la revisión.
   Cambiar de negocio reinicia el formulario para no publicar en otro establecimiento.

   Después de registrar un negocio en la app, **Gestionar ofertas en Tarjeta Latido**
   abre directamente ese negocio. No se relacionan negocios por coincidencia de
   email o nombre: se usa la cuenta propietaria guardada en `providers.user_id`.
5. En Scanner, leer el QR del socio. Marcar la comprobación de condiciones y
   canjear el 15 %. Un segundo intento debe mostrar el límite mensual.
   Reclamar de nuevo el café si se liberó, escanear y canjearlo una vez.
   El empleado aplica el descuento en su caja habitual.
6. Comprobar el canje en **Mis usos** y en el historial del negocio.
   El propietario puede anularlo con un motivo. Rotar el QR del negocio debe
   invalidar los accesos anteriores. Otro propietario no debe poder administrarlo.
7. Entrar como socio pausado. Debe ver el catálogo sin botones para generar QR
   o reclamar promociones; el servidor debe rechazar las operaciones igualmente.
8. Entrar como socio activo, abrir **Gestionar mi tarjeta e historial** y solicitar
   tarjeta física con recogida o dirección
   ficticia suiza. Entrar como administrador en `/card/admin`: comprobar la cola
   y el aviso; aprobar, emitir/descargar el QR, preparar y marcar entregada
   (recogida) o enviada y después entregada (envío). Comprobar el estado del socio.
   Probar pérdida y reposición. Las notas internas solo se ven en administración.
9. Antes del piloto, repetir con dos administradores a la vez, cámaras reales
   Android/iPhone, instalación PWA y una conexión interrumpida durante un canje.

Pulsar **Compartir** en una oferta: en móvil abre el menú de compartir; cuando no
está disponible, copia el texto y el enlace. Si el navegador bloquea el portapapeles,
muestra un campo para copiarlo manualmente. Abrir ese enlace sin sesión: la oferta
aparece primero y el CTA permite crear una cuenta conservando el destino
`/card?oferta=UUID`. El enlace contiene el ID público de la oferta, nunca un QR ni
una reserva personal. Una oferta caducada muestra un aviso y las ventajas actuales.

Desde administración,
**Retirar del programa** oculta las ofertas y revoca accesos del negocio; el
propietario no puede incorporarlo de nuevo. Solo Latido puede restablecerlo.

La navegación inferior general de la app no se muestra en `/card` ni sus subrutas.
La barra superior centrada con emojis permite volver al perfil, abrir la tarjeta,
gestionar negocios y entrar en administración cuando corresponde.
Quien tiene tarjeta ve su tarjeta primero; quien no tiene ve la información y
un CTA. Durante el piloto, el CTA del usuario autenticado abre una solicitud por
email a `info@latido.ch`, y el visitante entra primero en su cuenta. No activa ni
cobra una membresía automáticamente.

La interfaz tiene solo **Disponibles** y **Activas**, debajo de **Ventajas para ti**.
Las filas muestran título, negocio, límite y vigencia; **Ver detalles** despliega
el detalle completo. Ya no hay Guardadas. La tabla y RPC de favoritas de la versión
anterior se conservan por compatibilidad; compartir ofertas no necesita SQL nuevo.

Las solicitudes físicas generan avisos y trabajos en la cola email. Mantener el
worker SMTP desactivado durante estas pruebas con cuentas `.test`. La dirección,
notas privadas y credenciales no deben llegar al negocio ni al Scanner.

## 6. Pruebas automáticas sin tocar Supabase

```powershell
npm run test:card
npm run test:card:browser
npm run test:notifications
npm run build
```

`test:card` usa PostgreSQL aislado (PGlite), instala dos veces las migraciones,
ejecuta el mismo SQL de ejemplos, comprueba que se puede repetir sin perder una
reserva y prueba permisos, límites, canjes y solicitudes físicas.

`test:card:browser` usa una API simulada local. Muestra seis ejemplos y escenarios
agotado/usado, prueba un QR con el decodificador real, el acceso desde Perfil,
reservas, solicitud física y administración. Guarda capturas en
`output/latido-card/`. Requiere Chromium de Playwright instalado
(`npx playwright install chromium` si hace falta). No envía correos ni usa la
base remota. Esto no sustituye las pruebas de concurrencia y dispositivo real.

## 7. SQL de emails: más adelante

**No ejecutar todavía `supabase/latido_card_physical_email_cron.sql`.**
Activarlo cuando se despliegue `latido_card_physical_email`, estén configurados
SMTP y los secretos del worker y Vault, y se haya probado con un buzón controlado.
Seguir `docs/LATIDO_CARD_ADMINISTRATION.md`. El cron es opcional para esta fase;
las solicitudes y las notificaciones dentro de Latido funcionan sin él.

El precio mostrado es **CHF 6,90 al mes**; los cobros y renovaciones automáticas
siguen pendientes. Los ejemplos usan activación manual del piloto.
