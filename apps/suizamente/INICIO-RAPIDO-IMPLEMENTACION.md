# Inicio, misterio y decoración por cantón · 28 de noviembre de 2026

Actualización posterior: el calendario anual, la devolución de decoraciones al
nivel 0, el editor exclusivamente por cantón y la optimización global del lector
de mapa están documentados en `CARGA-CALENDARIO-IMPLEMENTACION.md`. Esa entrega
sustituye la vista general del decorador y amplía las fechas descritas aquí.

«Juega ahora» está justo debajo del botón grande de Inicio. Sus accesos se
dibujan con la configuración pública, sin esperar al resumen de la cuenta. Los
récords, retos, contadores y recomendaciones los sustituye después la respuesta
real del servidor. No se inventan números durante la carga. Misterio solo se
adelanta si el calendario editorial contiene una entrada para hoy en Zúrich.
El navegador solo recibe esa disponibilidad, no el contenido del calendario.

## Carga

La estadística agregada de producción indicaba una media de 3.345 ms en las
llamadas de mejoras. El resumen invocaba tres veces más el dispatcher completo,
con nuevas cargas de jugador, economía, misiones, ligas y mapas.

V39 sustituye esas tres cargas dentro de `mej_resumen` por los mismos lectores
privados. La autenticación, moderación y límite se siguen validando una vez con
el motor original. Se conserva la actualización de plazos y el cobro de misiones.
No se cambia el dispatcher del juego, ni una pregunta, regla o premio.

La comparación local con la misma cuenta y resultado pasó de unos 1.840 ms a
545 ms. Es una medición del resumen local, no una promesa de tiempo total para
cualquier teléfono o conexión. El test compara ambos JSON y comprueba que todas
las funciones antiguas y sus permisos siguen iguales.

La configuración pública se solicita con la identidad anónima: no queda detrás
del bloqueo de la cuenta durante el arranque. Las rutas del jugador conservan
su autenticación. El servidor tampoco lee el álbum ni el banco privado de
preguntas para consultar unos interruptores; los carga solo si se solicitan.

## Decorar

La pastilla del Mapa conserva el cantón seleccionado en `?canton=LU`, por
ejemplo. La pantalla abre «Decora Lucerna», construye únicamente esa maqueta y
filtra los puntos y el contador a ese cantón. Las colocaciones se guardan en los
mismos huecos y con las reglas del servidor anteriores. La flecha de la maqueta
vuelve a la región; cambiar la región elimina el cantón de la URL.

La vista general del decorador construye solo su región, en lugar de los 26
cantones. El Mapa normal y sus modelos no cambian. Las cargas antiguas que se
cancelan al cambiar de vista no pueden borrar la maqueta nueva.

## Misterio publicado

Se presentó el contenido completo del Monumento del León y, tras «continúa», se
preparó para el 28 de noviembre de 2026. Fuente oficial:
https://www.luzern.com/en/the-city/sights/top-sights/lion-monument

Está en `fuentes/misterios.txt`, compilado por el generador existente. El ejemplo
con pistas pendientes sigue comentado. V40 inserta la fecha sin modificar ni
sobrescribir días ya publicados. La correcta, las pistas cerradas y el dato se
mantienen privados hasta el momento que permiten las reglas.

El calendario contiene esta fecha. Los días siguientes necesitan contenido
editorial: no se repite automáticamente el mismo misterio ni se publican textos
de prueba. Para otra publicación:

```sh
node herramientas/generar-misterios.js --escribir
node scripts/generar-misterios-publicacion.mjs --salida supabase/suizamente_misterios_FECHA.sql
```

Revisar y aplicar el SQL antes de desplegar los archivos. El generador de SQL no
sobrescribe otra publicación distinta. No hace falta volver a sembrar los
interruptores ni las decoraciones para publicar contenido.

## Verificación

```sh
npm run test:inicio:rapido
npm run test:mejoras:contenido
npm run test:mejoras:servidor
node scripts/test-suizamente-map-layout.mjs
npm run build
```

El navegador retrasa deliberadamente el resumen para comprobar que los tres
accesos ya se ven; verifica después los contadores reales. Recorre Mapa → cantón
→ Decorar, coloca una decoración y comprueba que ningún punto pertenece a otro
cantón. Juega el misterio y comprueba la ocultación de la solución antes de
responder. Capturas a 390 × 844 y 375 × 667 en `output/inicio-rapido/`.
