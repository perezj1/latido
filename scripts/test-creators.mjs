import assert from 'node:assert/strict'

class MemoryStorage {
  #values = new Map()

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null
  }

  setItem(key, value) {
    this.#values.set(key, String(value))
  }

  removeItem(key) {
    this.#values.delete(key)
  }
}

globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type
  }
}

globalThis.window = {
  localStorage:new MemoryStorage(),
  sessionStorage:new MemoryStorage(),
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
}

const {
  formatCreatorHandle,
  getAutomaticCreatorThumbnail,
  getCreatorForUser,
  isCreatorHandleAvailable,
  getFollowedCreatorIds,
  getCreatorInteractionState,
  getCreatorOEmbedMetadata,
  getCreatorTopicsFromInterests,
  getOrderedCreatorContents,
  moveCreatorContent,
  saveCreatorContent,
  saveCreatorProfile,
  toggleCreatorInteraction,
} = await import('../src/lib/creators.js')

assert.equal(formatCreatorHandle('perfilantiguo'), '@perfilantiguo', 'Los alias antiguos también deben mostrarse con @.')

const userId = 'test-creator-user'
saveCreatorProfile(userId, {
  name:'Perfil de prueba',
  handle:'@perfildeprueba',
  avatar_url:'data:image/webp;base64,avatar-test',
  tagline:'Contenido útil sobre Suiza',
  bio:'Una descripción suficientemente clara para probar el perfil del creador.',
  canton:'ZH',
  topics:['trabajo'],
  socials:[
    { platform:'youtube', url:'https://youtube.com/@prueba', follower_range:'1k_5k' },
  ],
})

assert.equal(
  getCreatorForUser(userId)?.avatar_url,
  'data:image/webp;base64,avatar-test',
  'La foto elegida debe guardarse con el perfil del creador.',
)

assert.equal(isCreatorHandleAvailable('@PERFILDEPRUEBA', userId), true, 'El propietario debe poder conservar su usuario al editar.')
assert.equal(isCreatorHandleAvailable('@PERFILDEPRUEBA', 'another-user'), false, 'Los usuarios de creador no deben poder repetirse.')
assert.throws(
  () => saveCreatorProfile('another-user', { name:'Otro perfil', handle:'@PERFILDEPRUEBA' }),
  /ya pertenece a otro perfil/,
  'El guardado también debe rechazar un usuario duplicado.',
)

const first = saveCreatorContent(userId, {
  title:'Primera publicación',
  summary:'Resumen de prueba',
  url:'https://youtu.be/abcdefghijk',
  platform:'youtube',
  topic:'trabajo',
  position:1,
})
const second = saveCreatorContent(userId, {
  title:'Nueva carta de presentación',
  summary:'Resumen de prueba',
  url:'https://youtu.be/lmnopqrstuv',
  platform:'youtube',
  topic:'trabajo',
  position:1,
})
const third = saveCreatorContent(userId, {
  title:'Publicación intermedia',
  summary:'Resumen de prueba',
  url:'https://youtu.be/zyxwvutsrqp',
  platform:'youtube',
  topic:'trabajo',
  position:2,
})

let creator = getCreatorForUser(userId)
assert.deepEqual(
  getOrderedCreatorContents(creator).map(content => content.id),
  [second.id, third.id, first.id],
  'La posición elegida debe ordenar Los 6.',
)

moveCreatorContent(userId, first.id, 'up')
creator = getCreatorForUser(userId)
assert.deepEqual(
  getOrderedCreatorContents(creator).map(content => content.id),
  [second.id, first.id, third.id],
  'El panel debe permitir reordenar la selección.',
)

assert.equal(
  getAutomaticCreatorThumbnail('https://www.youtube.com/watch?v=abcdefghijk'),
  'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
  'YouTube debe generar una miniatura desde el ID del vídeo.',
)

assert.deepEqual(
  getCreatorTopicsFromInterests(['empleo', 'vivienda', 'comunidad']),
  ['trabajo', 'vivienda', 'integracion'],
  'Los intereses del onboarding deben precargar temas equivalentes del perfil de creador.',
)

const originalFetch = globalThis.fetch
let requestedOEmbedUrl = ''
globalThis.fetch = async url => {
  requestedOEmbedUrl = String(url)
  return {
    ok:true,
    async json() {
      return { title:'Título detectado', thumbnail_url:'https://example.com/thumbnail.jpg' }
    },
  }
}
try {
  const youtubeMetadata = await getCreatorOEmbedMetadata('https://www.youtube.com/watch?v=abcdefghijk')
  assert.equal(youtubeMetadata.title, 'Título detectado', 'YouTube debe poder completar el título desde oEmbed.')
  assert.match(requestedOEmbedUrl, /youtube\.com\/oembed/, 'YouTube debe usar su endpoint público de oEmbed.')

  await getCreatorOEmbedMetadata('https://www.tiktok.com/@latido/video/123456789')
  assert.match(requestedOEmbedUrl, /tiktok\.com\/oembed/, 'TikTok debe usar su endpoint público de oEmbed.')
} finally {
  globalThis.fetch = originalFetch
}

const interaction = { action:'helpful', targetType:'content', targetId:first.id, actorId:userId }
toggleCreatorInteraction(interaction)
assert.deepEqual(getCreatorInteractionState(interaction), { active:true, count:1 })
toggleCreatorInteraction(interaction)
assert.deepEqual(getCreatorInteractionState(interaction), { active:false, count:0 })

const follow = { action:'saved', targetType:'creator', targetId:creator.id, actorId:userId }
toggleCreatorInteraction(follow)
assert.deepEqual(getFollowedCreatorIds(userId), [creator.id], 'Seguir un perfil debe guardarlo en Creadores seguidos.')
toggleCreatorInteraction(follow)
assert.deepEqual(getFollowedCreatorIds(userId), [], 'Dejar de seguir debe retirar el perfil de la lista.')

console.log('Creator prototype tests passed')
