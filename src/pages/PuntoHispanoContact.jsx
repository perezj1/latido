import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import { PUNTO_HISPANO_LOGO } from '../lib/puntoHispano'
import { PUNTO_HISPANO_SERVICES, buildPuntoHispanoWhatsappUrl, getPuntoHispanoService } from '../lib/puntoHispanoServices'
import './PuntoHispanoContact.css'

export default function PuntoHispanoContact() {
  const { user, loading, isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(null)
  const submitting = useRef(false)
  const categoryId = params.get('category') || params.get('service') || ''
  const serviceId = params.get('subcategory') || ''
  const category = PUNTO_HISPANO_SERVICES.find(item => item.id === categoryId)
  const selected = getPuntoHispanoService(categoryId, serviceId)

  const choose = (key, value) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    if (key === 'category') next.delete('subcategory')
    setParams(next, { replace:true })
    request.current = null
    setError('')
  }

  const contact = async event => {
    event.preventDefault()
    if (!user || !selected || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      // Retries after a network timeout reuse the ID: one record per click.
      request.current ||= crypto.randomUUID()
      const { data, error:saveError } = await supabase.rpc('record_punto_hispano_contact', {
        p_request_id:request.current,
        p_category:categoryId,
        p_service:serviceId,
        p_placement:(params.get('from') || 'direct').slice(0, 120),
      })
      if (saveError) throw saveError
      const url = buildPuntoHispanoWhatsappUrl(data.user_name, data.category_label, data.service_label)
      // Keep optional aggregate metrics; never put the personalized message in analytics.
      if (!isAdmin) {
        try {
          await Promise.race([
            trackPartnerInteraction('partner_outbound_click', {
              userId:user.id, placement:params.get('from') || 'direct',
              action:'whatsapp', service:categoryId, destination:'https://wa.me/41766232664',
            }),
            new Promise(resolve => setTimeout(resolve, 300)),
          ])
        } catch { /* Contact recording does not depend on optional analytics. */ }
      }
      // Same-tab navigation works on mobile without async popup blocking.
      window.location.assign(url)
      request.current = null
    } catch (failure) {
      if (failure?.message?.includes("Complete your Latido name and email")) {
        setError("Completa tu nombre y email en tu perfil de Latido antes de contactar.")
        return
      }
      setError('No pudimos preparar el contacto. Comprueba tu conexión y vuelve a intentarlo.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <main className="ph-contact-page">
      <Link className="ph-back" to="/">← Volver a Latido</Link>
      <section className="ph-contact-card" aria-labelledby="ph-contact-title">
        <div className="ph-brand"><img src="/favicon.svg" alt="Latido" /><span>×</span><img src={PUNTO_HISPANO_LOGO} alt="Punto Hispano" /></div>
        <p className="ph-eyebrow">Punto Hispano · Atención en español</p>
        <h1 id="ph-contact-title">¿En qué podemos ayudarte?</h1>
        <p>Elige el servicio que necesitas y contacta con Punto Hispano por WhatsApp.</p>
        <form onSubmit={contact}>
          <label htmlFor="ph-category">Categoría</label>
          <select id="ph-category" required value={category?.id || ''} disabled={busy} onChange={event => choose('category', event.target.value)}>
            <option value="">Elige una categoría</option>
            {PUNTO_HISPANO_SERVICES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <label htmlFor="ph-service">Servicio</label>
          <select id="ph-service" required value={selected ? serviceId : ''} disabled={!category || busy} onChange={event => choose('subcategory', event.target.value)}>
            <option value="">{category ? 'Elige un servicio' : 'Elige primero una categoría'}</option>
            {category?.services.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <p className="ph-contact-note">Al contactar, Latido guardará tu nombre, email, servicio elegido y fecha para el seguimiento de esta colaboración. WhatsApp se abrirá con un mensaje que podrás revisar antes de enviarlo.</p>
          {error && <p className="ph-error" role="alert">{error}</p>}
          {loading ? <p role="status">Cargando tu sesión…</p> : user ? (
            <button className="ph-whatsapp" type="submit" disabled={!selected || busy}>{busy ? 'Preparando contacto…' : 'Contactar por WhatsApp'}</button>
          ) : (
            <Link className="ph-whatsapp" to={`/auth?next=${encodeURIComponent(`/servicios-suiza?${params.toString()}`)}`}>Inicia sesión para contactar</Link>
          )}
          <p className="ph-phone">Punto Hispano · +41 76 623 26 64</p>
        </form>
      </section>
    </main>
  )
}
