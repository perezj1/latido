import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ConversationFollowUp, { ConversationFollowUpCard } from '../../src/components/ConversationFollowUp'
import ConversationFollowUpAnswer from '../../src/pages/ConversationFollowUpAnswer'
import ConversationFollowUpReport from '../../src/components/admin/ConversationFollowUpReport'
import EmailNotificationPreference from '../../src/components/EmailNotificationPreference'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'

async function request(action, values = {}) {
  const response = await fetch('/__followup/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...values }) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error)
  return data
}
const api = { get: () => request('get'), answer: (_id, round, answer) => request('answer', { round, answer }), feedback: (_id, round, change, value) => request('feedback', { round, change, value }), email: (token, answer) => request('email', { token, ...(answer ? { answer } : {}) }), emailChange: (token, round, change, value) => request('email_change', { token, round, change, value }) }
const preferenceApi = { read: () => request('email_preferences'), save: (_id, enabled) => request('email_preferences', { enabled }) }
function PreferencePreview() { return <main style={{ maxWidth: 520, margin: '40px auto', padding: 20, fontFamily: 'Poppins,sans-serif' }}><h1 style={{ fontSize: 22 }}>Avisos de correo</h1><p style={{ fontSize: 12 }}>Ajustes de prueba locales.</p><EmailNotificationPreference userId="11111111-1111-4111-8111-111111111111" api={preferenceApi} /><a href="/scripts/fixtures/followup-preview.html">Volver a la prueba</a></main> }
function StateExample({ outcome = 'pending', reasonAnswered = false }) {
  const [followup, setFollowup] = useState({ id: `example-${outcome}-${reasonAnswered}`, round: 1, outcome, due: outcome === 'pending', contact_name: 'Ramón Pérez', due_at: new Date(Date.now() + 7 * 86400000).toISOString(), reason_answered: reasonAnswered })
  return <ConversationFollowUpCard followup={followup} publicationTitle="Vendo bicicleta de montaña" onAnswer={value => setFollowup(current => ({ ...current, round: current.round + 1, outcome: value, due: false, reason_answered: false, dismissed: false }))} onFeedback={(action, value) => setFollowup(current => action === 'dismiss' ? { ...current, dismissed: true } : { ...current, reason_answered: true, no_reason: value })} />
}
function StatesPreview() {
  return <main style={{ minHeight: '100vh', boxSizing: 'border-box', padding: '18px', background: '#edf3ff', fontFamily: 'Poppins,sans-serif' }}><div style={{ maxWidth: 378, margin: 'auto' }}>
    {[['1 · Pregunta', 'pending', false], ['2 · Sí', 'yes', false], ['3 · En proceso', 'not_yet', false], ['4 · No: motivo opcional', 'no', false], ['5 · No: cerrado', 'no', true]].map(([title, outcome, answered]) => <section key={title} style={{ marginBottom: 26 }}><h2 style={{ fontSize: 13, fontWeight: 600, color: '#475e7d', margin: 0 }}>{title}</h2><StateExample outcome={outcome} reasonAnswered={answered} /></section>)}
  </div></main>
}
function EmailResultPreview({ variant }) {
  const [previewApi] = useState(() => {
    const followup = { id: 'email-design-preview', conversation_id: '33333333-3333-4333-8333-333333333333', round: 2, contact_name: 'Sara Arranz', title: 'Curso de alemán', outcome: variant === 'closed' ? 'no' : variant, reason_answered: variant === 'closed', edit_token: 'b'.repeat(64), due_at: new Date(Date.now() + 7 * 86400000).toISOString() }
    return { email: async () => followup, emailChange: async (_token, _round, _action, value) => ({ ...followup, reason_answered: true, no_reason: value }) }
  })
  return <ConversationFollowUpAnswer api={previewApi} initialLink={{ token: 'a'.repeat(64), answer: variant === 'closed' ? 'no' : variant }} />
}
function Preview() {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { let active = true; request('state').then(data => { if (active) setState(data) }).catch(() => {}); return () => { active = false } }, [revision])
  async function run(action) {
    setError(''); setBusy(true)
    try { await request(action); setRevision(value => value + 1) } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <main style={{ fontFamily: 'Poppins,sans-serif', background: '#f1f5f9', minHeight: '100vh', padding: '24px 16px', boxSizing: 'border-box', color: '#0f172a' }}>
    <div style={{ maxWidth: 1040, margin: 'auto' }}><h1 style={{ fontSize: 23 }}>Prueba local del seguimiento</h1><p style={{ fontSize: 13 }}>Datos ficticios en una base de datos local. No se envían correos ni notificaciones reales.</p><p><a href="?estados=1">Ver los cinco estados del chat</a></p><p style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>{[['yes', 'Correo: Sí'], ['not_yet', 'Correo: En proceso'], ['no', 'Correo: No'], ['closed', 'Correo: cerrado']].map(([value, label]) => <a key={value} href={`?respuesta=${value}`} target="_blank" rel="noreferrer">{label}</a>)}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>{[['reset', 'Reiniciar caso'], ['day_one', 'Simular primer día'], ['advance', 'Avanzar 7 días'], ['notify', 'Generar aviso y correo de prueba']].map(([action, label]) => <button key={action} disabled={busy} onClick={() => run(action)} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: 9, padding: '11px', cursor: 'pointer', font: 'inherit', fontSize: 12 }}>{label}</button>)}</div>
      {error && <p role="alert">{error}</p>}
      <section style={{ maxWidth: 720, border: '1px solid #dbeafe', borderRadius: 18, overflow: 'hidden', background: '#eff6ff' }} aria-label="Conversación de prueba">
        <header style={{ padding: 18, background: 'white' }}><strong>Negocio de prueba</strong><p style={{ fontSize: 12, marginBottom: 0 }}>Curso de alemán · consulta de prueba</p></header>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}><p style={{ background: '#2563eb', color: 'white', borderRadius: 16, padding: 16, margin: 0, alignSelf: 'end', maxWidth: 380 }}>Hola, ¿sigue disponible el curso de los lunes?</p><p style={{ background: 'white', borderRadius: 16, padding: 16, margin: 0, maxWidth: 380 }}>¡Hola! Sí, puedes contactarnos para consultar las plazas.</p>
          <ConversationFollowUp key={revision} conversationId="33333333-3333-4333-8333-333333333333" userId="11111111-1111-4111-8111-111111111111" publicationTitle="Curso de alemán" api={api} />
        </div>
      </section>
      <h2 style={{ fontSize: 18, marginTop: 30 }}>Avisos de prueba</h2><p style={{ fontSize: 12 }}>Avisos generados: {state?.notifications ?? 0}. Usa «Generar aviso» para simular el trabajo programado.</p>
      {state?.email && <><p><a href="/__followup/email-preview" target="_blank" rel="noreferrer">Abrir correo de prueba</a></p><iframe key={revision} title="Correo de seguimiento" src="/__followup/email-preview" style={{ width: '100%', maxWidth: 720, height: 620, border: '1px solid #cbd5e1', borderRadius: 14 }} /></>}
      <div style={{ marginTop: 25 }}><ConversationFollowUpReport key={revision} /></div>
    </div>
  </main>
}
const resultVariant = new URLSearchParams(window.location.search).get('respuesta')
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter>{window.location.pathname === '/seguimiento' ? <ConversationFollowUpAnswer api={api} /> : window.location.pathname === '/perfil' ? <PreferencePreview /> : ['yes', 'not_yet', 'no', 'closed'].includes(resultVariant) ? <EmailResultPreview variant={resultVariant} /> : new URLSearchParams(window.location.search).has('estados') ? <StatesPreview /> : <Preview />}</BrowserRouter></React.StrictMode>)
