import { supabase } from './supabase'

export const PUBLICATION_IMAGES_BUCKET = 'publication-images'
export const AVATARS_BUCKET = 'avatars'
export const MAX_PUBLICATION_IMAGES = 5

const ONE_YEAR_SECONDS = '31536000'
const MAX_PUBLICATION_SOURCE_BYTES = 10 * 1024 * 1024
const MAX_AVATAR_SOURCE_BYTES = 6 * 1024 * 1024
const BYPASS_COMPRESSION_TYPES = new Set(['image/gif', 'image/svg+xml'])
const OUTPUT_FORMATS = [
  { type:'image/webp', extension:'webp' },
  { type:'image/jpeg', extension:'jpg' },
]
const PUBLICATION_IMAGE_DETAIL_PROFILE = {
  maxSourceBytes: MAX_PUBLICATION_SOURCE_BYTES,
  maxOutputBytes: 360 * 1024,
  maxDimension: 1280,
  minDimension: 640,
  quality: 0.76,
  minQuality: 0.52,
  fallbackMaxBytes: 5 * 1024 * 1024,
}
const PUBLICATION_IMAGE_THUMB_PROFILE = {
  maxSourceBytes: MAX_PUBLICATION_SOURCE_BYTES,
  maxOutputBytes: 92 * 1024,
  maxDimension: 520,
  minDimension: 320,
  quality: 0.72,
  minQuality: 0.48,
  fallbackMaxBytes: 1024 * 1024,
}
const AVATAR_IMAGE_PROFILE = {
  maxSourceBytes: MAX_AVATAR_SOURCE_BYTES,
  maxOutputBytes: 140 * 1024,
  maxDimension: 640,
  minDimension: 320,
  quality: 0.78,
  minQuality: 0.56,
  fallbackMaxBytes: 3 * 1024 * 1024,
}

function inferExtension(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 4) return fromName
  const fromType = file.type?.split('/').pop()?.toLowerCase()
  return fromType || 'jpg'
}

function getOptimizedName(file, extension = 'webp') {
  const base = file.name?.replace(/\.[^.]+$/, '') || 'image'
  return `${base}.${extension}`
}

function getUniqueImageBasePath(userId, folder) {
  return `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getExtensionForType(type) {
  return OUTPUT_FORMATS.find(format => format.type === type)?.extension || 'jpg'
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo procesar la imagen'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

async function encodeCanvas(canvas, type, quality) {
  const blob = await canvasToBlob(canvas, type, quality)
  if (!blob?.size) return null
  if (blob.type && blob.type !== type) return null
  return blob
}

function getQualitySteps(start, min) {
  const steps = []
  for (let quality = start; quality >= min; quality -= 0.08) {
    steps.push(Number(quality.toFixed(2)))
  }
  if (!steps.includes(min)) steps.push(min)
  return steps
}

async function renderOptimizedImage(image, {
  maxOutputBytes,
  maxDimension,
  minDimension,
  quality,
  minQuality,
}) {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) throw new Error('No se pudo leer la imagen')

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo preparar la imagen')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const qualitySteps = getQualitySteps(quality, minQuality)
  let bestBlob = null

  for (let dimension = maxDimension; dimension >= minDimension; dimension = Math.floor(dimension * 0.82)) {
    const scale = Math.min(1, dimension / Math.max(sourceWidth, sourceHeight))
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale))
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale))

    canvas.width = targetWidth
    canvas.height = targetHeight
    context.clearRect(0, 0, targetWidth, targetHeight)
    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    for (const format of OUTPUT_FORMATS) {
      for (const nextQuality of qualitySteps) {
        const blob = await encodeCanvas(canvas, format.type, nextQuality)
        if (!blob) continue
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob
        if (blob.size <= maxOutputBytes) {
          canvas.width = 1
          canvas.height = 1
          return blob
        }
      }
    }
  }

  canvas.width = 1
  canvas.height = 1
  if (bestBlob) return bestBlob

  throw new Error('No se pudo optimizar la imagen')
}

function validateImageSource(file, { maxSourceBytes }) {
  if (!file.type?.startsWith('image/')) throw new Error('Selecciona un archivo de imagen valido')
  if (file.size > maxSourceBytes) {
    throw new Error(`La imagen es demasiado grande. Maximo ${Math.round(maxSourceBytes / 1024 / 1024)} MB.`)
  }
}

async function prepareLoadedImageForUpload(file, image, {
  maxSourceBytes,
  maxOutputBytes,
  maxDimension,
  minDimension,
  quality,
  minQuality,
  fallbackMaxBytes,
}) {
  validateImageSource(file, { maxSourceBytes })
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) throw new Error('No se pudo leer la imagen')

  const shouldKeepOriginal = OUTPUT_FORMATS.some(format => format.type === file.type)
    && file.size <= maxOutputBytes
    && Math.max(width, height) <= maxDimension
  if (shouldKeepOriginal) return file

  const blob = await renderOptimizedImage(image, {
    maxOutputBytes,
    maxDimension,
    minDimension,
    quality,
    minQuality,
  })

  if (!blob) throw new Error('No se pudo optimizar la imagen')
  if (blob.size > fallbackMaxBytes) {
    throw new Error('La imagen es demasiado pesada incluso optimizada. Prueba con otra foto.')
  }

  const extension = getExtensionForType(blob.type)
  const name = getOptimizedName(file, extension)
  return typeof File === 'function'
    ? new File([blob], name, { type:blob.type || 'image/jpeg', lastModified:Date.now() })
    : Object.assign(blob, { name })
}

async function prepareImageForUpload(file, profile) {
  validateImageSource(file, profile)

  if (BYPASS_COMPRESSION_TYPES.has(file.type) || typeof document === 'undefined') {
    if (file.size > profile.fallbackMaxBytes) throw new Error('La imagen es demasiado grande. Usa JPG, PNG o WebP.')
    return file
  }

  const image = await loadImage(file)
  return prepareLoadedImageForUpload(file, image, profile)
}

export function getStorageErrorMessage(error) {
  const message = error?.message || ''
  if (/bucket.*not.*found|not found|Bucket not found/i.test(message)) {
    console.error('Storage bucket missing or unavailable:', error)
    return 'No pudimos preparar la subida de imagenes. Intentalo de nuevo mas tarde.'
  }
  if (/exceeded|too large|size|demasiado grande/i.test(message)) {
    return message || 'La imagen es demasiado grande. Maximo 5 MB.'
  }
  if (/mime|type|formato/i.test(message)) {
    return 'Formato no valido. Usa JPG, PNG o WebP.'
  }
  if (message) console.error('Storage upload error:', error)
  return message || 'No se pudo subir la imagen'
}

export async function uploadPublicationImage({ file, userId, folder = 'misc' }) {
  if (!file) throw new Error('No se ha seleccionado ninguna imagen')
  if (!userId) throw new Error('Necesitas iniciar sesion para subir imagenes')

  const uploadPreparedFile = async (preparedFile, path) => {
    const { error } = await supabase.storage.from(PUBLICATION_IMAGES_BUCKET).upload(path, preparedFile, {
      cacheControl: ONE_YEAR_SECONDS,
      upsert: false,
      contentType: preparedFile.type || 'image/webp',
    })

    if (error) throw error

    const { data } = supabase.storage.from(PUBLICATION_IMAGES_BUCKET).getPublicUrl(path)
    if (!data?.publicUrl) throw new Error('No se pudo obtener la URL publica de la imagen')

    return data.publicUrl
  }

  const canCreateVariants = !BYPASS_COMPRESSION_TYPES.has(file.type) && typeof document !== 'undefined'

  if (!canCreateVariants) {
    const optimizedFile = await prepareImageForUpload(file, PUBLICATION_IMAGE_DETAIL_PROFILE)
    const extension = inferExtension(optimizedFile)
    return uploadPreparedFile(optimizedFile, `${getUniqueImageBasePath(userId, folder)}.${extension}`)
  }

  validateImageSource(file, PUBLICATION_IMAGE_DETAIL_PROFILE)
  const image = await loadImage(file)
  const detailFile = await prepareLoadedImageForUpload(file, image, PUBLICATION_IMAGE_DETAIL_PROFILE)
  const thumbFile = await prepareLoadedImageForUpload(file, image, PUBLICATION_IMAGE_THUMB_PROFILE)

  const basePath = getUniqueImageBasePath(userId, folder)
  const detailPath = `${basePath}-detail.${inferExtension(detailFile)}`
  const thumbPath = `${basePath}-thumb.${inferExtension(thumbFile)}`
  const [detailUrl] = await Promise.all([
    uploadPreparedFile(detailFile, detailPath),
    uploadPreparedFile(thumbFile, thumbPath),
  ])

  return detailUrl
}

export async function uploadPublicationImages({ files, userId, folder = 'misc' }) {
  return Promise.all(Array.from(files).map(file => uploadPublicationImage({ file, userId, folder })))
}

export async function uploadAvatar({ file, userId }) {
  if (!file) throw new Error('No se ha seleccionado ninguna imagen')
  if (!userId) throw new Error('Necesitas iniciar sesion para subir una foto')

  const optimizedFile = await prepareImageForUpload(file, AVATAR_IMAGE_PROFILE)

  const extension = inferExtension(optimizedFile)
  const path = `${userId}/avatar.${extension}`

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, optimizedFile, {
    upsert: true,
    cacheControl: ONE_YEAR_SECONDS,
    contentType: optimizedFile.type || 'image/webp',
  })

  if (error) throw error

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener la URL de la foto')

  return `${data.publicUrl}?v=${Date.now()}`
}
