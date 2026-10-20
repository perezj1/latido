import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function LatidoCardOpenValidation({ offers, serverNow, receivedAt, providerId }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  const now = Date.parse(serverNow) + Math.max(0, performance.now() - receivedAt)
  const open = offers
    .filter(
      (o) =>
        (!providerId || o.provider_id === providerId) &&
        o.validation &&
        Date.parse(o.validation.expires_at) > now
    )
    .sort((a, b) => Date.parse(a.validation.expires_at) - Date.parse(b.validation.expires_at))
  if (!Number.isFinite(now) || !open.length) return null
  return (
    <aside className="lc-open-validation" aria-label="Descuentos abiertos" data-tick={tick}>
      {open.map((offer) => {
        const remaining = Math.max(
          0,
          Math.ceil((Date.parse(offer.validation.expires_at) - now) / 1000)
        )
        return (
          <Link key={offer.validation.id} to={`/card/validacion/${offer.validation.id}`}>
            <strong>Tienes un descuento abierto en {offer.business_name}</strong>
            <span>
              <span aria-hidden="true">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} ·{' '}
              </span>
              Volver a mostrar →
            </span>
          </Link>
        )
      })}
    </aside>
  )
}
