import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useLatidoBusinessDisplay(business, { includePhoto = false } = {}) {
  const [display, setDisplay] = useState(null)
  useEffect(() => {
    let live = true
    setDisplay(null)
    if (!business?.id || (business.city !== undefined && (!includePhoto || business.photo_url))) return undefined
    supabase
      .from('providers')
      .select('id,name,city,photo_url,category')
      .eq('id', business.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error || !data) return
        let photo = data.photo_url || business.photo_url
        if (includePhoto && !photo) {
          const photos = await supabase.from('provider_photos')
            .select('url').eq('provider_id', business.id)
            .order('is_main', { ascending: false })
            .order('sort_order', { ascending: true }).limit(1)
          photo = photos.data?.[0]?.url
        }
        if (live) setDisplay({ ...data, photo_url: photo || null })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [business?.id, business?.city, business?.photo_url, includePhoto])
  return display?.id === business?.id ? { ...business, ...display } : business
}
