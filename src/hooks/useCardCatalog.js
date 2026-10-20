import { useEffect, useMemo, useState } from 'react'
import {
  getCachedCardCatalog,
  loadCardCatalog,
  subscribeCardCatalog
} from '../lib/latidoCardCatalog'

const EMPTY = []

export default function useCardCatalog(enabled = true) {
  const [offers, setOffers] = useState(() => enabled ? getCachedCardCatalog() || EMPTY : EMPTY)
  const [checkedAt, setCheckedAt] = useState(Date.now)
  useEffect(() => {
    if (!enabled) return undefined
    let live = true
    const update = (options) =>
      loadCardCatalog(options)
        .then((items) => {
          if (live) setOffers(items)
        })
        .catch(() => {})
    const refresh = () => update({ revalidate: true })
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    const unsubscribe = subscribeCardCatalog(update)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      live = false
      unsubscribe()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled])
  useEffect(() => {
    const nextExpiry = Math.min(
      ...offers
        .map((offer) => Date.parse(offer.ends_at))
        .filter((end) => Number.isFinite(end) && end > Date.now())
    )
    if (!Number.isFinite(nextExpiry)) return undefined
    const timer = setTimeout(
      () => setCheckedAt(Date.now()),
      Math.min(2147483647, Math.max(1, nextExpiry - Date.now() + 1))
    )
    return () => clearTimeout(timer)
  }, [offers, checkedAt])
  // GlobalSearch publishes results to its parent. Preserve this reference between
  // real catalog changes so that the callback cannot create a render loop.
  return useMemo(() => {
    if (!enabled) return EMPTY
    const now = Math.max(checkedAt, Date.now())
    return offers.filter((offer) => offer.ends_at === 'infinity' || Date.parse(offer.ends_at) > now)
  }, [offers, checkedAt, enabled])
}
