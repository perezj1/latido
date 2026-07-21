const VARIANT_MARKER = /-(detail|thumb)(\.[a-z0-9]{2,5})$/i

export function getImageVariantUrl(rawUrl, variant = 'detail') {
  if (!rawUrl || (variant !== 'detail' && variant !== 'thumb')) return rawUrl || ''

  const [, path = rawUrl, suffix = ''] = rawUrl.match(/^([^?#]*)(.*)$/) || []
  const nextPath = path.replace(VARIANT_MARKER, (match, currentVariant, extension) => {
    const nextExtension = variant === 'thumb' && currentVariant.toLowerCase() === 'detail' && extension.toLowerCase() === '.jpeg'
      ? '.jpg'
      : extension
    return `-${variant}${nextExtension}`
  })
  return nextPath === path ? rawUrl : `${nextPath}${suffix}`
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
