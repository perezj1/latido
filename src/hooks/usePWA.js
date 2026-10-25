import { useEffect, useState } from 'react'

const INSTALLED_KEY = 'latido_pwa_installed'
const displayQueries = ['standalone', 'minimal-ui', 'window-controls-overlay']
  .map(mode => window.matchMedia(`(display-mode: ${mode})`))
const homeScreenLaunch = new URLSearchParams(window.location.search).get('pwa') === '1'
const inAppWindow = () => displayQueries.some(query => query.matches) || window.navigator.standalone === true || homeScreenLaunch
const readInstalled = () => {
  try { return window.localStorage.getItem(INSTALLED_KEY) === '1' } catch { return false }
}

// Installation and the current display mode are distinct, shared across hook consumers.
let _prompt = null
let _isPWA = inAppWindow()
let _installed = readInstalled()
let _checked = _installed || typeof navigator.getInstalledRelatedApps !== 'function'
let _checking = false
const _subs = new Set()
const notify = () => _subs.forEach(fn => fn())

function rememberInstalled() {
  _installed = true
  _checked = true
  _prompt = null
  try { window.localStorage.setItem(INSTALLED_KEY, '1') } catch {}
  notify()
}

function isLatidoApp(app) {
  if (app.platform !== 'webapp') return false
  try {
    return (app.url && new URL(app.url, window.location.href).href === new URL('/manifest.json', window.location.href).href) ||
      (app.id && new URL(app.id, window.location.href).href === new URL('/?pwa=1', window.location.href).href)
  } catch { return false }
}

async function refreshInstallation() {
  _isPWA = inAppWindow()
  if (_isPWA || readInstalled()) rememberInstalled()
  else notify()
  if (_installed || _checking || typeof navigator.getInstalledRelatedApps !== 'function') return
  _checking = true
  // A blocked or unavailable browser API must not hold the UI indefinitely.
  const timeout = setTimeout(() => { _checked = true; notify() }, 1500)
  try {
    const apps = await navigator.getInstalledRelatedApps()
    if (apps.some(isLatidoApp)) rememberInstalled()
  } catch {
    // Brave and Safari may restrict this API; remembered launches remain valid.
  } finally {
    clearTimeout(timeout)
    _checking = false
    _checked = true
    notify()
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  if (_installed || inAppWindow()) return
  _prompt = event
  notify()
})
window.addEventListener('appinstalled', rememberInstalled)
for (const query of displayQueries) {
  if (query.addEventListener) query.addEventListener('change', refreshInstallation)
  else query.addListener?.(refreshInstallation)
}
window.addEventListener('storage', event => {
  if (event.key === INSTALLED_KEY && event.newValue === '1') rememberInstalled()
})
window.addEventListener('focus', refreshInstallation)
window.addEventListener('pageshow', refreshInstallation)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refreshInstallation()
})
void refreshInstallation()

export function usePWA() {
  const [, tick] = useState(0)
  useEffect(() => {
    const rerender = () => tick(n => n + 1)
    _subs.add(rerender)
    rerender()
    return () => _subs.delete(rerender)
  }, [])

  const promptInstall = async () => {
    if (!_prompt || _installed || !_checked) return false
    const prompt = _prompt
    _prompt = null
    notify()
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome !== 'accepted') return false
      rememberInstalled()
      return true
    } catch { return false }
  }

  return { isPWA: _isPWA, isInstalled: _installed, installationChecked: _checked,
    canInstall: Boolean(_prompt) && _checked && !_installed && !_isPWA, promptInstall }
}
