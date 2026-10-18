import { useEffect, useMemo, useState } from 'react'
import {
  getCachedCardCatalog,
  loadCardCatalog,
  subscribeCardCatalog
} from '../lib/latidoCardCatalog'

export default function useCardCatalog() {
  const [offers, setOffers] = useState(() => getCachedCardCatalog() || [])
  const [checkedAt, setCheckedAt] = useState(Date.now)
  useEffect(() => {
    let live = true
    const update = () =>
      loadCardCatalog()
        .then((items) => {
          if (live) setOffers(items)
        })
        .catch(() => {})
    update()
    const unsubscribe = subscribeCardCatalog(update)
    return () => {
      live = false
      unsubscribe()
    }
  }, [])
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
    const now = Math.max(checkedAt, Date.now())
    return offers.filter((offer) => offer.ends_at === 'infinity' || Date.parse(offer.ends_at) > now)
  }, [offers, checkedAt])
}
