import { supabase } from './supabase'

export const PUBLICATION_IMAGES_BUCKET = 'publication-images'
export const AVATARS_BUCKET = 'avatars'

const ONE_YEAR_SECONDS = '31536000'
const MAX_PUBLICATION_SOURCE_BYTES = 10 * 1024 * 1024
const MAX_PUBLICATION_OUTPUT_BYTES = 650 * 1024
const MAX_AVATAR_SOURCE_BYTES = 6 * 1024 * 1024
const MAX_AVATAR_OUTPUT_BYTES = 260 * 1024
const BYPASS_COMPRESSION_TYPES = new Set(['image/gif', 'image/svg+xml'])

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

async function prepareImageForUpload(file, {
  maxSourceBytes,
  maxOutputBytes,
  maxDimension,
  quality,
  fallbackMaxBytes,
}) {
  if (!file.type?.startsWith('image/')) throw new Error('Selecciona un archivo de imagen valido')
  if (file.size > maxSourceBytes) {
    throw new Error(`La imagen es demasiado grande. Maximo ${Math.round(maxSourceBytes / 1024 / 1024)} MB.`)
  }

  if (BYPASS_COMPRESSION_TYPES.has(file.type) || typeof document === 'undefined') {
    if (file.size > fallbackMaxBytes) throw new Error('La imagen es demasiado grande. Usa JPG, PNG o WebP.')
    return file
  }

  const image = await loadImage(file)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) throw new Error('No se pudo leer la imagen')

  const shouldKeepOriginal = file.type === 'image/webp'
    && file.size <= maxOutputBytes
    && Math.max(width, height) <= maxDimension
  if (shouldKeepOriginal) return file

  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo preparar la imagen')

  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  let blob = null
  for (const nextQuality of [quality, 0.72, 0.66, 0.6]) {
    blob = await canvasToBlob(canvas, 'image/webp', nextQuality)
    if (blob && blob.size <= maxOutputBytes) break
  }

  if (!blob) throw new Error('No se pudo optimizar la imagen')
  if (blob.size > file.size && file.size <= maxOutputBytes) return file

  const name = getOptimizedName(file)
  return typeof File === 'function'
    ? new File([blob], name, { type:'image/webp', lastModified:Date.now() })
    : Object.assign(blob, { name })
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

  const optimizedFile = await prepareImageForUpload(file, {
    maxSourceBytes: MAX_PUBLICATION_SOURCE_BYTES,
    maxOutputBytes: MAX_PUBLICATION_OUTPUT_BYTES,
    maxDimension: 1600,
    quality: 0.78,
    fallbackMaxBytes: 5 * 1024 * 1024,
  })

  const extension = inferExtension(optimizedFile)
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

  const { error } = await supabase.storage.from(PUBLICATION_IMAGES_BUCKET).upload(path, optimizedFile, {
    cacheControl: ONE_YEAR_SECONDS,
    upsert: false,
    contentType: optimizedFile.type || 'image/webp',
  })

  if (error) throw error

  const { data } = supabase.storage.from(PUBLICATION_IMAGES_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener la URL publica de la imagen')

  return data.publicUrl
}

export async function uploadPublicationImages({ files, userId, folder = 'misc' }) {
  return Promise.all(Array.from(files).map(file => uploadPublicationImage({ file, userId, folder })))
}

export async function uploadAvatar({ file, userId }) {
  if (!file) throw new Error('No se ha seleccionado ninguna imagen')
  if (!userId) throw new Error('Necesitas iniciar sesion para subir una foto')

  const optimizedFile = await prepareImageForUpload(file, {
    maxSourceBytes: MAX_AVATAR_SOURCE_BYTES,
    maxOutputBytes: MAX_AVATAR_OUTPUT_BYTES,
    maxDimension: 800,
    quality: 0.8,
    fallbackMaxBytes: 3 * 1024 * 1024,
  })

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
