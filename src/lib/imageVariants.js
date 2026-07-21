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
  [
    'https://www.mites.gob.es/mundo/consejerias/suiza/img/suiza.gif_1868210207.gif',
    '',
  ],
  [
    'https://suiza.embajada.gov.co/sites/default/files/inline-images/logoGovCO.png',
    'https://suiza.embajada.gov.co/sites/default/files/inline-images/logo-cancilleria.png',
  ],
  [
    'https://www.exteriores.gob.es/Consulados/berna/es/Consulado/PublishingImages/MAEC_SUIZA_BERNA2.jpg?width=1440&height=628',
    '',
  ],
  [
    'https://www.exteriores.gob.es/Consulados/ginebra/es/Consulado/PublishingImages/MAEC_SUIZA_GINEBRA.jpg?width=1440&height=628',
    '',
  ],
  [
    'https://www.exteriores.gob.es/Consulados/zurich/es/Consulado/PublishingImages/MAEC_SUIZA_ZURICH.jpg?width=1440&height=628',
    '',
  ],
  [
    'https://www.exteriores.gob.es/PublishingImages/Banners/logoMinisterio.svg',
    '',
  ],
  [
    'https://frabina.ch/wp-content/uploads/2021/06/frabina-ohne-Untertitel.png',
    '',
  ],
  [
    'https://lh7-us.googleusercontent.com/sitesv-images-rt/ACHe0d2_86HnaElxnBQ191yIdMHFvkR-rGwa9R5LALC0rvd-yRd-oOxunSQSM6A0PAy62HBsSZLFo8Qg9jE7cFvxAVHdmeU5AbDEuCiW9aZFg_5JREKUPb58aAxRMKFmllriu-ZO6fWS_Zghcmoe-Kwl7j-Q2k1gjg_MkleBLZg4N5Oswei48pwST2k8=w16383',
    '',
  ],
])

export function resolveImageUrl(rawUrl) {
  const normalizedUrl = String(rawUrl || '').trim()
  return IMAGE_URL_REPLACEMENTS.has(normalizedUrl)
    ? IMAGE_URL_REPLACEMENTS.get(normalizedUrl)
    : normalizedUrl
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
  image.src = resolveImageUrl(originalUrl)
}
