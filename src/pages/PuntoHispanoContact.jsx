import { Link, useSearchParams } from 'react-router-dom'
import PuntoHispanoContactForm from '../components/PuntoHispanoContactForm'
import './PuntoHispanoContact.css'

export default function PuntoHispanoContact() {
  const [params] = useSearchParams()
  const categoryId = params.get('category') || params.get('service') || ''
  const serviceId = params.get('subcategory') || ''

  return (
    <main className="ph-contact-page">
      <Link className="ph-back" to="/">← Volver a Latido</Link>
      <section className="ph-contact-card" aria-labelledby="ph-contact-title">
        <p className="ph-eyebrow">Punto Hispano · Atención en español</p>
        <h1 id="ph-contact-title">¿En qué podemos ayudarte?</h1>
        <p>Elige el servicio que necesitas y contacta con Punto Hispano por WhatsApp.</p>
        <PuntoHispanoContactForm
          placement={params.get('from') || 'direct'}
          initialCategory={categoryId}
          initialService={serviceId}
        />
      </section>
    </main>
  )
}
