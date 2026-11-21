# País y años en Suiza para los perfiles de ejemplo

En Supabase SQL Editor del proyecto de Latido, ejecuta completo
[suizamente_desgloses_ejemplo.sql](../../supabase/suizamente_desgloses_ejemplo.sql).
Requiere la instalación social existente. No utiliza `suizamente_private`, que
pertenece a otro juego.

El añadido asigna país y tiempo en Suiza a los mismos 320 perfiles de ejemplo
que ya aparecen en el ranking. Incluye 8 países y los 4 tramos de antigüedad.
Son distribuciones diseñadas para la demostración; no describen la población
de Suiza ni la actividad real de Latido.

Los perfiles y repartos se guardan en `suizamente_social.demo_perfiles` y
`suizamente_social.demo_repartos`, con procedencia `ejemplo`. No se crean cuentas
de Auth ni se modifican votos, puntos, amistades o clasificaciones reales.
Cada pregunta asigna una respuesta a cada perfil mediante una permutación
determinista. Ambos desgloses suman 320 y coinciden exactamente con el reparto
por opciones del juego, también en las preguntas de tres respuestas.

El endpoint de desglose usa estos datos cuando hay menos de 20 votos reales
en la pregunta. Al alcanzar 20, usa exclusivamente los votos reales y mantiene
el mínimo de 20 personas por grupo. Las respuestas indican `demo: true` o
`demo: false`. Se conserva la indicación de procedencia que ya tiene el resultado.

Después del SQL, recarga el juego: la versión actual del cliente puede mostrar
los porcentajes por país y años. El código actualizado de `experiencia.js` añade
los recuentos «X de Y», muestra los ocho países y ordena los años cronológicamente;
esa presentación requiere publicar la web. No hace falta desplegar de nuevo
la Edge Function.

Puede ejecutarse varias veces. Para comprobar los perfiles sin modificar nada:

```sql
select pais, count(*) as perfiles
from suizamente_social.demo_perfiles group by pais order by perfiles desc, pais;

select anos_suiza, count(*) as perfiles
from suizamente_social.demo_perfiles group by anos_suiza order by anos_suiza;
```

Generación y validación local desde la raíz del repositorio:

```powershell
node scripts/generar-suizamente-social.mjs
node scripts/test-suizamente-desgloses.mjs
node scripts/test-suizamente-social.mjs
npm --prefix apps/suizamente run build
npm --prefix apps/suizamente run test:social
```
