# Suizamente: referencias de diseño integradas

Revisión del 13 de noviembre de 2026 frente al paquete entregado por el usuario: `ESPECIFICACION.md`, `LEEME.md`, los diez JSON de `datos/`, los SVG y las capturas. Los documentos se usan como especificación del producto y material de referencia, no como instrucciones para ejecutar código, publicar ni modificar servicios externos.

## Aplicado

- Siluetas suministradas para las cinco montañas, con sus facetas y colores suaves al estar bloqueadas. Los trazados están incorporados en `src/data/suizamenteIconPaths.json`; no se depende de archivos externos al repositorio. Se conservan las barras compactas, las montañas centradas cerca de la base y los títulos en una sola línea con elipsis solicitados previamente.
- Paisajes y geometría de las cinco rutas; marcas de senderismo; carteles con la flecha hacia la parada, cartel de cima centrado y poste al pie. Monedas completadas con el icono de acierto, repasos con flechas, llegada blanca, cimas con cruz suiza, bloqueo en gris y aro de avance real.
- Tarjeta flotante de etapa, llegada, repaso, reto y cima sobre la navegación, con encabezado de color, duración orientativa y cierre. Se puede seguir explorando el mapa; tocar de nuevo la misma parada cierra la tarjeta.
- Preguntas: indicador del ámbito, etiqueta de llegada a la montaña, instrucciones coloreadas por formato, ilustración en un recuadro, verdadero/falso con símbolos, selección múltiple con botones inferiores en paralelo y fallos de parejas breves en ambas columnas.
- Corrección: verde, rojo o ámbar, icono circular, respuesta correcta, explicación desplazable, fuente, aviso de error, racha de aciertos y premio realmente recibido. «No lo sé» no resta XP y usa el mensaje amable.
- Glosario con las 23 entradas, terminaciones alemanas `-e`, `-n` y `-en`, definiciones enlazadas y hoja de traducción. En preguntas de idioma, traducción e instituciones cuya definición revelaría la respuesta se habilita después de contestar. Abrir una palabra dentro de una opción no selecciona esa respuesta.
- Resultados con marca, premio, avance por rombos, tres tarjetas de estadísticas y botón inferior persistente. Estados de cima aprobada, cima fallida y celebración de racha con días realmente jugados. La revisión de respuestas propias sigue disponible.
- Clasificación con alias, avatar de iniciales, puestos compartidos y resultado propio. El progreso conserva horizonte, estadísticas privadas y mochila.

## Decisiones para la app real

- Los nombres, fechas, 305 XP, 7 días, 128 participantes y resultados de las capturas son datos de demostración. La aplicación muestra exclusivamente datos de la cuenta y del servidor; no copia esos valores ni dibuja una barra de estado falsa del teléfono.
- Las 31 preguntas de ejemplo no sustituyen el banco existente de 276 preguntas ni las ediciones del administrador. El paquete identifica contenido pendiente de revisión editorial.
- Se mantiene la protección contra duplicación de XP, bonus y premios. Repetir no vuelve a conceder recompensas ya obtenidas. Los XP se calculan en el servidor según los formatos configurados, no según el estado local del prototipo.
- Se conserva el guardado también de llegadas y retos, además de las etapas. Salir de un test real sigue contando como intento no superado. Cambiar de ámbito no modifica una partida empezada.
- Las llegadas tratan de su montaña; las etapas siguen los ámbitos elegidos y notifican si falta contenido local; los tests de cima y el reto semanal conservan las preguntas generales de la implementación actual. La interfaz de preferencias lo explica.
- Temporada 2, rutas cantonales y modo invierno se presentan como próximos contenidos, sin simular que estén activos. El reto semanal sí funciona.
- Se mantiene la navegación y la identidad de Latido existentes. No se reemplaza el Inicio completo por la pantalla ficticia del prototipo ni se añaden paquetes sin destino real.

## Activación y comprobación

### Última referencia: «Suizamente modo juego», 13 de noviembre de 2026

- Pregunta centrada, sin bocadillo ni marca grande lateral; marca pequeña junto al contexto, ámbito y montaña de llegada centrados.
- Instrucciones por formato en mayúsculas, tarjetas de respuesta con borde inferior grueso, imágenes enmarcadas y botones inferiores con relieve.
- Ajuste del espacio en cuatro pasos según la altura disponible. Las respuestas conservan un mínimo de 12 px y objetivos táctiles de al menos 44 px. Si el contenido sigue siendo largo, se puede desplazar; tras responder se pueden ocultar las opciones ajenas al acierto y a la elección propia.
- Corrección compacta con solución, explicación desplazable, fuente y aviso de error. El desvanecido de la explicación desaparece al llegar al final. Las instrucciones dejan paso al resultado tras responder.
- Palabras útiles conservadas en un desplegable, además de los términos que se pueden tocar en el enunciado y las respuestas. Los símbolos de verdadero/falso siguen el texto de la opción, aunque el servidor mezcle el orden.
- Resultados y estadísticas con el espaciado, las tarjetas y los colores de la nueva referencia. El historial de respuestas propias sigue disponible y no queda fuera de alcance cuando ocupa más que la pantalla.
- Paisajes SVG suministrados para las cinco montañas: nubes, trenes, barcos, animales y elementos de luz animados. Amanecer, día, atardecer y noche se eligen con el reloj de `Europe/Zurich` y los umbrales estacionales aproximados del diseño; no son datos meteorológicos ni una predicción astronómica.
- Animación detenida al ocultarse la página o salir de la vista; se respeta `prefers-reduced-motion`. No se solicita geolocalización ni se cargan recursos de paisaje desde terceros. El selector horario del prototipo y las galerías de demostración no se añaden al flujo de la app.

Esta revisión no modifica SQL, permisos, RLS ni datos remotos. Si la versión 4 ya está instalada, basta con recargar la app. Para una primera instalación o actualización desde una versión anterior, seguir [SUIZAMENTE_SETUP.md](SUIZAMENTE_SETUP.md).

Durante la prueba local se detectó una navegación rechazada dentro de `sw.js`. En las direcciones de loopback el worker deja ahora las peticiones y el HMR directamente al navegador/Vite y desactiva navigation preload; conserva sus controladores de notificaciones. El comportamiento de navegación y caché de producción se mantiene y se comprueba con `npm run test:pwa:dev`. Si una pestaña conserva el error anterior, recargar con `Ctrl+Shift+R` una vez que el servidor responda en `http://localhost:8080`.

Validación local: compilación de producción, ESLint, pruebas de permisos y persistencia con PostgreSQL local, recorridos de las cinco montañas y pruebas de interfaz en Chromium y WebKit a distintas anchuras. Los servicios y usuarios usados por las pruebas son locales; no se escribe en Supabase remoto. Capturas de comprobación en `output/latido-card/suizamente/` (carpeta local de resultados).

En la última comprobación del nuevo estilo, el recorrido completo en Chromium pasó. El nuevo intento completo en WebKit quedó sin validar: su proceso de navegador no arrancó dentro de los 180 segundos disponibles. Las comprobaciones anteriores de las pantallas de preguntas en WebKit sí habían pasado; este intento no permite confirmar el recorrido completo actualizado en ese motor.
