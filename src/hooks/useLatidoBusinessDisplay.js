import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useLatidoBusinessDisplay(business) {
  const [display, setDisplay] = useState(null)
  useEffect(() => {
    let live = true
    setDisplay(null)
    if (!business?.id || business.city !== undefined) return undefined
    supabase
      .from('providers')
      .select('id,name,city,photo_url,category')
      .eq('id', business.id)
      .maybeSingle()
      .then(({ data }) => {
        if (live && data) setDisplay(data)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [business?.id, business?.city])
  return display?.id === business?.id ? { ...business, ...display } : business
}
