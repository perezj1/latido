import { useEffect, useRef, useState } from 'react'
import { Bell, Check, MapPin, X } from 'lucide-react'
import { cardRpc } from '../lib/latidoCard'
import { CANTONS } from '../lib/constants'

const validPreference = (data) =>
  data &&
  typeof data.new_offers === 'boolean' &&
  (!data.new_offers || CANTONS.some((item) => item.code === data.canton))

export default function LatidoCardNotificationPreferences({ open, onClose, onPreferenceChange }) {
  const [preference, setPreference] = useState(null)
  const [canton, setCanton] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const section = useRef(null)
  const dialog = useRef(null)
  useEffect(() => {
    let live = true
    const controller = new AbortController()
    setError('')
    cardRpc('lc_notification_preferences', {}, { signal: controller.signal })
      .then((data) => {
        if (!validPreference(data)) throw new Error('Invalid preference')
        if (live) {
          setPreference(data)
          setCanton(data.canton || '')
          onPreferenceChange?.(data)
        }
      })
      .catch(() => {
        if (live) setError('No se pudieron cargar tus alertas. Vuelve a intentarlo.')
      })
    return () => {
      live = false
      controller.abort()
    }
  }, [attempt, onPreferenceChange])
  useEffect(() => {
    if (!open) return
    const element = dialog.current
    const opener = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = overflow
      const target = opener?.isConnected
        ? opener
        : document.querySelector('.lc-app-header [aria-label="Alertas de descuentos"]')
      target?.focus({ preventScroll: true })
    }
  }, [open])
  const save = async (enabled) => {
    if (busy) return
    if (enabled && !canton) {
      setError('Elige un cantón para activar las alertas.')
      section.current?.querySelector('select')?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await cardRpc('lc_notification_preferences', {
        p_enabled: enabled,
        p_canton: canton
      })
      if (!validPreference(data)) throw new Error('Invalid preference')
      setPreference(data)
      setCanton(data.canton || '')
      onPreferenceChange?.(data)
    } catch {
      setError('No se pudo guardar tu preferencia. Vuelve a intentarlo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className="lc-alerts-modal"
      aria-labelledby="lc-alerts-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const box = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose()
      }}
    >
      <button
        className="lc-alerts-close"
        type="button"
        aria-label="Cerrar alertas"
        onClick={onClose}
      >
        <X size={20} aria-hidden="true" />
      </button>
      <section
        ref={section}
        className="lc-notification-preferences"
        id="lc-card-alerts"
        aria-labelledby="lc-alerts-title"
      >
        <div className="lc-alerts-heading">
          <span aria-hidden="true">
            <Bell size={23} />
          </span>
          <div>
            <h2 id="lc-alerts-title">Alertas de descuentos</h2>
            <p>
              Te avisamos dentro de Latido cuando haya nuevas ofertas o negocios con descuentos en
              tu cantón. Como máximo, un aviso por semana.
            </p>
          </div>
        </div>
        {!preference ? (
          error ? (
            <button
              type="button"
              className="lc-text-button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Reintentar
            </button>
          ) : (
            <p role="status">Cargando alertas…</p>
          )
        ) : preference.new_offers ? (
          <div className="lc-alerts-active">
            <span role="status">
              <Check size={16} aria-hidden="true" /> Alertas activadas para{' '}
              <strong>{CANTONS.find((item) => item.code === preference.canton)?.name}</strong>
            </span>
            <button type="button" disabled={busy} onClick={() => save(false)}>
              Desactivar
            </button>
          </div>
        ) : (
          <form
            className="lc-alerts-form"
            onSubmit={(event) => {
              event.preventDefault()
              save(true)
            }}
          >
            <label>
              <MapPin size={16} aria-hidden="true" />
              <select
                aria-label="Cantón para las alertas"
                value={canton}
                disabled={busy}
                onChange={(event) => {
                  setCanton(event.target.value)
                  setError('')
                }}
              >
                <option value="">Elige tu cantón</option>
                {CANTONS.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="lc-button" disabled={busy} type="submit">
              {busy ? 'Activando…' : 'Activar'}
            </button>
          </form>
        )}
        {error && (
          <p className="lc-alert" role="alert">
            {error}
          </p>
        )}
      </section>
    </dialog>
  )
}
