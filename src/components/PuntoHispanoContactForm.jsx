import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { trackPartnerInteraction } from '../lib/partnerAttribution'
import {
  PUNTO_HISPANO_SERVICES,
  buildPuntoHispanoWhatsappUrl,
  getPuntoHispanoService,
} from '../lib/puntoHispanoServices'
import './PuntoHispanoContactForm.css'

export default function PuntoHispanoContactForm({
  placement = 'direct',
  initialCategory = '',
  initialService = '',
  compact = false,
}) {
  const { user, loading, isAdmin } = useAuth()
  const fieldId = useId().replaceAll(':', '')
  const [categoryId, setCategoryId] = useState(initialCategory)
  const [serviceId, setServiceId] = useState(initialService)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(null)
  const submitting = useRef(false)
  const category = PUNTO_HISPANO_SERVICES.find(item => item.id === categoryId)
  const selected = getPuntoHispanoService(categoryId, serviceId)

  const chooseCategory = value => {
    setCategoryId(value)
    setServiceId('')
    request.current = null
    setError('')
  }

  const chooseService = value => {
    setServiceId(value)
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
      request.current ||= crypto.randomUUID()
      const { data, error:saveError } = await supabase.rpc('record_punto_hispano_contact', {
        p_request_id:request.current,
        p_category:categoryId,
        p_service:serviceId,
        p_placement:String(placement || 'direct').slice(0, 120),
      })
      if (saveError) throw saveError
      const url = buildPuntoHispanoWhatsappUrl(data.user_name, data.category_label, data.service_label)
      if (!isAdmin) {
        try {
          await Promise.race([
            trackPartnerInteraction('partner_outbound_click', {
              userId:user.id,
              placement,
              action:'whatsapp',
              service:categoryId,
              destination:'https://wa.me/41766232664',
            }),
            new Promise(resolve => setTimeout(resolve, 300)),
          ])
        } catch { /* El contacto no depende de la analítica opcional. */ }
      }
      window.location.assign(url)
      request.current = null
    } catch (failure) {
      if (failure?.message?.includes('Complete your Latido name and email')) {
        setError('Completa tu nombre y email en tu perfil de Latido antes de contactar.')
      } else {
        setError('No pudimos preparar el contacto. Comprueba tu conexión y vuelve a intentarlo.')
      }
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const nextParams = new URLSearchParams({ from:String(placement || 'direct'), action:'cta' })
  if (categoryId) nextParams.set('category', categoryId)
  if (serviceId) nextParams.set('subcategory', serviceId)
  const nextPath = `/servicios-suiza?${nextParams.toString()}`

  return (
    <div className={`ph-contact-form${compact ? ' ph-contact-form--compact' : ''}`}>
      {compact && (
        <div className="ph-contact-form-heading">
          <p className="ph-eyebrow">Punto Hispano · Atención en español</p>
          <h2>¿En qué podemos ayudarte?</h2>
          <p>Elige el servicio que necesitas y contacta por WhatsApp.</p>
        </div>
      )}
      <form onSubmit={contact}>
        <label htmlFor={`ph-category-${fieldId}`}>Categoría</label>
        <select
          id={`ph-category-${fieldId}`}
          required
          value={category?.id || ''}
          disabled={busy}
          onChange={event => chooseCategory(event.target.value)}
        >
          <option value="">Elige una categoría</option>
          {PUNTO_HISPANO_SERVICES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>

        <label htmlFor={`ph-service-${fieldId}`}>Servicios</label>
        <select
          id={`ph-service-${fieldId}`}
          required
          value={selected ? serviceId : ''}
          disabled={!category || busy}
          onChange={event => chooseService(event.target.value)}
        >
          <option value="">{category ? 'Elige un servicio' : 'Elige primero una categoría'}</option>
          {category?.services.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>

        <p className="ph-contact-note">WhatsApp se abrirá con un mensaje que podrás revisar antes de enviarlo.</p>
        {error && <p className="ph-error" role="alert">{error}</p>}
        {loading ? <p role="status">Cargando tu sesión…</p> : user ? (
          <button className="ph-whatsapp" type="submit" disabled={!selected || busy}>
            {busy ? 'Preparando contacto…' : 'Contactar por WhatsApp'}
          </button>
        ) : (
          <Link className="ph-whatsapp" to={`/auth?next=${encodeURIComponent(nextPath)}`}>Inicia sesión para contactar</Link>
        )}
      </form>
    </div>
  )
}
