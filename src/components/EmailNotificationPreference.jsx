import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
const preferenceApi = {
  async read(userId) {
    const { data, error } = await supabase.from('email_notification_preferences').select('message_emails_enabled').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data?.message_emails_enabled !== false
  },
  async save(userId, enabled) {
    const { error } = await supabase.from('email_notification_preferences').upsert({ user_id: userId, message_emails_enabled: enabled }, { onConflict: 'user_id' })
    if (error) throw error
  },
}
export default function EmailNotificationPreference({ userId, active = true, api = preferenceApi }) {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!active || !userId) return undefined
    let current = true
    setLoading(true); setError('')
    api.read(userId).then(value => { if (current) setEnabled(value) }).catch(() => { if (current) setError('No se pudieron cargar los avisos de correo.') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [userId, active, api])
  async function change(value) {
    const previous = enabled
    setEnabled(value)
    setSaving(true); setError(''); setSaved(false)
    try { await api.save(userId, value); setSaved(true) }
    catch { setEnabled(previous); setError('No se ha guardado el cambio. Vuelve a intentarlo.') }
    finally { setSaving(false) }
  }
  return <section aria-label="Avisos por correo" style={{ padding: 16, marginBottom: 18, border: '1px solid #dbe5f5', borderRadius: 14, background: '#f7f9fd' }}>
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13, color: '#10204a', cursor: 'pointer' }}><input type="checkbox" checked={enabled} disabled={loading || saving || !userId} onChange={event => change(event.target.checked)} style={{ width: 18, height: 18, accentColor: '#2563eb', marginTop: 2, flexShrink: 0 }} /><span><strong>Avisos por correo</strong><span style={{ display: 'block', color: '#52627a', marginTop: 5, lineHeight: 1.6 }}>Recibir emails de mensajes sin leer y del seguimiento de mis consultas.</span></span></label>
    {saved && <p role="status" style={{ fontSize: 12, color: '#047857', marginBottom: 0 }}>Preferencia guardada.</p>}
    {error && <p role="alert" style={{ fontSize: 12, color: '#b91c1c' }}>{error}</p>}
  </section>
}
