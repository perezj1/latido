import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getBusinessPath } from '../lib/seo'
import { resolveImageUrl } from '../lib/imageVariants'
import { getBusinessGuideMatches, getGuideBusinesses } from '../lib/guideBusinesses'
import { BUSINESS_ROTATION_INTERVAL_MS } from '../lib/businessPromotion'
import { useTimedRotationBucket } from '../hooks/useTimedRotationBucket'
import HorizontalDragScroller from './HorizontalDragScroller'
import RelatedBusinessCard from './RelatedBusinessCard'
import useGuideBusinessDirectory from '../hooks/useGuideBusinessDirectory'
import './GuideRelatedBusinesses.css'

export default function GuideRelatedBusinesses({ guide, heading='Negocios relacionados', headingAs:Heading='h2', className='', hideWhenEmpty=false }) {
  const navigate = useNavigate()
  const { directory, recommendations, status, retry } = useGuideBusinessDirectory()
  const [photosMap, setPhotosMap] = useState({})
  const rotationBucket = useTimedRotationBucket(BUSINESS_ROTATION_INTERVAL_MS)

  const related = useMemo(() => getGuideBusinesses(guide, directory, recommendations, Date.now()),
    [guide, directory, recommendations, rotationBucket])
  const relatedIds = related.map(business => business.id).join(',')

  useEffect(() => {
    let cancelled = false
    setPhotosMap({})
    if (!relatedIds) return
    const load = async () => {
      try {
        const { data, error } = await supabase.from('provider_photos')
          .select('provider_id,url,is_main,sort_order').in('provider_id', relatedIds.split(','))
          .order('is_main', { ascending:false }).order('sort_order', { ascending:true })
        if (cancelled || error) return
        const photos = {}
        for (const row of data || []) {
          const url = resolveImageUrl(row.url)
          if (url) (photos[row.provider_id] ||= []).push(url)
        }
        setPhotosMap(photos)
      } catch {
        // The directory image remains available if gallery photos fail to load.
      }
    }
    load()
    return () => { cancelled = true }
  }, [relatedIds])

  if (hideWhenEmpty && status === 'ready' && related.length === 0) return null

  return (
    <section className={`latido-guide-businesses ${className}`} aria-label={heading} aria-busy={status === 'loading'}>
      <Heading>{heading}</Heading>
      {status === 'loading' && <p className="latido-guide-businesses-status" role="status">Buscando negocios relacionados…</p>}
      {status === 'error' && <p className="latido-guide-businesses-status" role="status">
        No hemos podido cargar los negocios. <button type="button" onClick={retry}>Reintentar</button>
      </p>}
      {status === 'ready' && related.length === 0 && <p className="latido-guide-businesses-status">Todavía no hay negocios relacionados con esta guía en Latido.</p>}
      {status === 'ready' && related.length > 0 && <HorizontalDragScroller className="latido-guide-businesses-rail" label="Negocios relacionados; desliza para ver más">
        {related.map(business => <RelatedBusinessCard
          key={business.id}
          business={business}
          photosMap={photosMap}
          supportingText={getBusinessGuideMatches(business, guide).slice(0, 2).map(term => ['rav', 'orp', 'cv', 'ahv', 'avs', 'syna', 'unia'].includes(term) ? term.toUpperCase() : term).join(' · ')}
          onClick={() => navigate(getBusinessPath(business))}
        />)}
      </HorizontalDragScroller>}
    </section>
  )
}
