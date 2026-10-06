import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, Share2, ShieldCheck, Ticket } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { trackAnalyticsEvent } from '../lib/analytics'
import { SANTIAGO_CRUZ_EVENT as EVENT, SANTIAGO_CRUZ_GIVEAWAY as GIVEAWAY } from '../lib/giveaways'
import '../pages/SantiagoCruz.css'

function errorMessage(error) {
  const text = String(error?.message || '')
  if (text.includes('invalid_email')) return 'Revisa el email: parece que no es válido.'
  if (text.includes('invalid_name')) return 'Escribe tu nombre completo (nombre y apellido).'
  if (text.includes('giveaway_closed')) return 'El sorteo ya ha terminado.'
  if (text.includes('giveaway_not_started')) return 'El sorteo todavía no ha empezado.'
  return 'No hemos podido guardar tu participación. Inténtalo de nuevo en unos minutos.'
}

function track(eventType, metadata = {}, userId = null) {
  trackAnalyticsEvent(eventType, {
    user_id:userId,
    metadata:{ giveaway_id:GIVEAWAY.id, ...metadata },
  })
}

export function GiveawayShareButton({ className = 'sc-share', label = 'Compartir', userId }) {
  const share = async () => {
    const url = `${window.location.origin}${GIVEAWAY.path}`
    const text = `🎤 ${EVENT.artist} en Zürich: participa gratis en el sorteo de ${GIVEAWAY.winners} entradas dobles en Latido.`
    track('giveaway_share', { method:navigator.share ? 'native' : 'copy' }, userId)
    if (navigator.share) {
      try {
        await navigator.share({ title:`${EVENT.artist} en Zürich · Sorteo Latido`, text, url })
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      toast.success('Enlace copiado')
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button type="button" className={className} onClick={share}>
      <Share2 size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

export default function GiveawayParticipationCard({
  onParticipated,
  giveawayEnded = false,
  onOpenConditions,
  source = 'landing',
}) {
  const { user, isLoggedIn, loading:authLoading, displayName } = useAuth()
  const [form, setForm] = useState({ name:'', email:'', marketing:false, website:'' })
  const [status, setStatus] = useState('idle')
  const [entryEmail, setEntryEmail] = useState('')
  const [error, setError] = useState('')
  const nameRef = useRef(null)
  const now = Date.now()
  const closed = giveawayEnded || now > new Date(GIVEAWAY.endsAt).getTime()
  const notStarted = now < new Date(GIVEAWAY.startsAt).getTime()

  useEffect(() => {
    if (!isLoggedIn) return undefined
    let cancelled = false
    supabase.rpc('get_my_giveaway_entry', { p_giveaway_id:GIVEAWAY.id }).then(({ data }) => {
      if (cancelled || !data?.status) return
      setEntryEmail(data.email || user?.email || '')
      setStatus('already')
      onParticipated?.()
    })
    return () => { cancelled = true }
  }, [isLoggedIn, user?.email, onParticipated])

  const submit = async event => {
    event.preventDefault()
    if (status === 'submitting') return
    setError('')

    if (form.website) {
      setStatus('entered')
      return
    }

    if (!isLoggedIn) {
      const fullNameParts = form.name.trim().split(/\s+/).filter(Boolean)
      if (fullNameParts.length < 2) {
        setError('Escribe tu nombre completo (nombre y apellido).')
        nameRef.current?.focus()
        return
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(form.email.trim())) {
        setError('Revisa el email: parece que no es válido.')
        return
      }
    }

    setStatus('submitting')
    const { data, error:rpcError } = await supabase.rpc('enter_giveaway', {
      p_giveaway_id:GIVEAWAY.id,
      p_name:isLoggedIn ? displayName : form.name.trim(),
      p_email:isLoggedIn ? user?.email : form.email.trim(),
      p_marketing_consent:form.marketing,
      p_source:new URLSearchParams(window.location.search).get('utm_source') || source,
    })

    if (rpcError) {
      if (String(rpcError.message || '').includes('giveaway_closed')) {
        setStatus('closed')
        return
      }
      setStatus('idle')
      setError(errorMessage(rpcError))
      return
    }

    setEntryEmail(data?.email || form.email.trim() || user?.email || '')
    setStatus(data?.status === 'already' ? 'already' : 'entered')
    onParticipated?.()
    if (data?.status !== 'already') {
      track('giveaway_entry', {
        entry_type:isLoggedIn ? 'account' : 'guest',
        marketing_consent:form.marketing,
        source,
      }, user?.id || null)
    }
  }

  if (status === 'entered' || status === 'already') {
    return (
      <div className="sc-card sc-card--success" role="status" aria-live="polite">
        <span className="sc-success__icon" aria-hidden="true"><Check size={26} strokeWidth={3} /></span>
        <h2 className="sc-card__title">¡Ya estás participando!</h2>
        <p className="sc-card__text">
          {status === 'already' ? 'Este email ya estaba en el sorteo. ' : ''}
          Si ganas, te escribiremos{entryEmail ? <> a <strong>{entryEmail}</strong></> : ''} el {GIVEAWAY.drawLabel}.
        </p>

        {!isLoggedIn && (
          <div className="sc-join">
            <p>Únete a la comunidad hispanohablante en Suiza.</p>
            <Link
              to={`/auth?mode=register&next=${encodeURIComponent('/')}`}
              className="sc-button sc-button--blue"
              onClick={() => track('giveaway_signup_click')}
            >
              Crear mi perfil gratis
            </Link>
          </div>
        )}

        <div className="sc-share-box">
          <p>¿Conoces a alguien que quiera ver a {EVENT.artist}?</p>
          <GiveawayShareButton userId={user?.id || null} />
        </div>
      </div>
    )
  }

  if (closed || status === 'closed') {
    return (
      <div className="sc-card" role="status">
        <span className="sc-card__eyebrow">Sorteo finalizado</span>
        <h2 className="sc-card__title">La participación está cerrada</h2>
        <p className="sc-card__text">
          El plazo terminó el {GIVEAWAY.endLabel}. Contactaremos por email con las personas ganadoras.
        </p>
      </div>
    )
  }

  return (
    <form className="sc-card" onSubmit={submit} noValidate>
      <span className="sc-card__eyebrow">Sorteo gratuito</span>
      <h2 className="sc-card__title">Participa en el sorteo</h2>

      {notStarted ? (
        <p className="sc-card__notice">El sorteo empieza el {GIVEAWAY.startLabel}.</p>
      ) : authLoading ? (
        <div className="sc-card__loading" aria-hidden="true" />
      ) : isLoggedIn ? (
        <div className="sc-account">
          <span className="sc-account__avatar" aria-hidden="true">{(displayName || 'L').slice(0, 1).toUpperCase()}</span>
          <span className="sc-account__text">
            <small>Participas con tu cuenta de Latido</small>
            <strong>{displayName}</strong>
            <span>{user?.email}</span>
          </span>
        </div>
      ) : (
        <div className="sc-fields">
          <label className="sc-field">
            <span>Nombre completo</span>
            <input
              ref={nameRef}
              type="text"
              name="name"
              autoComplete="name"
              maxLength={80}
              value={form.name}
              onChange={event => setForm(previous => ({ ...previous, name:event.target.value }))}
              placeholder="Nombre y apellido"
              required
            />
          </label>
          <label className="sc-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              value={form.email}
              onChange={event => setForm(previous => ({ ...previous, email:event.target.value }))}
              placeholder="tu@email.com"
              required
            />
          </label>
          <label className="sc-honeypot" aria-hidden="true">
            Web
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={event => setForm(previous => ({ ...previous, website:event.target.value }))}
            />
          </label>
          <label className="sc-check">
            <input
              type="checkbox"
              checked={form.marketing}
              onChange={event => setForm(previous => ({ ...previous, marketing:event.target.checked }))}
            />
            <span>Quiero recibir novedades de Latido por email. <em>(opcional)</em></span>
          </label>
        </div>
      )}

      {error && <p className="sc-error" role="alert">{error}</p>}

      {!notStarted && (
        <button type="submit" className="sc-button sc-button--primary sc-button--block" disabled={status === 'submitting' || authLoading}>
          <Ticket size={19} aria-hidden="true" />
          {status === 'submitting' ? 'Guardando…' : 'Participar gratis'}
        </button>
      )}

      <div className="sc-legal">
        <p><ShieldCheck size={15} aria-hidden="true" /> Gratis · Sin compra · Sin cuenta</p>
        <p>
          Al participar aceptas las{' '}
          {onOpenConditions ? (
            <button type="button" className="sc-link" onClick={onOpenConditions}>condiciones del sorteo</button>
          ) : (
            <Link to={`${GIVEAWAY.path}#condiciones`} className="sc-link">condiciones del sorteo</Link>
          )}
          {' '}y la <Link to="/privacidad" className="sc-link">política de privacidad</Link>.
        </p>
      </div>
    </form>
  )
}
