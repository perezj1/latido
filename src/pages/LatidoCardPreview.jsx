import { useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import useCardCatalog from '../hooks/useCardCatalog'
import { CardHeader } from './LatidoCard'
import LatidoDiscountCard from '../components/LatidoDiscountCard'
import { CardSearch, matchesCardSearch } from '../components/LatidoCardDiscovery'
import { shareCardOffer } from '../lib/latidoCardShare'

export default function LatidoCardPreview() {
  const catalog = useCardCatalog()
  const { providerId } = useParams()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [manualShare, setManualShare] = useState(null)
  const offers = catalog.filter((offer) => (!providerId || offer.provider_id === providerId) && matchesCardSearch([offer.title, offer.business_name, offer.city], query))
  const share = async (offer) => {
    try {
      const result = await shareCardOffer(offer)
      if (result.status === 'manual') setManualShare({ id: offer.id, url: result.url })
      if (result.status === 'copied') toast.success('Enlace de la oferta copiado.')
    } catch { toast.error('No se pudo compartir la oferta.') }
  }
  return (
    <div className="lc-page lc-member-page lc-discounts-page lc-app-page">
      <CardHeader />
      <section className="lc-benefits" aria-labelledby="lc-preview-title">
        <h1 id="lc-preview-title">Ofertas publicadas</h1>
        <p className="lc-muted">Descubre las ofertas de los negocios de la comunidad.</p>
        <CardSearch value={query} onChange={setQuery} label="Buscar ofertas publicadas" placeholder="Busca una oferta o un negocio" />
        <div className="lc-offer-list">
          {offers.map((offer) => <LatidoDiscountCard key={offer.id} offer={offer}
            memberActive={false} hideJoinAction previewOnly
            expanded={expanded === offer.id} onToggleDetails={() => setExpanded(expanded === offer.id ? null : offer.id)}
            onShare={share} manualShareUrl={manualShare?.id === offer.id ? manualShare.url : ''} />)}
          {!offers.length && <p className="lc-empty-state">{query ? 'No encontramos ofertas con esta búsqueda.' : 'Los negocios están preparando sus primeras ofertas.'}</p>}
        </div>
      </section>
    </div>
  )
}
