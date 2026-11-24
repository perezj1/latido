import { useEffect, useRef } from 'react'

let overlayCounter = 0

function createOverlayId() {
  overlayCounter += 1
  return `latido-overlay-${overlayCounter}`
}

export function useOverlayHistory(show, onClose, enabled = true) {
  const overlayIdRef = useRef('')
  const activeRef = useRef(false)
  const poppedRef = useRef(false)
  const onCloseRef = useRef(onClose)

  if (!overlayIdRef.current) {
    overlayIdRef.current = createOverlayId()
  }

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!enabled || !show || typeof window === 'undefined') return undefined

    const overlayId = overlayIdRef.current
    const currentState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {}

    activeRef.current = true
    poppedRef.current = false
    window.history.pushState({ ...currentState, __latidoOverlay: overlayId }, '')

    const handlePopState = event => {
      if (!activeRef.current) return
      if (event.state?.__latidoOverlay === overlayId) return

      activeRef.current = false
      poppedRef.current = true
      onCloseRef.current?.()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)

      const shouldRewind =
        activeRef.current &&
        !poppedRef.current &&
        window.history.state?.__latidoOverlay === overlayId

      activeRef.current = false

      if (shouldRewind) {
        window.history.back()
      }
    }
  }, [enabled, show])
}
