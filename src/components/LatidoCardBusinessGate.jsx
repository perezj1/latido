import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import useCardBusinessAccess from '../hooks/useCardBusinessAccess'
import { CARD_MEMBERS_ENABLED } from '../lib/latidoCardLaunch'

export default function LatidoCardBusinessGate({ children }) {
  const { loading: authLoading, isAdmin } = useAuth()
  const { hasBusiness, loading, error, retry } = useCardBusinessAccess()
  if (CARD_MEMBERS_ENABLED) return children
  if (authLoading || loading) return <p role="status">Cargando tu negocio…</p>
  if (error) return <section className="lc-panel" role="alert"><p>{error}</p><button type="button" onClick={retry}>Reintentar</button></section>
  return hasBusiness || isAdmin ? children : <Navigate to="/" replace />
}
