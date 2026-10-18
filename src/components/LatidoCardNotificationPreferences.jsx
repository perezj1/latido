import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Check, MapPin } from 'lucide-react'
import { cardRpc } from '../lib/latidoCard'

export default function LatidoCardNotificationPreferences({ cities }) {
  const [preference, setPreference] = useState(null)
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const section = useRef(null)
  const { hash } = useLocation()
  useEffect(() => {
    let live = true
    const controller = new AbortController()
    setError('')
    cardRpc('lc_notification_preferences', {}, { signal: controller.signal })
      .then((data) => {
        if (!data || typeof data.new_offers !== 'boolean') throw new Error('Invalid preference')
        if (live) {
          setPreference(data)
          setCity(data.city || '')
        }
      })
      .catch(() => {
        if (live) setError('No se pudieron cargar tus alertas. Vuelve a intentarlo.')
      })
    return () => {
      live = false
      controller.abort()
    }
  }, [attempt])
  useEffect(() => {
    if (hash !== '#lc-card-alerts') return
    const frame = requestAnimationFrame(() =>
      section.current?.scrollIntoView({ behavior: 'instant', block: 'center' })
    )
    return () => cancelAnimationFrame(frame)
  }, [hash, preference])
  const save = async (enabled) => {
    if (busy) return
    if (enabled && !city) {
      setError('Elige una ciudad para activar las alertas.')
      section.current?.querySelector('select')?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await cardRpc('lc_notification_preferences', {
        p_enabled: enabled,
        p_city: city
      })
      if (!data || typeof data.new_offers !== 'boolean') throw new Error('Invalid preference')
      setPreference(data)
      setCity(data.city || '')
    } catch {
      setError('No se pudo guardar tu preferencia. Vuelve a intentarlo.')
    } finally {
      setBusy(false)
    }
  }
  return (
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
            Te avisamos dentro de Latido cuando haya descuentos nuevos en tu ciudad. Como máximo,
            uno por semana.
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
            <strong>{preference.city}</strong>
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
              aria-label="Ciudad para las alertas"
              value={city}
              disabled={busy}
              onChange={(event) => {
                setCity(event.target.value)
                setError('')
              }}
            >
              <option value="">Elige tu ciudad</option>
              {[...new Set([...cities, preference.city].filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'es'))
                .map((value) => (
                  <option key={value}>{value}</option>
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
  )
}
