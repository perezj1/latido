import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cardInvitationPath } from '../lib/latidoCardInvitation'

const OfferModal = lazy(() => import('./LatidoCardOfferModal'))
const OfferContext = createContext(null)
export const useLatidoCardOffer = () => useContext(OfferContext)

export default function LatidoCardOfferProvider({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [business, setBusiness] = useState(null)
  const [open, setOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [publishedProvider, setPublishedProvider] = useState('')
  useEffect(() => {
    setOpen(false)
    setBusiness(null)
    setPublishedProvider('')
  }, [user?.id])
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])
  const queryProvider =
    params.get('crear-oferta') ||
    (location.pathname === '/card/negocios' && params.get('crear') === '1'
      ? params.get('negocio')
      : '')
  useEffect(() => {
    if (loading || !queryProvider) return
    if (!user?.id) {
      navigate(`/auth?next=${encodeURIComponent(cardInvitationPath(queryProvider))}`, {
        replace: true
      })
      return
    }
    setBusiness({ id: queryProvider })
    setOpen(true)
  }, [loading, user?.id, queryProvider, navigate])
  const openOffer = useCallback(
    (target) => {
      if (!target?.id) return
      if (!user?.id) {
        navigate(`/auth?next=${encodeURIComponent(cardInvitationPath(target.id))}`)
        return
      }
      setBusiness(target)
      setOpen(true)
    },
    [user?.id, navigate]
  )
  const closeOffer = () => {
    setOpen(false)
    if (queryProvider) {
      const next = new URLSearchParams(params)
      next.delete('crear-oferta')
      next.delete('crear')
      setParams(next, { replace: true })
    }
  }
  const value = useMemo(
    () => ({ openOffer, revision, publishedProvider }),
    [openOffer, revision, publishedProvider]
  )
  return (
    <OfferContext.Provider value={value}>
      {children}
      {business && user?.id && (
        <Suspense fallback={null}>
          <OfferModal
            key={`${user.id}:${business.id}`}
            providerId={business.id}
            open={open}
            onClose={closeOffer}
            onPublished={() => {
              setPublishedProvider(business.id)
              setRevision((current) => current + 1)
              closeOffer()
            }}
          />
        </Suspense>
      )}
    </OfferContext.Provider>
  )
}
