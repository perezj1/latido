import { useState, useEffect } from 'react'

/**
 * Detects if the app is running as an installed PWA.
 * Returns { isPWA, canInstall, promptInstall }
 */
export function usePWA() {
  const [isPWA, setIsPWA] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // Check if running as installed PWA
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      new URLSearchParams(window.location.search).get('pwa') === '1'
    setIsPWA(standalone)

    // Listen for install prompt (Chrome/Android)
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Listen for display mode change
    const mq = window.matchMedia('(display-mode: standalone)')
    const mqHandler = (e) => setIsPWA(e.matches)
    mq.addEventListener('change', mqHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      mq.removeEventListener('change', mqHandler)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setCanInstall(false)
    return outcome === 'accepted'
  }

  return { isPWA, canInstall, promptInstall }
}
