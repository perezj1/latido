// Sistema visual de iconos de Latido.
//
// La interfaz usa nombres semanticos a traves de <Icon name="..." />. El
// proveedor queda centralizado aqui para no acoplar las pantallas al nombre
// concreto de cada glifo. Los emojis de datos (fallbacks de fotos, anuncios,
// empleos, negocios y contenido) siguen viviendo en sus modelos y tarjetas.
import {
  RiAddLargeLine,
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiArrowLeftSLine,
  RiArrowRightLine,
  RiArrowRightSLine,
  RiArrowUpSLine,
  RiBankCardLine,
  RiBarChartBoxLine,
  RiBookOpenLine,
  RiBookmarkLine,
  RiBriefcaseLine,
  RiBroadcastLine,
  RiBrush3Line,
  RiBuilding2Line,
  RiBuilding4Line,
  RiCalendarEventLine,
  RiCamera3Line,
  RiChat3Line,
  RiCheckLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiCompass3Line,
  RiComputerLine,
  RiCursorLine,
  RiDeleteBin6Line,
  RiDownload2Line,
  RiEarthLine,
  RiEdit2Line,
  RiEmpathizeLine,
  RiEqualizer2Line,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiFileCopyLine,
  RiFileTextLine,
  RiFlag2Line,
  RiFlashlightLine,
  RiGiftLine,
  RiGlobalLine,
  RiGroupLine,
  RiHeartFill,
  RiHeartLine,
  RiHome4Line,
  RiHomeLine,
  RiImageLine,
  RiInformationLine,
  RiInstagramLine,
  RiLightbulbLine,
  RiLinkM,
  RiLoader4Line,
  RiLock2Line,
  RiLogoutBoxRLine,
  RiMailLine,
  RiMapPin2Line,
  RiMegaphoneLine,
  RiMenuLine,
  RiMicLine,
  RiMoneyEuroCircleLine,
  RiMore2Line,
  RiMovieLine,
  RiNotification3Line,
  RiNotificationBadgeLine,
  RiParentLine,
  RiPhoneLine,
  RiPlayFill,
  RiProhibited2Line,
  RiQuestionLine,
  RiRefreshLine,
  RiRestaurant2Line,
  RiRocket2Line,
  RiSchoolLine,
  RiSearchLine,
  RiScissors2Line,
  RiSendPlane2Line,
  RiServiceLine,
  RiSettings3Line,
  RiShakeHandsLine,
  RiShareForwardLine,
  RiShoppingBag3Line,
  RiSortDesc,
  RiSparkling2Line,
  RiStarHalfLine,
  RiStarLine,
  RiStockLine,
  RiStore2Line,
  RiTeamLine,
  RiThumbDownLine,
  RiThumbUpLine,
  RiTiktokLine,
  RiTimeLine,
  RiToolsLine,
  RiTranslate2,
  RiTrophyLine,
  RiTruckLine,
  RiUser3Line,
  RiVerifiedBadgeLine,
  RiWhatsappLine,
} from '@remixicon/react'

// Nombre estable de Latido -> componente oficial de Remix Icon.
const ICON_SOURCES = {
  // Navegacion y chrome
  home: RiHomeLine,
  explore: RiCompass3Line,
  search: RiSearchLine,
  menu: RiMenuLine,
  close: RiCloseLine,
  back: RiArrowLeftLine,
  forward: RiArrowRightLine,
  chevronRight: RiArrowRightSLine,
  chevronLeft: RiArrowLeftSLine,
  chevronUp: RiArrowUpSLine,
  chevronDown: RiArrowDownSLine,
  more: RiMore2Line,
  external: RiExternalLinkLine,
  link: RiLinkM,

  // Identidad y cuentas
  user: RiUser3Line,
  users: RiTeamLine,
  profile: RiUser3Line,
  logout: RiLogoutBoxRLine,
  lock: RiLock2Line,
  settings: RiSettings3Line,
  ban: RiProhibited2Line,
  verified: RiVerifiedBadgeLine,

  // Secciones de contenido
  listing: RiMegaphoneLine,
  job: RiBriefcaseLine,
  business: RiStore2Line,
  creator: RiMicLine,
  event: RiCalendarEventLine,
  group: RiGroupLine,
  housing: RiHome4Line,
  service: RiServiceLine,
  care: RiEmpathizeLine,
  sale: RiShoppingBag3Line,
  document: RiFileTextLine,
  gift: RiGiftLine,
  guide: RiBookOpenLine,
  movie: RiMovieLine,

  // Acciones
  add: RiAddLine,
  addLarge: RiAddLargeLine,
  edit: RiEdit2Line,
  delete: RiDeleteBin6Line,
  check: RiCheckLine,
  share: RiShareForwardLine,
  save: RiBookmarkLine,
  favorite: RiHeartLine,
  favoriteActive: RiHeartFill,
  send: RiSendPlane2Line,
  copy: RiFileCopyLine,
  download: RiDownload2Line,
  refresh: RiRefreshLine,
  filter: RiEqualizer2Line,
  sort: RiSortDesc,
  report: RiFlag2Line,
  helpful: RiThumbUpLine,
  notHelpful: RiThumbDownLine,

  // Comunicacion
  message: RiChat3Line,
  mail: RiMailLine,
  phone: RiPhoneLine,
  bell: RiNotification3Line,
  bellActive: RiNotificationBadgeLine,
  megaphone: RiMegaphoneLine,
  instagram: RiInstagramLine,
  tiktok: RiTiktokLine,
  whatsapp: RiWhatsappLine,

  // Estado y feedback
  success: RiCheckboxCircleLine,
  warning: RiErrorWarningLine,
  info: RiInformationLine,
  help: RiQuestionLine,
  loading: RiLoader4Line,
  clock: RiTimeLine,
  star: RiStarLine,
  starHalf: RiStarHalfLine,
  trophy: RiTrophyLine,
  sparkles: RiSparkling2Line,
  idea: RiLightbulbLine,
  rocket: RiRocket2Line,
  zap: RiFlashlightLine,
  play: RiPlayFill,

  // Datos y panel de administracion
  chart: RiBarChartBoxLine,
  trending: RiStockLine,
  live: RiBroadcastLine,
  views: RiEyeLine,
  clicks: RiCursorLine,
  calendar: RiCalendarEventLine,
  location: RiMapPin2Line,
  money: RiMoneyEuroCircleLine,
  payment: RiBankCardLine,
  partner: RiShakeHandsLine,
  image: RiImageLine,
  camera: RiCamera3Line,
  world: RiEarthLine,
  website: RiGlobalLine,

  // Categorias y oficios
  cleaning: RiBrush3Line,
  cooking: RiRestaurant2Line,
  repair: RiToolsLine,
  moving: RiTruckLine,
  classes: RiSchoolLine,
  beauty: RiScissors2Line,
  tech: RiComputerLine,
  childcare: RiParentLine,
  language: RiTranslate2,
  company: RiBuilding2Line,
  building: RiBuilding4Line,
}

export const ICON_NAMES = Object.keys(ICON_SOURCES)

// Se conserva por compatibilidad con llamadas existentes. Los iconos Line de
// Remix ya traen su peso definido y no necesitan configurar el trazo.
export const ICON_STROKE = 1.75

export function Icon({
  name,
  size = 16,
  color = 'currentColor',
  title = '',
  style = {},
  className = '',
}) {
  const Glyph = ICON_SOURCES[name] || ICON_SOURCES.info

  return (
    <Glyph
      size={size}
      color={color}
      className={className}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      role={title ? 'img' : undefined}
      // inline-block y no block: dentro de flex o grid da igual (el contenedor
      // los blockifica), pero junto a texto el icono se queda en la misma linea
      // en vez de formar su propio bloque y empujar la palabra abajo.
      style={{ flexShrink:0, display:'inline-block', verticalAlign:'-0.125em', ...style }}
    />
  )
}

const INTERFACE_EMOJI_ICONS = {
  '🏠':'housing', '🏡':'housing', '🏘':'housing',
  '🔎':'search', '🔍':'search',
  '💬':'message', '🗨':'message', '✉':'mail', '📧':'mail', '📩':'mail', '📨':'mail',
  '📲':'download', '📞':'phone',
  '👤':'user', '🙋':'user', '🧑':'user', '👩':'user', '👨':'user',
  '💼':'job', '🧰':'job', '🛠':'repair', '🔧':'repair', '🧹':'cleaning', '🚚':'moving', '💻':'tech',
  '🏪':'business', '🏢':'building', '🏬':'business', '🛍':'sale', '🛒':'sale', '🏷':'sale', '💳':'payment', '💰':'money', '💸':'money', '🏦':'money',
  '👥':'group', '👪':'group', '👨‍👩‍👧':'group', '👩‍👧':'group',
  '📅':'calendar', '🗓':'calendar', '🎉':'event', '🎊':'event', '🎟':'event', '🕐':'clock', '🕒':'clock', '🕔':'clock',
  '📍':'location', '📌':'listing', '🧭':'explore',
  '🔔':'bell', '📣':'megaphone', '⚠':'warning', '⛔':'warning', '🚨':'warning',
  '❤':'favorite', '💙':'favorite', '💚':'favorite', '💛':'favorite', '🧡':'favorite', '💜':'favorite', '🖤':'favorite', '🤍':'favorite', '💗':'favorite', '💖':'favorite', '💕':'favorite', '💓':'favorite',
  '🎚':'filter', '⚙':'settings',
  '📤':'share', '🔗':'link', '↗':'external',
  '➕':'add', '✨':'sparkles', '🚀':'rocket', '🎁':'gift',
  '🔐':'lock', '🔒':'lock', '🔑':'lock', '🛡':'verified',
  '✅':'success', '✔':'check', '✓':'check', '🏆':'trophy', '⭐':'star', '★':'star', '☆':'star',
  '🌐':'website', '🌎':'world', '🌍':'world', '🌏':'world', '🗣':'language',
  '🎙':'creator', '🎤':'creator', '🎧':'creator', '🎬':'creator', '📹':'creator', '▶':'play',
  '📄':'document', '📋':'document', '📝':'edit', '📰':'document', '🧾':'document', '📚':'guide', 'ℹ':'info', '❓':'help', '🎓':'classes',
  '📸':'instagram', '📷':'camera', '🎵':'tiktok',
  '👍':'helpful', '👎':'notHelpful',
  '🗑':'delete', '✏':'edit', '✎':'edit',
  '⏳':'loading',
}

export function getInterfaceIconName(value, fallback='info') {
  const normalized = String(value || '').replaceAll('\uFE0F', '').trim()
  return INTERFACE_EMOJI_ICONS[normalized] || fallback
}

export function InterfaceIcon({ emoji, fallback='info', ...props }) {
  return <Icon name={getInterfaceIconName(emoji, fallback)} {...props} />
}

const CATEGORY_ICONS = {
  vivienda:'housing',
  servicios:'service',
  cuidados:'care',
  venta:'sale',
  documentos:'document',
  empleo:'job',
  regalo:'gift',
  eventos:'event',
  comunidad:'group',
  negocios:'business',
}

const SECTION_ICONS = {
  anuncios:'listing',
  empleo:'job',
  negocios:'business',
  creadores:'creator',
  eventos:'event',
  grupos:'group',
}

const CREATOR_TOPIC_ICONS = {
  tramites:'document',
  trabajo:'job',
  negocios:'business',
  vivienda:'housing',
  familia:'care',
  dinero:'money',
  planes:'event',
  gastronomia:'cooking',
  integracion:'partner',
}

const NOTIFICATION_ICONS = {
  message:'message',
  favorite:'favorite',
  saved_search:'search',
  zone_alert:'location',
  business_lead:'business',
  creator:'creator',
  report:'report',
  system:'bell',
}

export function getCategoryIconName(categoryId) {
  return CATEGORY_ICONS[categoryId] || 'listing'
}

export function getSectionIconName(sectionId) {
  return SECTION_ICONS[sectionId] || 'listing'
}

export function getCreatorTopicIconName(topicId) {
  return CREATOR_TOPIC_ICONS[topicId] || 'creator'
}

export function getNotificationIconName(type) {
  return NOTIFICATION_ICONS[type] || 'bell'
}
