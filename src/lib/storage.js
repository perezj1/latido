import { supabase } from './supabase'

export const PUBLICATION_IMAGES_BUCKET = 'publication-images'

function inferExtension(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase()
  if (fromName) return fromName
  const fromType = file.type?.split('/').pop()?.toLowerCase()
  return fromType || 'jpg'
}

export function getStorageErrorMessage(error) {
  const message = error?.message || ''
  if (/bucket|storage|not found/i.test(message)) {
    return 'Falta configurar Supabase Storage. Ejecuta publications_schema_v4.sql para crear el bucket de imágenes.'
  }
  return message || 'No se pudo subir la imagen'
}

export async function uploadPublicationImage({ file, userId, folder='misc' }) {
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

export async function uploadPublicationImages({ files, userId, folder='misc' }) {
  return Promise.all(Array.from(files).map(file => uploadPublicationImage({ file, userId, folder })))
}
