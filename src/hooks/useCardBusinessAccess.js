import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { cardRpc } from '../lib/latidoCard'

const cache = new Map()
const requests = new Map()
export const CARD_ACCESS_EVENT = 'lc-business-access'

function read(id) {
  if (!id) return { hasBusiness: false, participating: false }
  if (cache.has(id)) return cache.get(id)
  try {
    return JSON.parse(sessionStorage.getItem(`lc-access:${id}`))
  } catch {
    return null
  }
}

export function refreshCardBusinessAccess(id) {
  if (!id) return Promise.resolve(null)
  if (!requests.has(id))
    requests.set(
      id,
      cardRpc('lc_business_dashboard')
        .then((data) => {
          const value = {
            hasBusiness: Boolean(data.businesses?.length),
            participating: data.businesses?.some((b) => b.participating) || false
          }
          cache.set(id, value)
          try {
            sessionStorage.setItem(`lc-access:${id}`, JSON.stringify(value))
          } catch {}
          window.dispatchEvent(new Event(CARD_ACCESS_EVENT))
          return value
        })
        .finally(() => requests.delete(id))
    )
  return requests.get(id)
}

export default function useCardBusinessAccess() {
  const { user } = useAuth()
  const id = user?.id
  const [state, setState] = useState(() => ({ id, value: read(id) }))
  const value = state.id === id ? state.value : read(id)
  useEffect(() => {
    let live = true
    const update = () => {
      if (live) setState({ id, value: read(id) })
    }
    update()
    window.addEventListener(CARD_ACCESS_EVENT, update)
    refreshCardBusinessAccess(id).catch(() => {})
    return () => {
      live = false
      window.removeEventListener(CARD_ACCESS_EVENT, update)
    }
  }, [id])
  return { ...value, loading: Boolean(id && !value) }
}
