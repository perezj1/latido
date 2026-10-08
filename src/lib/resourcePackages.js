import { CANTONS } from './constants.js'

// Small editorial collections of existing Latido resources. No separate
// catalogue or account is needed to open or share one.
export const RESOURCE_PACKAGES = [
  {
    slug:'acabo-de-llegar',
    featured:true,
    title:'Acabo de llegar',
    emoji:'🧳',
    description:'Permisos, vivienda, salud y comunidad: un punto de partida para tus primeros pasos en Suiza.',
    intro:'Cuando todo es nuevo, ayuda tener por dónde empezar. Aquí tienes una selección de recursos de Latido para orientarte y encontrar apoyo.',
    resources:[
      { id:'permisos', emoji:'📄', title:'Entiende los permisos de residencia', description:'Esta guía te ayuda a entender los tipos de permiso y cuál te corresponde.', href:'/guias?openGuide=d1', action:'Leer la guía' },
      { id:'vivienda', emoji:'🏠', title:'Busca tu primera vivienda', description:'Explora pisos y habitaciones publicados por la comunidad.', href:'/tablon?cat=vivienda&type=ofrece', local:true, action:'Ver viviendas' },
      { id:'salud', emoji:'🏥', title:'Oriéntate con el seguro de salud', description:'Esta guía te ayuda a elegir tu Krankenkasse y preparar tus preguntas.', href:'/guias?openGuide=d3', action:'Leer la guía' },
      { id:'tramites', emoji:'💬', title:'Encuentra ayuda con tus trámites', description:'Busca apoyo con documentos, traducciones y gestiones.', href:'/tablon?cat=documentos&type=ofrece', local:true, action:'Ver ayuda disponible' },
      { id:'grupos', emoji:'👥', title:'Conecta con la comunidad', description:'Descubre grupos para conocer gente y compartir experiencias.', href:'/comunidades?view=comunidades', local:true, action:'Encontrar un grupo' },
    ],
  },
  {
    slug:'busco-trabajo',
    featured:true,
    title:'Busco trabajo',
    emoji:'💼',
    description:'Ofertas, búsqueda de empleo y guías para dar tus próximos pasos laborales en Suiza.',
    intro:'Reúne en un solo lugar las oportunidades y los recursos que pueden ayudarte a avanzar en tu búsqueda de empleo.',
    resources:[
      { id:'ofertas', emoji:'🔎', title:'Explora las ofertas de empleo', description:'Consulta los puestos publicados en Latido y contacta desde cada anuncio.', href:'/tablon?cat=empleo&jobIntent=ofrece', local:true, action:'Ver ofertas' },
      { id:'solicitud', emoji:'✍️', title:'Cuenta qué trabajo buscas', description:'Publica tu solicitud para que la comunidad conozca tu experiencia y lo que buscas.', href:'/publicar-empleo?intent=busca', requiresAccount:true, action:'Publicar mi búsqueda' },
      { id:'ett', emoji:'📚', title:'Conoce el trabajo temporal', description:'Esta guía te ayuda a entender cómo funcionan las empresas de trabajo temporal.', href:'/guias?openGuide=d14', action:'Leer la guía' },
      { id:'derechos', emoji:'🤝', title:'Infórmate sobre tus derechos laborales', description:'Esta guía te ayuda a conocer tus derechos laborales básicos en Suiza.', href:'/guias?openGuide=d10', action:'Leer la guía' },
    ],
  },
  {
    slug:'planes-y-comunidad',
    featured:true,
    title:'Planes y comunidad',
    emoji:'🎉',
    description:'Eventos, grupos y negocios para disfrutar de Suiza y conectar con gente en español.',
    intro:'Encuentra un plan, descubre un lugar o conoce a personas con las que compartir tu día a día. Empieza por lo que más te apetezca.',
    resources:[
      { id:'eventos', emoji:'🎟️', title:'Encuentra tu próximo plan', description:'Explora conciertos, encuentros, fiestas y otros eventos publicados en Latido.', href:'/comunidades?view=eventos', local:true, action:'Ver eventos' },
      { id:'grupos', emoji:'👥', title:'Conoce gente con tus intereses', description:'Descubre grupos de la comunidad por zona e intereses.', href:'/comunidades?view=comunidades', local:true, action:'Encontrar un grupo' },
      { id:'negocios', emoji:'🏪', title:'Descubre negocios de la comunidad', description:'Encuentra comercios y profesionales hispanohablantes para tu día a día.', href:'/comunidades?view=negocios', local:true, action:'Explorar negocios' },
      { id:'creadores', emoji:'🎙️', title:'Inspírate con otras experiencias', description:'Descubre contenido en español de personas que comparten su vida en Suiza.', href:'/comunidades?view=creadores', action:'Descubrir creadores' },
    ],
  },
  {
    slug:'busco-piso', title:'Busco piso', emoji:'🏠',
    description:'Viviendas, solicitudes y una guía para preparar tu candidatura y alquilar con más seguridad.',
    intro:'Encuentra un lugar donde vivir y prepara lo que te pedirán. Empieza por entender el alquiler, explora las ofertas y cuenta qué vivienda necesitas.',
    resources:[
      { id:'guia', emoji:'📚', title:'Prepara tu búsqueda de piso', description:'Esta guía te ayuda a preparar la documentación, la fianza y el contrato, y a detectar señales de alerta antes de pagar.', href:'/guias?openGuide=d9', action:'Leer la guía' },
      { id:'ofertas', emoji:'🏠', title:'Explora pisos y habitaciones', description:'Consulta las viviendas que ofrece la comunidad en tu zona.', href:'/tablon?cat=vivienda&type=ofrece', local:true, action:'Ver viviendas' },
      { id:'solicitud', emoji:'✍️', title:'Publica qué vivienda buscas', description:'Indica zona, presupuesto, personas y fecha de entrada para recibir propuestas.', href:'/publicar?cat=vivienda&intent=busca', requiresAccount:true, action:'Publicar mi búsqueda' },
      { id:'ayuda', emoji:'💬', title:'Busca ayuda con el contrato', description:'Encuentra apoyo con cartas, traducciones y trámites de alquiler.', href:'/tablon?cat=documentos&type=ofrece', local:true, action:'Ver ayuda disponible' },
    ],
  },
  {
    slug:'llego-con-ninos', title:'Llego con niños', emoji:'👶',
    description:'Escuela, guardería, salud y trámites para organizar la llegada de tu familia a Suiza.',
    intro:'Preparar la llegada con niños es más sencillo cuando sabes a quién preguntar. Organiza primero residencia, colegio y salud; después, los cuidados y vuestra red de apoyo.',
    resources:[
      { id:'guia', emoji:'📚', title:'Organiza la llegada con tus hijos', description:'Esta guía te ayuda a preparar el viaje y empezar con la escuela, el idioma y la salud.', href:'/guias?openGuide=d19', action:'Leer la guía' },
      { id:'familia', emoji:'👨‍👩‍👧', title:'Comprueba la reagrupación familiar', description:'Esta guía te ayuda a comprobar los requisitos según tu nacionalidad, permiso y parentesco.', href:'/guias?openGuide=d7', action:'Ver los requisitos' },
      { id:'escuela', emoji:'🎒', title:'Entiende escuelas y guarderías', description:'Esta guía te ayuda a entender la escolarización, los horarios y las plazas de Kita en tu municipio.', href:'/guias?openGuide=d5', action:'Leer la guía' },
      { id:'cuidados', emoji:'❤️', title:'Encuentra apoyo para los cuidados', description:'Explora anuncios de cuidado infantil y comprueba experiencia, referencias y condiciones.', href:'/tablon?cat=cuidados&type=ofrece', local:true, action:'Ver cuidados' },
      { id:'comunidad', emoji:'👥', title:'Conoce a otras personas de tu zona', description:'Busca grupos para compartir experiencias y crear vuestra red de apoyo.', href:'/comunidades?view=comunidades', local:true, action:'Encontrar un grupo' },
    ],
  },
  {
    slug:'sin-trabajo', title:'Sin trabajo', emoji:'💼',
    description:'Primeros pasos con el RAV, prestaciones y recursos para retomar tu búsqueda de empleo.',
    intro:'Si te has quedado sin empleo o sabes que tu contrato termina, empieza por proteger tus derechos y organizar los trámites. Después, prepara tu siguiente oportunidad.',
    resources:[
      { id:'guia', emoji:'📚', title:'Entiende el desempleo y el RAV', description:'Esta guía te ayuda a registrarte, elegir la caja de desempleo y no perder plazos.', href:'/guias?openGuide=d15', action:'Leer la guía' },
      { id:'derechos', emoji:'🤝', title:'Revisa tus derechos laborales', description:'Esta guía te ayuda a revisar el preaviso, el salario y los documentos al terminar un empleo.', href:'/guias?openGuide=d10', action:'Leer la guía' },
      { id:'ofertas', emoji:'🔎', title:'Encuentra nuevas oportunidades', description:'Consulta las ofertas de trabajo publicadas en tu zona.', href:'/tablon?cat=empleo&jobIntent=ofrece', local:true, action:'Ver ofertas' },
      { id:'solicitud', emoji:'✍️', title:'Haz visible tu experiencia', description:'Publica qué sabes hacer, tu disponibilidad y el tipo de puesto que buscas.', href:'/publicar-empleo?intent=busca', requiresAccount:true, action:'Publicar mi búsqueda' },
      { id:'tramites', emoji:'💬', title:'Busca apoyo con los documentos', description:'Encuentra ayuda para entender cartas y preparar tus gestiones.', href:'/tablon?cat=documentos&type=ofrece', local:true, action:'Ver ayuda disponible' },
    ],
  },
  {
    slug:'me-mudo', title:'Me mudo', emoji:'📦',
    description:'Cambio de domicilio, entrega del piso y ayuda práctica para tu mudanza en Suiza.',
    intro:'Una mudanza implica más que cajas. Organiza la salida del piso, el cambio de dirección y los servicios que necesitas antes de fijar el día.',
    resources:[
      { id:'guia', emoji:'📚', title:'Prepara tu mudanza paso a paso', description:'Esta guía te ayuda a organizar el contrato, el cambio de domicilio y la entrega del piso.', href:'/guias?openGuide=d16', action:'Leer la guía' },
      { id:'servicios', emoji:'🚚', title:'Encuentra servicios de mudanza', description:'Busca ayuda para transporte, limpieza y otras tareas de la mudanza.', href:'/tablon?cat=servicios&type=ofrece&q=mudanza', local:true, action:'Buscar ayuda' },
      { id:'vivienda', emoji:'🏠', title:'Busca tu siguiente vivienda', description:'Explora pisos y habitaciones disponibles en la zona donde quieres vivir.', href:'/tablon?cat=vivienda&type=ofrece', local:true, action:'Ver viviendas' },
      { id:'muebles', emoji:'🛋️', title:'Vende lo que ya no necesitas', description:'Publica muebles y objetos para que otra persona pueda aprovecharlos.', href:'/publicar?cat=venta&intent=ofrece', requiresAccount:true, action:'Publicar un anuncio' },
    ],
  },
  {
    slug:'viene-un-bebe', title:'Viene un bebé', emoji:'🤰',
    description:'Seguro, nacimiento y permisos laborales para preparar la llegada de tu bebé en Suiza.',
    intro:'Prepara los trámites con tiempo para poder centrarte en tu familia. Aquí tienes una orientación sobre el seguro, el registro del nacimiento y la organización del trabajo y los cuidados.',
    resources:[
      { id:'guia', emoji:'📚', title:'Prepara el embarazo y el nacimiento', description:'Esta guía te ayuda a entender la cobertura de maternidad, el seguro del bebé, el registro y las prestaciones.', href:'/guias?openGuide=d17', action:'Leer la guía' },
      { id:'seguro', emoji:'🏥', title:'Revisa tu seguro de salud', description:'Esta guía te ayuda a entender la cobertura básica y qué preguntar a tu aseguradora.', href:'/guias?openGuide=d3', action:'Leer la guía' },
      { id:'guarderia', emoji:'🎒', title:'Anticipa los cuidados y la guardería', description:'Esta guía te ayuda a informarte sobre plazas, horarios y ayudas antes de volver al trabajo.', href:'/guias?openGuide=d5', action:'Leer la guía' },
      { id:'cuidados', emoji:'❤️', title:'Busca apoyo para el día a día', description:'Explora los cuidados que ofrece la comunidad y acuerda sus condiciones.', href:'/tablon?cat=cuidados&type=ofrece', local:true, action:'Ver cuidados' },
    ],
  },
  {
    slug:'vuelvo-a-mi-pais', title:'Vuelvo a mi país', emoji:'✈️',
    description:'Baja municipal, seguros, impuestos y pensiones antes de salir definitivamente de Suiza.',
    intro:'Cerrar tu etapa en Suiza requiere planificar fechas y guardar documentos. Organiza la vivienda, la baja y tus seguros antes de viajar, y revisa qué pasa con tus cotizaciones.',
    resources:[
      { id:'guia', emoji:'📚', title:'Prepara tu salida de Suiza', description:'Esta guía te ayuda a saber qué comunicar, qué conservar y qué comprobar según tu país de destino.', href:'/guias?openGuide=d18', action:'Leer la guía' },
      { id:'pension', emoji:'💰', title:'Entiende tus cotizaciones y tu pensión', description:'Esta guía te ayuda a distinguir AHV/AVS, segundo y tercer pilar antes de decidir.', href:'/guias?openGuide=d8', action:'Leer la guía' },
      { id:'tramites', emoji:'💬', title:'Encuentra ayuda con los trámites de salida', description:'Busca apoyo con cartas, traducciones y gestiones pendientes.', href:'/tablon?cat=documentos&type=ofrece', local:true, action:'Ver ayuda disponible' },
      { id:'venta', emoji:'🛋️', title:'Da otra vida a tus cosas', description:'Publica los objetos que no te llevarás y acuerda la recogida antes de viajar.', href:'/publicar?cat=venta&intent=ofrece', requiresAccount:true, action:'Publicar un anuncio' },
    ],
  },
]

export function getResourcePackage(slug='') {
  return RESOURCE_PACKAGES.find(resourcePackage => resourcePackage.slug === slug) || null
}

export function getResourcePackagePath(resourcePackage) {
  return `/paquetes/${resourcePackage.slug}`
}

export function normalizePackageCanton(canton='') {
  return CANTONS.some(item => item.code === canton) ? canton : ''
}

export function getPackageResourcePath(resource, canton='') {
  const selectedCanton = normalizePackageCanton(canton)
  if (!resource.local || !selectedCanton) return resource.href
  const url = new URL(resource.href, 'https://latido.ch')
  url.searchParams.set('canton', selectedCanton)
  return `${url.pathname}${url.search}`
}

// Un paso es una guía cuando enlaza a /guias?openGuide=dX (o declara `guide`).
export function getResourceGuideId(resource) {
  if (resource?.guide) return resource.guide
  try {
    return new URL(resource?.href || '', 'https://latido.ch').searchParams.get('openGuide') || ''
  } catch {
    return ''
  }
}

// Paquetes que incluyen una guía, con su posición como paso dentro de cada uno.
export function getGuidePackages(guideId='') {
  if (!guideId) return []
  return RESOURCE_PACKAGES.flatMap(resourcePackage => {
    const index = resourcePackage.resources.findIndex(resource => getResourceGuideId(resource) === guideId)
    return index < 0 ? [] : [{ resourcePackage, resource:resourcePackage.resources[index], index }]
  })
}

// Tipo de recurso para los pasos que no son guías.
export function getPackageResourceKind(resource) {
  const href = resource?.href || ''
  if (getResourceGuideId(resource)) return 'Guía'
  if (href.startsWith('/publicar')) return 'Publicar'
  if (href.includes('cat=empleo')) return 'Ofertas de empleo'
  if (href.startsWith('/tablon')) return 'Anuncios'
  if (href.includes('view=eventos')) return 'Eventos'
  if (href.includes('view=negocios')) return 'Negocios'
  if (href.includes('view=creadores')) return 'Creadores'
  if (href.includes('view=comunidades')) return 'Grupos'
  return 'Recurso'
}
