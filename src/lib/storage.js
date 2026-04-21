import { supabase } from './supabase'

export const PUBLICATION_IMAGES_BUCKET = 'publication-images'
export const AVATARS_BUCKET = 'avatars'

function inferExtension(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 4) return fromName
  const fromType = file.type?.split('/').pop()?.toLowerCase()
  return fromType || 'jpg'
}

export function getStorageErrorMessage(error) {
  const message = error?.message || ''
  if (/bucket.*not.*found|not found|Bucket not found/i.test(message)) {
    return 'Bucket de imágenes no encontrado. Ve a Supabase → Storage → New bucket, crea "publication-images" y "avatars" con acceso público.'
  }
  if (/exceeded|too large|size/i.test(message)) {
    return 'La imagen es demasiado grande. Máximo 5 MB.'
  }
  if (/mime|type/i.test(message)) {
    return 'Formato no válido. Usa JPG, PNG o WebP.'
  }
  return message || 'No se pudo subir la imagen'
}


export async function uploadPublicationImage({ file, userId, folder = 'misc' }) {
  if (!file) throw new Error('No se ha seleccionado ninguna imagen')
  if (!userId) throw new Error('Necesitas iniciar sesión para subir imágenes')
  if (!file.type?.startsWith('image/')) throw new Error('Selecciona un archivo de imagen válido')

  const extension = inferExtension(file)
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

  const { error } = await supabase.storage.from(PUBLICATION_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) throw error

  const { data } = supabase.storage.from(PUBLICATION_IMAGES_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener la URL pública de la imagen')

  return data.publicUrl
}

export async function uploadPublicationImages({ files, userId, folder = 'misc' }) {
  return Promise.all(Array.from(files).map(file => uploadPublicationImage({ file, userId, folder })))
}

export async function uploadAvatar({ file, userId }) {
  if (!file) throw new Error('No se ha seleccionado ninguna imagen')
  if (!userId) throw new Error('Necesitas iniciar sesión para subir una foto')
  if (!file.type?.startsWith('image/')) throw new Error('Selecciona un archivo de imagen válido')
  if (file.size > 3 * 1024 * 1024) throw new Error('La imagen no puede superar 3 MB')

  const extension = inferExtension(file)
  const path = `${userId}/avatar.${extension}`

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: '1',
    contentType: file.type,
  })

  if (error) throw error

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener la URL de la foto')

  // Append timestamp so the browser always fetches the latest version
  return `${data.publicUrl}?v=${Date.now()}`
}
