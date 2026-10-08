// Content checked against the linked primary sources on 7 October 2026.
// Review dates are editorial dates, never generated at render time.
const source = (label, url) => ({ label, url })
const section = (heading, paragraphs = [], bullets = [], note = '') => ({ heading, paragraphs, bullets, note })

export const GUIDE_REVISIONS = {
  d1: {
    summary:'Qué cambia entre L, B y C, cómo empezar y qué depende de tu nacionalidad y del cantón.',
    relatedBusinessTerms:['permiso de residencia', 'permisos de residencia', 'permisos y registro', 'gestión de permisos', 'reagrupación', 'inmigración', 'migración', 'extranjería', 'residencia en suiza'],
    sections:[
      section('Empieza por tu situación', ['Las reglas distinguen entre ciudadanos de la UE/AELC y de terceros países. Tener residencia en España no equivale a tener nacionalidad española. El motivo de estancia también importa: empleo, estudios, familia o residencia sin actividad laboral.']),
      section('Si vienes a trabajar desde la UE/AELC', ['Para un empleo de más de tres meses, regístrate en tu municipio dentro de los 14 días de llegada y antes de empezar. Los trabajos de hasta tres meses suelen seguir un procedimiento de notificación.'], [
        '**L:** normalmente para contratos de tres meses a menos de un año; su duración sigue la del contrato.',
        '**B:** para contratos de al menos un año o indefinidos; generalmente válido cinco años.',
        '**G:** para trabajadores fronterizos que viven fuera de Suiza; tiene requisitos propios.',
      ]),
      section('El permiso C no es automático', ['El acceso suele ser después de cinco o diez años, según nacionalidad y situación. Para ciudadanos españoles puede ser a los cinco años si se cumplen las condiciones. La continuidad de residencia, integración e idioma se revisan; confirma los requisitos con tu cantón.']),
      section('Si no tienes nacionalidad UE/AELC', ['La contratación está sujeta a condiciones más restrictivas, cuotas y autorización. En general, el empleador debe justificar la contratación y solicitar el permiso. Una oferta de trabajo por sí sola no autoriza a empezar.']),
      section('Tu siguiente paso', [], ['Consulta la oficina cantonal de migración antes de mudarte o aceptar una fecha de incorporación.', 'Prepara identificación, contrato o motivo de estancia y la documentación de alojamiento que te pidan.', 'Anota la fecha de caducidad y solicita la renovación con antelación.']),
    ],
    sources:[
      source('SEM · Trabajar en Suiza', 'https://www.sem.admin.ch/sem/en/home/overview-arbeit.html'),
      source('SEM · Permiso L UE/AELC', 'https://www.sem.admin.ch/sem/en/home/themen/aufenthalt/eu_efta/ausweis_l_eu_efta.html'),
      source('SEM · Permiso C UE/AELC', 'https://www.sem.admin.ch/sem/en/home/themen/aufenthalt/eu_efta/ausweis_c_eu_efta.html'),
      source('SEM · Preguntas sobre libre circulación', 'https://www.sem.admin.ch/sem/en/home/themen/fza_schweiz-eu-efta/eu-efta_buerger_schweiz/faq.html'),
    ],
  },
  d2: {
    summary:'Retención en nómina, declaración posterior y el plazo del 31 de marzo: cuándo actuar y qué comprobar.',
    relatedBusinessTerms:['impuestos', 'declaración de renta', 'declaración fiscal', 'quellensteuer', 'fiscal', 'steuer', 'fiduciaria'],
    sections:[
      section('Qué es la Quellensteuer', ['Es la retención fiscal que el empleador descuenta del salario. Suele aplicarse a trabajadores extranjeros residentes sin permiso C, con excepciones, por ejemplo si el cónyuge es suizo o tiene C. No sustituye siempre a una declaración posterior.']),
      section('Cuándo debes declarar después', ['Para residentes sujetos a retención, un salario bruto anual de **CHF 120.000 o más** obliga a la imposición ordinaria posterior (NOV). Otros ingresos o patrimonio también pueden obligarte; los umbrales dependen del cantón. No sumes sin más los salarios de la pareja para aplicar el umbral individual.']),
      section('Pedirla voluntariamente', ['Si resides en Suiza, puedes solicitar la NOV hasta el **31 de marzo del año siguiente**. Para el ejercicio 2026, el plazo es el 31 de marzo de 2027. Puede aumentar o reducir el impuesto: compara antes de solicitarla. Una petición válida no se puede retirar y normalmente implica seguir declarando en los años posteriores.']),
      section('Antes de enviar la solicitud', [], ['Reúne certificados salariales, ingresos y patrimonio en Suiza y el extranjero.', 'Comprueba deducciones admisibles y justificantes con la oficina fiscal de tu cantón.', 'Una tarifa o salario retenido incorrectos se corrigen por otra vía; no confundas esa corrección con pedir deducciones mediante la NOV.'], 'La retención ya pagada se tiene en cuenta en la liquidación ordinaria. Una declaración no garantiza una devolución.'),
    ],
    sources:[
      source('Cantón de Zúrich · Personas sujetas a retención', 'https://www.zh.ch/de/steuern-finanzen/steuern/quellensteuer/Quellensteuerpflichtige-Personen.html'),
      source('Cantón de Zúrich · NOV y corrección de retención', 'https://www.zh.ch/de/steuern-finanzen/steuern/quellensteuer/nachtraegliche-ordentliche-veranlagung-oder-quellensteuerkorrekt.html'),
    ],
  },
  d3: {
    summary:'Seguro básico, franquicia, modelos y cambio de compañía sin promesas de ahorro ni precios desactualizados.',
    relatedBusinessTerms:['krankenkasse', 'seguro de salud', 'seguro médico', 'seguros de salud', 'seguros médicos', 'seguro básico', 'seguros', 'primas'],
    sections:[
      section('Al llegar: tres meses para asegurarte', ['En general, debes contratar el seguro básico obligatorio dentro de los **tres meses** de establecerte en Suiza. Si lo haces a tiempo, la cobertura y las primas se remontan al inicio de residencia. Cada miembro de la familia necesita su propio seguro; existen excepciones que debe reconocer la autoridad competente.']),
      section('Compara el mismo seguro', ['Las prestaciones del seguro básico están definidas por ley. Cambian la prima, el modelo de acceso y la atención administrativa. Usa **Priminfo**, el comparador oficial, con tu municipio, edad y la prima del año que vas a contratar. No mezcles el básico con un seguro complementario, que tiene otras condiciones de admisión.']),
      section('La franquicia cambia tu riesgo', ['Para adultos: CHF 300, 500, 1.000, 1.500, 2.000 o 2.500 al año. Una franquicia alta suele bajar la prima, pero te exige más ahorro disponible para tratamientos. Además se paga normalmente un 10 % de los gastos que superan la franquicia, hasta CHF 700 al año para adultos; hay reglas especiales para determinados medicamentos y hospitalización.']),
      section('Cómo decidir', [], ['Compara el coste anual de primas y tu posible participación, no solo la mensualidad.', 'Revisa si el modelo exige llamar primero a telemedicina, al médico de familia o a un centro HMO.', 'Pregunta al cantón por la reducción de primas y sus plazos.', 'Si trabajas al menos ocho horas semanales con un empleador, comprueba la cobertura de accidentes antes de excluirla del seguro básico.']),
      section('Cambiar para enero', ['Para el cambio anual del básico, la aseguradora debe recibir la baja **como máximo el 30 de noviembre**. Inscríbete también en la nueva compañía y confirma el traspaso. Las deudas pendientes y otras situaciones pueden impedir el cambio. El complementario tiene plazos propios.']),
    ],
    sources:[
      source('BAG · Seguro al residir en Suiza', 'https://www.bag.admin.ch/en/health-insurance-requirement-to-obtain-insurance-for-persons-resident-in-switzerland'),
      source('BAG · Franquicias', 'https://www.bag.admin.ch/en/health-insurance-optional-deductibles'),
      source('BAG · Participación en gastos', 'https://www.bag.admin.ch/en/health-insurance-co-payment-for-persons-resident-in-switzerland'),
      source('BAG · Primas y cambio de aseguradora', 'https://www.bag.admin.ch/en/premiums-and-costs-answers-to-frequently-asked-questions'),
      source('Priminfo · Comparador oficial', 'https://www.priminfo.admin.ch/'),
      source('ch.ch · Enfermedad y accidentes en el trabajo', 'https://www.ch.ch/en/work/illness--accident--disability/absences-from-work-due-to-illness-or-accident/'),
    ],
  },
  d4: {
    summary:'Documentos habituales, costes que comparar y cómo comprobar qué protección tiene tu dinero.',
    relatedBusinessTerms:['cuenta bancaria', 'cuentas bancarias', 'banca', 'bancario', 'bancaria', 'servicios financieros', 'banco y servicios básicos'],
    sections:[
      section('No necesitas una recomendación personal', ['Abrir una cuenta depende de las comprobaciones de identidad y de la política del banco. Ninguna entidad está obligada a aceptar cualquier solicitud. Pregunta si admite tu situación concreta: recién llegado, permiso en trámite o residencia fuera de Suiza.']),
      section('Prepara la documentación', [], ['Pasaporte o documento de identidad vigente.', 'Permiso de residencia o justificante de registro, si la entidad lo solicita.', 'Dirección y residencia fiscal; pueden pedir números de identificación fiscal.', 'Información sobre empleo, origen de fondos y uso previsto de la cuenta.']),
      section('Compara el coste real', ['Revisa mantenimiento, tarjeta, retiradas, pagos en otras monedas, transferencias y requisitos de saldo o ingresos. Que una cuenta se anuncie como gratuita no significa que todos los servicios lo sean. Confirma también si ofrece IBAN suizo y cómo ingresar efectivo.']),
      section('Banco y aplicación no siempre son lo mismo', ['En bancos y entidades autorizadas sujetos al sistema suizo, los depósitos protegidos tienen un límite de **CHF 100.000 por cliente y entidad**. Un saldo en una aplicación de pagos puede tener otra estructura y protección. Comprueba quién mantiene el dinero y la autorización correspondiente.']),
      section('Tu siguiente paso', ['Haz una lista de dos o tres opciones que admitan tu documentación, solicita sus tarifas actuales y elige según el uso que vas a darles. No envíes documentos bancarios a través de mensajes públicos.']),
    ],
    sources:[
      source('Swiss Banking · Identificación y apertura de cuenta', 'https://www.swissbanking.ch/en/financial-centre/information-for-clients/information-for-bank-clients'),
      source('FINMA · Protección de depósitos', 'https://www.finma.ch/en/supervision/banks-and-securities-firms/depositor-protection/'),
    ],
  },
  d5: {
    summary:'Diferencias entre Kita y escuela pública, cómo pedir plaza y dónde consultar ayudas municipales.',
    relatedBusinessTerms:['guardería', 'guarderías', 'kita', 'kinder', 'apoyo escolar', 'clases para niños', 'cuidado infantil', 'niñera'],
    sections:[
      section('Kita y escuela son servicios distintos', ['La Kita ofrece cuidado infantil antes de la escolarización y, según el centro, para otras edades. Sus plazas, horarios y precios dependen del proveedor y de las ayudas locales. No existe una tarifa nacional ni una lista de espera igual para toda Suiza.']),
      section('Cómo pedir una plaza de Kita', [], ['Pregunta en tu municipio por centros autorizados y posibles subvenciones.', 'Indica edad, fecha de inicio y días de asistencia; consulta varias opciones con antelación.', 'Pide por escrito el precio que pagarías con tus ingresos y ayudas.', 'Revisa adaptación, comidas, días festivos, ausencias y preaviso de baja antes de firmar.']),
      section('La escuela pública', ['La educación obligatoria pública es gratuita y suele abarcar once años, incluyendo el jardín de infancia. La escolarización empieza generalmente alrededor de los cuatro años, pero las fechas de corte y la organización dependen del cantón. Contacta con el municipio al mudarte para conocer la asignación de centro y el apoyo lingüístico disponible.']),
      section('Necesitas cubrir el horario laboral', ['Comedor, atención antes o después de clase y vacaciones escolares pueden requerir inscripción y pago aparte. Confirma esos servicios antes de contar con una jornada completa de cuidado.']),
      section('Ayudas: consulta las de tu municipio', ['Como ejemplo, la ciudad de Zúrich calcula sus subvenciones de cuidado según ingresos, patrimonio y requisitos de acceso. Es un sistema local: no lo apliques a otro municipio. Pregunta cuándo debes solicitar la ayuda y desde qué fecha surte efecto.']),
    ],
    sources:[
      source('Confederación · Educación obligatoria', 'https://www.aboutswitzerland.eda.admin.ch/en/compulsory-education'),
      source('Ciudad de Zúrich · Costes y subvenciones de cuidado', 'https://www.stadt-zuerich.ch/de/lebenslagen/jugend-und-familie/fruehe-kindheit/familienergaenzende-kinderbetreuung/betreuungskosten-und-subventionen.html'),
    ],
  },
  d6: {
    summary:'Cómo escoger un curso útil, buscar apoyo local y comprobar qué certificado sirve para tu trámite.',
    relatedBusinessTerms:['alemán', 'deutsch', 'idiomas', 'escuela de idiomas', 'curso de alemán', 'clases de alemán', 'sprachschule'],
    sections:[
      section('Elige según dónde vives', ['En la Suiza alemana conviven el alemán estándar escrito y el dialecto hablado. Un curso de alemán estándar sirve como base; añade práctica de conversación para el día a día. En cantones francófonos o italófonos, comprueba primero qué lengua necesitas para trabajar y realizar tus trámites.']),
      section('Busca apoyo cerca de ti', ['Las oficinas cantonales y municipales de integración pueden orientar sobre cursos, ofertas locales y posibles ayudas. La disponibilidad, el precio y las condiciones cambian por localidad. Consulta allí antes de contratar un curso largo.']),
      section('Compara más que el precio', [], ['Haz una prueba de nivel y explica tu objetivo: empleo, conversación o certificado.', 'Compara horas reales de clase, tamaño del grupo, horarios y modalidad.', 'Pregunta si matrícula, materiales y examen están incluidos.', 'Pide condiciones de cancelación y cambio de grupo por escrito.']),
      section('Si necesitas un certificado', ['Para permisos o naturalización, el nivel oral y escrito requerido depende del procedimiento. **No todos los certificados se aceptan.** Revisa la lista vigente del SEM y confirma los requisitos con la autoridad que tramita tu solicitud antes de pagar un examen.']),
      section('Una rutina que puedas mantener', ['Combina clases con pequeñas tareas diarias: escribir un correo, hacer una llamada o practicar una conversación de trabajo. Llegar a A2 o B1 requiere un esfuerzo distinto según tu punto de partida y las horas de práctica; evita planes que prometan un nivel en un plazo fijo sin evaluarte.']),
    ],
    sources:[
      source('SEM · Idioma y certificados reconocidos', 'https://www.sem.admin.ch/sem/de/home/integration-einbuergerung/mein-beitrag/zugewandert/sprache.html'),
      source('SEM · Cursos e integración', 'https://www.sem.admin.ch/sem/de/home/integration-einbuergerung/integrationsfoerderung/faq.html'),
      source('SEM · Oficinas cantonales de integración', 'https://www.sem.admin.ch/sem/de/home/sem/kontakt/kantonale_behoerden/kantonale_ansprechstellen.html'),
    ],
  },
  d7: {
    summary:'Quién puede venir contigo, por qué cambia entre UE/AELC y terceros países y qué preparar antes de solicitar.',
    relatedBusinessTerms:['reagrupación', 'inmigración', 'extranjería', 'permiso de residencia', 'permisos de residencia', 'derecho migratorio'],
    sections:[
      section('Primero identifica qué reglas se aplican', ['La reagrupación depende de tu nacionalidad, permiso y parentesco. No existe una espera general de un año para todos los titulares de un B ni un salario mínimo mensual único para toda Suiza.']),
      section('Ciudadanos UE/AELC', ['En general, pueden reagrupar al cónyuge, hijos y nietos menores de 21 años o dependientes, y ascendientes dependientes. Para estudiantes el círculo familiar es más limitado. Se exige alojamiento adecuado y, en los supuestos correspondientes, acreditar dependencia económica.']),
      section('Nacionales de terceros países', ['La vía habitual comprende al cónyuge y a hijos solteros menores de 18 años. Los requisitos y el derecho a obtenerla varían según el permiso. Pueden examinarse convivencia, vivienda, recursos, dependencia de ayudas sociales e idioma.'], [], 'En los casos sujetos a la ley de extranjería, el plazo general para pedir la reagrupación es de cinco años; para hijos mayores de 12 años, de un año. El momento desde el que se cuenta y las excepciones deben confirmarse con el cantón.'),
      section('Prepara la solicitud antes del viaje', [], ['Consulta a la autoridad cantonal y al consulado si hace falta visado.', 'Reúne documentos de identidad y certificados de matrimonio o nacimiento.', 'Pide la lista exacta de traducciones, legalizaciones y pruebas económicas: no todos los documentos exigen lo mismo.', 'Confirma también el derecho a trabajar de los familiares según su situación.']),
    ],
    sources:[
      source('ch.ch · Reagrupación familiar', 'https://www.ch.ch/en/foreign-nationals-in-switzerland/entry-and-stay-in-switzerland/family-reunification/'),
      source('SEM · Familiares de ciudadanos UE/AELC', 'https://www.sem.admin.ch/sem/en/home/themen/fza_schweiz-eu-efta/eu-efta_buerger_schweiz/faq.html'),
      source('SEM · Preguntas sobre residencia', 'https://www.sem.admin.ch/sem/fr/home/themen/aufenthalt/faq.html'),
    ],
  },
  d8: {
    summary:'Los tres pilares, importes de 2026 y la primera paga adicional de AHV/AVS en diciembre.',
    relatedBusinessTerms:['pensión', 'pensiones', 'jubilación', 'ahv', 'avs', 'tercer pilar', '3a', 'previsión', 'vorsorge'],
    sections:[
      section('Tres pilares, funciones distintas', ['El primer pilar es AHV/AVS. El segundo es la previsión profesional y resulta obligatorio para empleados que cumplen sus condiciones; no es simplemente un ahorro voluntario. El tercero es ahorro privado, con modalidades como el pilar 3a.']),
      section('Qué se descuenta de tu nómina', ['La cotización conjunta AHV/IV/EO es del **10,6 % del salario**, repartida por mitades entre trabajador y empleador. No incluye todos los demás descuentos sociales. Los empleados cotizan desde el 1 de enero posterior a cumplir 17 años; las personas sin actividad, desde el 1 de enero posterior a cumplir 20, salvo reglas especiales.']),
      section('Importes y edad de referencia en 2026', ['La pensión mensual ordinaria completa de AHV/AVS va de **CHF 1.260 a CHF 2.520**. No es lo que recibirá todo el mundo: influyen ingresos medios, años cotizados y lagunas. La edad de referencia es 65 años para hombres; para mujeres nacidas en 1962, 64 años y seis meses, dentro de la transición a 65.'], [], 'La primera 13.ª paga de la pensión de vejez se abonará en diciembre de 2026 a quienes cumplan las condiciones. Se calcula sobre las pensiones de vejez del año; no se extiende sin más a pensiones de invalidez o supervivencia.'),
      section('Pilar 3a: límites de 2026', ['Con afiliación al segundo pilar, el máximo anual es **CHF 7.258**. Sin ella, hasta el 20 % de los ingresos de actividad, con un máximo de **CHF 36.288**, sujeto a las condiciones del 3a. Comprueba la deducibilidad y el plazo de abono antes de aportar.']),
      section('Si te vas de Suiza', ['No existe un reembolso universal para personas de Latinoamérica. El resultado depende de nacionalidad, convenios y circunstancias. Consulta a la Caja Suiza de Compensación antes de pedir un reembolso o planificar el cobro en otro país. Solicita también un extracto de tu cuenta individual para detectar lagunas.']),
    ],
    sources:[
      source('BSV · Los tres pilares', 'https://www.bsv.admin.ch/en/old-age-insurance-system'),
      source('AHV/IV · Pensión de vejez, ficha 2026', 'https://www.ahv-iv.ch/p/3.01.e'),
      source('AHV/IV · Cotizaciones de trabajadores', 'https://www.ahv-iv.ch/de/sozialversicherungen/alters-und-hinterlassenenversicherung-ahv/online-rechner/arbeitgebende-arbeitnehmende'),
      source('AHV/IV · Reforma y edad de referencia', 'https://www.ahv-iv.ch/p/11.01.i'),
      source('AHV/IV · 13.ª paga de vejez', 'https://www.ahv-iv.ch/fr/Assurances-sociales/Assurance-vieillesse-et-survivants-AVS/13e-rente-AVS'),
      source('BSV · Aportaciones al pilar 3a', 'https://www.bsv.admin.ch/fr/votre-cotisation-au-3e-pilier'),
      source('Caja Suiza de Compensación · Reembolso', 'https://www.zas.admin.ch/en/reimbursement-of-contributions'),
    ],
  },
  d9: {
    summary:'Prepara tu candidatura, entiende alquiler y gastos y protege la fianza antes de firmar.',
    relatedBusinessTerms:['inmobiliaria', 'inmobiliario', 'alquiler de vivienda', 'búsqueda de vivienda', 'búsqueda de piso', 'mudanza', 'mudanzas', 'reubicación', 'relocation', 'derecho de arrendamiento'],
    sections:[
      section('Define un presupuesto completo', ['Separa alquiler base, gastos adicionales (Nebenkosten), electricidad y otros servicios. El anuncio no siempre incluye todo. Pregunta qué gastos se facturan a cuenta y cuáles a tanto alzado, y deja margen para la mudanza y la fianza.']),
      section('Prepara tu candidatura', [], ['Identificación y permiso o situación de residencia.', 'Justificantes de ingresos o contrato laboral, si te los piden.', 'Extracto del registro de deudas (Betreibungsregisterauszug), cuando sea necesario; solicitud y coste dependen de la oficina.', 'Presentación breve con personas que vivirán allí y fecha prevista de entrada.']),
      section('Busca y visita con criterio', ['Combina portales, administraciones y contactos locales. Guarda anuncios, confirma las visitas y pregunta por ruido, transporte, lavandería, mascotas y condiciones de salida. Presentar un dossier completo ayuda, pero no garantiza que te elijan.']),
      section('La fianza de una vivienda', ['La garantía en dinero puede ser de hasta **tres meses de alquiler** y debe mantenerse en una cuenta de garantía a nombre del inquilino. No la confundas con un seguro de caución: su prima suele ser un coste y no dinero ahorrado que recuperas.'], [], 'Comprueba la identidad del arrendador y las condiciones de la cuenta antes de transferir. Desconfía de pagos urgentes para reservar una vivienda que no puedes verificar.'),
      section('Al recibir las llaves', ['Lee el contrato y el inventario de entrada, fotografía desperfectos y comunica los que falten por escrito enseguida. Conserva anuncios, correos y justificantes. Si surge una disputa, consulta la autoridad de conciliación de alquileres de tu zona.']),
    ],
    sources:[
      source('BWO · Vivir en Suiza, folleto en varios idiomas', 'https://www.bwo.admin.ch/de/broschuere-wohnen'),
      source('BWO · Derechos y obligaciones del alquiler (PDF)', 'https://www.bwo.admin.ch/dam/bwo/de/dokumente/02_Wie_wir_wohnen/27_Infoblatt-Wohnen/informationsblatt/englisch.pdf.download.pdf/englisch.pdf'),
    ],
  },
  d10: {
    summary:'Vacaciones, preaviso, enfermedad y qué revisar en tu contrato o convenio colectivo.',
    relatedBusinessTerms:['derecho laboral', 'asesoría laboral', 'asesoramiento laboral', 'abogado laboral', 'abogada laboral', 'laboralista', 'contratos de trabajo'],
    sections:[
      section('Contrato y convenio: empieza aquí', ['Revisa salario, jornada, prueba, vacaciones, preaviso y convenio colectivo (CCT/GAV). Suiza no tiene un salario mínimo federal general: puede existir uno cantonal o del convenio. La 13.ª paga no es obligatoria para todos; comprueba si está pactada.']),
      section('Vacaciones y horas extra', ['El mínimo legal de vacaciones es de **cuatro semanas al año**, y cinco hasta cumplir 20 años. El contrato o convenio puede mejorar esa cifra. Anota tus horas: las horas por encima del contrato y las que superan el máximo legal no siguen siempre la misma compensación.']),
      section('Preaviso en un contrato indefinido', ['Como regla legal después de la prueba: un mes en el primer año, dos del segundo al noveno y tres desde el décimo, normalmente a fin de mes. El contrato escrito o convenio puede cambiar estas reglas. Durante la prueba suele ser de siete días; la prueba ordinaria puede pactarse hasta tres meses, con posibles prolongaciones legales por ausencias.']),
      section('Enfermedad y accidentes', ['Avisa pronto y presenta certificado cuando corresponda. El pago depende del seguro de pérdida de ingresos o de las condiciones legales de continuidad salarial; no es una promesa ilimitada de salario completo. Tras la prueba existen periodos de protección frente al despido por enfermedad o accidente, distintos del derecho al salario.'], [], 'Si trabajas ocho horas semanales o más con un empleador, su seguro cubre también accidentes no laborales. Con menos horas, comprueba tu cobertura para el tiempo libre.'),
      section('Si hay un problema', [], ['Guarda contrato, nóminas, horarios y comunicaciones.', 'Pide por escrito aclaraciones sobre descuentos, salario u horas.', 'Consulta al sindicato, un asesor laboral o la autoridad competente antes de firmar una renuncia o acuerdo de salida.']),
    ],
    sources:[
      source('ch.ch · Salario mínimo y salario medio', 'https://www.ch.ch/en/work/salary/minimum-wage-and-average-salary'),
      source('Confederación · Contrato y 13.ª paga', 'https://www.kmu.admin.ch/fr/but-du-contrat-de-travail'),
      source('SECO · Prueba, preaviso y despido', 'https://www.seco.admin.ch/fr/faq-resiliation-du-contrat'),
      source('ch.ch · Vacaciones y ausencias', 'https://www.ch.ch/de/arbeit/arbeitszeit/ferien--feiertage-und-arbeitsabwesenheiten/'),
      source('ch.ch · Horas extra', 'https://www.ch.ch/fr/travail/horaires--absences--vacances/heures-supplementaires-et-travail-supplementaire'),
      source('ch.ch · Enfermedad y accidentes', 'https://www.ch.ch/en/work/illness--accident--disability/absences-from-work-due-to-illness-or-accident/'),
    ],
  },
  d11: {
    summary:'Compara cuánto llega al destinatario, entiende el cambio CHF/EUR y evita confundir SEPA con gratuidad.',
    relatedBusinessTerms:['remesas', 'envío de dinero', 'enviar dinero', 'transferencias internacionales', 'cambio de divisas', 'cambio de moneda'],
    sections:[
      section('Compara el importe que recibe la otra persona', ['Pide presupuestos para el mismo importe, moneda, forma de pago y momento. Un servicio sin comisión puede incluir margen en el cambio; otro puede añadir costes de tarjeta o de bancos intermediarios. Las tarifas y promociones cambian, así que no elijas por una clasificación antigua.']),
      section('De Suiza a España', ['Suiza participa en SEPA, que permite transferencias en **euros** entre entidades participantes. SEPA no garantiza que una transferencia desde Suiza sea gratuita. Si partes de francos, comprueba quién convierte a euros y con qué tipo de cambio; el banco receptor también puede aplicar condiciones.']),
      section('De Suiza a Latinoamérica', [], ['Comprueba país, moneda y si el cobro es en cuenta, cartera o efectivo.', 'Pregunta por el importe final, plazo estimado y comisiones del receptor.', 'Verifica límites, documentación y condiciones de cancelación.', 'Revisa la entidad jurídica que presta el servicio y la supervisión que le corresponde.']),
      section('Cómo comprobar el cambio', ['Puedes usar el tipo de referencia del BCE para orientarte sobre la diferencia con una oferta CHF/EUR. Es una referencia informativa, **no un precio garantizado** para una transferencia. Compara siempre el resultado final después de todos los cargos.']),
      section('Antes de confirmar', ['Comprueba nombre, IBAN o datos de cobro con el destinatario por un canal conocido. Guarda justificante y número de seguimiento. Para un destinatario nuevo, una pequeña transferencia inicial puede ayudarte a comprobar los datos antes de enviar una cantidad mayor.']),
    ],
    sources:[
      source('SIX · SEPA en Suiza y condiciones', 'https://www.six-group.com/en/products-services/banking-services/payment-standardization/standards/sepa.html'),
      source('BCE · Tipos de cambio de referencia', 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html'),
    ],
  },
  d13: {
    summary:'El plazo de 12 meses también afecta al carnet español. Consulta el canje según el país de expedición.',
    relatedBusinessTerms:['carnet de conducir', 'permiso de conducir', 'licencia de conducir', 'autoescuela', 'fahrschule', 'canje de carnet', 'canje de licencia'],
    sections:[
      section('Al mudarte: cuenta los 12 meses', ['Con carácter general, puedes conducir con un permiso extranjero válido durante los primeros **12 meses de residencia**. Después necesitas el permiso suizo para seguir conduciendo aquí. Esto también afecta a permisos españoles: no son válidos indefinidamente por ser de la UE. Hay reglas especiales para conducción profesional.']),
      section('Importa dónde se expidió el permiso', ['No se decide solo por tu nacionalidad. Para un permiso español ordinario, el canje normalmente no exige prueba de conducción. Para permisos de otros países puede exigirse una prueba de control (Kontrollfahrt) y, según categoría, otros requisitos. No significa que toda persona de Latinoamérica deba empezar desde cero.'], [], 'La prueba de control solo permite un intento. Si no la superas, tendrás que obtener el permiso suizo mediante el procedimiento completo; prepárala con antelación.'),
      section('Pasos para tramitar el canje', [], ['Consulta la oficina de tráfico de tu cantón y su lista de países y categorías.', 'Prepara formulario, identificación, residencia, foto y permiso original según sus instrucciones.', 'Realiza la prueba visual y aporta traducción si te la piden.', 'Solicita con antelación; confirma tasas y cualquier prueba adicional.']),
      section('Si ya pasó el plazo', ['No sigas conduciendo con el permiso extranjero sin confirmar tu autorización. Contacta con tráfico para regularizar el canje; haber pasado el plazo no equivale por sí solo a tener que repetir todo el aprendizaje.']),
      section('Permiso internacional y uso profesional', ['Un permiso internacional acompaña al nacional y no sustituye el canje por residencia. Antes de trabajar conduciendo, consulta las exigencias de tu categoría: pueden aplicarse desde antes de los 12 meses.'], [], 'La fuente cantonal enlazada es la de Zúrich; formularios, tasas y citas deben comprobarse en el cantón donde resides.'),
    ],
    sources:[
      source('EDA · Conducir con permiso extranjero', 'https://www.eda.admin.ch/countries/czech-republic/en/home/services/driving-and-vehicles/driving-ch-foreign-licence.html'),
      source('Cantón de Zúrich · Países y pruebas de canje', 'https://www.zh.ch/de/mobilitaet/fuehrerausweis-fahren-lernen/auslaendischer-fuehrerausweis.html'),
      source('Cantón de Zúrich · Canje y países de expedición', 'https://www.zh.ch/de/mobilitaet/fuehrerausweis-fahren-lernen/auslaendischer-fuehrerausweis/auslaendischen-fuehrerausweis-umtauschen.html'),
    ],
  },
  d14: {
    summary:'Qué hace una agencia temporal, cómo comprobar su autorización y qué revisar antes de una misión.',
    relatedBusinessTerms:['trabajo temporal', 'personal temporal', 'agencia de empleo', 'agencia de colocación', 'colocación laboral', 'reclutamiento', 'selección de personal', 'personalverleih', 'temporär', 'búsqueda de empleo', 'búsqueda de trabajo', 'carta de motivación', 'cartas de presentación', 'currículum'],
    sections:[
      section('Temporal no es lo mismo que colocación', ['En la cesión temporal de personal, la agencia suele ser tu empleador y te asigna a una empresa cliente. En la colocación, la agencia te conecta con una empresa que te contrata directamente. Pregunta quién firma tu contrato y paga tu salario.']),
      section('Comprueba la agencia', ['La intermediación y la cesión profesional de personal están reguladas y pueden exigir autorización cantonal y, para actividad transfronteriza, federal. Consulta el registro oficial desde el portal de empleo de la Confederación. Un anuncio o una marca conocida no sustituyen esa comprobación.']),
      section('Antes de aceptar una misión', [], ['Pide contrato y condiciones de la asignación: empresa, lugar, fechas y jornada.', 'Comprueba salario bruto por hora, vacaciones, festivos, posibles suplementos y descuentos.', 'Pregunta qué convenio colectivo se aplica y cómo funciona el preaviso.', 'Confirma permiso de trabajo o notificación: tener un L, B, F o N no autoriza cualquier empleo automáticamente.', 'Revisa seguros de accidentes, pérdida de ingresos por enfermedad y previsión según tu situación.']),
      section('Cuidado con los cobros', ['No todo cobro al candidato es ilegal: la colocación privada admite determinados honorarios dentro de las reglas aplicables. Pide fundamento, contrato y desglose. Distingue esos honorarios de la cesión temporal y consulta a la autoridad si te cobran por obtener una misión o te prometen un permiso garantizado.']),
      section('Aumenta tus opciones', ['Prepara un CV claro, disponibilidad, idiomas, experiencia y documentos de trabajo. Registra tus candidaturas y mantén contacto con la agencia. Si estás desempleado, consulta también al RAV/ORP y los servicios oficiales de búsqueda de empleo.']),
    ],
    sources:[
      source('work.swiss · Agencias de colocación y trabajo temporal', 'https://www.arbeit.swiss/en/employment-agencies/recruitment-and-staffing-agencies-in-switzerland'),
      source('SECO · Colocación privada y cesión de personal', 'https://www.seco.admin.ch/de/private-arbeitsvermittlung-und-personalverleih'),
      source('SEM · Condiciones para trabajar en Suiza', 'https://www.sem.admin.ch/sem/en/home/overview-arbeit.html'),
    ],
  },
  d12: {
    summary:'Distingue reconocimiento profesional y admisión académica, y encuentra la autoridad correcta para tu profesión.',
    relatedBusinessTerms:['reconocimiento de títulos', 'reconocimiento de diplomas', 'homologación', 'convalidación', 'traducción jurada', 'traducciones juradas', 'traducción oficial', 'traducciones oficiales', 'traducciones generales y oficiales'],
    sections:[
      section('Primero: ¿tu profesión está regulada?', ['Busca la profesión y el lugar donde quieres ejercer en **recognition.swiss**. Si está regulada, puede ser necesario reconocer la cualificación o cumplir un procedimiento específico. Si no lo está, normalmente puedes trabajar sin reconocimiento obligatorio; el empleador decide si tu formación encaja y puede pedir una evaluación.']),
      section('La autoridad cambia según la profesión', ['No existe una oficina única para todos los títulos. El buscador oficial indica el organismo competente y el procedimiento. Medicina, farmacia, enfermería y docencia siguen vías diferentes; no envíes el expediente a una organización solo porque esté relacionada con tu sector.']),
      section('Qué preparar', [], ['Diploma, certificado de estudios y contenidos de la formación.', 'Identificación y, si corresponde, acreditación de habilitación y experiencia profesional.', 'Traducciones y copias certificadas en el formato que pida la autoridad.', 'Documentación lingüística si el procedimiento o el ejercicio la exige.']),
      section('No presupongas reconocimiento automático', ['El país de formación, la nacionalidad, la profesión y las diferencias de programa pueden influir. Un título español no implica reconocimiento automático para cualquier profesión. Pueden requerirse medidas compensatorias; no todos los solicitantes deben hacer el mismo examen. Consulta costes y tiempos vigentes antes de pagar traducciones.']),
      section('Si quieres estudiar en Suiza', ['La admisión a una universidad o a un máster es distinta de la autorización profesional. Pregunta directamente a la institución por acceso, equivalencias y reconocimiento de créditos. Un reconocimiento para trabajar no garantiza plaza académica, ni al revés.']),
      section('Tu siguiente paso', ['Guarda el resultado de la búsqueda oficial y escribe a la autoridad competente con tu diploma, país de expedición y objetivo. Así podrás preparar un expediente adecuado antes de asumir gastos.']),
    ],
    sources:[
      source('recognition.swiss · Buscador oficial de profesiones', 'https://www.recognition.swiss/en'),
      source('recognition.swiss · Preguntas frecuentes', 'https://www.recognition.swiss/en/faq'),
      source('SBFI · Procedimientos de reconocimiento', 'https://www.sbfi.admin.ch/en/faq-recognition-procedure-for-professional-qualifications'),
    ],
  },
}
