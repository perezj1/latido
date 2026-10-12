import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { resolveImageUrl } from '../lib/imageVariants'
import { getGuideBusinesses } from '../lib/guideBusinesses'
import { getRelatedAdContext, getRelatedAdsExplorePath, mergeRelatedResources, selectRelatedAds } from '../lib/relatedResources'
import { useTimedRotationBucket } from '../hooks/useTimedRotationBucket'
import useGuideBusinessDirectory from '../hooks/useGuideBusinessDirectory'
import useRelatedAds from '../hooks/useRelatedAds'
import HorizontalDragScroller from './HorizontalDragScroller'
import RelatedResourceCard from './RelatedResourceCard'
import './RelatedResources.css'

const FILTERS = [{id:'all',label:'Todo',emoji:'✨'},{id:'ad',label:'Anuncios',emoji:'📋'},{id:'business',label:'Negocios',emoji:'🏪'}]

export default function RelatedResources({guide,resource,canton='',heading='Recursos recomendados',headingAs:Heading='h2',className='',hideWhenEmpty=false}) {
  const [filter,setFilter] = useState('all')
  const id = useId()
  const {directory,recommendations,status:businessStatus,retry:retryBusinesses} = useGuideBusinessDirectory()
  const context = useMemo(() => getRelatedAdContext(guide,resource),[guide,resource])
  const {listings,jobs,loading:adsLoading,failed:adsFailed,retry:retryAds} = useRelatedAds({enabled:Boolean(context),includeJobs:Boolean(context?.jobs)})
  // Refresh expiry filters while the page stays open; the directory still uses
  // its established six-hour rotation and paid business priority.
  const refreshBucket = useTimedRotationBucket(60*1000)
  const businesses = useMemo(() => getGuideBusinesses(guide,directory,recommendations,Date.now()),[guide,directory,recommendations,refreshBucket])
  const ads = useMemo(() => selectRelatedAds(context,listings,jobs,canton),[context,listings,jobs,canton,refreshBucket])
  const combined = useMemo(() => mergeRelatedResources(ads,businesses,context?.adsFirst),[ads,businesses,context])
  const visible = filter === 'all' ? combined : combined.filter(item => item.kind === filter)
  const [photosMap,setPhotosMap] = useState({})
  const relatedIds = businesses.map(business => business.id).join(',')

  useEffect(() => {
    let cancelled = false
    if (!relatedIds) return
    supabase.from('provider_photos').select('provider_id,url,is_main,sort_order').in('provider_id',relatedIds.split(','))
      .order('is_main',{ascending:false}).order('sort_order',{ascending:true}).then(({data,error}) => {
        if (cancelled || error) return
        const photos = {}
        for (const row of data || []) {
          const url = resolveImageUrl(row.url)
          if (url) (photos[row.provider_id] ||= []).push(url)
        }
        setPhotosMap(photos)
      }).catch(() => {})
    return () => {cancelled=true}
  },[relatedIds])

  const businessLoading = businessStatus === 'loading'
  const businessFailed = businessStatus === 'error'
  const loading = (filter !== 'ad' && businessLoading) || (filter !== 'business' && adsLoading)
  const failed = (filter !== 'ad' && businessFailed) || (filter !== 'business' && adsFailed)
  if (hideWhenEmpty && !businessLoading && !adsLoading && !businessFailed && !adsFailed && !combined.length) return null
  const emptyText = filter === 'ad' ? 'Todavía no hay anuncios disponibles para este paso en la zona seleccionada.' : filter === 'business' ? 'Todavía no hay negocios relacionados con este paso.' : 'Todavía no hay recursos disponibles para este paso.'
  const retry = () => {
    if (filter !== 'ad' && businessFailed) retryBusinesses()
    if (filter !== 'business' && adsFailed) retryAds()
  }
  const businessHref = '/comunidades?view=negocios'
  const adsHref = getRelatedAdsExplorePath(context,canton)

  return <section className={`related-resources ${className}`} aria-labelledby={`${id}-heading`}>
    <Heading id={`${id}-heading`}>{heading}</Heading>
    <div className="related-resources__filters" role="group" aria-label="Filtrar recursos recomendados">
      {FILTERS.map(({id:kind,label,emoji}) => {
        const countLoading = kind === 'all' ? businessLoading || adsLoading : kind === 'ad' ? adsLoading : businessLoading
        const count = kind === 'all' ? combined.length : kind === 'ad' ? ads.length : businesses.length
        return <button key={kind} type="button" aria-pressed={filter === kind} aria-controls={`${id}-results`} onClick={() => setFilter(kind)}>
          <span aria-hidden="true">{emoji}</span>{label}<span className="related-resources__count">{countLoading ? '…' : count}</span>
        </button>
      })}
    </div>
    <div className="related-resources__summary">
      <span aria-live="polite">{filter === 'all' ? 'Anuncios y negocios para ayudarte' : filter === 'ad' ? 'Anuncios relacionados con este paso' : 'Profesionales y entidades relacionados'}</span>
      {filter !== 'all' && <Link to={filter === 'ad' ? adsHref : businessHref}>Explorar más<ArrowRight size={12} aria-hidden="true" /></Link>}
    </div>
    <div id={`${id}-results`} aria-busy={loading}>
      {visible.length > 0 && <HorizontalDragScroller className="related-resources__rail" label="Recursos recomendados; desliza para ver más" key={filter}>
        {visible.map(item => <RelatedResourceCard key={`${item.kind}:${item.row.resourceKind || ''}:${item.row.id}`} item={item} guide={guide} photosMap={photosMap} />)}
      </HorizontalDragScroller>}
      {!visible.length && loading && <div className="related-resources__loading" role="status"><span className="related-resources__sr">Buscando recursos relacionados…</span>{[0,1].map(n => <div className="related-resources__skeleton" key={n} aria-hidden="true"><div /><span /><span /></div>)}</div>}
      {!visible.length && !loading && !failed && <div className="related-resources__empty"><span className="related-resources__empty-emoji" aria-hidden="true">🔎</span><strong>Aún no hay recursos para mostrar</strong><span>{emptyText}</span>
        <div>{filter !== 'business' && <Link to={adsHref}>Explorar anuncios<ArrowRight size={12} aria-hidden="true" /></Link>}{filter !== 'ad' && <Link to={businessHref}>Explorar negocios<ArrowRight size={12} aria-hidden="true" /></Link>}</div>
      </div>}
      {failed && <div className="related-resources__status" role="status">{filter === 'all' ? 'Algunos recursos no se han podido cargar.' : filter === 'ad' ? 'No hemos podido cargar todos los anuncios.' : 'No hemos podido cargar los negocios.'} <button type="button" onClick={retry}>Reintentar</button></div>}
      {visible.length > 0 && loading && <span className="related-resources__status" role="status">Cargando más recursos…</span>}
    </div>
  </section>
}
