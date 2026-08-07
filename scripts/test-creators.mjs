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
  CREATOR_FEATURED_CONTENTS,
  formatCreatorHandle,
  getAutomaticCreatorThumbnail,
  getCreatorVideoEmbed,
  getCreatorContentsNewestFirst,
  getCreatorForUser,
  getFeaturedCreatorContents,
  isCreatorHandleAvailable,
  getFollowedCreatorIds,
  getCreatorInteractionState,
  getCreatorOEmbedMetadata,
  getCreatorTopicsFromInterests,
  getOrderedCreatorContents,
  saveCreatorContent,
  saveCreatorProfile,
  setCreatorContentFeatured,
  toggleCreatorInteraction,
} = await import('../src/lib/creators.js')
const { resolveTikTokLink } = await import('../api/tiktok-resolve.js')

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
  getCreatorContentsNewestFirst(creator, { publishedOnly:true }).map(content => content.id),
  [third.id, second.id, first.id],
  'La publicación añadida más recientemente debe aparecer primero.',
)

assert.deepEqual(
  getFeaturedCreatorContents(creator).map(content => content.id),
  [third.id, second.id, first.id],
  'Los nuevos destacados deben aparecer primero.',
)

setCreatorContentFeatured(userId, first.id, false)
creator = getCreatorForUser(userId)
assert.deepEqual(
  getFeaturedCreatorContents(creator).map(content => content.id),
  [third.id, second.id],
  'El creador debe poder retirar una publicación de Destacados.',
)

setCreatorContentFeatured(userId, first.id, true)
creator = getCreatorForUser(userId)
assert.deepEqual(
  getFeaturedCreatorContents(creator).map(content => content.id),
  [first.id, third.id, second.id],
  'La publicación destacada más recientemente debe aparecer primero.',
)

assert.equal(
  getAutomaticCreatorThumbnail('https://www.youtube.com/watch?v=abcdefghijk'),
  'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
  'YouTube debe generar una miniatura desde el ID del vídeo.',
)

assert.deepEqual(
  getCreatorVideoEmbed({ url:'https://www.youtube.com/shorts/abcdefghijk' }),
  {
    platform:'youtube',
    src:'https://www.youtube-nocookie.com/embed/abcdefghijk?playsinline=1&rel=0&hl=es',
    vertical:false,
  },
  'Los vídeos de YouTube deben abrirse en el reproductor integrado.',
)

assert.deepEqual(
  getCreatorVideoEmbed({ url:'https://www.tiktok.com/@latido/video/123456789' }),
  {
    platform:'tiktok',
    src:'https://www.tiktok.com/player/v1/123456789?autoplay=0&loop=0&fullscreen_button=0',
    vertical:true,
  },
  'Los vídeos de TikTok deben abrirse en el reproductor vertical integrado.',
)

const shortTikTokUrl = 'https://vm.tiktok.com/ZN8Re8hNH/'
const resolvedTikTokUrl = 'https://www.tiktok.com/@/video/7670562387044470038?_r=1'
const resolvedTikTok = await resolveTikTokLink(shortTikTokUrl, {
  fetchImpl:async () => ({ ok:true, url:resolvedTikTokUrl }),
})

assert.equal(resolvedTikTok.video_id, '7670562387044470038', 'El backend debe seguir la redirección y extraer el ID del vídeo.')
assert.equal(resolvedTikTok.embed_url, 'https://www.tiktok.com/player/v1/7670562387044470038', 'El backend debe generar la URL oficial del player.')

assert.deepEqual(
  getCreatorVideoEmbed({ url:shortTikTokUrl, video_id:resolvedTikTok.video_id, resolved_url:resolvedTikTok.resolved_url }),
  {
    platform:'tiktok',
    src:'https://www.tiktok.com/player/v1/7670562387044470038?autoplay=0&loop=0&fullscreen_button=0',
    vertical:true,
  },
  'Un enlace corto guardado debe reproducirse con el ID resuelto.',
)

const savedShortTikTok = saveCreatorContent(userId, {
  title:'Vídeo corto de TikTok resuelto',
  summary:'Este contenido comprueba que el enlace original se conserva junto con los datos del reproductor.',
  url:shortTikTokUrl,
  platform:'tiktok',
  video_id:resolvedTikTok.video_id,
  resolved_url:resolvedTikTok.resolved_url,
  topic:'trabajo',
})
assert.equal(savedShortTikTok.url, shortTikTokUrl, 'La publicación debe conservar el enlace corto original.')
assert.equal(savedShortTikTok.video_id, resolvedTikTok.video_id, 'La publicación debe guardar el ID resuelto una sola vez.')

const extraContents = Array.from({ length:3 }, (_, index) => saveCreatorContent(userId, {
  title:`Publicación adicional ${index + 1}`,
  summary:'Contenido adicional para comprobar el límite independiente de destacados.',
  url:`https://example.com/publicacion-${index + 1}`,
  platform:'web',
  topic:'trabajo',
}))
creator = getCreatorForUser(userId)
assert.equal(getFeaturedCreatorContents(creator).length, CREATOR_FEATURED_CONTENTS, 'Destacados debe admitir como máximo seis publicaciones.')
assert.equal(
  getFeaturedCreatorContents(creator).some(content => content.id === extraContents.at(-1).id),
  false,
  'Las publicaciones posteriores deben seguir publicándose sin entrar automáticamente cuando Destacados está completo.',
)
assert.throws(
  () => setCreatorContentFeatured(userId, extraContents.at(-1).id, true),
  /máximo de 6/,
  'Para destacar otra publicación primero debe retirarse una de la selección.',
)

assert.deepEqual(
  getCreatorVideoEmbed({ url:'https://www.instagram.com/reel/ABC_123/?utm_source=share' }),
  {
    platform:'instagram',
    src:'https://www.instagram.com/reel/ABC_123/embed/?locale=es',
    vertical:true,
  },
  'Los reels de Instagram deben abrirse mediante el enlace de inserción oficial.',
)

assert.equal(
  getCreatorVideoEmbed({ url:'https://www.instagram.com/latido_ch/' }),
  null,
  'Los perfiles sociales deben conservar la apertura externa como respaldo.',
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
