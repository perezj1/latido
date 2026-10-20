# Ofertas por cercanía

Al elegir una ciudad, `/card` conserva sus ofertas primero y añade «Más ofertas cercanas», ordenadas por distancia geográfica creciente entre los centros aproximados de las localidades. Se aplica también a Negocios. Búsqueda y tipo de oferta se respetan en ambos grupos, con diez resultados iniciales por grupo y Mostrar todos independiente. Todas las ciudades conserva el catálogo anterior.

Las localidades sin coordenadas reconocibles se muestran al final en «Más ofertas»/«Más negocios». No se descartan resultados ni se inventa una distancia. Los nombres ambiguos entre cantones requieren el sufijo del cantón, por ejemplo Reinach BL. Se reconocen variantes habituales como Berna/Bern, Ginebra/Genève y Basilea/Basel.

No requiere SQL, GPS, permisos de ubicación ni llamadas externas al navegar. La distancia es en línea recta entre localidades, no un trayecto ni la distancia exacta al establecimiento. El acceso, las condiciones de uso y las confirmaciones del descuento se mantienen.

## Datos y actualización

Fuente: **Federal Office of Topography swisstopo (©swisstopo)**, [directorio oficial de localidades](https://www.swisstopo.admin.ch/en/official-directory-of-towns-and-cities), CSV WGS84 descargado el 18 de octubre de 2026. [Condiciones de uso](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices).

`src/lib/swissLocalityCoordinates.json` contiene las coordenadas aproximadas derivadas del promedio de puntos postales únicos por nombre oficial de localidad; como alternativa se usan puntos del municipio cuando no existe una localidad con ese nombre. Se conservan separadas las localidades homónimas con sufijos de cantón. Una localidad que cruza fronteras cantonales, como Basel o St. Gallen, conserva un único centro. No contiene datos de usuarios ni negocios.

Para regenerar el índice con Python 3, sin dependencias adicionales:

```powershell
python scripts/update-swiss-locality-coordinates.py
npm run test:card:location
```

El generador descarga el ZIP oficial, valida los límites geográficos y escribe únicamente el índice local. No debe ejecutarse en cada compilación: el índice se distribuye con la app.
