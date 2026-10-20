import { Link, useSearchParams } from 'react-router-dom'
import { Gift, SlidersHorizontal } from 'lucide-react'
import useCardBusinessAccess from '../hooks/useCardBusinessAccess'
import { useLatidoCardOffer } from '../components/LatidoCardOfferProvider'
import LatidoCardIllustration from '../components/LatidoCardIllustration'
import '../components/LatidoOfferCoupon.css'
import './LatidoCardBusinessWelcome.css'

export default function LatidoCardBusinessWelcome() {
  const { businesses = [], loading, error, retry } = useCardBusinessAccess()
  const { openOffer, publishedProvider } = useLatidoCardOffer()
  const [params, setParams] = useSearchParams()
  const business = businesses.find((item) => item.id === params.get('negocio')) || businesses[0]
  return (
    <div className="lc-business-welcome">
      <Link className="lc-business-welcome-back" to="/">← Volver a Latido</Link>
      <section className="lc-business-welcome-card" aria-labelledby="lc-business-welcome-title">
        <LatidoCardIllustration business />
        <div className="lc-business-welcome-content">
          <p className="lc-business-welcome-brand">Tarjeta Latido · {business?.name || 'Para negocios'}</p>
          <h1 id="lc-business-welcome-title">Promocionar los negocios hispanohablantes</h1>
          <p>Ofrece beneficios a la comunidad hispanohablante y consigue que más personas descubran tu negocio gracias a Latido.</p>
          <div className="lc-business-welcome-benefits">
            <span><Gift size={14} aria-hidden="true" /> Gratis</span>
            <span><SlidersHorizontal size={14} aria-hidden="true" /> Tú pones las reglas</span>
          </div>
          {loading ? <p role="status">Cargando tu negocio…</p> : error ? <div role="alert"><p>{error}</p><button className="lc-business-welcome-cta" type="button" onClick={retry}>Reintentar</button></div> : business ? (
            <>
              {businesses.length > 1 && <label className="lc-business-welcome-select">Tu negocio
                <select value={business.id} onChange={(event) => setParams({ negocio: event.target.value })}>
                  {businesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>}
              <button className="lc-business-welcome-cta" type="button" aria-haspopup="dialog"
                disabled={business.suspended || business.published === false}
                onClick={() => openOffer(business)}>Ofrecer mi primer descuento</button>
              {(business.participating || publishedProvider === business.id) && <Link className="lc-business-welcome-manage" to={`/card/negocios?negocio=${business.id}`}>Ir a Mi negocio →</Link>}
              {business.published === false && <p>Cuando tu negocio esté aprobado, podrás publicar tu primera oferta.</p>}
              {business.suspended && <p>Contacta con Latido para revisar la participación de tu negocio.</p>}
            </>
          ) : <Link className="lc-business-welcome-cta" to="/registrar-negocio?origen=tarjeta">Registrar mi negocio gratis</Link>}
        </div>
      </section>
    </div>
  )
}
