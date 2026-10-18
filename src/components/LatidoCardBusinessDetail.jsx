import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronLeft, MapPin, Share2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { getBusinessPath } from '../lib/seo'
import { shareCardBusiness } from '../lib/latidoCardShare'
import LatidoCardBusinessImage from './LatidoCardBusinessImage'
import './LatidoCardBusinessDetail.css'

export default function LatidoCardBusinessDetail({ business, offers = [], count, loading }) {
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
          <LatidoCardBusinessImage business={business} offers={offers} />
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
      {business && (
        <section className="lc-business-public-info" aria-label="Información del local">
          {business.address && (
            <p>
              📍 {business.address}
              {business.city ? ` · ${business.city}` : ''}
            </p>
          )}
          {business.phone && (
            <p>
              <a href={`tel:${business.phone.replace(/[^+0-9]/g, '')}`}>{business.phone}</a>
            </p>
          )}
          {typeof business.hours === 'string' && business.hours && <p>Horario: {business.hours}</p>}
          {business.hours && typeof business.hours === 'object' && (
            <dl>
              {Object.entries(business.hours).map(([day, hours]) => (
                <div key={day}>
                  <dt>{day}</dt>
                  <dd>
                    {typeof hours === 'string'
                      ? hours
                      : Array.isArray(hours)
                        ? hours.join(' · ')
                        : [hours?.open, hours?.close].filter(Boolean).join('–')}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <div className="lc-actions">
            {business.address && (
              <a
                className="lc-text-button"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([business.address, business.city, 'Suiza'].filter(Boolean).join(', '))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Cómo llegar
              </a>
            )}
            <Link className="lc-text-button" to={getBusinessPath(business)}>
              Ver ficha en Latido
            </Link>
          </div>
        </section>
      )}
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
