import { useState } from 'react'
import './LatidoCardBusinessImage.css'

export default function LatidoCardBusinessImage({
  business,
  offers = [],
  small = false,
  className = ''
}) {
  const [failed, setFailed] = useState([])
  const identity = business || {}
  const candidates = [
    ...new Set(
      [
        identity.photo_url,
        identity.business_photo_url,
        ...offers
          .filter((offer) => offer.provider_id === identity.id)
          .map((offer) => offer.business_photo_url)
      ]
        .filter((url) => typeof url === 'string' && url.trim())
        .map((url) => url.trim())
    )
  ]
  const src = candidates.find((url) => !failed.includes(url))
  const label = `Imagen de ${identity.name || 'Negocio'}`
  return (
    <div
      className={`lc-discount-photo lc-business-image ${small ? 'lc-discount-photo--small' : ''} ${className}`}
    >
      {src ? (
        <img src={src} alt={label} onError={() => setFailed((values) => [...values, src])} />
      ) : (
        <span className="lc-discount-photo-emoji" role="img" aria-label={label}>
          🏪
        </span>
      )}
    </div>
  )
}
