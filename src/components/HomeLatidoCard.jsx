import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cardRpc } from '../lib/latidoCard'
import './HomeLatidoCard.css'

export default function HomeLatidoCard() {
  const { user, loading } = useAuth()
  const [data, setData] = useState(null)
  const summaryId = useId()
  useEffect(() => {
    if (loading || !user?.id) return
    let live = true
    let sequence = 0
    const userId = user.id
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      const current = ++sequence
      try {
        const result = await cardRpc('lc_member_home')
        if (live && current === sequence) setData({ userId, member: result?.membership || null })
      } catch {
        // The entry point remains usable even when membership cannot be loaded.
      }
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      live = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [user?.id, loading])

  const member = user && data?.userId === user.id ? data.member : null
  const until = Date.parse(member?.valid_until)
  const active = Boolean(member?.active) && Number.isFinite(until) && until > Date.now()
  return (
    <Link
      className="home-latido-card"
      to="/card"
      aria-label={member ? 'Ver Tarjeta Latido' : 'Conseguir Tarjeta Latido'}
      aria-describedby={summaryId}
    >
      <img className="home-latido-card-watermark" src="/favicon.svg" alt="" aria-hidden="true" />
      <span className="home-latido-card-logo" aria-hidden="true">
        <img src="/favicon.svg" alt="" />
      </span>
      <span className="home-latido-card-info" id={summaryId}>
        {member?.member_number != null ? (
          <>
            <span className="home-latido-card-label">Socio nº</span>
            <strong className="home-latido-card-number">
              {String(member.member_number).padStart(4, '0')}
            </strong>
          </>
        ) : (
          <strong className="home-latido-card-name">Tarjeta Latido</strong>
        )}
        <span>
          {active ? (
            `Válida hasta ${new Date(until).toLocaleDateString('es-CH', { timeZone: 'Europe/Zurich' })}`
          ) : member ? (
            'Membresía inactiva'
          ) : (
            <>
              Descuentos en negocios
              <br />
              de tu comunidad
            </>
          )}
        </span>
      </span>
      <span className="home-latido-card-actions">
        {member && (
          <span className="home-latido-card-status" data-active={active}>
            <span aria-hidden="true" />
            {active ? 'Activa' : 'Inactiva'}
          </span>
        )}
        <span className="home-latido-card-action">{member ? 'Ver tarjeta' : 'Conseguir'}</span>
      </span>
      <span className="home-latido-card-stripe" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
    </Link>
  )
}
