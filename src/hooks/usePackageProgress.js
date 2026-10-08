import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Pasos completados de cada paquete: { [slugPaquete]: [idPaso, ...] }.
// Sin sesión se guardan en el dispositivo; con sesión, también en el perfil
// (metadatos de la cuenta), y al iniciar sesión se unen ambos.
const STORAGE_KEY = 'latido:package-progress'
const METADATA_KEY = 'package_progress'
const SYNC_EVENT = 'latido:package-progress-change'

function cleanProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([slug, ids]) => [slug, [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && id))]])
      .filter(([, ids]) => ids.length > 0),
  )
}

function mergeProgress(first, second) {
  const merged = { ...first }
  Object.entries(second).forEach(([slug, ids]) => {
    merged[slug] = [...new Set([...(merged[slug] || []), ...ids])]
  })
  return cleanProgress(merged)
}

function readLocalProgress() {
  try {
    return cleanProgress(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}'))
  } catch {
    return {}
  }
}

function writeLocalProgress(progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Sin almacenamiento el progreso dura lo que dure la visita.
  }
}

function saveToProfile(progress) {
  supabase.auth.updateUser({ data:{ [METADATA_KEY]:progress } }).then(({ error }) => {
    if (error) console.warn('No se pudo guardar el progreso del paquete:', error.message)
  })
}

export function usePackageProgress() {
  const { user } = useAuth()
  const [progress, setProgress] = useState(readLocalProgress)
  const progressRef = useRef(progress)
  const syncedUserRef = useRef('')
  const userId = user?.id || ''
  const remoteProgress = user?.user_metadata?.[METADATA_KEY]

  // Al iniciar sesión: une lo hecho en este dispositivo con lo guardado en el perfil.
  useEffect(() => {
    if (!userId || syncedUserRef.current === userId) return
    syncedUserRef.current = userId
    const remote = cleanProgress(remoteProgress)
    const merged = mergeProgress(readLocalProgress(), remote)
    progressRef.current = merged
    setProgress(merged)
    writeLocalProgress(merged)
    if (JSON.stringify(merged) !== JSON.stringify(remote)) saveToProfile(merged)
  }, [userId, remoteProgress])

  // Mantiene sincronizadas varias instancias abiertas a la vez.
  useEffect(() => {
    const sync = event => {
      progressRef.current = event.detail
      setProgress(event.detail)
    }
    window.addEventListener(SYNC_EVENT, sync)
    return () => window.removeEventListener(SYNC_EVENT, sync)
  }, [])

  const isDone = useCallback(
    (slug, stepId) => Boolean(progress[slug]?.includes(stepId)),
    [progress],
  )

  const completedIn = useCallback(
    (slug, stepIds) => stepIds.filter(stepId => progress[slug]?.includes(stepId)).length,
    [progress],
  )

  const setStepDone = useCallback((slug, stepId, done) => {
    const current = new Set(progressRef.current[slug] || [])
    const nextDone = typeof done === 'boolean' ? done : !current.has(stepId)
    if (nextDone) current.add(stepId)
    else current.delete(stepId)
    const next = cleanProgress({ ...progressRef.current, [slug]:[...current] })
    progressRef.current = next
    setProgress(next)
    writeLocalProgress(next)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail:next }))
    if (userId) saveToProfile(next)
  }, [userId])

  return { isDone, completedIn, setStepDone, savedInProfile:Boolean(userId) }
}
