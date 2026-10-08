import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getNegocioTypeMeta } from '../lib/constants'
import { getBusinessPath } from '../lib/seo'
import { resolveImageUrl } from '../lib/imageVariants'
import { getGuideBusinesses } from '../lib/guideBusinesses'
import { BUSINESS_ROTATION_INTERVAL_MS } from '../lib/businessPromotion'
import { useTimedRotationBucket } from '../hooks/useTimedRotationBucket'
import HorizontalDragScroller from './HorizontalDragScroller'
import RelatedBusinessCard from './RelatedBusinessCard'

const PAGE_SIZE = 500
const COLUMNS = 'id,name,category,city,canton,description,services,photo_url,featured,active,created_at,promotion_plan,promotion_starts_at,promotion_ends_at'

async function fetchGuideDirectory() {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from('providers').select(COLUMNS)
      .eq('active', true).order('id').range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < PAGE_SIZE) return rows.map(row => ({
      ...row,
      type:row.category,
      emoji:getNegocioTypeMeta(row.category)?.label?.split(' ')[0] || '🏪',
      photo_url:resolveImageUrl(row.photo_url),
    }))
  }
}

export default function GuideRelatedBusinesses({ guide }) {
  const navigate = useNavigate()
  const [directory, setDirectory] = useState([])
  const [recommendations, setRecommendations] = useState({})
  const [status, setStatus] = useState('loading')
  const [photosMap, setPhotosMap] = useState({})
  const [attempt, setAttempt] = useState(0)
  const rotationBucket = useTimedRotationBucket(BUSINESS_ROTATION_INTERVAL_MS)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const load = async () => {
      const [providers, recommendationCounts] = await Promise.allSettled([
        fetchGuideDirectory(),
        supabase.rpc('get_business_recommendation_counts'),
      ])
      if (cancelled) return
      if (providers.status === 'rejected') {
        setStatus('error')
        return
      }
      setDirectory(providers.value)
      const counts = {}
      if (recommendationCounts.status === 'fulfilled' && !recommendationCounts.value.error) {
        for (const row of recommendationCounts.value.data || []) {
          if (row?.business_id) counts[row.business_id] = Number(row.recommendation_count || 0)
        }
      }
      setRecommendations(counts)
      setStatus('ready')
    }
    load()
    return () => { cancelled = true }
  }, [attempt])

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

  return (
    <section className="latido-guide-businesses" aria-label="Negocios relacionados con esta guía" aria-busy={status === 'loading'}>
      <h2>Negocios relacionados</h2>
      {status === 'loading' && <p className="latido-guide-businesses-status" role="status">Buscando negocios para esta guía…</p>}
      {status === 'error' && <p className="latido-guide-businesses-status" role="status">
        No hemos podido cargar los negocios. <button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
      </p>}
      {status === 'ready' && related.length === 0 && <p className="latido-guide-businesses-status">Todavía no hay negocios relacionados con esta guía en Latido.</p>}
      {status === 'ready' && related.length > 0 && <HorizontalDragScroller className="latido-guide-businesses-rail" label="Negocios relacionados; desliza para ver más">
        {related.map(business => <RelatedBusinessCard key={business.id} business={business} photosMap={photosMap} onClick={() => navigate(getBusinessPath(business))} />)}
      </HorizontalDragScroller>}
    </section>
  )
}
