import { C, PP } from '../lib/theme'
import { getAdDisplayCat, getAdDisplayEmoji, getJobIntentMeta } from '../lib/constants'
import { getThumbnailImageUrl, handleThumbnailImageError } from '../lib/imageVariants'
import { fmtPrice, getAdPhotos } from '../lib/publicationCardPresentation'

const CLAMP_1 = { minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }
const CLAMP_2 = { display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minWidth:0, overflowWrap:'anywhere', wordBreak:'break-word' }

export function RelatedAdCard({ ad, onClick }) {
  const photos = getAdPhotos(ad)
  const cat = getAdDisplayCat(ad)
  return (
    <button type="button" onClick={onClick} style={{ width:156, flex:'0 0 156px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', padding:0, textAlign:'left', cursor:'pointer' }}>
      <div style={{ height:112, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>
        {photos[0] ? <img src={getThumbnailImageUrl(photos[0])} alt={ad.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : getAdDisplayEmoji(ad)}
      </div>
      <div style={{ padding:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, lineHeight:1.35, margin:'0 0 6px', ...CLAMP_2 }}>{ad.title}</p>
        {ad.price && <p style={{ fontFamily:PP, fontWeight:900, fontSize:13, color:C.primary, margin:'0 0 5px', ...CLAMP_1 }}>{fmtPrice(ad.price)}</p>}
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, ...CLAMP_1 }}>{cat?.label || 'Anuncio'}</p>
      </div>
    </button>
  )
}

export function RelatedJobCard({ job, onClick }) {
  const intent = getJobIntentMeta(job)
  return (
    <button type="button" onClick={onClick} style={{ width:156, flex:'0 0 156px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden', padding:0, textAlign:'left', cursor:'pointer' }}>
      <div style={{ height:112, background:C.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>
        {job.logo_url ? <img src={getThumbnailImageUrl(job.logo_url)} onError={event => handleThumbnailImageError(event, job.logo_url)} alt={job.title || job.company} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} /> : (job.emoji || '💼')}
      </div>
      <div style={{ padding:10 }}>
        <p style={{ fontFamily:PP, fontWeight:700, fontSize:12, color:C.text, lineHeight:1.35, margin:'0 0 6px', ...CLAMP_2 }}>{job.title || job.company}</p>
        {job.salary && <p style={{ fontFamily:PP, fontWeight:900, fontSize:13, color:C.primary, margin:'0 0 5px', ...CLAMP_1 }}>{fmtPrice(job.salary)}</p>}
        <p style={{ fontFamily:PP, fontSize:10, color:C.light, margin:0, ...CLAMP_1 }}>{intent.label}</p>
      </div>
    </button>
  )
}
