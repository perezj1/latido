const VARIANT_MARKER = /-(detail|thumb)(\.[a-z0-9]{2,5})$/i

const IMAGE_URL_REPLACEMENTS = new Map([
  [
    'https://el-rincon-argentino.ch/images/s2dlogo.jpg',
    'https://img.restaurantguru.com/w550/h367/r18b-El-Rincon-Argentino-design-2024-12-3.jpg',
  ],
  [
    'https://www.el-rincon-argentino.ch/images/s2dlogo.jpg',
    'https://img.restaurantguru.com/w550/h367/r18b-El-Rincon-Argentino-design-2024-12-3.jpg',
  ],
])

export function resolveImageUrl(rawUrl) {
  const normalizedUrl = String(rawUrl || '').trim()
  return IMAGE_URL_REPLACEMENTS.get(normalizedUrl) || normalizedUrl
}

export function getImageVariantUrl(rawUrl, variant = 'detail') {
  const resolvedUrl = resolveImageUrl(rawUrl)
  if (!resolvedUrl || (variant !== 'detail' && variant !== 'thumb')) return resolvedUrl

  const [, path = resolvedUrl, suffix = ''] = resolvedUrl.match(/^([^?#]*)(.*)$/) || []
  const nextPath = path.replace(VARIANT_MARKER, (match, currentVariant, extension) => {
    const nextExtension = variant === 'thumb' && currentVariant.toLowerCase() === 'detail' && extension.toLowerCase() === '.jpeg'
      ? '.jpg'
      : extension
    return `-${variant}${nextExtension}`
  })
  return nextPath === path ? resolvedUrl : `${nextPath}${suffix}`
}

export function getThumbnailImageUrl(rawUrl) {
  return getImageVariantUrl(rawUrl, 'thumb')
}

export function getDetailImageUrl(rawUrl) {
  return getImageVariantUrl(rawUrl, 'detail')
}

export function handleThumbnailImageError(event, originalUrl) {
  const image = event?.currentTarget
  if (!image || !originalUrl || image.dataset.originalFallbackApplied === 'true') return

  image.dataset.originalFallbackApplied = 'true'
  image.src = originalUrl
}
