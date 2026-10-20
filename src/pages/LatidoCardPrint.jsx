import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { cardRpc } from '../lib/latidoCard'
import {
  LatidoCardBusinessSticker,
  LatidoCardStaffGuide
} from '../components/LatidoCardBusinessMaterial'
import './LatidoCard.css'

export default function LatidoCardPrint() {
  const { providerId } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState(null),
    [error, setError] = useState('')
  const guide = params.get('tipo') === 'guia'
  useEffect(() => {
    let active = true
    cardRpc('lc_business_benefits', { p_provider: providerId })
      .then((result) => {
        if (active) setData(result)
      })
      .catch(() => {
        if (active) setError('No se pudo cargar el material. Vuelve a intentarlo.')
      })
    return () => {
      active = false
    }
  }, [providerId])
  return (
    <div className={`lc-page lc-print-page${guide ? ' lc-print-guide' : ''}`}>
      <style>{`@media print { @page { size: A6; margin: 8mm; } body { background: white !important; } }`}</style>
      <div className="lc-print-controls">
        <Link to={`/card/negocios?negocio=${providerId}`}>← Mi negocio</Link>
        <button
          className="lc-button"
          disabled={!data?.business || !data?.offers?.length}
          onClick={() => window.print()}
        >
          Imprimir
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Preparando material…</p>
      ) : !data.business || !data.offers.length ? (
        <p>Publica tu primera oferta para obtener tu QR.</p>
      ) : guide ? (
        <LatidoCardStaffGuide />
      ) : (
        <LatidoCardBusinessSticker business={data.business} />
      )}
    </div>
  )
}
