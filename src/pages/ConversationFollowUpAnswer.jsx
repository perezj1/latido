import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { followupQuestion, followupApi } from '../lib/conversationFollowups'
import { ConversationFollowUpCard } from '../components/ConversationFollowUp'
import './ConversationFollowUpAnswer.css'

const emailChoices = [
  { value: 'yes', label: 'Sí', icon: '👍' },
  { value: 'not_yet', label: 'En proceso', icon: '⏳' },
  { value: 'no', label: 'No', icon: '👎' },
]

export default function ConversationFollowUpAnswer({ api = followupApi, initialLink }) {
  const [link] = useState(() => {
    if (initialLink) return initialLink
    const params = new URLSearchParams(window.location.hash.slice(1))
    const value = { token: params.get('token') || '', answer: params.get('respuesta') || '' }
    return value
  })
  const [followup, setFollowup] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const initialRequest = useRef(null)
  useEffect(() => { if (!initialLink) window.history.replaceState({}, '', window.location.pathname) }, [initialLink])
  useEffect(() => {
    let active = true
    if (!/^[a-f0-9]{64}$/.test(link.token)) { setError('Este enlace ya no está disponible. Puedes responder desde la conversación en Latido.'); setLoading(false); return undefined }
    const automatic = ['yes','not_yet','no'].includes(link.answer)
    const key = `${link.token}:${link.answer}`
    // Reuse the same request if React runs the effect again during development.
    if (initialRequest.current?.key !== key) initialRequest.current = { key, promise: api.email(link.token, automatic ? link.answer : undefined) }
    initialRequest.current.promise.then(data => { if (active) { setFollowup(data); setSaved(automatic) } }).catch(() => { if (active) setError('No se ha podido guardar la respuesta o el enlace ya se ha utilizado. Puedes revisar tu respuesta en el chat.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, link.token, link.answer])
  async function answer(value) {
    if (saving) return
    setSaving(true); setError('')
    try { setFollowup(saved ? await api.emailChange(followup.edit_token, followup.round, 'answer', value) : await api.email(link.token, value)); setSaved(true); setEditing(false); return true }
    catch { setError('No se ha guardado tu respuesta. Inténtalo de nuevo o abre la conversación en Latido.'); return false }
    finally { setSaving(false) }
  }
  async function feedback(action, value = null) {
    if (saving) return
    setSaving(true); setError('')
    try { setFollowup(await api.emailChange(followup.edit_token, followup.round, action, value)) }
    catch { setError('No se ha guardado el cambio. Abre la conversación para actualizar tu respuesta.') }
    finally { setSaving(false) }
  }
  const showChoices = followup && (!saved || editing)
  return <main className="followup-email-page">
    <div className="followup-email-layout">
      <article className="followup-email-card" aria-label="Estado de tu consulta">
        <header className="followup-email-header">
          <a href="https://latido.ch/" className="followup-email-logo"><img src="/icon-192.png" width="38" height="38" alt="Latido" /><span>latido.ch</span></a>
        </header>
        <div className="followup-email-content">
          <span className="followup-email-label">Estado de tu consulta</span>
          <h1>¿Cómo te ha ido?</h1>
          <p className="followup-email-intro">¡Hola! Hace unos días hablaste por el chat de Latido con:</p>
          <section className="followup-email-context" aria-label="Tu consulta">
            <div className="followup-email-contact"><span className="followup-email-chat-icon" aria-hidden="true">💬</span><div><h2>{followup?.contact_name || 'este contacto'}</h2><p>{followup?.title || 'Tu consulta en Latido'}</p></div></div>
            <Link className="followup-email-chat-link" to={followup ? `/mensajes?conv=${encodeURIComponent(followup.conversation_id)}` : '/mensajes'}>{followup ? 'Abrir la conversación' : 'Abrir mis conversaciones'} <span aria-hidden="true">→</span></Link>
          </section>
          <section className="followup-email-response" aria-label="Tu respuesta" aria-busy={loading || saving}>
            <h2>{followupQuestion(followup?.contact_name)}</h2>
            <div className="followup-email-response-body">
              {loading ? <p role="status">{['yes','not_yet','no'].includes(link.answer) ? 'Guardando tu respuesta…' : 'Comprobando el enlace…'}</p>
                : showChoices ? <><div className="followup-email-choices">{emailChoices.map(({ value, label, icon }) => <button key={value} type="button" className={`followup-email-choice followup-email-choice--${value}`} disabled={saving} onClick={() => answer(value)}><span aria-hidden="true">{icon}</span>{label}</button>)}</div><p className="followup-email-hint">Responde en un clic</p></>
                : followup?.dismissed ? <div className="followup-email-saved"><p>Tu respuesta se ha guardado.</p><button type="button" onClick={() => setEditing(true)}>Cambiar respuesta</button></div>
                : followup && <ConversationFollowUpCard followup={followup} onAnswer={answer} onEdit={() => setEditing(true)} onFeedback={feedback} saving={saving} />}
              {error && <p role="alert" className="followup-email-error">{error}</p>}
            </div>
          </section>
          <footer className="followup-email-signoff"><p>Tu respuesta nos ayuda a mejorar Latido y ofrecer servicios de calidad. ¡Gracias! ❤️<br /><strong>El equipo de Latido</strong></p></footer>
        </div>
      </article>
      <footer className="followup-email-footer"><a href="https://latido.ch/" className="followup-email-footer-brand">latido.ch</a><p>Recibes este correo porque usaste el chat de Latido.ch.</p><a href="https://latido.ch/">Visitar latido.ch</a></footer>
    </div>
  </main>
}
