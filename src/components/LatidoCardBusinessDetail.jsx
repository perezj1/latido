import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronLeft, MapPin, Share2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { shareCardBusiness } from '../lib/latidoCardShare'
import { DiscountBusinessPhoto } from './LatidoDiscountCard'
import { CardSearch } from './LatidoCardDiscovery'
import './LatidoCardBusinessDetail.css'

export default function LatidoCardBusinessDetail({ business, count, query, onQuery, loading }) {
  const [sharing, setSharing] = useState(false)
  const [manualLink, setManualLink] = useState('')
  useEffect(() => setManualLink(''), [business?.id])
  return (
    <>
      <header className="lc-business-detail-header">
        <div className="lc-business-detail-bar">
          <Link to="/card" className="lc-business-detail-round" aria-label="Volver a los negocios">
            <ChevronLeft size={21} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="lc-business-detail-round"
            aria-label="Compartir negocio"
            disabled={sharing || !business}
            onClick={async () => {
              setSharing(true)
              try {
                const result = await shareCardBusiness(business.id, business.name)
                setManualLink(result.status === 'manual' ? result.url : '')
                if (result.status === 'copied') toast.success('Enlace del negocio copiado.')
              } catch {
                toast.error('No se pudo compartir el negocio. Vuelve a intentarlo.')
              } finally {
                setSharing(false)
              }
            }}
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
        </div>
        <section className="lc-business-detail-identity" aria-label="Negocio" aria-busy={loading}>
          <DiscountBusinessPhoto
            offer={{
              business_name: business?.name || 'Negocio',
              business_photo_url: business?.photo_url
            }}
          />
          <div>
            <h1>{business?.name || 'Ofertas del negocio'}</h1>
            {!loading && (
              <p className="lc-business-detail-meta">
                {business?.city && (
                  <span>
                    <MapPin size={13} aria-hidden="true" />
                    {business.city}
                  </span>
                )}
                <span>
                  <Tag size={13} aria-hidden="true" />
                  {count} {count === 1 ? 'oferta' : 'ofertas'} para socios
                </span>
              </p>
            )}
          </div>
        </section>
      </header>
      <div className="lc-business-detail-search">
        <CardSearch
          label="Buscar en las ofertas de este negocio"
          placeholder="Buscar en sus ofertas"
          value={query}
          onChange={onQuery}
        />
      </div>
      {manualLink && (
        <label className="lc-business-detail-share-link">
          Enlace del negocio
          <input readOnly value={manualLink} onFocus={(event) => event.target.select()} />
        </label>
      )}
    </>
  )
}

export function BusinessOfferGuide() {
  return (
    <details className="lc-business-offer-guide">
      <summary>
        <span>
          <strong>¿Cómo se usa una oferta?</strong>
          <small>En 3 pasos, al pagar en el negocio</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <ol>
        <li>Pulsa «Usar ahora» cuando vayas a pagar.</li>
        <li>Confirma el uso para activar tu oferta.</li>
        <li>Enseña la pantalla al personal en los siguientes 5 minutos.</li>
      </ol>
    </details>
  )
}
