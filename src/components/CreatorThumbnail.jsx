import { useState } from 'react'
import { getCreatorThumbnailUrl } from '../lib/creators'

export default function CreatorThumbnail({ content, className, loading = 'lazy' }) {
  const src = getCreatorThumbnailUrl(content)
  const [failed, setFailed] = useState(null)
  if (!src || failed === src) return null
  return <img className={className} src={src} alt="" loading={loading} decoding="async"
    referrerPolicy="no-referrer" onError={() => setFailed(src)} />
}
