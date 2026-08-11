import assert from 'node:assert/strict'

const {
  APP_NOTIFICATION_KINDS,
  createExternalNotificationRows,
  groupAppNotifications,
} = await import('../src/lib/appNotifications.js')

const notification = (overrides = {}) => ({
  id:overrides.id || crypto.randomUUID(),
  kind:overrides.kind || APP_NOTIFICATION_KINDS.CREATOR_FOLLOW,
  source_id:overrides.source_id || crypto.randomUUID(),
  data:overrides.data || {},
  seen_at:overrides.seen_at ?? null,
  read_at:overrides.read_at ?? null,
  created_at:overrides.created_at || '2026-08-10T10:00:00.000Z',
})

const followerGroups = groupAppNotifications([
  notification({
    id:'follow-older',
    seen_at:'2026-08-10T10:01:00.000Z',
    data:{ actor_name:'Lucía' },
    created_at:'2026-08-10T10:00:00.000Z',
  }),
  notification({
    id:'follow-new',
    data:{ actor_name:'Ana' },
    created_at:'2026-08-10T10:05:00.000Z',
  }),
])

assert.equal(followerGroups.length, 1)
assert.equal(followerGroups[0].count, 2)
assert.equal(followerGroups[0].title, 'Tienes 2 nuevos seguidores')
assert.deepEqual(followerGroups[0].unseenIds, ['follow-new'])
assert.deepEqual(followerGroups[0].notificationIds, ['follow-new', 'follow-older'])

const messageGroup = groupAppNotifications([
  notification({
    id:'message-1',
    kind:APP_NOTIFICATION_KINDS.MESSAGE,
    data:{ actor_name:'José', conversation_id:'conv con espacios', preview:'Hola' },
  }),
])[0]

assert.equal(messageGroup.title, 'Tienes un nuevo mensaje')
assert.equal(messageGroup.body, 'José: Hola')
assert.equal(messageGroup.href, '/mensajes?conv=conv%20con%20espacios')

const creatorGroup = groupAppNotifications([
  notification({
    id:'creator-1',
    kind:APP_NOTIFICATION_KINDS.NEW_CREATOR,
    data:{ creator_name:'Vivir en Berna', href:'/creadores/vivir-en-berna' },
  }),
])[0]

assert.equal(creatorGroup.title, 'Nuevo creador en Latido')
assert.equal(creatorGroup.body, 'Vivir en Berna acaba de unirse.')
assert.equal(creatorGroup.href, '/comunidades?view=creadores&creatorView=creadores')

const unreadOnly = groupAppNotifications([
  notification({ id:'unread', kind:APP_NOTIFICATION_KINDS.CONTENT_HELPFUL }),
  notification({ id:'read', kind:APP_NOTIFICATION_KINDS.CONTENT_HELPFUL, read_at:'2026-08-10T10:06:00.000Z' }),
])

assert.equal(unreadOnly[0].count, 1)
assert.deepEqual(unreadOnly[0].notificationIds, ['unread'])

const externalRows = createExternalNotificationRows({
  zoneAlerts:[
    { key:'ad:1', kind:'ad', title:'Clases de alemán', href:'/tablon?openAd=1', icon:'📌', createdAt:'2026-08-10T11:00:00.000Z' },
    { key:'ad:2', kind:'ad', title:'Ayuda con mudanza', href:'/tablon?openAd=2', icon:'📌', createdAt:'2026-08-10T12:00:00.000Z' },
  ],
  seenIds:new Set(['zone:ad:1']),
})
const zoneGroup = groupAppNotifications(externalRows)[0]

assert.equal(zoneGroup.source, 'zone')
assert.equal(zoneGroup.title, '2 nuevos anuncios en tu zona')
assert.deepEqual(zoneGroup.unseenIds, ['zone:ad:2'])

console.log('App notification grouping tests passed')
