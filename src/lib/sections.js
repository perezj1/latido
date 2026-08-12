// Las seis secciones de Explorar. Un unico sitio donde se declara que hay en
// Latido, a donde va cada cosa y con que color se pinta.
//
// Este array manda en el orden de las dos superficies: la fila de pestanas y la
// rejilla de tarjetas de Explorar.
//   color    tono de la seccion. Tine el fondo claro de la pestana activa.
//   ink      version oscura del mismo tono, para el texto sobre ese fondo claro.
//   gradient degradado de la tarjeta de Explorar.
import { SECTION_COLORS } from './theme'

export const EXPLORE_SECTIONS = [
  {
    id:'anuncios',
    emoji:'📣',
    label:'Anuncios',
    desc:'Vivienda, servicios, compraventa y trámites',
    to:'/tablon',
    ...SECTION_COLORS.anuncios,
  },
  {
    id:'empleo',
    emoji:'💼',
    label:'Empleo',
    desc:'Ofertas y solicitudes de trabajo',
    to:'/tablon?cat=empleo',
    ...SECTION_COLORS.empleo,
  },
  {
    id:'negocios',
    emoji:'🏪',
    label:'Negocios',
    desc:'Comercios y profesionales hispanohablantes',
    to:'/comunidades?view=negocios',
    ...SECTION_COLORS.negocios,
  },
  {
    id:'creadores',
    emoji:'🎙️',
    label:'Creadores',
    desc:'Voces que cuentan Suiza en español',
    to:'/comunidades?view=creadores',
    ...SECTION_COLORS.creadores,
  },
  {
    id:'eventos',
    emoji:'🎉',
    label:'Eventos',
    desc:'Conciertos, fiestas y quedadas con fecha',
    to:'/comunidades?view=eventos',
    ...SECTION_COLORS.eventos,
  },
  {
    id:'grupos',
    emoji:'👥',
    label:'Grupos',
    desc:'Comunidades y chats por ciudad o interés',
    to:'/comunidades?view=comunidades',
    ...SECTION_COLORS.grupos,
  },
]

// Superficies secundarias: no son secciones propias, pero en movil no habia
// ninguna via para llegar a ellas.
export const EXPLORE_EXTRAS = [
  { id:'guias', emoji:'📚', label:'Guías', desc:'Permisos, trabajo, salud y dinero', to:'/guias', ...SECTION_COLORS.guias },
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
