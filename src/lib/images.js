const SUPABASE_OBJECT_PUBLIC = '/storage/v1/object/public/'
const SUPABASE_RENDER_PUBLIC = '/storage/v1/render/image/public/'
const RASTER_IMAGE_EXT = /\.(avif|jpe?g|png|webp)(?:$|[?#])/i
const NON_TRANSFORMABLE_EXT = /\.(gif|svg)(?:$|[?#])/i

function parseImageUrl(src) {
  if (!src || typeof src !== 'string') return null
  if (/^(blob:|data:|file:)/i.test(src)) return null

  try {
    return new URL(src)
  } catch {
    return null
  }
}

function clampInteger(value, min, max) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return null
  return Math.min(Math.max(parsed, min), max)
}

function canTransformSupabaseImage(url) {
  if (!url?.pathname?.includes(SUPABASE_OBJECT_PUBLIC)) return false
  if (url.pathname.includes(SUPABASE_RENDER_PUBLIC)) return false
  if (NON_TRANSFORMABLE_EXT.test(url.pathname)) return false
  return RASTER_IMAGE_EXT.test(url.pathname)
}

export function getOptimizedImageUrl(src, {
  width,
  height,
  resize = 'contain',
  quality = 72,
} = {}) {
  const url = parseImageUrl(src)
  if (!canTransformSupabaseImage(url)) return src || ''

  const next = new URL(url.toString())
  next.pathname = next.pathname.replace(SUPABASE_OBJECT_PUBLIC, SUPABASE_RENDER_PUBLIC)

  const params = new URLSearchParams()
  const safeWidth = clampInteger(width, 32, 2400)
  const safeHeight = clampInteger(height, 32, 2400)
  const safeQuality = clampInteger(quality, 35, 95)

  if (safeWidth) params.set('width', String(safeWidth))
  if (safeHeight) params.set('height', String(safeHeight))
  if (resize) params.set('resize', resize)
  if (safeQuality) params.set('quality', String(safeQuality))

  const version = url.searchParams.get('v')
  if (version) params.set('v', version)

  next.search = params.toString()
  return next.toString()
}

export function getOptimizedImageSrcSet(src, {
  widths = [],
  resize = 'contain',
  quality = 72,
} = {}) {
  const uniqueWidths = Array.from(new Set(widths.map(width => clampInteger(width, 32, 2400)).filter(Boolean)))
    .sort((a, b) => a - b)

  const entries = uniqueWidths
    .map(width => {
      const url = getOptimizedImageUrl(src, { width, resize, quality })
      return url && url !== src ? `${url} ${width}w` : ''
    })
    .filter(Boolean)

  return entries.length ? entries.join(', ') : undefined
}
