import { useNavigate } from 'react-router-dom'
import { getAdCategoryId } from '../lib/constants'
import { getAdPath, getBusinessPath, getJobPath } from '../lib/seo'
import { getBusinessGuideMatches } from '../lib/guideBusinesses'
import { getPublicationCardPrice } from '../lib/publicationCardPresentation'
import RelatedBusinessCard from './RelatedBusinessCard'
import { RelatedAdCard, RelatedJobCard } from './RelatedPublicationCards'

// Reuse Latido's existing cards unchanged, including emojis, sizing and pills.
export default function RelatedResourceCard({item,guide,photosMap={}}) {
  const navigate = useNavigate()
  const {row,kind} = item
  let card
  if (kind === 'business') {
    const supportingText = getBusinessGuideMatches(row,guide).slice(0,2)
      .map(term => ['rav','orp','cv','ahv','avs','syna','unia'].includes(term) ? term.toUpperCase() : term).join(' · ')
    card = <RelatedBusinessCard business={row} photosMap={photosMap} supportingText={supportingText} onClick={() => navigate(getBusinessPath(row))} />
  } else if (row.resourceKind === 'job' || getAdCategoryId(row) === 'empleo') {
    const job = {...row,salary:getPublicationCardPrice(row,true),logo_url:row.logo_url || row.img_url || row.photo_urls?.[0]}
    card = <RelatedJobCard job={job} onClick={() => navigate(row.resourceKind === 'job' ? getJobPath(row) : getAdPath(row))} />
  } else {
    card = <RelatedAdCard ad={{...row,price:getPublicationCardPrice(row)}} onClick={() => navigate(getAdPath(row))} />
  }
  return <div className="related-resources__item" data-resource-type={kind}>{card}</div>
}
