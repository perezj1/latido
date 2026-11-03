import { useEffect, useRef, useState } from 'react'
import { Check, Clock3, Share, X } from 'lucide-react'
import { FOLLOWUP_REASONS, followupApi, followupDate, followupQuestion } from '../lib/conversationFollowups'
import './ConversationFollowUp.css'

export function ConversationFollowUpCard({ followup, onAnswer, onFeedback, onEdit, contactName, publicationTitle = '', saving = false, error = '', cardRef }) {
  const [editing, setEditing] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  useEffect(() => { setEditing(false); setShareStatus('') }, [followup?.id, followup?.round])
  if (!followup || (followup.dismissed && !editing)) return null
  const name = contactName || followup.contact_name || 'este contacto'
  const subject = String(publicationTitle || '').trim()
  const done = followup.outcome === 'yes'
  const closed = followup.outcome === 'no'
  const waiting = followup.outcome === 'not_yet' && !followup.due
  const asking = editing || (!done && !closed && !waiting)
  const reason = closed && !followup.reason_answered && !editing
  const tone = asking || reason ? 'question' : done ? 'success' : waiting ? 'progress' : 'closed'
  const change = onAnswer && <button type="button" className="conversation-followup__text-button" disabled={saving} onClick={() => onEdit ? onEdit() : setEditing(true)}>Cambiar respuesta</button>
  const dismiss = onFeedback && <button type="button" className="conversation-followup__dismiss" disabled={saving} onClick={() => onFeedback('dismiss')} aria-label="Cerrar seguimiento"><X size={16} /></button>
  async function choose(value) {
    if ((await onAnswer?.(value)) !== false) setEditing(false)
  }
  async function share() {
    const data = { title: 'Latido', text: 'Encuentra lo que necesitas y conecta con la comunidad hispanohablante en Suiza.', url: 'https://latido.ch' }
    try {
      if (navigator.share) await navigator.share(data)
      else { await navigator.clipboard.writeText(`${data.text}\n${data.url}`); setShareStatus('Enlace copiado') }
    } catch (error) { if (error.name !== 'AbortError') setShareStatus('No se pudo compartir. Puedes copiar https://latido.ch.') }
  }
  return <aside ref={cardRef} className={`conversation-followup conversation-followup--${tone}`} aria-label="Seguimiento de Latido">
    <div className="conversation-followup__brand"><img src="/favicon.svg" width="10" height="10" alt="" /><span>Latido</span><span className="conversation-followup__privacy">· Solo tú ves esto</span></div>
    <div className="conversation-followup__row">
      {!asking && <span className="conversation-followup__icon" aria-hidden="true">{waiting ? <Clock3 size={17} /> : done || (closed && !reason) ? <Check size={18} /> : <X size={17} />}</span>}
      <div className="conversation-followup__copy">
        {asking ? <><h3>{followupQuestion(name)}</h3>{subject && <p className="conversation-followup__subject">Le escribiste por “{subject}”</p>}</>
          : done ? <><h3>¡Genial, lo conseguiste!</h3><p>Recomienda Latido para ayudar a alguien más.</p></>
          : waiting ? <p className="conversation-followup__message"><strong>Perfecto.</strong> Te volveremos a preguntar el {followupDate(followup.due_at)}.</p>
          : reason ? <><h3>Lo sentimos. ¿Qué pasó?</h3><p>Opcional · {change}</p></>
          : <p className="conversation-followup__message"><strong>Gracias por contárnoslo.</strong> Cerramos el seguimiento con {name}.</p>}
      </div>
    </div>
    {asking ? <div className="conversation-followup__answers"><button type="button" disabled={saving} onClick={() => choose('yes')}><Check size={17} />Sí</button><button type="button" disabled={saving} onClick={() => choose('not_yet')}><Clock3 size={16} />En proceso</button><button type="button" disabled={saving} onClick={() => choose('no')}><X size={16} />No</button></div>
      : reason ? <div className="conversation-followup__reasons">{Object.entries(FOLLOWUP_REASONS).map(([id, label]) => <button type="button" key={id} disabled={saving || !onFeedback} onClick={() => onFeedback('reason', id)}>{label}</button>)}<button type="button" className="conversation-followup__skip" disabled={saving || !onFeedback} onClick={() => onFeedback('reason', null)}>Omitir</button></div>
      : <div className="conversation-followup__footer">{done ? <button type="button" className="conversation-followup__share" onClick={share}><Share size={16} />Compartir Latido</button> : change}{dismiss}</div>}
    {shareStatus && <p role="status" className="conversation-followup__status">{shareStatus}</p>}
    {saving && <p role="status">Guardando tu respuesta…</p>}
    {error && <p className="conversation-followup__error" role="alert">{error}</p>}
  </aside>
}

export default function ConversationFollowUp({ conversationId, userId, contactName, publicationTitle, api = followupApi }) {
  const [state, setState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cardRef = useRef(null)
  useEffect(() => {
    let active = true
    setState(null)
    setError('')
    async function load() {
      try { const data = await api.get(conversationId); if (active) setState({ conversationId, data }) } catch { /* The migration may not be installed yet. Chat remains available. */ }
    }
    if (conversationId && userId) void load()
    const timer = setInterval(() => { if (!document.hidden && conversationId && userId) void load() }, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [conversationId, userId, api])
  const followup = state?.conversationId === conversationId ? state.data : null
  useEffect(() => {
    if (followup?.due) cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [followup?.id, followup?.round])
  async function answer(value) {
    if (!followup || saving) return
    setSaving(true)
    setError('')
    try { setState({ conversationId, data: await api.answer(conversationId, followup.round, value) }); return true }
    catch { setError('No se ha guardado tu respuesta. Comprueba la conexión y vuelve a intentarlo.'); return false }
    finally { setSaving(false) }
  }
  async function feedback(action, value = null) {
    if (!followup || saving) return
    setSaving(true); setError('')
    try { setState({ conversationId, data: await api.feedback(conversationId, followup.round, action, value) }) }
    catch { setError('No se ha guardado el cambio. Comprueba la conexión y vuelve a intentarlo.') }
    finally { setSaving(false) }
  }
  return <ConversationFollowUpCard cardRef={cardRef} followup={followup} onAnswer={answer} onFeedback={feedback} contactName={contactName} publicationTitle={publicationTitle} saving={saving} error={error} />
}
