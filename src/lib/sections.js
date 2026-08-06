// Las seis secciones de Explorar. Un unico sitio donde se declara que hay en
// Latido, a donde va cada cosa y con que color se pinta.
export const EXPLORE_SECTIONS = [
  {
    id:'anuncios',
    emoji:'📌',
    label:'Anuncios',
    desc:'Vivienda, servicios, compraventa y trámites',
    to:'/tablon',
    gradient:'linear-gradient(150deg, #4C8DFF 0%, #1D4ED8 100%)',
    glow:'rgba(37, 99, 235, .28)',
  },
  {
    id:'empleo',
    emoji:'💼',
    label:'Empleo',
    desc:'Ofertas y solicitudes de trabajo',
    to:'/tablon?cat=empleo',
    gradient:'linear-gradient(150deg, #34D6A4 0%, #0E9C74 100%)',
    glow:'rgba(29, 189, 138, .28)',
  },
  {
    id:'negocios',
    emoji:'🏪',
    label:'Negocios',
    desc:'Comercios y profesionales hispanohablantes',
    to:'/comunidades?view=negocios',
    gradient:'linear-gradient(150deg, #FFB84D 0%, #E08706 100%)',
    glow:'rgba(245, 166, 35, .3)',
  },
  {
    id:'eventos',
    emoji:'🎉',
    label:'Eventos',
    desc:'Conciertos, fiestas y quedadas con fecha',
    to:'/comunidades?view=eventos',
    gradient:'linear-gradient(150deg, #FF6F68 0%, #D22B24 100%)',
    glow:'rgba(232, 64, 58, .28)',
  },
  {
    id:'grupos',
    emoji:'👥',
    label:'Grupos',
    desc:'Comunidades y chats por ciudad o interés',
    to:'/comunidades?view=comunidades',
    gradient:'linear-gradient(150deg, #3FD3E8 0%, #0296AB 100%)',
    glow:'rgba(0, 188, 212, .28)',
  },
  {
    id:'creadores',
    emoji:'🎙️',
    label:'Creadores',
    desc:'Voces que cuentan Suiza en español',
    to:'/comunidades?view=creadores',
    gradient:'linear-gradient(150deg, #A78BFA 0%, #6D28D9 100%)',
    glow:'rgba(124, 58, 237, .28)',
  },
]

// Superficies secundarias: no son secciones propias, pero en movil no habia
// ninguna via para llegar a ellas.
export const EXPLORE_EXTRAS = [
  { id:'guias', emoji:'📚', label:'Guías', desc:'Permisos, trabajo, salud y dinero', to:'/guias' },
  { id:'empresas', emoji:'🚀', label:'Para Empresas', desc:'Da a conocer tu negocio en Latido', to:'/colaboraciones' },
]

// Rutas que pertenecen a Explorar. El area de perfil de creador (/creadores/alta
// y /creadores/mi-perfil) queda fuera a proposito: vive en Perfil.
const EXPLORE_ROUTE = /^\/(?:explorar|tablon|anuncios|empleos|comunidades|negocios|eventos|guias|creadores|colaboraciones)(?:\/|$)/

export function isCreatorProfileRoute(pathname='') {
  return pathname === '/creadores/alta' || pathname.startsWith('/creadores/mi-perfil')
}

export function isExploreRoute(pathname='') {
  return EXPLORE_ROUTE.test(pathname) && !isCreatorProfileRoute(pathname)
}

export function getActiveSection(pathname='', search='') {
  const params = new URLSearchParams(search)

  if (pathname.startsWith('/comunidades')) {
    const view = params.get('view')
    if (view === 'eventos') return 'eventos'
    if (view === 'comunidades') return 'grupos'
    if (view === 'creadores') return 'creadores'
    return 'negocios'
  }
  if (pathname.startsWith('/negocios')) return 'negocios'
  if (pathname.startsWith('/eventos')) return 'eventos'
  if (pathname.startsWith('/creadores')) return 'creadores'
  if (pathname.startsWith('/empleos')) return 'empleo'
  if (pathname.startsWith('/tablon') || pathname.startsWith('/anuncios')) {
    return params.get('cat') === 'empleo' ? 'empleo' : 'anuncios'
  }

  return ''
}
