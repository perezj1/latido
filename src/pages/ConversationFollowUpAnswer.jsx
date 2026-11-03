import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Check, Clock3, MessageCircle, Share, Users, X } from 'lucide-react'
import { FOLLOWUP_REASONS, followupQuestion, followupApi } from '../lib/conversationFollowups'
import './ConversationFollowUpAnswer.css'

const choices = [{ value: 'yes', label: 'Sí', Icon: Check }, { value: 'not_yet', label: 'En proceso', Icon: Clock3 }, { value: 'no', label: 'No', Icon: X }]
const reminderDate = value => value ? new Date(value).toLocaleDateString('es-ES', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '') : ''

export default function ConversationFollowUpAnswer({ api = followupApi, initialLink }) {
  const navigate = useNavigate()
  const [link] = useState(() => {
    if (initialLink) return initialLink
    const params = new URLSearchParams(window.location.hash.slice(1))
    return { token: params.get('token') || '', answer: params.get('respuesta') || '' }
  })
  const [followup, setFollowup] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [reason, setReason] = useState('')
  const [shareStatus, setShareStatus] = useState('')
  const initialRequest = useRef(null)
  useEffect(() => { if (!initialLink) window.history.replaceState({}, '', window.location.pathname) }, [initialLink])
  useEffect(() => {
    let active = true
    if (!/^[a-f0-9]{64}$/.test(link.token)) { setError('Este enlace ya no está disponible. Puedes responder desde la conversación en Latido.'); setLoading(false); return undefined }
    const automatic = ['yes', 'not_yet', 'no'].includes(link.answer)
    const key = `${link.token}:${link.answer}`
    // Reuse the request when React checks effects twice in development.
    if (initialRequest.current?.key !== key) initialRequest.current = { key, promise: api.email(link.token, automatic ? link.answer : undefined) }
    initialRequest.current.promise.then(data => { if (active) { setFollowup(data); setSaved(automatic) } }).catch(() => { if (active) setError('No se ha podido guardar la respuesta o el enlace ya se ha utilizado. Puedes revisar tu respuesta en el chat.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, link.token, link.answer])
  async function answer(value) {
    if (saving || saved) return
    setSaving(true); setError('')
    try { setFollowup(await api.email(link.token, value)); setSaved(true) }
    catch { setError('No se ha guardado tu respuesta. Inténtalo de nuevo o abre la conversación en Latido.') }
    finally { setSaving(false) }
  }
  async function saveReason(value) {
    if (saving) return false
    setSaving(true); setError('')
    try { setFollowup(await api.emailChange(followup.edit_token, followup.round, 'reason', value)); return true }
    catch { setError('No se ha guardado el motivo. Inténtalo de nuevo.'); return false }
    finally { setSaving(false) }
  }
  async function leaveWithoutReason() {
    // The answer is already saved; an optional reason must never block leaving.
    await saveReason(null)
    navigate('/')
  }
  async function share() {
    const data = { title: 'Latido', text: 'Encuentra lo que necesitas y conecta con la comunidad hispanohablante en Suiza.', url: 'https://latido.ch' }
    try {
      if (navigator.share) await navigator.share(data)
      else { await navigator.clipboard.writeText(`${data.text}\n${data.url}`); setShareStatus('Enlace copiado') }
    } catch (error) { if (error.name !== 'AbortError') setShareStatus('No se pudo compartir. Puedes copiar https://latido.ch.') }
  }
  const fullName = String(followup?.contact_name || '').trim()
  const name = fullName && !/^(?:este contacto|usuario)$/i.test(fullName) ? fullName.split(/\s+/)[0] : 'este contacto'
  const phase = !saved ? 'question' : followup?.outcome === 'yes' ? 'yes' : followup?.outcome === 'not_yet' ? 'progress' : followup?.reason_answered ? 'closed' : 'no'
  const title = phase === 'yes' ? '¡Enhorabuena!' : phase === 'progress' ? '¡Perfecto!' : phase === 'no' ? 'Lo sentimos' : phase === 'closed' ? 'Gracias por contárnoslo' : '¿Cómo te ha ido?'
  const Icon = phase === 'yes' || phase === 'closed' ? Check : phase === 'progress' ? Clock3 : phase === 'no' ? X : MessageCircle
  const chat = followup ? `/mensajes?conv=${encodeURIComponent(followup.conversation_id)}` : '/mensajes'
  return <div className="followup-result-page">
    <header className="followup-result-header"><div><Link to="/" className="followup-result-brand"><img src="/favicon.svg" width="24" height="24" alt="" /><span>latido.ch</span></Link></div></header>
    <main className="followup-result-main">
      <section className={`followup-result-card followup-result-card--${phase}`} aria-label="Estado de tu consulta" aria-busy={loading || saving}>
        <div className="followup-result-icon" aria-hidden="true"><span><Icon size={26} strokeWidth={2.5} /></span></div>
        <span className="followup-result-badge">{saved ? `Tu respuesta: ${phase === 'yes' ? 'Sí' : phase === 'progress' ? 'En proceso' : 'No'}` : 'Estado de tu consulta'}</span>
        <h1>{title}</h1>
        {loading ? <p role="status" className="followup-result-description">{link.answer ? 'Guardando tu respuesta…' : 'Comprobando el enlace…'}</p> : <>
          {phase === 'yes' && <><p className="followup-result-description">Nos alegramos de que Latido te haya sido útil para llegar a un acuerdo con {name}.</p><div className="followup-result-recommend"><div className="followup-result-recommend-copy"><span aria-hidden="true"><Users size={21} /></span><div><h2>Lo que te sirvió a ti puede servirle a otro</h2><p>Comparte Latido con quien hable español y viva en Suiza. Hagamos crecer juntos nuestra comunidad.</p></div></div><button className="followup-result-button followup-result-button--primary" type="button" onClick={share}><Share size={17} />Compartir Latido</button>{shareStatus && <p role="status">{shareStatus}</p>}</div><Link className="followup-result-button followup-result-home" to="/">Volver a Latido</Link></>}
          {phase === 'progress' && <><p className="followup-result-description">En unos días comprobaremos si ha avanzado tu consulta con {name}. Mientras tanto, puedes seguir la conversación en el chat.</p><div className="followup-result-reminder"><span aria-hidden="true"><CalendarDays size={21} /></span><div><p>Te volveremos a preguntar el</p><strong>{reminderDate(followup.due_at)}</strong></div></div><div className="followup-result-actions"><Link className="followup-result-button followup-result-button--primary" to="/">Volver a Latido</Link><Link className="followup-result-button" to={chat}><MessageCircle size={16} />Abrir la conversación</Link></div></>}
          {phase === 'no' && <><p className="followup-result-description">Gracias por decírnoslo. Tu respuesta nos ayuda a mejorar Latido.</p><form className="followup-result-reason-form" onSubmit={event => { event.preventDefault(); if (reason) void saveReason(reason) }}><fieldset disabled={saving}><legend><strong>¿Qué pasó con {name}?</strong><span>Opcional</span></legend>{Object.entries(FOLLOWUP_REASONS).map(([value, label]) => <label className="followup-result-reason" key={value}><input type="radio" name="followup-reason" value={value} checked={reason === value} onChange={() => setReason(value)} /><span>{label}</span></label>)}</fieldset><div className="followup-result-actions"><button className="followup-result-button followup-result-button--primary" type="submit" disabled={!reason || saving}>Enviar</button><button className="followup-result-button" type="button" onClick={leaveWithoutReason} disabled={saving}>Volver a Latido</button></div></form></>}
          {phase === 'closed' && <><p className="followup-result-description">Cerramos el seguimiento con {name}. Tu opinión nos ayuda a que Latido funcione mejor para todos.</p><Link className="followup-result-button followup-result-button--primary followup-result-home" to="/">Volver a Latido</Link></>}
          {phase === 'question' && <>{followup && <><p className="followup-result-description">{followupQuestion(fullName)}</p><p className="followup-result-subject">{followup.title}</p><div className="followup-result-choices">{choices.map(({ value, label, Icon: ChoiceIcon }) => <button type="button" key={value} disabled={saving} onClick={() => answer(value)} className="followup-result-button"><ChoiceIcon size={17} />{label}</button>)}</div></>}<Link className="followup-result-button followup-result-home" to={chat}>Abrir mis conversaciones</Link></>}
        </>}
        {saving && <p role="status" className="followup-result-status">Guardando…</p>}
        {error && <p role="alert" className="followup-result-error">{error}</p>}
      </section>
    </main>
    <footer className="followup-result-footer"><p>Gracias por ayudarnos a mejorar Latido <span aria-label="corazón">♥</span></p><strong>El equipo de Latido</strong></footer>
  </div>
}
