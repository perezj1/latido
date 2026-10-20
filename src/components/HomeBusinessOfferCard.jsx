import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Store } from 'lucide-react'
import useCardBusinessAccess from '../hooks/useCardBusinessAccess'
import { useLatidoBusinessDisplay } from '../hooks/useLatidoBusinessDisplay'
import { resolveImageUrl } from '../lib/imageVariants'
import './HomeLatidoCard.css'

export default function HomeBusinessOfferCard() {
  const { hasBusiness, loading, error, businesses = [] } = useCardBusinessAccess()
  const [failedLogo, setFailedLogo] = useState(null)
  const business = useLatidoBusinessDisplay(businesses[0], { includePhoto: true })
  const logo = resolveImageUrl(business?.photo_url)
  if (loading || error || !hasBusiness) return null
  return (
    <Link className="home-latido-card home-business-offer" to="/tarjeta-latido#negocios"
      aria-label="Promocionar mi negocio gratis">
      <span className="home-latido-card-logo home-business-offer-logo" aria-hidden="true">
        {logo && failedLogo !== logo
          ? <img src={logo} alt="" onError={() => setFailedLogo(logo)} />
          : <Store size={24} />}
      </span>
      <span className="home-latido-card-info">
        <strong className="home-latido-card-name">Atrae más clientes</strong>
        <span>Promociona tu negocio <b>gratis</b> con latido</span>
      </span>
      <span className="home-latido-card-action">Empezar</span>
      <img className="home-latido-card-watermark" src="/favicon.svg" alt="" aria-hidden="true" />
      <span className="home-latido-card-stripe" aria-hidden="true"><span /><span /><span /><span /><span /><span /></span>
    </Link>
  )
}
