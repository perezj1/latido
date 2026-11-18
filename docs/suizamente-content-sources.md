# Suizamente: banco inicial y revisión de contenido

Revisión documental inicial: **12 de noviembre de 2026**. El banco privado está en `supabase/seed-data/suizamente-questions.json`; se utiliza para generar SQL y nunca se importa en el cliente puntuable.

## Cobertura entregada

- **276 preguntas**, con identificadores estables: las 225 iniciales y 51 del modo juego (15 llegadas y 36 para etapas). Verdadero/falso tiene dos opciones; selección múltiple hasta cinco, y parejas cuatro elementos por columna.
- **125 generales**: cinco preguntas por cada combinación de las cinco categorías principales y las cinco dificultades.
- **25 de alemán opcional**: cinco por dificultad. Son ejercicios propios de reconocimiento y pequeñas situaciones; las montañas no equivalen a niveles CEFR ni a una certificación de idioma.
- **77 cantonales**: los 26 cantones tienen al menos dos preguntas iniciales (capital y portal administrativo); varias regiones tienen también transporte, instituciones o diversidad lingüística. El modo juego añade dos de Zürich, identificadas como cantonales.
- Distribución local: Zürich 8; Luzern 5; Bern, Genève, Ticino y Vaud 4; Appenzell Innerrhoden, Fribourg, Glarus, Graubünden, Nidwalden, Obwalden, Solothurn y Valais 3; los restantes 12 cantones, 2.

El modo juego adapta los ejemplos del diseño proporcionado. Las nuevas variantes de verdadero/falso conservan el enunciado y la fuente de preguntas revisadas. Las llegadas incluyen enlaces de turismo y operadores de las montañas. Se matizan las referencias al S10 (puede haber obras) y Zermatt (hay vehículos autorizados y excepciones). La demostración usa seis ejemplos públicos; el banco puntuable permanece privado.

Fuentes de las llegadas: [Turismo de Zürich: Uetliberg](https://www.zuerich.com/en/visit/nature/uetliberg-zurichs-very-own-mountain), [Rigi: historia del ferrocarril](https://www.rigi.ch/en/about-us/history/history-of-the-first-mountain-railway-of-europe), [Pilatus: tren de cremallera](https://pilatus.ch/en/railway-cableways/cogwheel-railway), [Jungfrau: región y ferrocarriles](https://www.jungfrau.ch/en-gb/), [Zermatt: llegada y circulación](https://zermatt.swiss/en/plan-book/arrival).

Las dificultades generales progresan de reconocimiento a casos contextualizados. La presencia de dos preguntas básicas en un cantón **no significa cobertura completa en cada categoría y dificultad**. La selección debe poder completar con contenido general y comunicarlo; no se deben fabricar preguntas locales ni sustituirlas por las de otro cantón. El panel editorial debe mostrar esta cobertura real.

La etiqueta `published` significa que el contenido ha pasado una revisión documental inicial con las fuentes indicadas. Sigue siendo recomendable una revisión editorial local antes de una campaña pública o un uso institucional, especialmente en vivienda, trabajo y salud. Ninguna pregunta ofrece diagnósticos, pautas médicas de actuación, requisitos personalizados de permisos o promesas de prestaciones.

## Fuentes principales

El enlace preciso y el título se incluyen en cada entrada. Los enunciados y explicaciones se han redactado para el juego; no se ha reproducido un examen oficial.

### Autoridades, instituciones y contexto

- [Cancillería Federal: federalismo](https://www.ch-info.swiss/en/die-schweiz/foederalismus).
- [Cancillería Federal: funciones del Parlamento](https://www.ch-info.swiss/en/das-parlament/aufgaben-des-parlaments).
- [DFAE: sistema político](https://www.aboutswitzerland.eda.admin.ch/en/political-system).
- [ch.ch: acceso y contacto con la administración](https://www.ch.ch/en/safety-and-justice/addresses-of-administrative-authorities).
- [DFAE: lenguas](https://www.aboutswitzerland.eda.admin.ch/en/language).
- [DFAE: geografía](https://www.aboutswitzerland.eda.admin.ch/en/geography).
- [DFAE: fiesta nacional](https://www.aboutswitzerland.eda.admin.ch/en/national-holiday-and-national-anthem).
- [OFS: mapa de los 26 cantones y capitales, estado 1 de enero de 2026](https://dam-api.bfs.admin.ch/hub/api/dam/assets/36390092/master).
- [Administración Federal de Finanzas: sistema monetario](https://www.efv.admin.ch/en/monetary-currency-system).
- [La Poste: phishing](https://site.post.ch/de/ueber-uns/sicherheit/phishing-und-betrug).

### Vivienda y residuos

- [ch.ch: contratos de alquiler y subalquiler](https://www.ch.ch/en/housing/rent/rental-and-leasing-agreements/).
- [BAFU: pilas y baterías](https://www.bafu.admin.ch/en/batteries).
- [BAFU: aparatos eléctricos y electrónicos](https://www.bafu.admin.ch/en/electrical-and-electronic-equipment-en).
- [BAFU: recuperación y reciclaje de materiales](https://www.bafu.admin.ch/en/material-recovery-recycling).

No se establecen horarios de silencio, calendarios de residuos ni procedimientos municipales universales. Esos datos necesitan una fuente del lugar concreto.

### Trabajo, formación y previsión

- [SECO: función del contrato de trabajo](https://www.kmu.admin.ch/en/the-purpose-of-the-employment-contract).
- [SECO: jornada y horas suplementarias](https://www.seco.admin.ch/en/posting-regulation-of-working-hours).
- [Central de Compensación: seguros sociales](https://www.zas.admin.ch/en/oasidi-in-swiss-social-security).
- [DFAE: seguridad social y tres pilares](https://www.aboutswitzerland.eda.admin.ch/en/social-security).
- [SECO: preguntas sobre desempleo](https://www.arbeit.swiss/en/jobseekers/faqs-on-unemployment-benefit).
- [SECO: inscripción y Job-Room](https://www.arbeit.swiss/en/jobseekers/signing-on-and-registration).
- [SBFI: espacio educativo suizo](https://www.sbfi.admin.ch/en/swiss-education-area).

No se promete acceso a prestaciones ni se extrapolan salarios mínimos, plazos o condiciones de un sector a toda Suiza.

### Salud y derechos del paciente

- [BAG: primas y participación en gastos](https://www.bag.admin.ch/en/health-insurance-premiums-and-co-payment).
- [BAG: diferencias entre básico y complementario](https://www.bag.admin.ch/en/premiums-and-costs-answers-to-frequently-asked-questions).
- [BAG: obligación de asegurarse y admisión](https://www.bag.admin.ch/en/health-insurance-requirement-to-obtain-insurance-for-persons-resident-in-switzerland).
- [BAG: derecho a la información](https://www.bag.admin.ch/en/the-right-to-information).
- [BAG: acceso al historial](https://www.bag.admin.ch/en/right-of-access-to-case-file).
- [BAG: secreto médico](https://www.bag.admin.ch/en/professional-or-medical-secrecy).
- [BAG: derechos en consulta y hospital](https://www.bag.admin.ch/en/your-rights-at-the-doctors-and-in-hospital).
- [Alertswiss](https://www.alert.swiss/en/home.html).

Se enseñan conceptos y canales de información, sin indicar una actuación clínica para un caso individual ni presentar el quiz como asesoramiento médico.

### Transporte y contenido local adicional

- [SBB: mapa de validez](https://www.sbb.ch/en/tickets-offers/travelcards/area-validity-map.html).
- [SBB: billetes Supersaver](https://www.sbb.ch/en/help-and-contact/products-services/tickets/switzerland/supersaver-tickets-saver-day-passes.html).
- [ZVV: mapas y zonas](https://www.zvv.ch/de/fahrplan-und-informationen/liniennetzplaene.html).
- [Verkehrsverbund Luzern: Passepartout](https://www.vvl.ch/ueberuns/passepartout).
- [BERNMOBIL: Libero](https://www.bernmobil.ch/de/abos-tickets/libero-tarifverbund).
- [État de Vaud: comunidades tarifarias](https://www.vd.ch/mobilite/loffre-de-mobilite-a-votre-disposition/communautes-tarifaires).
- [Unireso: títulos de transporte](https://www.unireso.com/titres-de-transport/).
- [Arcobaleno: preguntas frecuentes](https://arcobaleno.ch/it/faq).
- [Zürich: Kantonsrat](https://www.zh.ch/de/kantonsrat.html).
- [Luzern: Kantonsrat](https://www.lu.ch/kr).
- [Ticino: instituciones](https://www.ti.ch/).

Los nombres de redes no implican que cubran todo el territorio de un cantón ni todas las conexiones. Las explicaciones remiten al ámbito exacto del título.

### Alemán

- [Goethe-Institut: vocabulario A1](https://www.goethe.de/pro/relaunch/prf/de/A1_SD1_Wortliste_02.pdf).
- [Goethe-Institut: vocabulario B1](https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf).

Se ha utilizado alemán estándar. No se imita un dialecto suizo ni se equipara Matterhorn con un nivel lingüístico oficial. Los ejemplos breves son propios y sirven para reconocer expresiones cotidianas.

## Reglas de mantenimiento

1. Mantener el mismo `id` para una misma pregunta; no crear nuevas recompensas por corregir una errata.
2. Crear una nueva versión de contenido al cambiar opciones, solución o explicación. Las partidas empezadas conservan su versión.
3. Registrar fuente, fecha y ámbito en cada publicación. Comprobar que el enlace no sea solo la portada si la afirmación necesita una página concreta.
4. Retirar una pregunta dudosa y tramitar su aviso antes de volver a publicarla. Una retirada no debe obligar a inventar cobertura local.
5. Revisar contenido operativo antes que curiosidades estables. Los cambios de servicios, tarifas, normas o acceso digital pueden exigir una actualización.
6. No añadir datos personales a enunciados ni información que solicite al jugador revelar salud, situación migratoria o ingresos.

## Uso técnico del JSON

El archivo incluye `correct_index`: es **material editorial para generar la base de datos**, no un recurso para descargar íntegro en el navegador durante partidas puntuables. El frontend solo debe recibir preguntas asignadas sin soluciones y la corrección posterior de cada respuesta. Una demo pública debe utilizar una selección pequeña independiente.

No se han modificado tablas, permisos, configuración de Supabase ni contenido existente de Latido en esta tarea editorial.
