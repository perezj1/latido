# Contactos de Punto Hispano

Antes de desplegar el frontend, ejecutar `punto_hispano_contacts.sql` en el editor SQL del proyecto de Supabase de Latido. Requiere `profiles` y la función existente `is_business_promotion_admin()` de `business_promotion_plans.sql`. La migración se puede ejecutar de nuevo sin borrar contactos.

El frontend dirige las tarjetas, los enlaces antiguos `/servicios-suiza` y el botón Contactar del negocio de Punto Hispano al selector. La categoría es obligatoria y la subcategoría es opcional. Si no se elige subcategoría, el mensaje de WhatsApp usa solo la categoría y el registro administrativo muestra `Sin especificar` como servicio. La selección se conserva al regresar del acceso.

El botón final llama a `record_punto_hispano_contact`, que toma el nombre del perfil, el email de Auth y la fecha del servidor. Solo después de guardar el registro se abre `https://wa.me/41766232664` con el mensaje personalizado. Si el guardado falla, se muestra un error y se permite reintentar con el mismo identificador para evitar duplicados. El registro mide el clic, no el envío ni la recepción del mensaje en WhatsApp.

Administración → Colaboraciones → Contactos de Punto Hispano muestra nombre, email, categoría, servicio y fecha. La tabla muestra hora de Suiza; los filtros de fechas y las fechas exportadas usan UTC, indicado en las etiquetas. La exportación CSV incluye todos los resultados filtrados, lleva BOM UTF-8 y separador `;` para Excel, y neutraliza valores interpretables como fórmulas.

Los contactos tienen RLS: solo los administradores de Latido pueden leerlos. Los usuarios normales no pueden leer, insertar directamente, modificar ni borrar filas. La función admite únicamente los servicios del catálogo, y no acepta nombre, email, usuario ni fecha enviados por el cliente. El registro de contacto es independiente de las métricas opcionales de cookies; el selector informa de los datos que se guardan.

Las siete categorías y sus subcategorías resumidas proceden de `SERVICIOS PUNTO HISPANO.pdf`. El PDF no se publica. Si se cambia el catálogo, actualizar `src/lib/puntoHispanoServices.js` y el JSON de la función SQL juntos; la prueba comprueba que coincidan.

Verificación local:

```sh
npm run test:punto-hispano
npm run test:search
npm run build
```

La prueba también permite pasar como argumento la ruta a `@electric-sql/pglite/dist/index.js` instalado temporalmente. Ejecuta la migración en PostgreSQL en memoria y comprueba permisos, identidad, servicios, fecha y reintentos sin contactar con producción.

Para repetir la prueba de navegador, iniciar Vite en `127.0.0.1:5188` y ejecutar `node scripts/test-punto-hispano-browser.mjs <ruta-a-playwright/index.mjs>`. Usa Chrome local (o `LATIDO_TEST_CHROME`), simula todas las APIs externas y guarda capturas y un CSV de prueba en una carpeta temporal. Verifica el selector móvil, el enlace desde la landing, la selección conservada al acceder, los reintentos, el destino de WhatsApp y la descarga del administrador.

Después de aplicar la migración y desplegar, verificar con una sesión real que un clic aparezca en la tabla y descargar el CSV desde administración. No se ha aplicado la migración a producción desde este entorno.
