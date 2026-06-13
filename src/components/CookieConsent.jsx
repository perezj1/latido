import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  getCookieConsent,
  OPEN_COOKIE_SETTINGS_EVENT,
  saveCookieConsent,
  subscribeCookieConsent,
} from '../lib/cookieConsent'

function ChoiceButtons({ onAccept, onReject, onConfigure }) {
  return (
    <div className="cookie-consent-actions">
      <button type="button" className="cookie-consent-button cookie-consent-button--primary" onClick={onAccept}>
        Aceptar todo
      </button>
      <button type="button" className="cookie-consent-button cookie-consent-button--secondary" onClick={onReject}>
        Solo necesarias
      </button>
      <button type="button" className="cookie-consent-button cookie-consent-button--text" onClick={onConfigure}>
        Configurar
      </button>
    </div>
  )
}

function CookieBanner({ onAccept, onReject, onConfigure }) {
  const titleId = useId()

  return (
    <section className="cookie-consent-banner" role="dialog" aria-labelledby={titleId} aria-describedby={`${titleId}-description`}>
      <div className="cookie-consent-mark" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 3a9 9 0 1 0 9 9c-2.6.2-4.8-1.9-4.6-4.5A4.5 4.5 0 0 1 12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
          <circle cx="8.2" cy="10.1" r="1" fill="currentColor"/>
          <circle cx="11.5" cy="15.5" r="1" fill="currentColor"/>
          <circle cx="7.2" cy="16.2" r=".8" fill="currentColor"/>
        </svg>
      </div>
      <div className="cookie-consent-copy">
        <h2 id={titleId}>Tu privacidad, con claridad</h2>
        <p id={`${titleId}-description`}>
          Usamos almacenamiento necesario para que Latido funcione. Con tu permiso, activamos
          analítica para entender qué secciones ayudan más y mejorar la plataforma. No usamos
          publicidad comportamental ni vendemos tus datos.{' '}
          <Link to="/cookies">Ver política de cookies</Link>.
        </p>
      </div>
      <ChoiceButtons onAccept={onAccept} onReject={onReject} onConfigure={onConfigure} />
    </section>
  )
}

function PreferenceRow({ title, description, checked, disabled, onChange, badge }) {
  return (
    <div className="cookie-preference-row">
      <div>
        <div className="cookie-preference-title">
          <strong>{title}</strong>
          {badge && <span>{badge}</span>}
        </div>
        <p>{description}</p>
      </div>
      <label className={`cookie-switch${disabled ? ' cookie-switch--disabled' : ''}`}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} />
        <span aria-hidden="true" />
        <span className="sr-only">{checked ? `Desactivar ${title}` : `Activar ${title}`}</span>
      </label>
    </div>
  )
}

function CookiePreferences({ initialAnalytics, hasExistingChoice, onClose, onSave, onAccept, onReject }) {
  const [analytics, setAnalytics] = useState(initialAnalytics)
  const titleId = useId()
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = event => {
      if (event.key === 'Escape' && hasExistingChoice) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasExistingChoice, onClose])

  return (
    <div className="cookie-preferences-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && hasExistingChoice) onClose()
    }}>
      <section className="cookie-preferences" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="cookie-preferences-header">
          <div>
            <p>Centro de privacidad</p>
            <h2 id={titleId}>Preferencias de cookies</h2>
          </div>
          {hasExistingChoice && (
            <button ref={closeRef} type="button" className="cookie-preferences-close" onClick={onClose} aria-label="Cerrar preferencias">
              ×
            </button>
          )}
        </div>

        <p className="cookie-preferences-intro">
          Puedes decidir sobre la analítica sin perder acceso a Latido. Las tecnologías necesarias
          permanecen activas porque hacen posible la sesión, la seguridad y las funciones que solicitas.
        </p>

        <div className="cookie-preferences-list">
          <PreferenceRow
            title="Necesarias y funcionales"
            badge="Siempre activas"
            checked
            disabled
            description="Mantienen la sesión, recuerdan tus preferencias, favoritos, alertas y la elección de privacidad."
          />
          <PreferenceRow
            title="Analítica"
            badge="Opcional"
            checked={analytics}
            onChange={setAnalytics}
            description="Mide visitas, interacciones y rendimiento técnico mediante Latido y Vercel para mejorar el servicio. Se activa únicamente con tu consentimiento."
          />
        </div>

        <p className="cookie-preferences-legal">
          Consulta los proveedores, datos y plazos en la <Link to="/cookies" onClick={onClose}>política de cookies</Link>.
          Puedes retirar tu consentimiento en cualquier momento desde el pie de página.
        </p>

        <div className="cookie-preferences-actions">
          <button type="button" className="cookie-consent-button cookie-consent-button--primary" onClick={() => onSave(analytics)}>
            Guardar selección
          </button>
          <button type="button" className="cookie-consent-button cookie-consent-button--secondary" onClick={onReject}>
            Rechazar analítica
          </button>
          <button type="button" className="cookie-consent-button cookie-consent-button--text" onClick={onAccept}>
            Aceptar todo
          </button>
        </div>
      </section>
    </div>
  )
}

export default function CookieConsent({ showBanner = true }) {
  const location = useLocation()
  const [consent, setConsent] = useState(getCookieConsent)
  const [view, setView] = useState(() => {
    const wantsPreferences = new URLSearchParams(window.location.search).get('cookie-settings') === '1'
    if (wantsPreferences) return 'preferences'
    return getCookieConsent() || !showBanner ? null : 'banner'
  })

  useEffect(() => subscribeCookieConsent(next => {
    setConsent(next)
    if (next) setView(null)
  }), [])

  useEffect(() => {
    const openPreferences = () => setView('preferences')
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openPreferences)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openPreferences)
  }, [])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('cookie-settings') === '1') {
      setView('preferences')
    }
  }, [location.search])

  const clearSettingsParam = () => {
    if (!new URLSearchParams(window.location.search).has('cookie-settings')) return
    window.history.replaceState(window.history.state, '', window.location.pathname)
  }

  const choose = analytics => {
    const next = saveCookieConsent({ analytics })
    setConsent(next)
    setView(null)
    clearSettingsParam()
  }

  if (!view) return null

  if (view === 'preferences') {
    return (
      <CookiePreferences
        initialAnalytics={consent?.categories.analytics === true}
        hasExistingChoice={Boolean(consent)}
        onClose={() => {
          setView(null)
          clearSettingsParam()
        }}
        onSave={choose}
        onAccept={() => choose(true)}
        onReject={() => choose(false)}
      />
    )
  }

  return (
    <CookieBanner
      onAccept={() => choose(true)}
      onReject={() => choose(false)}
      onConfigure={() => setView('preferences')}
    />
  )
}
