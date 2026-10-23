import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Keep a snapshot for this history entry only, when opening a business from an offer.
export default function useOfferReturn(ready) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const storageKey = (entryId) => `lc-offer-return:${location.key}:${entryId}:${location.pathname}${location.search}`
  const [saved] = useState(() => {
    if (navigationType !== 'POP') return null
    try {
      const entryId = window.history.state?.latidoOfferReturn
      if (!entryId) return null
      const value = JSON.parse(sessionStorage.getItem(storageKey(entryId)))
      return value && typeof value === 'object' && Number.isFinite(value.scrollY) ? value : null
    } catch { return null }
  })
  const restored = useRef(false)
  useEffect(() => {
    if (!ready || !saved || restored.current) return undefined
    let secondFrame
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.scrollTo({ top: Math.max(0, saved.scrollY), left: 0, behavior: 'instant' })
        restored.current = true
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [ready, saved])
  const remember = (state) => {
    try {
      const entryId = window.history.state?.latidoOfferReturn || crypto.randomUUID()
      // Preserve React Router's fields; this marker distinguishes separate direct visits
      // whose initial Router key is always "default".
      window.history.replaceState({ ...window.history.state, latidoOfferReturn: entryId }, '')
      sessionStorage.setItem(storageKey(entryId), JSON.stringify({ ...state, scrollY: window.scrollY }))
    }
    catch {}
  }
  return { saved, remember }
}
