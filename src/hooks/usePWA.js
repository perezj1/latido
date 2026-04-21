import { useState, useEffect } from 'react'

// Module-level store so all usePWA instances share the same prompt
let _prompt = null
let _canInstall = false
let _isPWA =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true ||
  new URLSearchParams(window.location.search).get('pwa') === '1'
const _subs = new Set()

function notify() { _subs.forEach(fn => fn()) }

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  _prompt = e
  _canInstall = true
  notify()
})

window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
  _isPWA = e.matches
  notify()
})

export function usePWA() {
  const [, tick] = useState(0)

  useEffect(() => {
    const unsub = () => { _subs.add(rerender); return () => _subs.delete(rerender) }
    function rerender() { tick(n => n + 1) }
    _subs.add(rerender)
    return () => _subs.delete(rerender)
  }, [])

  const promptInstall = async () => {
    if (!_prompt) return false
    _prompt.prompt()
    const { outcome } = await _prompt.userChoice
    _prompt = null
    _canInstall = false
    notify()
    return outcome === 'accepted'
  }

  return { isPWA: _isPWA, canInstall: _canInstall, promptInstall }
}
