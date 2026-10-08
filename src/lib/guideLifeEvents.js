// Editorial review: 8 October 2026. Local requirements remain with the canton
// or municipality; the source links are shown in each complete guide.
const source = (label, url) => ({ label, url })
const section = (heading, paragraphs = [], bullets = [], note = '') => ({ heading, paragraphs, bullets, note })

export const LIFE_EVENT_GUIDE_REVISIONS = {
  d15: {
    reviewedAt:'2026-10-08',
    summary:'Si tu empleo termina, separa tres tareas: buscar trabajo desde ahora, registrarte en el RAV y tramitar las posibles prestaciones con una caja de desempleo.',
    relatedBusinessTerms:['desempleo', 'rav', 'derecho laboral', 'derecho del trabajo', 'derechos laborales', 'asesoría laboral', 'asesoramiento laboral', 'contratos de trabajo', 'sindicato', 'sindicatos', 'búsqueda de empleo', 'currículum', 'curriculum', 'orientación laboral'],
    sections:[
      section('Empieza antes de tu último día', ['Busca empleo desde que sabes que tu puesto termina y conserva las pruebas de cada candidatura. Revisa el preaviso y pide tu certificado de trabajo o una confirmación de empleo.'], [
        'Guarda contrato, carta de despido, nóminas y certificados laborales.',
        'Anota fecha, empresa, puesto, contacto y resultado de cada candidatura.',
        'Si te ofrecen un acuerdo de salida o quieres dimitir, consulta antes qué consecuencias puede tener para tus prestaciones.',
      ]),
      section('Regístrate en el RAV', ['El RAV, llamado ORP en francés y URC en italiano, es el servicio regional de empleo. Inscríbete cuanto antes; como máximo, el primer día por el que quieras reclamar prestaciones. Puedes iniciar el registro por Job-Room o acudir al centro que corresponde a tu domicilio.'], [
        'Prepara tu número AHV/AVS, identificación y permiso de residencia.',
        'Lleva las pruebas de búsqueda de empleo y los documentos que te soliciten.',
      ], 'El registro en el RAV y la cuenta de Job-Room son pasos distintos. Registrarte no significa que la prestación esté aprobada.'),
      section('La caja de desempleo revisa y paga', ['La Arbeitslosenkasse o caisse de chômage comprueba tu derecho y tramita el pago. El RAV te acompaña en la búsqueda y supervisa tus obligaciones. Pide al RAV las opciones de caja y presenta la solicitud con los certificados de empleadores que te exijan.']),
      section('¿Puedes cobrar prestaciones?', ['Por regla general, se requieren **al menos 12 meses de cotización en los dos años anteriores**, además de residencia, permiso válido y disponibilidad para trabajar. Existen excepciones y reglas para periodos cotizados en el extranjero: la caja debe revisar tu caso.', 'La prestación suele calcularse sobre el 70 % o el 80 % del salario asegurado, según las condiciones legales. Puede haber días de espera, deducciones o suspensiones; no equivale automáticamente a ese porcentaje de tu última nómina neta.'], [], 'Llegar a Suiza sin empleo no da derecho automático a cobrar el paro. Si eres fronterizo y resides fuera, normalmente corresponde solicitarlo en el país de residencia.'),
      section('Mantén tus gestiones al día', [], [
        'Asiste a las citas, sigue las instrucciones del RAV y registra tus candidaturas.',
        'Entrega formularios y justificantes en los plazos que te indiquen.',
        'Comunica trabajos temporales, ingresos y cambios de disponibilidad.',
        'Consulta con tu cantón si la pérdida de empleo afecta a tu permiso.',
      ], 'Hoy: reúne tus documentos y contacta con el RAV. Después: actualiza tu perfil y continúa enviando candidaturas.'),
    ],
    sources:[
      source('arbeit.swiss · Primeros pasos tras perder el empleo', 'https://www.arbeit.swiss/en/jobseekers/first-steps-after-dismissal'),
      source('arbeit.swiss · Registro en el RAV y caja de desempleo', 'https://www.arbeit.swiss/en/jobseekers/signing-on-and-registration'),
      source('arbeit.swiss · Requisitos y prestaciones de desempleo', 'https://www.arbeit.swiss/en/jobseekers/faqs-on-unemployment-benefit'),
      source('ch.ch · Permisos de residencia', 'https://www.ch.ch/en/foreign-nationals-in-switzerland/entry-and-stay-in-switzerland/permits-for-living-in-switzerland/'),
    ],
  },
  d16: {
    reviewedAt:'2026-10-08',
    summary:'Una lista práctica para mudarte dentro de Suiza: salir del alquiler, comunicar el domicilio, coordinar servicios y documentar la entrega del piso.',
    relatedBusinessTerms:['mudanza', 'mudanzas', 'transporte de muebles', 'limpieza de fin de alquiler', 'limpieza final', 'limpieza de pisos', 'alquiler', 'arrendamiento', 'cambio de domicilio'],
    sections:[
      section('Revisa el contrato antes de fijar la salida', ['Comprueba preaviso y fechas de rescisión. Comunica la baja por escrito y guarda prueba de recepción. En una vivienda familiar, verifica las firmas necesarias. Salir antes de la fecha acordada no cancela por sí solo la obligación de pagar. Si propones un inquilino sustituto, confirma que se cumplen los requisitos y conserva la respuesta.']),
      section('Organiza transporte y servicios', [], [
        'Compara presupuestos escritos que detallen transporte, limpieza, materiales y posibles suplementos.',
        'Reserva con tiempo y comprueba acceso, ascensor y estacionamiento para la carga.',
        'Acuerda con el empleador cómo organizar el día de mudanza.',
        'Separa llaves, documentos y lo que necesitarás la primera noche.',
      ]),
      section('Comunica tu nueva dirección', ['Notifica la salida a tu municipio anterior y el alta al nuevo; si permaneces en el mismo, comunica el cambio de dirección. **En general, el alta se hace dentro de los 14 días siguientes a la mudanza.** Confirma documentos y plazo local. eUmzugCH permite gestionar determinados cambios dentro de Suiza si tu caso y los municipios lo admiten.'], [
        'Actualiza la dirección con aseguradoras, banco y empleador.',
        'Coordina suministros, internet y, si lo necesitas, la redirección del correo.',
        'Si tienes hijos escolarizados o cambias de cantón con un vehículo, consulta también las oficinas correspondientes.',
      ]),
      section('Haz una entrega del piso documentada', ['Revisa el estado junto con la administración y deja constancia de desperfectos y llaves en el acta. Lee antes de firmar; solicita que figuren tus discrepancias. Conserva contrato, actas y justificantes.'], [
        'Haz fotos del estado de ambas viviendas y de las lecturas de contadores.',
        'Pide una copia de los documentos de entrega y recepción.',
      ]),
      section('Si la mudanza cruza la frontera', ['Esta lista se centra en cambios dentro de Suiza. Al trasladar tu residencia desde el extranjero, consulta las reglas aduaneras para enseres y vehículos. La importación de ciertos bienes usados puede beneficiarse de franquicia si se cumplen sus condiciones; no todos los objetos nuevos están exentos.'], [], 'Tu siguiente paso: fija en un calendario la fecha contractual de salida, el transporte, la entrega y el alta municipal. Si sales definitivamente del país, consulta también la guía de salida de Suiza.'),
    ],
    sources:[
      source('ch.ch · Lista para organizar una mudanza', 'https://www.ch.ch/en/housing/moving/checklist-for-moving-home/'),
      source('ch.ch · Baja y alta municipal', 'https://www.ch.ch/en/housing/moving/notification-of-departure-and-registration/'),
      source('BWO · Vivir de alquiler en Suiza', 'https://www.bwo.admin.ch/dam/de/sd-web/xKj1v2BhllVl/englisch.pdf'),
      source('BAZG · Importar bienes al mudarte a Suiza', 'https://www.bazg.admin.ch/en/moving-importing-goods-into-switzerland'),
    ],
  },
  d17: {
    reviewedAt:'2026-10-08',
    summary:'Qué preguntar sobre el seguro, qué organizar antes del nacimiento y cómo comprobar los permisos y prestaciones de maternidad.',
    relatedBusinessTerms:['maternidad', 'embarazo', 'matrona', 'matronas', 'ginecología', 'ginecologia', 'pediatría', 'pediatria', 'pediatra', 'postparto', 'seguro de salud', 'seguros de salud', 'krankenkasse', 'cuidado infantil'],
    sections:[
      section('Organiza el seguimiento y el parto', ['Contacta con tu profesional sanitario y acuerda el seguimiento y el lugar del parto. Pregunta cómo reservar las citas, qué documentación necesita el centro y si puedes disponer de atención o apoyo lingüístico que entiendas.'], [
        'Prepara identificación, tarjeta del seguro e información clínica que debas compartir.',
        'Anota a quién llamar para consultas y cómo organizar el acompañamiento.',
        'Pregunta por la atención de matrona antes y después del parto.',
      ]),
      section('Distingue cobertura básica y extras', ['Las prestaciones específicas de maternidad cubiertas por el seguro básico están exentas de participación en costes. Desde la **semana 13 del embarazo hasta ocho semanas después del parto**, también quedan exentos los tratamientos médicos generales cubiertos y los relacionados con enfermedades.', 'Eso no convierte cualquier servicio en gratuito: consulta si un examen, habitación o prestación está cubierto y si exige condiciones. La cobertura complementaria tiene sus propias reglas.']),
      section('Prepara el seguro del bebé', ['El bebé necesita su propio seguro de salud. Contrátalo **dentro de los tres meses siguientes al nacimiento** para que el seguro básico se aplique desde el nacimiento. Puedes organizarlo antes del parto; confirma por escrito fecha de inicio, prima y datos que debes enviar después.'], [], 'No confundas el seguro básico, sujeto a obligación de admisión, con un complementario que puede exigir evaluación y tener restricciones.'),
      section('Comprueba permiso y prestación de maternidad', ['La prestación federal de maternidad dura normalmente **14 semanas (98 días)** y equivale al **80 % del ingreso medio previo**, con un máximo de **CHF 220 al día**. Requiere cumplir las condiciones de aseguramiento y actividad; no se concede por el solo hecho de dar a luz en Suiza.', 'Como regla general, se revisan nueve meses de aseguramiento AHV/AVS y cinco meses de actividad antes del nacimiento. Hay reglas especiales, entre otras, para parto prematuro, cotizaciones extranjeras o desempleo. Pregunta a la caja de compensación y al empleador qué se aplica a tu caso.'], [], 'Fuera del periodo de prueba existe protección frente al despido durante el embarazo y las 16 semanas posteriores al nacimiento. Esa protección y las 14 semanas de prestación son conceptos distintos.'),
      section('Registro del nacimiento y organización familiar', ['El nacimiento debe comunicarse al registro civil del lugar del parto **en tres días**. Normalmente lo hace el hospital o el profesional que atiende el nacimiento; confirma que esté gestionado y qué documentos necesitas.'], [
        'Prepara con antelación los documentos de filiación que pida el registro civil.',
        'Consulta con el empleador o caja de compensación los permisos del otro progenitor y las asignaciones familiares aplicables.',
        'Si necesitarás guardería, pregunta pronto por plazas, horarios y ayudas de tu municipio.',
      ], 'Tu siguiente paso: reúne en una carpeta las confirmaciones del centro sanitario, el seguro del bebé y los trámites laborales.'),
    ],
    sources:[
      source('BAG · Participación en costes y maternidad', 'https://www.bag.admin.ch/en/premiums-and-costs-answers-to-frequently-asked-questions'),
      source('BAG · Seguro de residentes y recién nacidos', 'https://www.bag.admin.ch/en/health-insurance-requirement-to-obtain-insurance-for-persons-resident-in-switzerland'),
      source('AHV/IV · Prestación de maternidad', 'https://www.ahv-iv.ch/p/6.02.e'),
      source('ch.ch · Embarazo, maternidad y trabajo', 'https://www.ch.ch/en/family-and-partnership/work-and-family/pregnancy--maternity-leave-and-work'),
      source('ch.ch · Registro del nacimiento', 'https://www.ch.ch/en/family-and-partnership/maternity-and-paternity/pregnancy-and-birth/registering-a-birth'),
    ],
  },
  d18: {
    reviewedAt:'2026-10-08',
    summary:'Antes de salir definitivamente de Suiza, coordina la baja, el alquiler, los seguros y tus cotizaciones. Las reglas cambian según nacionalidad, destino y situación laboral.',
    relatedBusinessTerms:['salida de suiza', 'retorno', 'repatriación', 'mudanza internacional', 'mudanzas internacionales', 'pensiones', 'segundo pilar', 'tercer pilar', 'declaración fiscal', 'asesoría fiscal', 'trámites de salida'],
    sections:[
      section('Confirma tu salida con el municipio', ['Consulta al registro de habitantes cómo notificar una salida al extranjero, cuándo hacerlo y cómo obtener el certificado de baja. Facilita tu dirección futura. Los canales y documentos varían entre municipios; eUmzugCH no debe darse por válido para cualquier salida internacional.'], [], 'Si tu salida es temporal o quieres conservar un permiso, habla con migración antes de darte de baja. No asumas que el permiso seguirá siendo válido después.'),
      section('Cierra vivienda y contratos por separado', ['La baja municipal no cancela el alquiler ni los contratos privados. Revisa los preavisos, acuerda la entrega del piso y solicita confirmación de cada baja.'], [
        'Organiza las llaves, el acta de entrega y la devolución de la fianza.',
        'Revisa teléfono, internet, suministros y otros compromisos pendientes.',
        'Aclara con el banco si puedes conservar la cuenta como no residente y cómo recibirás devoluciones.',
      ]),
      section('Evita un vacío de cobertura sanitaria', ['En general, el seguro obligatorio suizo termina al trasladar la residencia al extranjero. Existen excepciones, especialmente en situaciones de trabajo, pensión y coordinación con la UE/AELC. Pide a tu aseguradora y a la autoridad competente una confirmación de qué sistema te cubrirá y desde cuándo.'], [], 'Coordina el inicio de cobertura en destino antes de cancelar. Los seguros complementarios y otros seguros requieren revisar su contrato por separado.'),
      section('No confundas tus tres pilares', ['**AHV/AVS:** salir de Suiza no permite recuperar automáticamente todas las cotizaciones. La conservación de derechos, posibles reembolsos o cobertura voluntaria depende de la nacionalidad y los convenios.', '**Segundo pilar:** al salir definitivamente puede existir derecho a cobrar una parte. Si te instalas en la UE/AELC y sigues sujeto allí al seguro obligatorio de vejez, invalidez y supervivencia, la parte obligatoria normalmente no se paga en efectivo. La parte no obligatoria puede seguir otras reglas.', '**Pilar 3a:** la salida definitiva es un supuesto que puede permitir el cobro anticipado; verifica documentos e impuestos antes de solicitarlo.'], [], 'Pide información a tu caja de pensiones, entidad de libre paso y caja de compensación. El país de destino importa; no existe una respuesta única para España y todos los países de Latinoamérica.'),
      section('Revisa impuestos y conserva tus documentos', ['Contacta con la oficina fiscal antes de viajar para confirmar las obligaciones del año de salida y cómo recibir notificaciones. Salir del país no implica que todos los impuestos estén liquidados.'], [
        'Conserva certificados salariales, de cotizaciones y de pensiones.',
        'Guarda el certificado de baja, las cancelaciones y tu dirección de contacto.',
        'Consulta aduanas en Suiza y en destino antes de transportar enseres o vehículo.',
        'Si cobras desempleo, acuerda cualquier salida con el RAV y la caja antes de viajar.',
      ], 'Tu siguiente paso: haz una lista de contratos con su fecha límite de aviso y solicita las confirmaciones que necesitarás en destino.'),
    ],
    sources:[
      source('Ciudad de Zúrich · Baja y salida al extranjero (ejemplo municipal)', 'https://www.stadt-zuerich.ch/de/lebenslagen/einwohner-services/umziehen-melden/wegzug.html'),
      source('BAG · Obligación de seguro y residencia en el extranjero', 'https://www.bag.admin.ch/en/health-insurance-requirement-to-obtain-insurance'),
      source('BSV · Seguridad social y salida de Suiza', 'https://www.bsv.admin.ch/en/situations-involving-foreign-countries-citizens'),
      source('Fondo de Garantía LPP · Cobro del segundo pilar al emigrar', 'https://sfbvg.ch/en/tasks/cash-payment-on-departure-abroad'),
      source('ch.ch · Tercer pilar', 'https://www.ch.ch/en/work/old-age-pension/3rd-pillar'),
      source('Ciudad de Zúrich · Impuestos al salir al extranjero (ejemplo local)', 'https://www.stadt-zuerich.ch/de/lebenslagen/steuern/natuerliche-personen/lebenssituationen/wegzug-ins-ausland.html'),
      source('BWO · Rescisión y entrega de una vivienda', 'https://www.bwo.admin.ch/dam/de/sd-web/xKj1v2BhllVl/englisch.pdf'),
    ],
  },
  d19: {
    reviewedAt:'2026-10-08',
    summary:'Organiza la llegada de tu familia: permiso y documentación, escolarización, cuidados, seguro de salud y una red de apoyo cerca de casa.',
    relatedBusinessTerms:['reagrupación', 'reagrupacion', 'cuidado infantil', 'cuidado de niños', 'niñera', 'niñero', 'au pair', 'guardería', 'guarderia', 'kita', 'pediatría', 'pediatria', 'pediatra', 'clases de alemán', 'clases de francés', 'traducción oficial', 'seguro de salud'],
    sections:[
      section('Aclara primero residencia y documentación', ['Comprueba con migración la vía de entrada y residencia de cada integrante de la familia. La nacionalidad, tu permiso y el parentesco influyen; una autorización para ti no resuelve por sí sola la situación de tus hijos.'], [
        'Prepara documentos de identidad, nacimiento y parentesco.',
        'Consulta si necesitas documentos de custodia, consentimientos, traducciones o legalizaciones.',
        'Reúne informes escolares y la información sanitaria necesaria para dar continuidad a su atención.',
      ]),
      section('Contacta con la escuela del lugar donde viviréis', ['La escolarización obligatoria es competencia de los cantones; la enseñanza pública obligatoria es gratuita. El inicio suele ser alrededor de los cuatro años, pero fechas de corte y organización dependen del cantón. Contacta con la autoridad escolar local cuando conozcas el domicilio; no esperes a dominar el idioma.'], [
        'Indica edad, curso anterior, idiomas y necesidades de apoyo de cada niño.',
        'Pregunta cómo se asigna la escuela y cuándo puede incorporarse.',
        'Consulta el apoyo de idioma y las medidas de integración disponibles.',
      ]),
      section('Distingue escuela, comedor y guardería', ['El horario escolar puede no cubrir toda tu jornada laboral. Las Kitas, el comedor y los servicios de atención antes o después de clase tienen plazas, tarifas y condiciones propias. Infórmate en el municipio sobre inscripción y posibles subvenciones.'], [
        'Haz un calendario real de entradas, salidas y desplazamientos.',
        'Comprueba qué días y comidas están incluidos en cada plaza.',
        'Pide condiciones de adaptación, vacaciones y cancelación por escrito.',
      ]),
      section('Organiza el seguro y la atención sanitaria', ['Cada niño necesita su seguro de salud. Por regla general, hay tres meses desde el establecimiento de residencia para contratar el básico; con el alta en plazo, la cobertura y las primas se aplican desde el inicio de residencia. Comprueba si tu situación internacional tiene una excepción.'], [
        'Busca un centro pediátrico y comparte la documentación clínica y de vacunación pertinente.',
        'Pregunta a tu cantón si puedes solicitar una reducción de primas.',
        'Confirma con la aseguradora el modelo elegido y cómo pedir atención.',
      ]),
      section('Crea una rutina y una red de apoyo', ['Una llegada no se resuelve en un día. Reserva tiempo para conocer el barrio, hablar con la escuela y organizar actividades que tus hijos puedan disfrutar. Los grupos de la comunidad pueden ayudar a compartir experiencias sin sustituir la información del colegio o de las autoridades.'], [], 'Tu siguiente paso: contacta con migración y con la autoridad escolar de tu futuro domicilio. Lleva sus respuestas a un calendario familiar con fechas, documentos y responsables.'),
    ],
    sources:[
      source('ch.ch · Permisos de residencia', 'https://www.ch.ch/en/foreign-nationals-in-switzerland/entry-and-stay-in-switzerland/permits-for-living-in-switzerland/'),
      source('EDK · Organización de la escolarización obligatoria', 'https://www.edk.ch/en/education-system-ch/compulsory/organisation-of-compulsory-education'),
      source('Confederación · Escolarización obligatoria', 'https://www.aboutswitzerland.eda.admin.ch/en/compulsory-education'),
      source('BAG · Obligación de asegurarse al llegar a Suiza', 'https://www.bag.admin.ch/en/health-insurance-requirement-to-obtain-insurance-for-persons-resident-in-switzerland'),
      source('BAG · Primas y ayudas cantonales', 'https://www.bag.admin.ch/en/premiums-and-costs-answers-to-frequently-asked-questions'),
    ],
  },
}
