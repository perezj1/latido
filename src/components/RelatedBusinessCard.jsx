import { getNegocioTypeMeta } from '../lib/constants'
import { C, PP } from '../lib/theme'
import { getThumbnailImageUrl, handleThumbnailImageError } from '../lib/imageVariants'
import { getDirectoryBusinessPlan } from '../lib/businessDirectoryRanking'
import { getBusinessPromotionDisplayLabel } from '../lib/businessPromotion'

const CLAMP_1 = { minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }
const CLAMP_2 = { display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minWidth:0, overflowWrap:'anywhere', wordBreak:'break-word' }

export default function RelatedBusinessCard({ business, photosMap={}, onClick }) {
  const category = getNegocioTypeMeta(business.type)
  const photos = photosMap[business.id] || (business.photo_url ? [business.photo_url] : [])
  const planLabel = getBusinessPromotionDisplayLabel(business, getDirectoryBusinessPlan(business))
  return (
    <button type="button" onClick={onClick} style={{ width:156, flex:'0 0 156px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', padding:0, textAlign:'left', cursor:'pointer' }}>
      <div style={{ position:'relative', height:112, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>
        {photos[0] ? <img src={getThumbnailImageUrl(photos[0])} onError={event => handleThumbnailImageError(event, photos[0])} alt={business.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : business.emoji}
        {planLabel && (
          <span style={{ position:'absolute', left:'50%', bottom:-10, transform:'translateX(-50%)', zIndex:2, display:'inline-flex', alignItems:'center', justifyContent:'center', fontFamily:PP, fontSize:9, fontWeight:800, color:C.primary, background:'#fff', border:`1.5px solid ${C.primaryMid}`, borderRadius:999, padding:'5px 10px', boxShadow:'0 8px 18px rgba(37,99,235,0.14)', whiteSpace:'nowrap' }}>
            {planLabel}
          </span>
        )}
      </div>
      <div style={{ padding:planLabel ? '24px 10px 10px' : 10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, lineHeight:1.35, margin:'0 0 6px', ...CLAMP_2 }}>{business.name}</p>
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:'0 0 4px', ...CLAMP_1 }}>{category?.label || 'Negocio'}</p>
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, ...CLAMP_1 }}>{business.city}</p>
      </div>
    </button>
  )
}
