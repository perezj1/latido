import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LABOR_VISIBILITY,
  buildLaborProfileRecord,
  getAgencyBySlug,
  getLaborProfiles,
  getLatestLaborProfile,
  saveLaborProfile,
  submitLaborProfile,
} from '../lib/laborProfile'
import { PP } from '../lib/theme'
import { Btn, StickyFormActions } from '../components/UI'
import '../styles/latido-workcheck.css'

const STEPS = [
  { id:'datos', label:'Datos', description:'Contacto, puesto que quieres hacer y autorización para compartir el perfil.' },
  { id:'disponibilidad', label:'Disponibilidad', description:'Cuándo puedes empezar, desde dónde sales y hasta dónde puedes desplazarte.' },
  { id:'experiencia', label:'Experiencia', description:'Tipo de obra, años, autonomía y límites reales.' },
  { id:'tareas', label:'Tareas', description:'Nivel real en tareas comunes de obra, de 1 a 4.' },
  { id:'tecnica', label:'Técnica', description:'Preguntas técnicas según el puesto elegido y seguridad básica general.' },
  { id:'equipo', label:'Equipo', description:'Equipo de protección, herramientas, idiomas y referencias.' },
  { id:'resumen', label:'Resumen', description:'Perfil preparado para que una temporera decida si llamar.' },
]

const OPTIONS = {
  location:['En Suiza', 'En España', 'Otro país de Europa', 'Fuera de Europa'],
  legal:['Sí', 'No', 'No lo sé', 'En proceso', 'UE/EFTA', 'Permiso suizo', 'Necesito orientación'],
  permitType:['Suizo/a', 'Permiso C', 'Permiso B', 'Permiso L', 'Permiso G', 'UE/EFTA', 'En trámite', 'No tengo permiso', 'No lo sé'],
  permitValidity:['Más de 6 meses', '3 a 6 meses', 'Menos de 3 meses', 'Caducado', 'En trámite', 'No aplica'],
  preferredLanguage:['Español', 'Alemán', 'Inglés', 'Francés', 'Italiano', 'Portugués'],
  start:['Inmediatamente', 'Menos de 1 semana', '2 semanas', '1 mes', 'No lo sé'],
  workload:['100%', '80-100%', '50-80%', 'Menos de 50%', 'Por horas', 'No lo sé'],
  shifts:['Mañana', 'Tarde', 'Noche', 'Fines de semana', 'Horas extra', 'Turnos partidos'],
  workTypes:['Temporal', 'Fijo', 'Jornada completa', 'Media jornada', 'Por horas', 'Turnos', 'Fines de semana'],
  cantons:['Zürich', 'Bern', 'Luzern', 'Uri', 'Schwyz', 'Obwalden', 'Nidwalden', 'Glarus', 'Zug', 'Fribourg', 'Solothurn', 'Basel-Stadt', 'Basel-Landschaft', 'Schaffhausen', 'Appenzell AR', 'Appenzell AI', 'St. Gallen', 'Graubünden', 'Aargau', 'Thurgau', 'Ticino', 'Vaud', 'Valais', 'Neuchâtel', 'Genève', 'Jura'],
  mobilityScope:['Solo mi ciudad o zona', 'Todo mi cantón', 'Mi cantón y cantones cercanos', 'Toda Suiza'],
  transport:['Coche propio', 'Transporte público', 'Puedo conseguir transporte', 'No tengo transporte claro'],
  license:['Sí', 'No', 'En trámite'],
  commute:['Hasta 30 minutos', 'Hasta 1 hora', 'Más de 1 hora si compensa', 'Puedo desplazarme varios días'],
  role:[
    'Peón',
    'Peón avanzado',
    'Ayudante encofrador',
    'Encofrador',
    'Albañil',
    'Ferrallista',
    'Pintor',
    'Yesero / pladur',
    'Electricista',
    'Carpintero',
    'Jardinero',
    'Demolición',
    'Otro',
  ],
  experience:['Menos de 1 año', '1 a 2 años', '3 a 5 años', '6 a 10 años', 'Más de 10 años'],
  swissExperience:['Sí', 'No, pero tengo experiencia fuera de Suiza', 'No, estoy empezando en construcción'],
  siteType:['Obra nueva', 'Reforma', 'Vivienda', 'Industrial', 'Carretera / exterior', 'Demolición', 'No he trabajado aún'],
  workedWith:['Albañiles', 'Encofradores', 'Ferrallistas', 'Pintores', 'Pladuristas', 'Demolición', 'Solo apoyo general'],
  autonomy:['Necesito encargado cerca', 'Puedo trabajar con instrucciones', 'Puedo estar varias horas solo', 'Depende de la tarea'],
  physicalLoad:['Condición óptima / sin limitaciones', 'Carga moderada y estar de pie', 'Solo carga ligera', 'Depende del trabajo', 'Tengo una limitación'],
  weatherWork:['Exterior con frío, lluvia o calor', 'Prefiero interior', 'Depende del trabajo', 'No'],
  reliability:['Aviso antes de la hora de entrada', 'Aviso a la temporera/agencia', 'Busco alternativa de transporte', 'Llego y explico al llegar'],
  lastJobReason:['Fin de obra o contrato', 'Cambio de empresa', 'Temporada terminada', 'Falta de trabajo', 'Todavía trabajo allí', 'Prefiero explicarlo en llamada'],
  limits:['Herramientas eléctricas', 'Trabajo en altura', 'Encofrado', 'Ferralla', 'Pladur', 'Alemán', 'Transporte', 'Permiso', 'Necesito supervisión'],
  ppe:['Botas', 'Casco', 'Chaleco', 'Guantes', 'Gafas', 'Protección auditiva', 'Mascarilla', 'No tengo equipo'],
  ownTools:['No', 'Básicas', 'Sí'],
  tools:['Taladro', 'Radial', 'Martillo demoledor', 'Nivel', 'Nivel láser', 'Sierra', 'Hormigonera', 'Herramientas de albañilería', 'Pintura', 'Encofrado'],
  certificates:['SUVA / seguridad', 'Carretilla', 'Plataforma elevadora', 'Trabajo en altura', 'Grúa / señalista', 'Diploma de oficio', 'Primeros auxilios', 'Ninguno'],
  languages:['Español', 'Alemán', 'Suizo alemán', 'Francés', 'Italiano', 'Inglés', 'Portugués'],
  german:['Nada', 'Palabras básicas', 'Órdenes simples', 'Hablo algo en obra', 'Medio', 'Bueno'],
  communication:['Sí', 'Con traductor', 'Solo en español', 'No'],
  references:['Sí', 'Puedo conseguirlas', 'No', 'Prefiero no compartir todavía'],
  referencePermission:['Sí, pueden contactar', 'Primero quiero que me avisen', 'Todavía no', 'No tengo referencias'],
  salaryExpectation:['Según convenio / negociable', 'CHF 24-28/h', 'CHF 29-33/h', 'CHF 34+/h', 'Mensual a negociar', 'No lo sé'],
}

const TASK_LEVELS = [
  { id:'seen', label:'1', text:'Lo he visto', score:1 },
  { id:'helped', label:'2', text:'He ayudado', score:2 },
  { id:'guided', label:'3', text:'Lo hago con instrucciones', score:3 },
  { id:'alone', label:'4', text:'Lo hago solo', score:4 },
]

const TASKS = [
  { id:'load', label:'Cargar material', group:'base' },
  { id:'organize', label:'Ordenar material', group:'base' },
  { id:'prepareZone', label:'Preparar zona', group:'base' },
  { id:'clean', label:'Limpiar obra', group:'base' },
  { id:'rubble', label:'Retirar escombros', group:'base' },
  { id:'waste', label:'Separar residuos', group:'base' },
  { id:'mortar', label:'Preparar mortero', group:'technical' },
  { id:'cement', label:'Preparar cemento', group:'technical' },
  { id:'concretePour', label:'Ayudar a hormigonar', group:'technical' },
  { id:'trenches', label:'Preparar zanjas', group:'technical' },
  { id:'qualityCheck', label:'Revisar medidas y orden', group:'technical' },
  { id:'measureCut', label:'Medir y cortar', group:'technical' },
  { id:'masonHelp', label:'Ayudar albañil', group:'specialty' },
  { id:'formworkHelp', label:'Ayudar encofrador', group:'specialty' },
  { id:'rebarHelp', label:'Ayudar ferrallista', group:'specialty' },
  { id:'drywallHelp', label:'Ayudar pladur', group:'specialty' },
  { id:'height', label:'Trabajo en altura', group:'risk' },
]

const TECHNICAL_QUESTIONS = {
  peon:[
    {
      id:'techPeonFirstDay',
      title:'Primer día como peón en obra',
      hint:'Qué haces para integrarte en el equipo el primer día.',
      multi:true,
      options:[
        { id:'askTask', label:'Pregunto la prioridad al encargado', impact:'strong' },
        { id:'materials', label:'Preparo material y despejo paso', impact:'strong' },
        { id:'clean', label:'Mantengo la zona limpia y accesible', impact:'strong' },
        { id:'watch', label:'Miro cómo trabajan y espero', impact:'weak' },
        { id:'random', label:'Empiezo por lo que vea más fácil', impact:'danger' },
      ],
    },
    {
      id:'techPeonMortar',
      title:'Preparar mortero sencillo',
      options:[
        { id:'measure', label:'Respeto proporción, mezclo homogéneo y ajusto poco a poco', impact:'strong' },
        { id:'moreWater', label:'Si está duro, añado bastante agua para trabajarlo rápido', impact:'danger' },
        { id:'byEye', label:'Lo hago a ojo hasta que parezca manejable', impact:'weak' },
        { id:'ask', label:'Pido la mezcla indicada si no la conozco', impact:'strong' },
      ],
    },
    {
      id:'techPeonLevel',
      title:'Te piden ayudar a nivelar o medir',
      options:[
        { id:'markClear', label:'Confirmo referencia, mido dos veces y marco claro', impact:'strong' },
        { id:'oneMeasure', label:'Mido una vez y corto para avanzar', impact:'danger' },
        { id:'askRef', label:'Pregunto cuál es el punto de referencia', impact:'strong' },
        { id:'followOld', label:'Uso la marca vieja aunque no esté confirmada', impact:'weak' },
      ],
    },
  ],
  encofrador:[
    {
      id:'techFormworkTools',
      title:'Primer día ayudando a encofrar',
      hint:'Qué herramientas y material prepararías primero.',
      multi:true,
      options:[
        { id:'panels', label:'Paneles, puntales, mordazas y aceite desencofrante', impact:'strong' },
        { id:'level', label:'Metro, nivel, plomada o láser', impact:'strong' },
        { id:'cleanPanels', label:'Reviso que los paneles estén limpios y sin restos', impact:'strong' },
        { id:'onlyHammer', label:'Solo martillo y clavos', impact:'weak' },
        { id:'cutFirst', label:'Corto piezas antes de confirmar medidas', impact:'danger' },
      ],
    },
    {
      id:'techFormworkCheck',
      title:'Antes de hormigonar un encofrado',
      options:[
        { id:'alignTight', label:'Compruebo alineación, plomo, cierres y apuntalamiento', impact:'strong' },
        { id:'visual', label:'Si visualmente se ve recto, está listo', impact:'weak' },
        { id:'pourFix', label:'Se corrige mientras entra el hormigón', impact:'danger' },
        { id:'askOfficial', label:'Pido revisión del oficial antes de hormigonar', impact:'strong' },
      ],
    },
    {
      id:'techFormworkConcretePressure',
      title:'Por qué se refuerza bien un encofrado',
      options:[
        { id:'pressure', label:'Porque el hormigón fresco empuja y puede abrir el encofrado', impact:'strong' },
        { id:'dry', label:'Porque el hormigón se seca más rápido', impact:'weak' },
        { id:'looks', label:'Para que se vea más profesional', impact:'weak' },
        { id:'noNeed', label:'Si el panel pesa bastante no hace falta mucho refuerzo', impact:'danger' },
      ],
    },
  ],
  yesero:[
    {
      id:'techGypsumMix',
      title:'Mezcla correcta de yeso o pasta',
      options:[
        { id:'waterPowderRest', label:'Agua primero, espolvorear material, dejar reposar y mezclar', impact:'strong' },
        { id:'powderWater', label:'Material primero y luego agua poco a poco', impact:'weak' },
        { id:'fastMix', label:'Mezclar fuerte desde el primer segundo', impact:'danger' },
        { id:'moreWaterLater', label:'Si endurece, añadir agua para recuperarlo', impact:'danger' },
      ],
    },
    {
      id:'techGypsumRest',
      title:'Por qué se deja reposar la mezcla',
      options:[
        { id:'hydrate', label:'Para que el material se hidrate y no queden grumos secos', impact:'strong' },
        { id:'color', label:'Para que coja mejor color', impact:'weak' },
        { id:'optional', label:'No hace falta si tienes prisa', impact:'danger' },
        { id:'depends', label:'Depende del producto y la ficha técnica', impact:'strong' },
      ],
    },
    {
      id:'techGypsumSurface',
      title:'Antes de aplicar yeso en una pared',
      options:[
        { id:'cleanPrime', label:'Reviso soporte limpio, firme, absorción y puente si hace falta', impact:'strong' },
        { id:'wetAll', label:'Mojar mucho siempre para que agarre', impact:'weak' },
        { id:'applyDirect', label:'Aplicar directo si la pared parece seca', impact:'danger' },
        { id:'askProduct', label:'Confirmo producto adecuado para el soporte', impact:'strong' },
      ],
    },
  ],
  pintor:[
    {
      id:'techPaintSurface',
      title:'Pintar una pared interior con manchas',
      options:[
        { id:'cleanPrime', label:'Limpio, lijo si hace falta y uso imprimación o bloqueador', impact:'strong' },
        { id:'twoCoats', label:'Dos manos de pintura normal lo cubren todo', impact:'weak' },
        { id:'paintWet', label:'Pinto encima aunque esté húmedo si corre prisa', impact:'danger' },
        { id:'checkCause', label:'Busco causa de humedad o grasa antes de pintar', impact:'strong' },
      ],
    },
    {
      id:'techPaintChoice',
      title:'Pintura adecuada para baño o zona húmeda',
      options:[
        { id:'washableAntiMold', label:'Pintura lavable adecuada para humedad y buena preparación', impact:'strong' },
        { id:'cheapInterior', label:'Cualquier pintura interior sirve si se dan dos manos', impact:'danger' },
        { id:'askSpec', label:'Reviso ficha o pregunto producto recomendado', impact:'strong' },
        { id:'thick', label:'Pintura más espesa para tapar humedad', impact:'weak' },
      ],
    },
    {
      id:'techPaintOrder',
      title:'Orden correcto antes de pintar',
      multi:true,
      options:[
        { id:'protect', label:'Proteger suelo, marcos y enchufes', impact:'strong' },
        { id:'repair', label:'Tapar agujeros, lijar y limpiar polvo', impact:'strong' },
        { id:'primer', label:'Imprimar si el soporte lo necesita', impact:'strong' },
        { id:'paintFirst', label:'Pintar rápido y limpiar salpicaduras después', impact:'danger' },
      ],
    },
  ],
  electricista:[
    {
      id:'techElectricFirst',
      title:'Antes de tocar una instalación eléctrica',
      options:[
        { id:'isolateTest', label:'Cortar, bloquear si procede y comprobar ausencia de tensión', impact:'strong' },
        { id:'glovesOnly', label:'Con guantes es suficiente para revisar', impact:'danger' },
        { id:'askPlan', label:'Pido plano/instrucción y confirmo circuito', impact:'strong' },
        { id:'quickLook', label:'Miro rápido si hay corriente con cuidado', impact:'danger' },
      ],
    },
    {
      id:'techElectricTools',
      title:'Herramientas básicas para rozas, tubo y cableado',
      multi:true,
      options:[
        { id:'tester', label:'Tester/comprobador adecuado', impact:'strong' },
        { id:'puller', label:'Guía pasacables y lubricante si hace falta', impact:'strong' },
        { id:'levels', label:'Metro, nivel y marcaje ordenado', impact:'strong' },
        { id:'randomCable', label:'Cablear según colores que haya disponibles', impact:'danger' },
      ],
    },
    {
      id:'techElectricConnections',
      title:'Una conexión queda floja en una caja',
      options:[
        { id:'redo', label:'La rehago con borne adecuado y compruebo apriete', impact:'strong' },
        { id:'tape', label:'La encinto bien para que no se mueva', impact:'danger' },
        { id:'leave', label:'Si funciona, se deja', impact:'danger' },
        { id:'ask', label:'Pido revisión si no estoy autorizado', impact:'strong' },
      ],
    },
  ],
  carpintero:[
    {
      id:'techCarpMeasure',
      title:'Antes de cortar madera o tablero',
      options:[
        { id:'measureTwice', label:'Confirmo medida, escuadra, sentido y margen de corte', impact:'strong' },
        { id:'cutDirect', label:'Corto la medida exacta a la primera', impact:'danger' },
        { id:'markWaste', label:'Marco lado de desperdicio y reviso apoyo', impact:'strong' },
        { id:'eye', label:'Ajusto a ojo si el corte es pequeño', impact:'weak' },
      ],
    },
    {
      id:'techCarpFixing',
      title:'Elegir fijación para una pieza pesada',
      options:[
        { id:'support', label:'Según soporte, carga, taco/tornillo adecuado y puntos de fijación', impact:'strong' },
        { id:'longScrew', label:'Tornillo más largo siempre aguanta más', impact:'weak' },
        { id:'glue', label:'Cola fuerte y algún tornillo vale', impact:'danger' },
        { id:'askLoad', label:'Pregunto peso y uso antes de fijar', impact:'strong' },
      ],
    },
    {
      id:'techCarpFinish',
      title:'Acabado antes de barnizar o pintar madera',
      options:[
        { id:'sandDust', label:'Lijar con grano adecuado, limpiar polvo y probar producto', impact:'strong' },
        { id:'paintDirect', label:'Pintar directo si la madera está nueva', impact:'weak' },
        { id:'wet', label:'Humedecer mucho para que agarre', impact:'danger' },
        { id:'primer', label:'Usar imprimación si el producto lo pide', impact:'strong' },
      ],
    },
  ],
  jardinero:[
    {
      id:'techGardenPlant',
      title:'Plantar arbusto o planta nueva',
      options:[
        { id:'holeSoilWater', label:'Agujero adecuado, mejorar tierra si hace falta, plantar y regar', impact:'strong' },
        { id:'samePot', label:'Hacer agujero del tamaño justo del tiesto', impact:'weak' },
        { id:'fertilizeStrong', label:'Mucho abono al principio para que crezca rápido', impact:'danger' },
        { id:'checkSun', label:'Reviso sol, suelo y distancia antes de plantar', impact:'strong' },
      ],
    },
    {
      id:'techGardenPrune',
      title:'Antes de podar',
      options:[
        { id:'seasonTool', label:'Identifico planta, época, objetivo y herramienta limpia', impact:'strong' },
        { id:'cutAll', label:'Cortar bastante para que rebrote fuerte', impact:'danger' },
        { id:'shapeOnly', label:'Solo dar forma visual', impact:'weak' },
        { id:'ask', label:'Pregunto si no conozco la especie', impact:'strong' },
      ],
    },
    {
      id:'techGardenMachine',
      title:'Uso de desbrozadora o cortacésped',
      options:[
        { id:'inspectArea', label:'Reviso zona, piedras, cable, protecciones y máquina', impact:'strong' },
        { id:'fast', label:'Empiezo rápido y aparto obstáculos al pasar', impact:'danger' },
        { id:'height', label:'Ajusto altura según césped y trabajo pedido', impact:'strong' },
        { id:'wet', label:'Corto igual aunque esté muy mojado', impact:'weak' },
      ],
    },
  ],
}

const ROLE_QUESTION_KEYS = [
  ['Encofrador', 'encofrador'],
  ['Ayudante encofrador', 'encofrador'],
  ['Pintor', 'pintor'],
  ['Yesero / pladur', 'yesero'],
  ['Pladur / yeso', 'yesero'],
  ['Electricista', 'electricista'],
  ['Carpintero', 'carpintero'],
  ['Jardinero', 'jardinero'],
]

const SAFETY_QUESTIONS = [
  {
    id:'safetyUnknownTool',
    title:'Te piden usar una herramienta o máquina que no dominas',
    options:[
      { id:'ask', label:'Aviso y pido explicación antes de usarla', impact:'strong' },
      { id:'delegate', label:'Pido que la use alguien cualificado', impact:'strong' },
      { id:'try', label:'La pruebo despacio para ver si puedo', impact:'danger' },
      { id:'hide', label:'Intento hacerlo sin molestar al equipo', impact:'danger' },
    ],
  },
  {
    id:'safetyRiskZone',
    title:'Ves una zona con hueco, cable o material mal colocado',
    options:[
      { id:'warn', label:'Aviso y evito que otros pasen por ahí', impact:'strong' },
      { id:'fixIfSafe', label:'Corrijo solo si es seguro y lo puedo hacer bien', impact:'strong' },
      { id:'continue', label:'Lo rodeo con cuidado y sigo con mi tarea', impact:'danger' },
      { id:'notMine', label:'Espero a que lo arregle quien corresponda', impact:'weak' },
    ],
  },
  {
    id:'safetyDamagedTool',
    title:'Una herramienta eléctrica tiene cable o protección dañada',
    options:[
      { id:'warn', label:'La aparto, no la uso y aviso', impact:'strong' },
      { id:'use', label:'La uso solo si parece funcionar bien', impact:'danger' },
      { id:'tape', label:'La arreglo provisionalmente y sigo', impact:'danger' },
      { id:'other', label:'Sigo con otra tarea y la dejo aparte', impact:'weak' },
    ],
  },
]

const INITIAL_FORM = {
  truth:false,
  consent:false,
  name:'',
  phone:'',
  email:'',
  location:'',
  city:'',
  legal:'',
  permitType:'',
  permitValidity:'',
  preferredLanguage:'Español',
  start:'',
  workload:'',
  shifts:[],
  workTypes:[],
  homeCanton:'',
  mobilityScope:'',
  nearbyCantons:[],
  transport:'',
  license:'',
  commute:'',
  role:'',
  experience:'',
  swissExperience:'',
  siteType:'',
  workedWith:[],
  autonomy:'',
  physicalLoad:'',
  weatherWork:'',
  reliability:'',
  lastJobReason:'',
  limits:[],
  tasks:Object.fromEntries(TASKS.map(task => [task.id, ''])),
  situations:{},
  ppe:[],
  ownTools:'',
  tools:[],
  certificates:[],
  languages:['Español'],
  german:'',
  communication:'',
  references:'',
  referencePermission:'',
  salaryExpectation:'',
  shortNote:'',
}

const CLASSIFICATION_COPY = {
  basic:{
    profile:'Peón básico',
    status:'Solo con supervisión',
    recommendation:'Apto para tareas básicas de apoyo, carga, limpieza de obra y trabajos bajo supervisión.',
  },
  advanced:{
    profile:'Peón avanzado',
    status:'Apto con reservas',
    recommendation:'Apto para apoyo en obra, preparación de material, limpieza, organización, ayuda a oficiales y tareas con supervisión ligera.',
  },
  specialist:{
    profile:'Ayudante especializado',
    status:'Apto',
    recommendation:'Apto para apoyo especializado según oficio. No enviarlo como oficial autónomo sin confirmación adicional.',
  },
  officialUnproven:{
    profile:'Oficial no demostrado',
    status:'Apto con reservas',
    recommendation:'No enviarlo directamente como oficial. Recomendar entrevista técnica o prueba práctica antes.',
  },
  notDemonstrated:{
    profile:'No suficientemente demostrado',
    status:'No suficientemente demostrado',
    recommendation:'No enviar como perfil cualificado. Puede servir para tareas muy básicas solo si la empresa acepta formar y supervisar.',
  },
  notRecommended:{
    profile:'No recomendable para obra',
    status:'No recomendable',
    recommendation:'No recomendar para obra hasta completar formación básica de seguridad y demostrar mejor criterio.',
  },
  notReadyLegal:{
    profile:'Permiso pendiente',
    status:'No enviable todavía',
    recommendation:'No enviar a cliente hasta aclarar permiso, derecho a trabajar y fecha de validez.',
  },
}

function getTaskScore(value) {
  return TASK_LEVELS.find(level => level.id === value)?.score ?? -1
}

function getImpacts(selectedValues, questions) {
  const impacts = []
  questions.forEach(question => {
    const selected = question.multi
      ? selectedValues[question.id] || []
      : selectedValues[question.id] ? [selectedValues[question.id]] : []

    selected.forEach(optionId => {
      const option = question.options.find(item => item.id === optionId)
      if (option) impacts.push(option.impact)
    })
  })
  return impacts
}

function getRoleQuestionKey(role = '') {
  const match = ROLE_QUESTION_KEYS.find(([label]) => role === label)
  if (match) return match[1]
  if (['Albañil', 'Ferrallista', 'Demolición'].includes(role)) return 'peon'
  return 'peon'
}

function getTechnicalQuestions(role = '') {
  return TECHNICAL_QUESTIONS[getRoleQuestionKey(role)] || TECHNICAL_QUESTIONS.peon
}

function getEvaluationQuestions(role = '') {
  return [...getTechnicalQuestions(role), ...SAFETY_QUESTIONS]
}

function isLegalClear(value) {
  return ['Sí', 'UE/EFTA', 'Permiso suizo'].includes(value)
}

function hasWorkRight(form) {
  return isLegalClear(form.legal) || ['Suizo/a', 'Permiso C', 'Permiso B', 'Permiso L', 'Permiso G', 'UE/EFTA'].includes(form.permitType)
}

function hasLegalBlocker(form) {
  return form.legal === 'No' || form.permitType === 'No tengo permiso' || form.permitValidity === 'Caducado'
}

function getMobilityLabel(form) {
  if (!form.mobilityScope) return '-'
  if (form.mobilityScope === 'Toda Suiza') return 'Toda Suiza'
  if (form.mobilityScope === 'Solo mi ciudad o zona') {
    return form.city ? `Solo ${form.city}` : 'Solo ciudad o zona indicada'
  }
  if (form.mobilityScope === 'Todo mi cantón') {
    return form.homeCanton ? `Todo ${form.homeCanton}` : 'Todo mi cantón'
  }
  const base = form.homeCanton ? `Base ${form.homeCanton}` : 'Mi cantón'
  const nearby = form.nearbyCantons.length ? ` + ${form.nearbyCantons.join(', ')}` : ' + cantones cercanos'
  return `${base}${nearby}`
}

function hasBroadMobility(form) {
  return form.mobilityScope === 'Toda Suiza'
    || form.mobilityScope === 'Mi cantón y cantones cercanos'
    || form.commute === 'Más de 1 hora si compensa'
    || form.commute === 'Puedo desplazarme varios días'
}

function buildAnalysis(form) {
  const taskRows = TASKS.map(task => ({ ...task, score:getTaskScore(form.tasks[task.id]) }))
  const answeredTasks = []
  const canDo = []
  const notDemonstrated = []
  let baseCount = 0
  let specialtyCount = 0

  for (const task of taskRows) {
    if (task.score >= 0) answeredTasks.push(task)
    if (task.score >= 3) {
      canDo.push(task.label)
      if (task.group === 'base') baseCount += 1
      if (task.group === 'specialty') specialtyCount += 1
    } else {
      notDemonstrated.push(task.label)
    }
  }
  const toolCount = Array.isArray(form.tools) ? form.tools.length : 0
  const technicalQuestions = getTechnicalQuestions(form.role)
  const technicalImpacts = getImpacts(form.situations, technicalQuestions)
  const safetyImpacts = getImpacts(form.situations, SAFETY_QUESTIONS)
  const impacts = [...technicalImpacts, ...safetyImpacts]
  const strongCount = impacts.filter(impact => impact === 'strong').length
  const weakCount = impacts.filter(impact => impact === 'weak').length
  const dangerCount = impacts.filter(impact => impact === 'danger').length
  const technicalStrongCount = technicalImpacts.filter(impact => impact === 'strong').length
  const technicalWeakCount = technicalImpacts.filter(impact => impact === 'weak').length
  const technicalDangerCount = technicalImpacts.filter(impact => impact === 'danger').length
  const safetyStrongCount = safetyImpacts.filter(impact => impact === 'strong').length
  const safetyWeakCount = safetyImpacts.filter(impact => impact === 'weak').length
  const safetyDangerCount = safetyImpacts.filter(impact => impact === 'danger').length
  const declaresOfficial = ['Encofrador', 'Albañil', 'Ferrallista', 'Pintor', 'Yesero / pladur', 'Pladur / yeso', 'Electricista', 'Carpintero', 'Jardinero'].includes(form.role)
  const hasSpecialistEvidence = specialtyCount >= 2 || technicalStrongCount >= 2
  const hasToolEvidence = toolCount >= 2 || technicalStrongCount >= 2
  const certificateCount = (form.certificates || []).filter(item => item !== 'Ninguno').length
  const flexibleShiftCount = (form.shifts || []).filter(item => ['Mañana', 'Tarde', 'Noche', 'Fines de semana', 'Horas extra'].includes(item)).length
  const completed = getCompletion(form)

  let key = 'basic'
  if (hasLegalBlocker(form)) {
    key = 'notReadyLegal'
  } else if (safetyDangerCount >= 2 || technicalDangerCount >= 3 || form.situations.safetyUnknownTool === 'try' || form.situations.safetyDamagedTool === 'use') {
    key = 'notRecommended'
  } else if (completed < 45 || answeredTasks.length < 8 || !form.role || !form.experience) {
    key = 'notDemonstrated'
  } else if (declaresOfficial && !hasSpecialistEvidence) {
    key = 'officialUnproven'
  } else if (declaresOfficial && hasSpecialistEvidence && hasToolEvidence && technicalDangerCount === 0 && safetyDangerCount === 0) {
    key = 'specialist'
  } else if (baseCount >= 5 && technicalStrongCount >= 1 && safetyDangerCount <= 1) {
    key = 'advanced'
  }

  const strengths = []
  if (hasWorkRight(form)) strengths.push('Permiso o derecho a trabajar indicado')
  if (form.permitValidity === 'Más de 6 meses') strengths.push('Permiso con validez suficiente')
  if (form.start === 'Inmediatamente') strengths.push('Disponible inmediatamente')
  if (['100%', '80-100%'].includes(form.workload)) strengths.push('Alta disponibilidad de porcentaje')
  if (flexibleShiftCount >= 3) strengths.push('Buena flexibilidad horaria')
  if (form.transport === 'Coche propio') strengths.push('Tiene coche propio')
  if (form.license === 'Sí') strengths.push('Tiene carnet de conducir')
  if (hasBroadMobility(form)) strengths.push('Buena movilidad')
  if (form.physicalLoad === 'Condición óptima / sin limitaciones') strengths.push('Condición física óptima para obra')
  if (form.physicalLoad === 'Carga moderada y estar de pie') strengths.push('Puede asumir carga física moderada')
  if (form.weatherWork === 'Exterior con frío, lluvia o calor') strengths.push('Acepta trabajo exterior con clima variable')
  if (form.reliability === 'Aviso antes de la hora de entrada') strengths.push('Buen criterio si hay retraso')
  if (form.ppe.includes('Botas')) strengths.push('Tiene botas de seguridad')
  if (form.ppe.length >= 4 && !form.ppe.includes('No tengo equipo')) strengths.push('Equipo de protección bastante completo')
  if (certificateCount > 0) strengths.push(`Certificados o cursos: ${form.certificates.filter(item => item !== 'Ninguno').slice(0, 3).join(', ')}`)
  if (form.swissExperience === 'Sí') strengths.push('Tiene experiencia previa en Suiza')
  if (['Órdenes simples', 'Hablo algo en obra', 'Medio', 'Bueno'].includes(form.german)) strengths.push('Puede entender instrucciones básicas')
  if (form.communication === 'Sí' || form.communication === 'Con traductor') strengths.push('Puede comunicar problemas al encargado')
  if (form.references === 'Sí' || form.references === 'Puedo conseguirlas') strengths.push('Puede aportar referencias')
  if (form.referencePermission === 'Sí, pueden contactar') strengths.push('Autoriza contactar referencias')
  if (technicalStrongCount >= 2) strengths.push('Responde bien a preguntas técnicas del puesto')
  if (safetyStrongCount >= 2 && safetyDangerCount === 0) strengths.push('Conoce seguridad básica de obra')
  if (canDo.length >= 8) strengths.push('Declara varias tareas listas para el primer día')
  if (form.autonomy === 'Puedo estar varias horas solo') strengths.push('Declara autonomía en tareas conocidas')

  const risks = []
  if (!hasWorkRight(form)) risks.push('Permiso o derecho a trabajar pendiente de aclarar')
  if (['Menos de 3 meses', 'Caducado', 'En trámite'].includes(form.permitValidity)) risks.push(`Validez de permiso: ${form.permitValidity}`)
  if (!form.workload || ['Menos de 50%', 'No lo sé'].includes(form.workload)) risks.push('Disponibilidad de porcentaje limitada o no clara')
  if (!(form.shifts || []).length) risks.push('Horarios disponibles no indicados')
  if (!form.homeCanton && form.mobilityScope && form.mobilityScope !== 'Toda Suiza') risks.push('Cantón base no indicado')
  if (form.mobilityScope === 'Mi cantón y cantones cercanos' && !form.nearbyCantons.length) risks.push('No ha indicado qué cantones cercanos acepta')
  if (form.transport && form.transport !== 'Coche propio') risks.push('Coche propio no confirmado')
  if (form.license && form.license !== 'Sí') risks.push('Carnet de conducir no confirmado')
  if (['Solo carga ligera', 'Tengo una limitación'].includes(form.physicalLoad)) risks.push(`Condición física: ${form.physicalLoad}`)
  if (['Prefiero interior', 'No'].includes(form.weatherWork)) risks.push(`Trabajo exterior: ${form.weatherWork}`)
  if (form.reliability === 'Llego y explico al llegar') risks.push('Si hay retraso, no avisa antes de la hora')
  if (form.lastJobReason === 'Prefiero explicarlo en llamada') risks.push('Motivo del último trabajo pendiente de aclarar')
  if (!form.ppe.includes('Botas')) risks.push('Botas de seguridad no confirmadas')
  if (form.ppe.includes('No tengo equipo') || form.ppe.length < 3) risks.push('Equipo de protección incompleto')
  if (form.swissExperience && form.swissExperience !== 'Sí') risks.push('No demuestra experiencia previa en Suiza')
  if (form.german === 'Nada') risks.push('No habla alemán')
  if (safetyDangerCount > 0) risks.push(`${safetyDangerCount} respuesta(s) de riesgo en seguridad básica`)
  if (technicalDangerCount > 0) risks.push(`${technicalDangerCount} respuesta(s) técnica(s) de riesgo`)
  if (technicalWeakCount > 1) risks.push('Algunas respuestas técnicas necesitan validación')
  if (weakCount > 2 && technicalWeakCount <= 1) risks.push('Algunas respuestas muestran poca iniciativa')
  if (declaresOfficial && !hasSpecialistEvidence) risks.push('Declara oficio, pero faltan respuestas técnicas o tareas especializadas demostradas')
  if (form.references === 'No' || form.references === 'Prefiero no compartir todavía') risks.push('Referencias no disponibles ahora')
  if (['Todavía no', 'No tengo referencias'].includes(form.referencePermission)) risks.push('No autoriza referencias por ahora')
  if (form.salaryExpectation === 'CHF 34+/h') risks.push('Expectativa salarial alta; confirmar con convenio')
  if (form.limits.length) risks.push(`Límites declarados: ${form.limits.slice(0, 4).join(', ')}`)

  return {
    ...CLASSIFICATION_COPY[key],
    key,
    canDo,
    notDemonstrated,
    strengths:[...new Set(strengths)].slice(0, 8),
    risks:[...new Set(risks)].slice(0, 8),
    strongCount,
    weakCount,
    dangerCount,
    technicalStrongCount,
    technicalWeakCount,
    technicalDangerCount,
    safetyStrongCount,
    safetyWeakCount,
    safetyDangerCount,
    completion:completed,
  }
}

function getCompletion(form) {
  const required = [
    form.truth,
    form.consent,
    form.name,
    form.phone,
    form.location,
    form.city,
    form.legal,
    form.permitType,
    form.permitValidity,
    form.start,
    form.workload,
    form.shifts.length,
    form.homeCanton || form.mobilityScope === 'Toda Suiza',
    form.mobilityScope,
    form.transport,
    form.role,
    form.experience,
    form.swissExperience,
    form.siteType,
    form.autonomy,
    form.physicalLoad,
    form.weatherWork,
    form.reliability,
    form.ppe.length,
    form.certificates.length,
    form.german,
    form.communication,
    form.references,
    form.referencePermission,
    form.salaryExpectation,
  ]
  const taskCount = Object.values(form.tasks).filter(Boolean).length
  const evaluationQuestions = getEvaluationQuestions(form.role)
  const evaluationQuestionCount = evaluationQuestions.length
  const situationCount = evaluationQuestions.filter(question => {
    const value = form.situations[question.id]
    return Array.isArray(value) ? value.length : value
  }).length
  const base = required.filter(Boolean).length + Math.min(taskCount, 12) + Math.min(situationCount, evaluationQuestionCount)
  return Math.min(100, Math.round((base / (required.length + 12 + evaluationQuestionCount)) * 100))
}

function buildSummaryText(form, analysis) {
  return [
    'LATIDO PERFIL LABORAL',
    '',
    `Nombre: ${form.name || '-'}`,
    `Contacto: ${[form.phone, form.email].filter(Boolean).join(' / ') || '-'}`,
    `Puesto: ${form.role || '-'}`,
    `Ubicación: ${[form.location, form.city].filter(Boolean).join(' - ') || '-'}`,
    `Disponibilidad: ${form.start || '-'}`,
    `Perfil completado: ${analysis.completion}%`,
  ].filter(line => line !== '').join('\n')
}

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'LA'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
}

function StepHeader({ step }) {
  return (
    <div className="workcheck-stepper" aria-label="Pasos del formulario">
      <div className="workcheck-step-count">
        PASO {step + 1} DE {STEPS.length} · {STEPS[step]?.label}
      </div>
      <div className="workcheck-progress" aria-hidden="true">
        {STEPS.map((item, index) => (
          <span
            key={item.id}
            className={index <= step ? 'is-done' : ''}
          />
        ))}
      </div>
    </div>
  )
}

function Section({ eyebrow, title, children }) {
  return (
    <section className="workcheck-section">
      <p className="workcheck-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function FormCard({ title, children, className = '' }) {
  return (
    <div className={`workcheck-form-card ${className}`.trim()}>
      {title && <h3 className="workcheck-card-title">{title}</h3>}
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="workcheck-field">
      <span className="workcheck-field-label">{label}</span>
      {children}
    </label>
  )
}

function SelectField({ label, value, onChange, options, placeholder = 'Selecciona una opción' }) {
  return (
    <label className="workcheck-field">
      <span className="workcheck-field-label">{label}</span>
      <span className="workcheck-select-wrap">
        <select
          className="workcheck-select"
          value={value}
          onChange={event => onChange(event.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </span>
    </label>
  )
}

function MultiSelectAdd({ label, value, onChange, options, placeholder = 'Añadir opción' }) {
  const selected = value || []
  const available = options.filter(option => !selected.includes(option))

  return (
    <div className="workcheck-field">
      <span className="workcheck-field-label">{label}</span>
      <span className="workcheck-select-wrap">
        <select
          className="workcheck-select"
          value=""
          onChange={event => {
            const next = event.target.value
            if (!next) return
            onChange([...selected, next])
          }}
        >
          <option value="">{placeholder}</option>
          {available.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </span>
      {selected.length > 0 && (
        <div className="workcheck-chip-row">
          {selected.map(option => (
            <button
              key={option}
              type="button"
              className="workcheck-chip"
              onClick={() => onChange(selected.filter(item => item !== option))}
            >
              {option} ×
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ChoiceGroup({ options, value, onChange, multi = false, exclusiveOptions = [] }) {
  const selected = multi ? value || [] : [value]
  return (
    <>
      {multi && (
        <p className="workcheck-multi-hint">
          Puedes elegir más de una opción{selected.length ? ` · ${selected.length} seleccionada(s)` : ''}.
        </p>
      )}
      <div className="workcheck-choice-grid">
        {options.map(option => {
          const active = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              className={`workcheck-choice${active ? ' workcheck-choice--active' : ''}`}
              onClick={() => {
                if (!multi) {
                  onChange(option)
                  return
                }

                if (active) {
                  onChange(selected.filter(item => item !== option))
                  return
                }

                if (exclusiveOptions.includes(option)) {
                  onChange([option])
                  return
                }

                onChange([...selected.filter(item => !exclusiveOptions.includes(item)), option])
              }}
            >
              {option}
            </button>
          )
        })}
      </div>
    </>
  )
}

function TaskPicker({ task, value, onChange }) {
  return (
    <div className="workcheck-task-card">
      <p>{task.label}</p>
      <div>
        {TASK_LEVELS.map(level => (
          <button
            key={level.id}
            type="button"
            className={value === level.id ? 'workcheck-level workcheck-level--active' : 'workcheck-level'}
            onClick={() => onChange(value === level.id ? '' : level.id)}
          >
            {level.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function OptionGroup({ question, value, onChange }) {
  const selected = question.multi ? value || [] : [value]
  return (
    <div className="workcheck-situation">
      <h3>{question.title}</h3>
      {question.hint && <p>{question.hint}</p>}
      {question.multi && (
        <p className="workcheck-multi-hint">
          Puedes elegir más de una opción{selected.length ? ` · ${selected.length} seleccionada(s)` : ''}.
        </p>
      )}
      <div className="workcheck-option-list">
        {question.options.map(option => {
          const active = selected.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              className={`workcheck-option workcheck-option--${option.impact}${active ? ' workcheck-option--active' : ''}`}
              onClick={() => {
                if (!question.multi) {
                  onChange(option.id)
                  return
                }
                onChange(active ? selected.filter(item => item !== option.id) : [...selected, option.id])
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SummaryPanel({
  form,
  analysis,
  copied,
  copySummary,
  reset,
  className = '',
  targetAgency = null,
  visibility = 'private',
  onVisibilityChange,
  onSaveProfile,
  onSubmitProfile,
  savedMessage = '',
  submittedMessage = '',
  saving = false,
}) {
  const profilePreview = [
    { label:'Ubicación', value:[form.location, form.city].filter(Boolean).join(' - ') || '-' },
    { label:'Disponibilidad', value:form.start || '-' },
    { label:'Idioma', value:form.preferredLanguage || form.german || '-' },
    { label:'Movilidad', value:getMobilityLabel(form) },
  ]

  return (
    <aside className={`workcheck-summary ${className}`}>
      <div className="workcheck-summary-panel">
        <p className="workcheck-eyebrow">Resumen del trabajador</p>
        <h2>Tu Perfil Laboral</h2>
        <div className="workcheck-profile-preview">
          <div className="workcheck-avatar" aria-label="Foto de perfil">
            {getInitials(form.name)}
          </div>
          <div>
            <strong>{form.name || 'Tu nombre'}</strong>
            <span>{form.role || 'Puesto por completar'}</span>
          </div>
        </div>
        <div className="workcheck-scorebar" aria-label={`Formulario completado ${analysis.completion}%`}>
          <span style={{ width:`${analysis.completion}%` }} />
        </div>
        <div className="workcheck-completion">
          <strong>{analysis.completion}%</strong>
          <span>completado</span>
        </div>
        <div className="workcheck-preview-grid">
          {profilePreview.map(item => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <p className="workcheck-private-note">
          Las temporeras colaboradoras verán la ficha completa preparada por Latido cuando guardes o envíes el perfil.
        </p>
        {onVisibilityChange && (
          <div className="workcheck-privacy-box">
            <strong>Privacidad del Perfil Laboral</strong>
            {Object.values(LABOR_VISIBILITY).map(option => (
              <label key={option.id}>
                <input
                  type="radio"
                  name={`labor-visibility-${className || 'side'}`}
                  checked={visibility === option.id}
                  onChange={() => onVisibilityChange(option.id)}
                />
                <span>
                  <b>{option.label}</b>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        )}
        {targetAgency && (
          <div className="workcheck-target-box">
            <strong>Envio directo</strong>
            <span>Este perfil se puede enviar a {targetAgency.name} cuando confirmes los datos.</span>
          </div>
        )}
        {savedMessage && <div className="workcheck-success">{savedMessage}</div>}
        {submittedMessage && <div className="workcheck-success">{submittedMessage}</div>}
        <div className="workcheck-summary-actions">
          {onSaveProfile && (
            <button className="workcheck-button workcheck-button--primary" type="button" onClick={onSaveProfile} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </button>
          )}
          {targetAgency && onSubmitProfile && (
            <button className="workcheck-button workcheck-button--primary" type="button" onClick={onSubmitProfile} disabled={saving}>
              Enviar a {targetAgency.name}
            </button>
          )}
          <button className="workcheck-button workcheck-button--primary" type="button" onClick={copySummary}>
            {copied ? 'Copiado' : 'Copiar resumen'}
          </button>
          <Link className="workcheck-button" to="/perfil-laboral">Mi Perfil Laboral</Link>
          <button className="workcheck-button" type="button" onClick={reset}>Nuevo perfil</button>
        </div>
      </div>
    </aside>
  )
}

export default function WorkCheckConstruccion() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const targetAgency = getAgencyBySlug(searchParams.get('agency') || '')
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [copied, setCopied] = useState(false)
  const [visibility, setVisibility] = useState('private')
  const [savedMessage, setSavedMessage] = useState('')
  const [submittedMessage, setSubmittedMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const analysis = useMemo(() => buildAnalysis(form), [form])
  const summaryText = useMemo(() => buildSummaryText(form, analysis), [form, analysis])
  const isLastStep = step === STEPS.length - 1
  const editProfileId = searchParams.get('edit') || ''

  useEffect(() => {
    if (!editProfileId) return
    const profile = getLaborProfiles({ user, includeAll:true }).find(item => item.id === editProfileId)
    if (!profile?.form) return

    setForm({
      ...INITIAL_FORM,
      ...profile.form,
      tasks:{ ...INITIAL_FORM.tasks, ...(profile.form.tasks || {}) },
      situations:{ ...INITIAL_FORM.situations, ...(profile.form.situations || {}) },
      workTypes:profile.form.workTypes || [],
      shifts:profile.form.shifts || [],
      nearbyCantons:profile.form.nearbyCantons || [],
      workedWith:profile.form.workedWith || [],
      limits:profile.form.limits || [],
      ppe:profile.form.ppe || [],
      tools:profile.form.tools || [],
      certificates:profile.form.certificates || [],
      languages:profile.form.languages || [],
    })
    setVisibility(profile.visibility || 'private')
    setSavedMessage('Perfil cargado para actualizar.')
  }, [editProfileId, user])

  const setField = (key, value) => setForm(current => ({ ...current, [key]:value }))
  const setNested = (group, key, value) => setForm(current => ({
    ...current,
    [group]:{
      ...current[group],
      [key]:value,
    },
  }))
  const setMobilityScope = value => setForm(current => ({
    ...current,
    mobilityScope:value,
    nearbyCantons:value === 'Mi cantón y cantones cercanos' ? current.nearbyCantons : [],
  }))
  const setHomeCanton = value => setForm(current => ({
    ...current,
    homeCanton:value,
    nearbyCantons:current.nearbyCantons.filter(canton => canton !== value),
  }))
  const goToStep = next => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)))
    window.scrollTo({ top:0, left:0, behavior:'smooth' })
  }
  const reset = () => {
    setForm(INITIAL_FORM)
    setCopied(false)
    setSavedMessage('')
    setSubmittedMessage('')
    goToStep(0)
  }
  const copySummary = async () => {
    await navigator.clipboard?.writeText(summaryText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  const saveProfile = () => {
    setSaving(true)
    try {
      const previousProfile = editProfileId
        ? getLaborProfiles({ user, includeAll:true }).find(item => item.id === editProfileId)
        : getLatestLaborProfile({ user, sector:'construction' })
      const profile = buildLaborProfileRecord({
        form,
        analysis,
        user,
        sector:'construction',
        visibility,
        previousProfile,
      })
      const saved = saveLaborProfile(profile)
      setSavedMessage('Perfil Laboral guardado. Ya puedes verlo desde Mi Perfil Laboral.')
      return saved
    } finally {
      setSaving(false)
    }
  }
  const submitToAgency = () => {
    if (!targetAgency) return
    if (!form.truth || !form.consent || !form.name || !form.phone) {
      setSubmittedMessage('Completa nombre, WhatsApp y autorizaciones antes de enviar el perfil.')
      goToStep(0)
      return
    }

    const saved = saveProfile()
    submitLaborProfile({ profile:saved, agencySlug:targetAgency.slug, user })
    setSubmittedMessage(`Perfil Laboral enviado a ${targetAgency.name}. La temporera lo verá en su portal.`)
  }

  return (
    <div className="workcheck-page" style={{ fontFamily:PP }}>
      <style>{`
        .workcheck-page {
          min-height: 100vh;
          background: #eef4ff;
          color: #0f172a;
          padding: 18px 24px 112px;
        }
        .workcheck-shell {
          max-width: 1060px;
          margin: 0 auto;
        }
        .workcheck-top {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: center;
          text-align: center;
          background: linear-gradient(160deg, #1e40af 0%, #2563eb 58%, #60a5fa 100%);
          color: #fff;
          border-radius: 28px;
          padding: 24px;
          margin-bottom: 20px;
          box-shadow: 0 22px 48px rgba(37, 99, 235, .24);
        }
        .workcheck-top::after {
          content: '';
          position: absolute;
          inset: 0 0 0 auto;
          width: 48%;
          background: linear-gradient(135deg, rgba(255,255,255,.13), rgba(255,255,255,0));
          clip-path: polygon(22% 0, 100% 0, 100% 100%, 0 100%);
          pointer-events: none;
        }
        .workcheck-top > * {
          position: relative;
          z-index: 1;
        }
        .workcheck-brand {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: center;
          justify-content: center;
          min-width: 0;
        }
        .workcheck-logo {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(255,255,255,.18);
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.26);
          box-shadow: none;
          flex-shrink: 0;
        }
        .workcheck-brand h1 {
          color: #fff;
          font-size: clamp(30px, 5.5vw, 44px);
          line-height: 1.12;
          margin: 0 0 6px;
          letter-spacing: 0;
        }
        .workcheck-brand p {
          color: rgba(255,255,255,.86);
          font-size: 14px;
          line-height: 1.45;
          margin: 0;
          max-width: 620px;
        }
        .workcheck-hero-meta {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
        }
        .workcheck-hero-meta span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 9px;
          border-radius: 999px;
          background: rgba(255,255,255,.14);
          border: 1px solid rgba(255,255,255,.24);
          color: #fff;
          font-size: 10.5px;
          font-weight: 800;
          white-space: nowrap;
        }
        .workcheck-top-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
          min-width: 240px;
        }
        .workcheck-agency-banner {
          display: grid;
          grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          background: #ecfdf5;
          border: 1px solid #99f6e4;
          border-radius: 16px;
          padding: 12px 14px;
          margin-bottom: 12px;
          color: #0f766e;
        }
        .workcheck-agency-banner strong {
          font-size: 13px;
          line-height: 1.25;
        }
        .workcheck-agency-banner span {
          color: #115e59;
          font-size: 12px;
          line-height: 1.45;
        }
        .workcheck-agency-banner a {
          color: #2563eb;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
          white-space: nowrap;
        }
        .workcheck-link,
        .workcheck-button {
          min-height: 46px;
          border-radius: 14px;
          padding: 0 14px;
          font: 900 12.5px ${PP};
          border: 1.5px solid #bfdbfe;
          color: #2563eb;
          background: #fff;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          white-space: nowrap;
        }
        .workcheck-button--primary {
          background: #2563eb;
          color: #fff;
          border-color: #2563eb;
        }
        .workcheck-top-actions .workcheck-link,
        .workcheck-top-actions .workcheck-button {
          border-color: rgba(255,255,255,.32);
          border-radius: 999px;
          background: rgba(255,255,255,.16);
          color: #fff;
          box-shadow: 0 10px 24px rgba(30,64,175,.12);
        }
        .workcheck-top-actions .workcheck-link:first-child {
          background: #fff;
          border-color: #fff;
          color: #2563eb;
        }
        .workcheck-stepper {
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 0;
          margin-bottom: 22px;
          box-shadow: none;
        }
        .workcheck-step-count {
          color: #8a9bb8;
          font-size: 14px;
          font-weight: 500;
          margin: 8px 0 2px;
        }
        .workcheck-step-description {
          margin: 0 0 16px;
          color: #8a9bb8;
          font-size: 13px;
          line-height: 1.45;
        }
        .workcheck-progress {
          height: 5px;
          border-radius: 999px;
          overflow: hidden;
          background: #dbe5f3;
          margin-bottom: 12px;
        }
        .workcheck-progress span,
        .workcheck-scorebar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #2563eb, #0f766e);
        }
        .workcheck-step-scroll {
          display: flex;
          gap: 7px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
        }
        .workcheck-step-chip {
          flex: 0 0 auto;
          min-height: 38px;
          border: 1.5px solid #d8e3f3;
          border-radius: 999px;
          background: #fff;
          color: #475569;
          font: 800 11px ${PP};
          padding: 0 12px 0 7px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          scroll-snap-align: start;
        }
        .workcheck-step-chip span {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: #e2eaf4;
          color: #475569;
          font-size: 10px;
        }
        .workcheck-step-chip--active {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #2563eb;
        }
        .workcheck-step-chip--done {
          background: #ecfdf5;
          color: #0f766e;
          border-color: #99f6e4;
        }
        .workcheck-step-chip--active span {
          background: #2563eb;
          color: #fff;
        }
        .workcheck-step-chip--done span {
          background: #0f766e;
          color: #fff;
        }
        .workcheck-layout {
          display: grid;
          grid-template-columns: minmax(0, 600px) minmax(320px, 390px);
          justify-content: center;
          gap: 24px;
          align-items: start;
        }
        .workcheck-main,
        .workcheck-summary {
          min-width: 0;
        }
        .workcheck-summary {
          position: sticky;
          top: 78px;
        }
        .workcheck-section {
          padding: 0;
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
        }
        .workcheck-summary-panel {
          background: #fff;
          border: 1px solid #d8e3f3;
          border-radius: 22px;
          box-shadow: 0 16px 38px rgba(30, 64, 175, 0.08);
        }
        .workcheck-eyebrow {
          margin: 0 0 10px;
          color: #2563eb;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .workcheck-section h2,
        .workcheck-summary-panel h2 {
          font-size: 28px;
          line-height: 1.12;
          margin: 0 0 14px;
          letter-spacing: 0;
        }
        .workcheck-note {
          margin: 0 0 18px;
          color: #8a9bb8;
          font-size: 14px;
          line-height: 1.65;
        }
        .workcheck-help {
          margin: -2px 0 8px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }
        .workcheck-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .workcheck-field {
          display: block;
          margin-bottom: 10px;
        }
        .workcheck-field-label,
        .workcheck-label {
          display: block;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin: 10px 0 6px;
        }
        .workcheck-input,
        .workcheck-textarea,
        .workcheck-select {
          width: 100%;
          box-sizing: border-box;
          border: 1.5px solid #d8e3f3;
          border-radius: 12px;
          background: #fff;
          color: #0f172a;
          font: 400 13px ${PP};
          outline: none;
        }
        .workcheck-input,
        .workcheck-select {
          min-height: 0;
          padding: 11px 13px;
        }
        .workcheck-select {
          appearance: none;
          -webkit-appearance: none;
          padding-right: 40px;
          cursor: pointer;
        }
        .workcheck-select:invalid,
        .workcheck-select option[value=""] {
          color: #94a3b8;
        }
        .workcheck-select-wrap {
          display: block;
          position: relative;
        }
        .workcheck-select-wrap::after {
          content: '';
          position: absolute;
          right: 14px;
          top: 50%;
          width: 9px;
          height: 9px;
          border-right: 2px solid #2563eb;
          border-bottom: 2px solid #2563eb;
          transform: translateY(-65%) rotate(45deg);
          pointer-events: none;
        }
        .workcheck-textarea {
          min-height: 78px;
          padding: 11px 13px;
          resize: vertical;
          line-height: 1.5;
        }
        .workcheck-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .workcheck-chip {
          min-height: 34px;
          border: 1.5px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          border-radius: 999px;
          padding: 0 12px;
          font: 800 12px ${PP};
          cursor: pointer;
        }
        .workcheck-checkline {
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr);
          gap: 9px;
          align-items: start;
          border: 1px solid #d8e3f3;
          border-radius: 12px;
          background: #fff;
          padding: 10px 13px;
          color: #334155;
          font-size: 13px;
          line-height: 1.55;
          margin-bottom: 8px;
        }
        .workcheck-checkline input {
          width: 20px;
          height: 20px;
          margin: 1px 0 0;
          accent-color: #2563eb;
        }
        .workcheck-choice-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
        .workcheck-multi-hint {
          display: inline-flex;
          width: fit-content;
          max-width: 100%;
          align-items: center;
          min-height: 28px;
          box-sizing: border-box;
          margin: -2px 0 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #eef5ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          font-size: 11px;
          font-weight: 800;
          line-height: 1.35;
        }
        .workcheck-choice,
        .workcheck-option,
        .workcheck-level {
          min-height: 48px;
          border: 1.5px solid #d8e3f3;
          background: #fff;
          border-radius: 14px;
          color: #334155;
          font: 900 13px ${PP};
          cursor: pointer;
          padding: 10px 13px;
        }
        .workcheck-choice,
        .workcheck-option {
          text-align: left;
        }
        .workcheck-choice--active,
        .workcheck-level--active {
          border-color: #2563eb;
          background: #edf5ff;
          color: #1d4ed8;
          box-shadow: inset 0 0 0 1px #2563eb22;
        }
        .workcheck-task-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 9px;
        }
        .workcheck-task-legend {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin: 0 0 14px;
        }
        .workcheck-task-legend div {
          border: 1px solid #d8e3f3;
          background: #fff;
          border-radius: 14px;
          padding: 9px 8px;
          min-width: 0;
        }
        .workcheck-task-legend strong {
          display: block;
          color: #2563eb;
          font-size: 15px;
          line-height: 1;
          margin-bottom: 4px;
        }
        .workcheck-task-legend span {
          display: block;
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.25;
        }
        .workcheck-task-card {
          border: 1px solid #d8e3f3;
          border-radius: 14px;
          padding: 11px;
          background: #fff;
        }
        .workcheck-task-card p {
          margin: 0 0 9px;
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
        }
        .workcheck-task-card div {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
        }
        .workcheck-level {
          min-height: 46px;
          padding: 0 4px;
          font-size: 19px;
          line-height: 1;
          text-align: center;
        }
        .workcheck-situation {
          border: 1px solid #d8e3f3;
          border-radius: 14px;
          padding: 12px;
          margin-bottom: 10px;
          background: #fff;
        }
        .workcheck-situation h3 {
          margin: 0 0 6px;
          font-size: 14px;
          line-height: 1.4;
        }
        .workcheck-situation p {
          margin: 0 0 10px;
          color: #8a9bb8;
          font-size: 12px;
          line-height: 1.5;
        }
        .workcheck-situation .workcheck-multi-hint {
          margin: 0 0 10px;
          color: #1d4ed8;
          font-size: 11px;
          line-height: 1.35;
        }
        .workcheck-option-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 7px;
        }
        .workcheck-option--active {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .workcheck-bottom-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 28px;
        }
        .workcheck-summary-panel {
          padding: 18px;
        }
        .workcheck-scorebar {
          height: 9px;
          border-radius: 999px;
          overflow: hidden;
          background: #e2eaf4;
          margin: 8px 0 14px;
        }
        .workcheck-profile-preview {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          margin: 12px 0 14px;
          padding: 12px;
          border: 1px solid #dce8f6;
          border-radius: 16px;
          background: #f8fbff;
        }
        .workcheck-avatar {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #2563eb, #0f766e);
          color: #fff;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0;
        }
        .workcheck-profile-preview strong {
          display: block;
          font-size: 16px;
          line-height: 1.25;
          color: #0f172a;
          overflow-wrap: anywhere;
        }
        .workcheck-profile-preview span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }
        .workcheck-completion {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 6px;
          margin: 0 0 12px;
          color: #0f172a;
        }
        .workcheck-completion strong {
          font-size: 30px;
          line-height: 1;
        }
        .workcheck-completion span {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }
        .workcheck-preview-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
        .workcheck-preview-grid div {
          min-width: 0;
          border: 1px solid #dce8f6;
          border-radius: 12px;
          background: #f8fbff;
          padding: 10px;
        }
        .workcheck-preview-grid span {
          display: block;
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .workcheck-preview-grid strong {
          display: block;
          color: #0f172a;
          font-size: 12px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .workcheck-private-note {
          margin: 0 0 12px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.55;
          text-align: center;
        }
        .workcheck-privacy-box,
        .workcheck-target-box,
        .workcheck-success {
          border: 1px solid #d8e3f3;
          background: #fff;
          border-radius: 16px;
          padding: 14px;
          margin-top: 14px;
        }
        .workcheck-privacy-box > strong,
        .workcheck-target-box > strong {
          display: block;
          color: #0f172a;
          font-size: 12px;
          line-height: 1.35;
          margin-bottom: 8px;
        }
        .workcheck-privacy-box label {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 9px;
          align-items: flex-start;
          min-height: 38px;
          padding: 8px 0;
          border-top: 1px solid #e2eaf4;
          cursor: pointer;
        }
        .workcheck-privacy-box label:first-of-type {
          border-top: 0;
        }
        .workcheck-privacy-box input {
          margin-top: 3px;
          accent-color: #2563eb;
        }
        .workcheck-privacy-box b,
        .workcheck-privacy-box small,
        .workcheck-target-box span {
          display: block;
        }
        .workcheck-privacy-box b {
          color: #1d4ed8;
          font-size: 12px;
          line-height: 1.35;
        }
        .workcheck-privacy-box small,
        .workcheck-target-box span {
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }
        .workcheck-success {
          background: #ecfdf5;
          border-color: #99f6e4;
          color: #0f766e;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.45;
        }
        .workcheck-button:disabled {
          opacity: .62;
          cursor: not-allowed;
        }
        .workcheck-summary-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
        }
        @media (max-width: 960px) {
          .workcheck-layout,
          .workcheck-top {
            grid-template-columns: 1fr;
          }
          .workcheck-top-actions {
            min-width: 0;
            width: 100%;
          }
          .workcheck-agency-banner {
            grid-template-columns: 1fr;
            align-items: start;
          }
          .workcheck-summary {
            position: static;
            display: none;
          }
          .workcheck-summary--open {
            display: block;
          }
          .workcheck-top-actions {
            justify-content: stretch;
          }
          .workcheck-link,
          .workcheck-top-actions .workcheck-button {
            flex: 1;
          }
        }
        @media (max-width: 640px) {
          .workcheck-page {
            padding: 12px 20px 104px;
          }
          .workcheck-top {
            margin: -12px -20px 18px;
            padding: 28px 20px 18px;
            border-radius: 0 0 28px 28px;
          }
          .workcheck-top::after {
            width: 72%;
          }
          .workcheck-brand h1 {
            font-size: 32px;
          }
          .workcheck-brand p {
            font-size: 13px;
            max-width: 360px;
          }
          .workcheck-hero-meta {
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 2px;
            -webkit-overflow-scrolling: touch;
          }
          .workcheck-hero-meta span {
            flex: 0 0 auto;
            font-size: 10px;
          }
          .workcheck-top-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .workcheck-section,
          .workcheck-stepper {
            border-radius: 0;
            padding: 0;
          }
          .workcheck-summary-panel {
            border-radius: 20px;
            padding: 16px;
          }
          .workcheck-section h2,
          .workcheck-summary-panel h2 {
            font-size: 25px;
            margin-bottom: 10px;
          }
          .workcheck-note {
            font-size: 13.5px;
            margin-bottom: 16px;
          }
          .workcheck-two,
          .workcheck-bottom-actions,
          .workcheck-summary-actions {
            grid-template-columns: 1fr;
          }
          .workcheck-choice-grid,
          .workcheck-option-list,
          .workcheck-task-grid {
            grid-template-columns: 1fr;
          }
          .workcheck-choice,
          .workcheck-option {
            min-height: 48px;
          }
          .workcheck-button,
          .workcheck-link {
            min-height: 44px;
          }
          .workcheck-input,
          .workcheck-select {
            min-height: 48px;
          }
          .workcheck-field-label,
          .workcheck-label {
            margin-top: 11px;
          }
          .workcheck-task-legend {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="workcheck-shell">
        <div className="workcheck-top">
          <div className="workcheck-brand">
            <div className="workcheck-logo">
              <img src="/favicon.svg" alt="Latido" width="30" height="30" />
            </div>
            <div>
              <h1>Latido WorkCheck</h1>
              <p>Construcción · Perfil para temporeras</p>
            </div>
          </div>
          <StepHeader step={step} />
        </div>

        {targetAgency && (
          <div className="workcheck-agency-banner">
            <strong>{targetAgency.name}</strong>
            <span>Envía tu perfil a esta temporera al terminar.</span>
            <Link to={`/temporeras/${targetAgency.slug}`}>Ver página de la temporera</Link>
          </div>
        )}

        <div className="workcheck-layout">
          <main className="workcheck-main">
            {step === 0 && (
              <Section eyebrow="01 Datos" title="Datos básicos y autorización">
                <p className="workcheck-note">Datos mínimos para preparar tu perfil.</p>
                <FormCard>
                  <Field label="Nombre y apellidos">
                    <input className="workcheck-input" placeholder="Ej.: Juan Pérez" value={form.name} onChange={event => setField('name', event.target.value)} />
                  </Field>
                  <div className="workcheck-two">
                    <Field label="WhatsApp">
                      <input className="workcheck-input" placeholder="+41, +34 ..." value={form.phone} onChange={event => setField('phone', event.target.value)} />
                    </Field>
                    <Field label="Ciudad o zona">
                      <input className="workcheck-input" placeholder="Ej.: Luzern" value={form.city} onChange={event => setField('city', event.target.value)} />
                    </Field>
                  </div>
                  <Field label="Email opcional">
                    <input className="workcheck-input" type="email" placeholder="tucorreo@ejemplo.com" value={form.email} onChange={event => setField('email', event.target.value)} />
                  </Field>
                  <SelectField
                    label="Puesto"
                    value={form.role}
                    onChange={value => setField('role', value)}
                    options={OPTIONS.role}
                    placeholder="Selecciona una opción"
                  />
                </FormCard>
                <FormCard title="Situación y permiso">
                  <SelectField
                    label="Dónde estás ahora"
                    value={form.location}
                    onChange={value => setField('location', value)}
                    options={OPTIONS.location}
                  />
                  <SelectField
                    label="¿Puedes trabajar legalmente en Suiza?"
                    value={form.legal}
                    onChange={value => setField('legal', value)}
                    options={OPTIONS.legal}
                  />
                  <div className="workcheck-two">
                    <SelectField
                      label="Tipo de permiso"
                      value={form.permitType}
                      onChange={value => setField('permitType', value)}
                      options={OPTIONS.permitType}
                      placeholder="Selecciona"
                    />
                    <SelectField
                      label="Validez aprox."
                      value={form.permitValidity}
                      onChange={value => setField('permitValidity', value)}
                      options={OPTIONS.permitValidity}
                      placeholder="Selecciona"
                    />
                  </div>
                  <SelectField
                    label="Idioma de contacto"
                    value={form.preferredLanguage}
                    onChange={value => setField('preferredLanguage', value)}
                    options={OPTIONS.preferredLanguage}
                  />
                </FormCard>
                <FormCard className="workcheck-consent-card">
                  <label className="workcheck-checkline">
                    <input
                      type="checkbox"
                      checked={form.truth}
                      onChange={event => setField('truth', event.target.checked)}
                    />
                    <span>Confirmo que la información es verdadera.</span>
                  </label>
                  <label className="workcheck-checkline">
                    <input
                      type="checkbox"
                      checked={form.consent}
                      onChange={event => setField('consent', event.target.checked)}
                    />
                    <span>Autorizo a Latido a compartir mi perfil con empresas temporeras.</span>
                  </label>
                </FormCard>
              </Section>
            )}

            {step === 1 && (
              <Section eyebrow="02 Disponibilidad" title="Cuándo y dónde puedes trabajar">
                <p className="workcheck-note">Indica cuándo empiezas y tu movilidad real.</p>
                <FormCard>
                  <div className="workcheck-two">
                    <SelectField
                      label="Cuándo empiezas"
                      value={form.start}
                      onChange={value => setField('start', value)}
                      options={OPTIONS.start}
                      placeholder="Selecciona"
                    />
                    <SelectField
                      label="Carga de trabajo"
                      value={form.workload}
                      onChange={value => setField('workload', value)}
                      options={OPTIONS.workload}
                      placeholder="Selecciona"
                    />
                  </div>
                  <p className="workcheck-label">Horarios</p>
                  <ChoiceGroup multi options={OPTIONS.shifts} value={form.shifts} onChange={value => setField('shifts', value)} />
                  <p className="workcheck-label">Tipo de trabajo</p>
                  <ChoiceGroup multi options={OPTIONS.workTypes} value={form.workTypes} onChange={value => setField('workTypes', value)} />
                </FormCard>
                <FormCard title="Movilidad">
                  <SelectField
                    label="Cantón base"
                    value={form.homeCanton}
                    onChange={setHomeCanton}
                    options={OPTIONS.cantons}
                    placeholder="Elige tu cantón base"
                  />
                  <SelectField
                    label="Alcance"
                    value={form.mobilityScope}
                    onChange={setMobilityScope}
                    options={OPTIONS.mobilityScope}
                  />
                  {form.mobilityScope === 'Mi cantón y cantones cercanos' && (
                    <MultiSelectAdd
                      label="Cantones cercanos"
                      options={OPTIONS.cantons.filter(canton => canton !== form.homeCanton)}
                      value={form.nearbyCantons}
                      onChange={value => setField('nearbyCantons', value)}
                      placeholder="Añadir cantón"
                    />
                  )}
                  <div className="workcheck-two">
                    <SelectField
                      label="Transporte"
                      value={form.transport}
                      onChange={value => setField('transport', value)}
                      options={OPTIONS.transport}
                      placeholder="Selecciona"
                    />
                    <SelectField
                      label="Carnet"
                      value={form.license}
                      onChange={value => setField('license', value)}
                      options={OPTIONS.license}
                      placeholder="Selecciona"
                    />
                  </div>
                  <SelectField
                    label="Desplazamiento máximo"
                    value={form.commute}
                    onChange={value => setField('commute', value)}
                    options={OPTIONS.commute}
                  />
                </FormCard>
              </Section>
            )}

            {step === 2 && (
              <Section eyebrow="03 Experiencia" title="Experiencia real">
                <p className="workcheck-note">Años, obra principal y forma de trabajar.</p>
                <FormCard>
                  <div className="workcheck-two">
                    <SelectField
                      label="Años de experiencia"
                      value={form.experience}
                      onChange={value => setField('experience', value)}
                      options={OPTIONS.experience}
                      placeholder="Selecciona"
                    />
                    <SelectField
                      label="¿Has trabajado en Suiza?"
                      value={form.swissExperience}
                      onChange={value => setField('swissExperience', value)}
                      options={OPTIONS.swissExperience}
                      placeholder="Selecciona"
                    />
                  </div>
                  <SelectField
                    label="Tipo de obra"
                    value={form.siteType}
                    onChange={value => setField('siteType', value)}
                    options={OPTIONS.siteType}
                  />
                  <p className="workcheck-label">Has ayudado a...</p>
                  <ChoiceGroup
                    multi
                    options={OPTIONS.workedWith}
                    value={form.workedWith}
                    onChange={value => setField('workedWith', value)}
                    exclusiveOptions={['Solo apoyo general']}
                  />
                </FormCard>
                <FormCard title="Cómo trabajas">
                  <SelectField
                    label="Autonomía"
                    value={form.autonomy}
                    onChange={value => setField('autonomy', value)}
                    options={OPTIONS.autonomy}
                  />
                  <div className="workcheck-two">
                    <SelectField
                      label="Condición física"
                      value={form.physicalLoad}
                      onChange={value => setField('physicalLoad', value)}
                      options={OPTIONS.physicalLoad}
                      placeholder="Selecciona"
                    />
                    <SelectField
                      label="Exterior con clima"
                      value={form.weatherWork}
                      onChange={value => setField('weatherWork', value)}
                      options={OPTIONS.weatherWork}
                      placeholder="Selecciona"
                    />
                  </div>
                  <div className="workcheck-two">
                    <SelectField
                      label="Si vas a llegar tarde"
                      value={form.reliability}
                      onChange={value => setField('reliability', value)}
                      options={OPTIONS.reliability}
                      placeholder="Selecciona"
                    />
                    <SelectField
                      label="Motivo último trabajo"
                      value={form.lastJobReason}
                      onChange={value => setField('lastJobReason', value)}
                      options={OPTIONS.lastJobReason}
                      placeholder="Selecciona"
                    />
                  </div>
                  <p className="workcheck-label">Límites</p>
                  <ChoiceGroup multi options={OPTIONS.limits} value={form.limits} onChange={value => setField('limits', value)} />
                </FormCard>
              </Section>
            )}

            {step === 3 && (
              <Section eyebrow="04 Tareas" title="Nivel por tarea">
                <p className="workcheck-note">Marca solo lo que puedes hacer en obra.</p>
                <div className="workcheck-task-legend" aria-label="Leyenda de niveles">
                  {TASK_LEVELS.map(level => (
                    <div key={level.id}>
                      <strong>{level.label}</strong>
                      <span>{level.text}</span>
                    </div>
                  ))}
                </div>
                <div className="workcheck-task-grid">
                  {TASKS.map(task => (
                    <TaskPicker
                      key={task.id}
                      task={task}
                      value={form.tasks[task.id]}
                      onChange={value => setNested('tasks', task.id, value)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {step === 4 && (
              <Section eyebrow="05 Técnica" title="Preguntas del puesto">
                <p className="workcheck-note">Responde como trabajarías en obra.</p>
                <p className="workcheck-label">Técnica del puesto</p>
                {getTechnicalQuestions(form.role).map(question => (
                  <OptionGroup
                    key={question.id}
                    question={question}
                    value={form.situations[question.id]}
                    onChange={value => setNested('situations', question.id, value)}
                  />
                ))}
                <p className="workcheck-label">Seguridad general</p>
                {SAFETY_QUESTIONS.map(question => (
                  <OptionGroup
                    key={question.id}
                    question={question}
                    value={form.situations[question.id]}
                    onChange={value => setNested('situations', question.id, value)}
                  />
                ))}
              </Section>
            )}

            {step === 5 && (
              <Section eyebrow="06 Equipo" title="Equipo e idiomas">
                <p className="workcheck-note">Equipo, herramientas y contacto.</p>
                <FormCard>
                  <p className="workcheck-label">Equipo de protección</p>
                  <ChoiceGroup
                    multi
                    options={OPTIONS.ppe}
                    value={form.ppe}
                    onChange={value => setField('ppe', value)}
                    exclusiveOptions={['No tengo equipo']}
                  />
                  <SelectField
                    label="Herramientas propias"
                    value={form.ownTools}
                    onChange={value => setField('ownTools', value)}
                    options={OPTIONS.ownTools}
                    placeholder="Selecciona una opción"
                  />
                  <p className="workcheck-label">Herramientas</p>
                  <ChoiceGroup multi options={OPTIONS.tools} value={form.tools} onChange={value => setField('tools', value)} />
                  <p className="workcheck-label">Certificados o cursos</p>
                  <ChoiceGroup
                    multi
                    options={OPTIONS.certificates}
                    value={form.certificates}
                    onChange={value => setField('certificates', value)}
                    exclusiveOptions={['Ninguno']}
                  />
                </FormCard>
                <FormCard title="Idiomas y comunicación">
                  <p className="workcheck-label">Idiomas</p>
                  <ChoiceGroup multi options={OPTIONS.languages} value={form.languages} onChange={value => setField('languages', value)} />
                  <div className="workcheck-two">
                    <SelectField
                      label="Nivel de alemán"
                      value={form.german}
                      onChange={value => setField('german', value)}
                      options={OPTIONS.german}
                      placeholder="Selecciona"
                    />
                    <SelectField
                      label="Si hay un problema"
                      value={form.communication}
                      onChange={value => setField('communication', value)}
                      options={OPTIONS.communication}
                      placeholder="Selecciona"
                    />
                  </div>
                </FormCard>
                <FormCard title="Referencias y salario">
                  <SelectField
                    label="Referencias"
                    value={form.references}
                    onChange={value => setField('references', value)}
                    options={OPTIONS.references}
                    placeholder="Selecciona"
                  />
                  <div className="workcheck-two">
                    <SelectField
                      label="¿Podemos contactarlas?"
                      value={form.referencePermission}
                      onChange={value => setField('referencePermission', value)}
                      options={OPTIONS.referencePermission}
                      placeholder="Selecciona"
                    />
                    <SelectField
                      label="Salario esperado"
                      value={form.salaryExpectation}
                      onChange={value => setField('salaryExpectation', value)}
                      options={OPTIONS.salaryExpectation}
                      placeholder="Selecciona"
                    />
                  </div>
                <Field label="Nota corta · opcional">
                  <textarea
                    className="workcheck-textarea"
                    value={form.shortNote}
                    maxLength={260}
                    onChange={event => setField('shortNote', event.target.value)}
                    placeholder="Ej.: experiencia, tareas fuertes o disponibilidad."
                  />
                </Field>
                </FormCard>
              </Section>
            )}

            {isLastStep && (
              <SummaryPanel
                form={form}
                analysis={analysis}
                copied={copied}
                copySummary={copySummary}
                reset={reset}
                targetAgency={targetAgency}
                visibility={visibility}
                onVisibilityChange={setVisibility}
                onSaveProfile={saveProfile}
                onSubmitProfile={submitToAgency}
                savedMessage={savedMessage}
                submittedMessage={submittedMessage}
                saving={saving}
                className="workcheck-summary--open"
              />
            )}

            <StickyFormActions>
              {step === 0 ? (
                <Btn onClick={() => navigate('/perfil-laboral')} variant="danger" style={{ flex:'0 0 122px', border:'1.5px solid #FCA5A5' }}>
                  ← Cancelar
                </Btn>
              ) : (
                <Btn onClick={() => goToStep(step - 1)} variant="secondary" style={{ flex:'0 0 122px' }}>
                  ← Atrás
                </Btn>
              )}
              {!isLastStep ? (
                <Btn onClick={() => goToStep(step + 1)} style={{ flex:1 }}>
                  Continuar →
                </Btn>
              ) : (
                <Btn onClick={copySummary} style={{ flex:1 }}>
                  {copied ? 'Copiado' : 'Copiar resumen →'}
                </Btn>
              )}
            </StickyFormActions>
          </main>

          {!isLastStep && (
            <SummaryPanel
              form={form}
              analysis={analysis}
              copied={copied}
              copySummary={copySummary}
              reset={reset}
              targetAgency={targetAgency}
              visibility={visibility}
              onVisibilityChange={setVisibility}
              onSaveProfile={saveProfile}
              onSubmitProfile={submitToAgency}
              savedMessage={savedMessage}
              submittedMessage={submittedMessage}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  )
}
