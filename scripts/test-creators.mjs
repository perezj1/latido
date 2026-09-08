import assert from 'node:assert/strict'

const {
  CREATOR_FEATURED_CONTENTS,
  CREATOR_VIDEO_IFRAME_PERMISSIONS,
  canManageCreator,
  detectCreatorPlatform,
  detectCreatorFormat,
  formatCreatorHandle,
  getAutomaticCreatorThumbnail,
  getCreatorContentsNewestFirst,
  getContentRecentHelpfulCount,
  getCreatorInteractionState,
  getCreatorMetrics,
  getCreatorOEmbedMetadata,
  getCreatorTopicsFromInterests,
  getCreatorThumbnailUrl,
  getCreatorVideoEmbed,
  getFeaturedCreatorContents,
  getOrderedCreatorContents,
  getTikTokVideoId,
  normalizeCreatorUrl,
  resolveCreatorVideoEmbed,
  resolveTikTokVideo,
  slugifyCreator,
} = await import('../src/lib/creators.js')
const { getTikTokIdFromUrl, resolveTikTokLink } = await import('../api/tiktok-resolve.js')
const { default:tiktokMetadataHandler, getTikTokMetadata, getTikTokThumbnail } = await import('../api/tiktok-metadata.js')
const { getSeoForLocation } = await import('../src/lib/seo.js')
const { rotateItemsWithRecentFirst } = await import('../src/lib/rotation.js')

assert.equal(formatCreatorHandle('perfilantiguo'), '@perfilantiguo')
assert.equal(canManageCreator('owner-1', { id:'creator-1', owner_id:'owner-1' }), true)
assert.equal(canManageCreator('other-user', { id:'creator-1', owner_id:'owner-1' }), false)
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
const rotationNow = new Date('2026-08-21T12:00:00.000Z').getTime()
const rotationWindow = 6 * 60 * 60 * 1000
const rotationItems = [
  { id:'new', created_at:'2026-08-21T11:00:00.000Z' },
  { id:'boundary', created_at:'2026-08-21T06:00:00.000Z' },
  { id:'old', created_at:'2026-08-20T12:00:00.000Z' },
]
assert.deepEqual(
  rotateItemsWithRecentFirst(rotationItems, 1, rotationWindow, item => item.created_at, rotationNow).map(item => item.id),
  ['new', 'old', 'boundary'],
  'Lo nuevo debe permanecer primero durante seis horas y el resto debe rotar.',
)
assert.deepEqual(
  rotateItemsWithRecentFirst(rotationItems, 1, rotationWindow, item => item.created_at, rotationNow + rotationWindow).map(item => item.id),
  ['boundary', 'old', 'new'],
  'Al cumplir seis horas, el elemento nuevo debe entrar en la rotación normal.',
)
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

const photoTikTokUrl = 'https://www.tiktok.com/@martaacorral97/photo/7682743119472872726?_r=1&_t=ZN-99ZFldkOFHy'
const shortPhotoTikTokUrl = 'https://vm.tiktok.com/ZN82yn7Hg/'
const photoId = '7682743119472872726'
const photoEmbedUrl = `https://www.tiktok.com/player/v1/${photoId}`
assert.equal(detectCreatorFormat(photoTikTokUrl, 'tiktok'), 'fotos')
for (const parseId of [getTikTokIdFromUrl, getTikTokVideoId]) {
  assert.equal(parseId(photoTikTokUrl), photoId)
  assert.equal(parseId(`https://www.tiktok.com/@latido/photo/${photoId}/`), photoId)
  assert.equal(parseId(`https://example.com/@latido/photo/${photoId}`), '')
  assert.equal(parseId(`https://www.tiktok.com/@latido/photo/${photoId}invalid`), '')
  assert.equal(parseId('https://www.tiktok.com/@latido'), '')
}
const directPhoto = await resolveTikTokLink(photoTikTokUrl, {
  fetchImpl:async () => assert.fail('Un enlace completo de fotos no necesita peticiones a TikTok.'),
})
assert.equal(directPhoto.video_id, photoId)
assert.equal(directPhoto.resolved_url, photoTikTokUrl)
assert.equal(directPhoto.embed_url, photoEmbedUrl)
assert.deepEqual(await resolveTikTokVideo(photoTikTokUrl), directPhoto)

// Simulate TikTok's short-link redirects, stopping before the photo page itself.
const photoRedirectRequests = []
const resolvedPhoto = await resolveTikTokLink(shortPhotoTikTokUrl, {
  fetchImpl:async url => {
    photoRedirectRequests.push(String(url))
    assert.ok(photoRedirectRequests.length <= 2, 'No se debe solicitar la página de fotos tras obtener su URL.')
    return {
      status:302,
      headers:{ get:() => photoRedirectRequests.length === 1 ? '/intermediate' : photoTikTokUrl },
    }
  },
})
assert.deepEqual(photoRedirectRequests, [shortPhotoTikTokUrl, 'https://vm.tiktok.com/intermediate'])
assert.deepEqual(resolvedPhoto, { ...directPhoto, original_url:shortPhotoTikTokUrl })
assert.equal((await resolveTikTokLink(shortPhotoTikTokUrl, {
  fetchImpl:async () => ({ ok:true, url:photoTikTokUrl }),
})).video_id, photoId)
await assert.rejects(resolveTikTokLink(shortPhotoTikTokUrl, {
  fetchImpl:async () => ({ ok:true, url:'https://www.tiktok.com/' }),
}), error => error.statusCode === 422 && /vídeo o fotos/.test(error.message))

const expectedPhotoEmbed = {
  platform:'tiktok',
  src:`${photoEmbedUrl}?autoplay=0&loop=0&fullscreen_button=0`,
  vertical:true,
}
assert.deepEqual(getCreatorVideoEmbed({ url:photoTikTokUrl }), expectedPhotoEmbed)
assert.deepEqual(getCreatorVideoEmbed({ url:shortPhotoTikTokUrl, ...resolvedPhoto }), expectedPhotoEmbed)
assert.deepEqual(getCreatorVideoEmbed({ url:shortPhotoTikTokUrl, resolved_url:photoTikTokUrl }), expectedPhotoEmbed)

assert.deepEqual(
  getCreatorTopicsFromInterests(['empleo', 'vivienda', 'comunidad']),
  ['trabajo', 'vivienda', 'integracion'],
)
assert.deepEqual(
  getCreatorInteractionState({ action:'helpful', targetType:'content', targetId:'content-1', actorId:'user-1', baseCount:12 }),
  { active:false, count:12 },
)
assert.equal(getContentRecentHelpfulCount({ recent_helpful_count:7 }), 7)
assert.equal(getContentRecentHelpfulCount({ recent_helpful_count:-3 }), 0)
assert.deepEqual(
  getCreatorMetrics(creator).byContent['content-1'],
  { impressions:0, clicks:0, helpful:0, shares:0, clickRate:0 },
  'Las métricas por contenido deben exponer visualizaciones, ayudas y compartidos.',
)

const originalFetch = globalThis.fetch
let requestedOEmbedUrl = ''
globalThis.fetch = async url => {
  requestedOEmbedUrl = String(url)
  if (requestedOEmbedUrl.startsWith('/api/tiktok-resolve?')) {
    assert.equal(new URL(requestedOEmbedUrl, 'https://latido.ch').searchParams.get('url'), shortPhotoTikTokUrl)
    return { ok:true, json:async () => resolvedPhoto }
  }
  if (requestedOEmbedUrl.startsWith('/api/tiktok-metadata?')) {
    return { ok:true, json:async () => ({ title:'Título de fotos', thumbnail_url:'/api/tiktok-metadata?thumbnail=1&url=photo' }) }
  }
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
  assert.match(requestedOEmbedUrl, /^\/api\/tiktok-metadata\?/)

  assert.deepEqual(await resolveCreatorVideoEmbed({ url:shortPhotoTikTokUrl }), expectedPhotoEmbed)
  for (const photoUrl of [photoTikTokUrl, shortPhotoTikTokUrl]) {
    const photoMetadata = await getCreatorOEmbedMetadata(photoUrl)
    assert.equal(photoMetadata.video_id, photoId)
    assert.equal(photoMetadata.resolved_url, photoTikTokUrl)
    assert.equal(photoMetadata.embed_url, photoEmbedUrl)
    assert.equal(photoMetadata.title, 'Título de fotos')
    assert.equal(photoMetadata.summary, 'Título de fotos')
    assert.equal(getCreatorThumbnailUrl(photoMetadata), '/api/tiktok-metadata?thumbnail=1&url=photo')
    assert.equal(new URL(requestedOEmbedUrl, 'https://latido.ch').searchParams.get('url'), photoTikTokUrl)
  }
} finally {
  globalThis.fetch = originalFetch
}

const cdnThumbnail = 'https://p16-common-sign.tiktokcdn-eu.com/photo.jpeg?x-expires=123'
const metadataRequests = []
const metadataFetch = async (url, options) => {
  const requested = new URL(url)
  metadataRequests.push(requested.href)
  if (requested.hostname === 'www.tiktok.com') {
    assert.equal(requested.pathname, '/oembed')
    assert.equal(requested.searchParams.get('url'), `https://www.tiktok.com/@martaacorral97/video/${photoId}`)
    assert.equal(options.redirect, 'error')
    return Response.json({ title:'Encontré esto sin gluten en Coop', thumbnail_url:cdnThumbnail })
  }
  assert.equal(requested.href, cdnThumbnail)
  assert.equal(options.redirect, 'manual')
  return new Response(new Uint8Array([255, 216, 255]), { headers:{ 'Content-Type':'image/jpeg' } })
}
const serverMetadata = await getTikTokMetadata(photoTikTokUrl, { fetchImpl:metadataFetch })
assert.equal(serverMetadata.title, 'Encontré esto sin gluten en Coop')
assert.equal(serverMetadata.resolved_url, photoTikTokUrl, 'El enlace original debe conservar su ruta de fotos.')
const serverImage = await getTikTokThumbnail(photoTikTokUrl, { fetchImpl:metadataFetch })
assert.equal(serverImage.contentType, 'image/jpeg')
assert.equal(serverImage.body.length, 3)
assert.equal(metadataRequests.length, 3, 'La portada debe solicitar una URL firmada nueva al servidor de TikTok.')
await assert.rejects(getTikTokMetadata(photoTikTokUrl, {
  fetchImpl:async () => Response.json({ code:400, message:'Something went wrong' }),
}), /no devolvió los datos/)
await assert.rejects(getTikTokMetadata('https://example.com/photo/123456789', {
  fetchImpl:async () => assert.fail('No se deben solicitar dominios externos.'),
}), /Only TikTok/)
await assert.rejects(getTikTokMetadata(photoTikTokUrl, {
  fetchImpl:async () => Response.json({ title:'Foto', thumbnail_url:'https://127.0.0.1/private' }),
}), /portada válida/)
await assert.rejects(getTikTokThumbnail(photoTikTokUrl, {
  fetchImpl:async (url, options) => String(url).startsWith('https://www.tiktok.com/')
    ? metadataFetch(url, options)
    : new Response(null, { status:302, headers:{ location:'https://127.0.0.1/private' } }),
}), /portada válida/)
await assert.rejects(getTikTokThumbnail(photoTikTokUrl, {
  fetchImpl:async (url, options) => String(url).startsWith('https://www.tiktok.com/')
    ? metadataFetch(url, options)
    : new Response('Access denied', { status:403 }),
}), /no pudo cargar la portada/)
await assert.rejects(getTikTokThumbnail(photoTikTokUrl, {
  fetchImpl:async (url, options) => String(url).startsWith('https://www.tiktok.com/')
    ? metadataFetch(url, options)
    : new Response(new Uint8Array(5 * 1024 * 1024 + 1), { headers:{ 'Content-Type':'image/jpeg' } }),
}), /demasiado grande/)

const handlerResponse = () => ({
  headers:{},
  setHeader(key, value) { this.headers[key] = value },
  end(body) { this.body = body },
})
globalThis.fetch = metadataFetch
try {
  const response = handlerResponse()
  await tiktokMetadataHandler({ method:'GET', url:`/?url=${encodeURIComponent(photoTikTokUrl)}` }, response)
  assert.equal(response.statusCode, 200)
  const data = JSON.parse(response.body)
  assert.match(data.thumbnail_url, /^\/api\/tiktok-metadata\?thumbnail=1&url=/)
  assert.equal(getCreatorThumbnailUrl(data), data.thumbnail_url)
  const imageResponse = handlerResponse()
  await tiktokMetadataHandler({ method:'GET', url:data.thumbnail_url }, imageResponse)
  assert.equal(imageResponse.statusCode, 200)
  assert.equal(imageResponse.headers['Content-Type'], 'image/jpeg')
  assert.equal(imageResponse.body.length, 3)
  const invalidResponse = handlerResponse()
  await tiktokMetadataHandler({ method:'GET', url:'/' }, invalidResponse)
  assert.equal(invalidResponse.statusCode, 400)
  const methodResponse = handlerResponse()
  await tiktokMetadataHandler({ method:'POST', url:'/' }, methodResponse)
  assert.equal(methodResponse.statusCode, 405)
} finally {
  globalThis.fetch = originalFetch
}

console.log('Creator production tests passed')
