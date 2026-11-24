import { C } from '../lib/theme'
import { Tag, InfoBanner, BackButton } from './UI'
import GuideArticle from './GuideArticle'
import RelatedResources from './RelatedResources'
import { useAuth } from '../hooks/useAuth'
import { useSearchParams } from 'react-router-dom'
import GuidePackageJourney, { useGuideJourney } from './GuidePackageJourney'
import { getResourcePackagePath, normalizePackageCanton } from '../lib/resourcePackages'

export default function GuideDetailPage({ guide }) {
  const journey = useGuideJourney(guide)
  const { userCanton } = useAuth()
  const [searchParams] = useSearchParams()
  const canton = normalizePackageCanton(searchParams.has('canton') ? searchParams.get('canton') : userCanton)
  // Si se llega desde un paquete, "Atrás" vuelve a sus pasos.
  const backTo = journey.fromPackage ? `${getResourcePackagePath(journey.active.resourcePackage)}?canton=${canton || 'all'}` : '/guias'

  return (
    <div className="latido-page-container latido-page-container--content latido-guide-page">
      <BackButton to={backTo} style={{ marginBottom:18 }} />
      <div className="latido-guide-page-body">
        <header className="latido-guide-page-header">
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            <Tag bg={guide.level === 'Básico' ? '#D1FAE5' : '#FEF3C7'} color={guide.level === 'Básico' ? '#065F46' : '#92400E'}>{guide.level}</Tag>
            <Tag bg={C.primaryLight} color={C.primary}>⏱ {guide.time}</Tag>
          </div>
          <h1>{guide.title}</h1>
        </header>
        {guide.img && <img className="latido-guide-page-cover" src={guide.img} alt={guide.title} decoding="async" />}
        <GuideArticle guide={guide} />
        <InfoBanner emoji="⚠️" title="Aviso" text="Esta guía es orientativa. Para casos específicos consulta la administración cantonal o un asesor certificado." />
        <GuidePackageJourney key={`${guide.id}:${journey.active?.resourcePackage.slug || ''}`} journey={journey} />
        <RelatedResources key={guide.id} guide={guide} canton={canton} />
      </div>
    </div>
  )
}
