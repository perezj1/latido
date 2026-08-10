import assert from 'node:assert/strict'

const {
  CREATOR_FEATURED_CONTENTS,
  CREATOR_VIDEO_IFRAME_PERMISSIONS,
  detectCreatorPlatform,
  formatCreatorHandle,
  getAutomaticCreatorThumbnail,
  getCreatorContentsNewestFirst,
  getCreatorInteractionState,
  getCreatorOEmbedMetadata,
  getCreatorTopicsFromInterests,
  getCreatorVideoEmbed,
  getFeaturedCreatorContents,
  getOrderedCreatorContents,
  normalizeCreatorUrl,
  slugifyCreator,
} = await import('../src/lib/creators.js')
const { resolveTikTokLink } = await import('../api/tiktok-resolve.js')
const { getSeoForLocation } = await import('../src/lib/seo.js')

assert.equal(formatCreatorHandle('perfilantiguo'), '@perfilantiguo')
assert.equal(slugifyCreator('María en Zúrich'), 'maria-en-zurich')
assert.equal(normalizeCreatorUrl('latido.ch/creadores'), 'https://latido.ch/creadores')
assert.equal(normalizeCreatorUrl('javascript:alert(1)'), '')
assert.equal(detectCreatorPlatform('https://example.com/?next=youtube.com'), 'web')

const creator = {
  id:'creator-1',
  featured_content_ids:['content-2', 'content-1'],
  contents:[
    { id:'content-1', title:'Contenido anterior', url:'https://example.com/1', status:'published', sort_order:1, published_at:'2026-08-01T10:00:00.000Z' },
    { id:'content-2', title:'Contenido reciente', url:'https://example.com/2', status:'published', sort_order:2, published_at:'2026-08-07T10:00:00.000Z' },
    { id:'content-3', title:'Borrador', url:'https://example.com/3', status:'draft', sort_order:3, published_at:'2026-08-08T10:00:00.000Z' },
  ],
}

assert.deepEqual(
  getOrderedCreatorContents(creator).map(content => content.id),
  ['content-1', 'content-2', 'content-3'],
  'El orden editorial debe conservarse.',
)
assert.deepEqual(
  getCreatorContentsNewestFirst(creator, { publishedOnly:true }).map(content => content.id),
  ['content-2', 'content-1'],
  'El contenido publicado más reciente debe aparecer primero.',
)
assert.deepEqual(
  getOrderedCreatorContents({
    contents:[
      { id:'visible', url:'https://example.com/visible', status:'published', active:true },
      { id:'moderated', url:'https://example.com/moderated', status:'published', active:false },
    ],
  }, { publishedOnly:true }).map(content => content.id),
  ['visible'],
  'El contenido oculto por moderación no debe llegar a las vistas públicas.',
)
assert.deepEqual(
  getFeaturedCreatorContents(creator).map(content => content.id),
  ['content-2', 'content-1'],
  'Los destacados deben respetar la selección persistida.',
)
assert.equal(CREATOR_FEATURED_CONTENTS, 6)
assert.deepEqual(
  CREATOR_VIDEO_IFRAME_PERMISSIONS,
  {
    allow:'accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share',
    allowFullScreen:true,
  },
  'Los reproductores externos deben recibir permisos de reproducción y pantalla completa.',
)
assert.equal(
  getSeoForLocation({ pathname:'/publicar-contenido', search:'' }).robots,
  'noindex, nofollow',
  'El formulario de publicación de contenido no debe indexarse.',
)

assert.equal(
  getAutomaticCreatorThumbnail('https://www.youtube.com/watch?v=abcdefghijk'),
  'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
)
assert.deepEqual(
  getCreatorVideoEmbed({ url:'https://www.youtube.com/shorts/abcdefghijk' }),
  {
    platform:'youtube',
    src:'https://www.youtube-nocookie.com/embed/abcdefghijk?playsinline=1&rel=0&hl=es',
    vertical:false,
  },
)
assert.deepEqual(
  getCreatorVideoEmbed({ url:'https://www.tiktok.com/@latido/video/123456789' }),
  {
    platform:'tiktok',
    src:'https://www.tiktok.com/player/v1/123456789?autoplay=0&loop=0&fullscreen_button=0',
    vertical:true,
  },
)
assert.deepEqual(
  getCreatorVideoEmbed({ url:'https://www.instagram.com/reel/ABC_123/?utm_source=share' }),
  {
    platform:'instagram',
    src:'https://www.instagram.com/reel/ABC_123/embed/?locale=es',
    vertical:true,
  },
)
assert.equal(getCreatorVideoEmbed({ url:'https://www.instagram.com/latido_ch/' }), null)

const shortTikTokUrl = 'https://vm.tiktok.com/ZN8Re8hNH/'
const resolvedTikTokUrl = 'https://www.tiktok.com/@/video/7670562387044470038?_r=1'
const resolvedTikTok = await resolveTikTokLink(shortTikTokUrl, {
  fetchImpl:async () => ({ ok:true, url:resolvedTikTokUrl }),
})
assert.equal(resolvedTikTok.video_id, '7670562387044470038')
assert.equal(resolvedTikTok.embed_url, 'https://www.tiktok.com/player/v1/7670562387044470038')
await assert.rejects(
  resolveTikTokLink(shortTikTokUrl, {
    fetchImpl:async () => ({
      ok:false,
      status:302,
      headers:{ get:() => 'http://127.0.0.1/private' },
    }),
  }),
  /Only TikTok HTTPS URLs are allowed/,
  'El resolvedor no debe seguir redirecciones fuera de TikTok.',
)
assert.equal(
  getCreatorVideoEmbed({ url:shortTikTokUrl, video_id:resolvedTikTok.video_id })?.src,
  'https://www.tiktok.com/player/v1/7670562387044470038?autoplay=0&loop=0&fullscreen_button=0',
)

assert.deepEqual(
  getCreatorTopicsFromInterests(['empleo', 'vivienda', 'comunidad']),
  ['trabajo', 'vivienda', 'integracion'],
)
assert.deepEqual(
  getCreatorInteractionState({ action:'helpful', targetType:'content', targetId:'content-1', actorId:'user-1', baseCount:12 }),
  { active:false, count:12 },
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
  assert.equal(youtubeMetadata.title, 'Título detectado')
  assert.match(requestedOEmbedUrl, /youtube\.com\/oembed/)

  await getCreatorOEmbedMetadata('https://www.tiktok.com/@latido/video/123456789')
  assert.match(requestedOEmbedUrl, /tiktok\.com\/oembed/)
} finally {
  globalThis.fetch = originalFetch
}

console.log('Creator production tests passed')
