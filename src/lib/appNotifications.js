export const APP_NOTIFICATION_KINDS = Object.freeze({
  MESSAGE:'message',
  CREATOR_FOLLOW:'creator_follow',
  CREATOR_HELPFUL:'creator_helpful',
  CONTENT_HELPFUL:'content_helpful',
  NEW_CREATOR:'new_creator',
  ZONE_AD:'zone_ad',
  ZONE_JOB:'zone_job',
  ZONE_BUSINESS:'zone_business',
  ZONE_EVENT:'zone_event',
  SAVED_SEARCH:'saved_search',
  BUSINESS_LEAD:'business_lead',
})

const KIND_ORDER = [
  APP_NOTIFICATION_KINDS.MESSAGE,
  APP_NOTIFICATION_KINDS.CREATOR_FOLLOW,
  APP_NOTIFICATION_KINDS.CREATOR_HELPFUL,
  APP_NOTIFICATION_KINDS.CONTENT_HELPFUL,
  APP_NOTIFICATION_KINDS.NEW_CREATOR,
  APP_NOTIFICATION_KINDS.SAVED_SEARCH,
  APP_NOTIFICATION_KINDS.BUSINESS_LEAD,
  APP_NOTIFICATION_KINDS.ZONE_AD,
  APP_NOTIFICATION_KINDS.ZONE_JOB,
  APP_NOTIFICATION_KINDS.ZONE_BUSINESS,
  APP_NOTIFICATION_KINDS.ZONE_EVENT,
]

function readData(row) {
  if (row?.data && typeof row.data === 'object') return row.data
  try {
    return JSON.parse(row?.data || '{}')
  } catch {
    return {}
  }
}

function getLatestRow(rows) {
  return [...rows].sort((first, second) => (
    new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
  ))[0]
}

function getMessageHref(rows) {
  const conversationIds = new Set(rows
    .map(row => readData(row).conversation_id)
    .filter(Boolean)
    .map(String))

  if (conversationIds.size !== 1) return '/mensajes'
  const [conversationId] = conversationIds
  return `/mensajes?conv=${encodeURIComponent(conversationId)}`
}

function describeNotificationGroup(kind, rows) {
  const count = rows.length
  const latest = getLatestRow(rows)
  const data = readData(latest)
  const actorName = String(data.actor_name || '').trim() || 'Alguien'
  const creatorName = String(data.creator_name || '').trim() || 'un nuevo creador'
  const targetTitle = String(data.target_title || '').trim()

  switch (kind) {
    case APP_NOTIFICATION_KINDS.MESSAGE:
      return {
        icon:'💬',
        title:count === 1 ? 'Tienes un nuevo mensaje' : `Tienes ${count} nuevos mensajes`,
        body:count === 1
          ? [actorName, data.preview].filter(Boolean).join(': ')
          : 'Abre Mensajes para ver las conversaciones pendientes.',
        href:getMessageHref(rows),
      }
    case APP_NOTIFICATION_KINDS.CREATOR_FOLLOW:
      return {
        icon:'👤',
        title:count === 1 ? `${actorName} comenzó a seguirte` : `Tienes ${count} nuevos seguidores`,
        body:count === 1
          ? 'Tu comunidad en Latido está creciendo.'
          : `${actorName} y más personas comenzaron a seguirte.`,
        href:data.href || '/creadores/mi-perfil',
      }
    case APP_NOTIFICATION_KINDS.CREATOR_HELPFUL:
      return {
        icon:'💙',
        title:count === 1 ? `A ${actorName} le ayudó tu perfil` : `Tu perfil recibió ${count} nuevos “Me ayudó”`,
        body:'Tu experiencia está ayudando a la comunidad.',
        href:data.href || '/creadores/mi-perfil',
      }
    case APP_NOTIFICATION_KINDS.CONTENT_HELPFUL:
      return {
        icon:'🙌',
        title:count === 1 ? `A ${actorName} le ayudó tu contenido` : `Tu contenido recibió ${count} nuevos “Me ayudó”`,
        body:targetTitle || 'Tu contenido está ayudando a la comunidad.',
        href:data.href || '/creadores/mi-perfil',
      }
    case APP_NOTIFICATION_KINDS.NEW_CREATOR:
      return {
        icon:'🎙️',
        title:count === 1 ? 'Nuevo creador en Latido' : `Hay ${count} nuevos creadores en Latido`,
        body:count === 1 ? `${creatorName} acaba de unirse.` : `Descubre a ${creatorName} y a más creadores.`,
        href:'/comunidades?view=creadores&creatorView=creadores',
      }
    case APP_NOTIFICATION_KINDS.SAVED_SEARCH:
      return {
        icon:'✨',
        title:count === 1 ? 'Hay algo nuevo para ti' : `Tienes ${count} novedades en tus búsquedas`,
        body:count === 1 ? data.title || 'Encontramos un resultado que coincide con tu búsqueda.' : 'Revisa los nuevos resultados que coinciden con tus alertas.',
        href:data.href || '/',
      }
    case APP_NOTIFICATION_KINDS.BUSINESS_LEAD:
      return {
        icon:'🔔',
        title:count === 1 ? 'Tienes un nuevo cliente potencial' : `Tienes ${count} nuevos clientes potenciales`,
        body:count === 1 ? data.title || 'Hay una nueva oportunidad para tu negocio.' : 'Abre Latido para revisar las nuevas oportunidades.',
        href:data.href || '/',
      }
    case APP_NOTIFICATION_KINDS.ZONE_AD:
    case APP_NOTIFICATION_KINDS.ZONE_JOB:
    case APP_NOTIFICATION_KINDS.ZONE_BUSINESS:
    case APP_NOTIFICATION_KINDS.ZONE_EVENT: {
      const titles = {
        [APP_NOTIFICATION_KINDS.ZONE_AD]:['Nuevo anuncio en tu zona', `${count} nuevos anuncios en tu zona`],
        [APP_NOTIFICATION_KINDS.ZONE_JOB]:['Nueva oportunidad de empleo en tu zona', `${count} nuevas oportunidades de empleo en tu zona`],
        [APP_NOTIFICATION_KINDS.ZONE_BUSINESS]:['Nuevo negocio en tu zona', `${count} nuevos negocios en tu zona`],
        [APP_NOTIFICATION_KINDS.ZONE_EVENT]:['Nuevo evento en tu zona', `${count} nuevos eventos en tu zona`],
      }
      const [singularTitle, pluralTitle] = titles[kind]
      return {
        icon:data.icon || '📍',
        title:count === 1 ? singularTitle : pluralTitle,
        body:count === 1 ? data.title || 'Hay una novedad cerca de ti.' : 'Abre Latido para ver todas las novedades.',
        href:data.href || '/',
      }
    }
    default:
      return {
        icon:'🔔',
        title:count === 1 ? 'Tienes una nueva notificación' : `Tienes ${count} nuevas notificaciones`,
        body:'Hay novedades esperándote en Latido.',
        href:data.href || '/',
      }
  }
}

export function groupAppNotifications(rows = []) {
  const unreadRows = rows.filter(row => row?.id && !row.read_at)
  const byKind = new Map()

  for (const row of unreadRows) {
    const kind = String(row.kind || '')
    if (!byKind.has(kind)) byKind.set(kind, [])
    byKind.get(kind).push(row)
  }

  return [...byKind.entries()]
    .map(([kind, notificationRows]) => {
      const sortedRows = [...notificationRows].sort((first, second) => (
        new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
      ))
      const description = describeNotificationGroup(kind, sortedRows)

      return {
        kind,
        source:sortedRows[0]?.source || 'app',
        count:sortedRows.length,
        notifications:sortedRows,
        notificationIds:sortedRows.map(row => row.id),
        unseenIds:sortedRows.filter(row => !row.seen_at).map(row => row.id),
        latestAt:sortedRows[0]?.created_at || '',
        ...description,
      }
    })
    .sort((first, second) => {
      const timeDifference = new Date(second.latestAt || 0).getTime() - new Date(first.latestAt || 0).getTime()
      if (timeDifference) return timeDifference
      return KIND_ORDER.indexOf(first.kind) - KIND_ORDER.indexOf(second.kind)
    })
}

export function createExternalNotificationRows({
  zoneAlerts = [],
  businessLeadAlerts = [],
  savedSearchAlerts = [],
  getSavedSearchAlertPath = alert => alert?.result_path || '/',
  seenIds = new Set(),
} = {}) {
  const zoneRows = zoneAlerts.map(alert => ({
    id:`zone:${alert.key}`,
    source:'zone',
    source_id:alert.key,
    kind:`zone_${alert.kind}`,
    data:{ title:alert.title, href:alert.href, icon:alert.icon },
    seen_at:seenIds.has(`zone:${alert.key}`) ? 'persisted' : null,
    read_at:null,
    created_at:alert.createdAt || '',
  }))
  const leadRows = businessLeadAlerts.map(alert => ({
    id:`business_lead:${alert.id}`,
    source:'business_lead',
    source_id:alert.id,
    kind:APP_NOTIFICATION_KINDS.BUSINESS_LEAD,
    data:{ title:alert.listing_title, href:alert.listing_path },
    seen_at:seenIds.has(`business_lead:${alert.id}`) ? 'persisted' : null,
    read_at:null,
    created_at:alert.created_at || '',
  }))
  const savedRows = savedSearchAlerts.map(alert => ({
    id:`saved_search:${alert.id}`,
    source:'saved_search',
    source_id:alert.id,
    kind:APP_NOTIFICATION_KINDS.SAVED_SEARCH,
    data:{ title:alert.result_title, href:getSavedSearchAlertPath(alert) },
    seen_at:seenIds.has(`saved_search:${alert.id}`) ? 'persisted' : null,
    read_at:null,
    created_at:alert.matched_at || '',
  }))

  return [...zoneRows, ...leadRows, ...savedRows]
}
