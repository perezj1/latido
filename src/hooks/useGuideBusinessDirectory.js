import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getNegocioTypeMeta } from '../lib/constants'
import { resolveImageUrl } from '../lib/imageVariants'

const PAGE_SIZE = 500
const CACHE_MS = 5 * 60 * 1000
const COLUMNS = 'id,name,category,city,canton,description,services,photo_url,featured,active,created_at,promotion_plan,promotion_starts_at,promotion_ends_at,partner_card_title,partner_card_description'
let cachedDirectory = null
let cachedAt = 0
let pendingDirectory = null

async function fetchDirectory() {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from('providers').select(COLUMNS)
      .eq('active', true).order('id').range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < PAGE_SIZE) return rows.map(row => ({
      ...row,
      type:row.category,
      emoji:getNegocioTypeMeta(row.category)?.label?.split(' ')[0]
        || ({ empleo:'💼', vivienda:'🏠' }[row.category]) || '🏪',
      photo_url:resolveImageUrl(row.photo_url),
    }))
  }
}

// Every step shares the same request and snapshot, including StrictMode mounts.
// Only successful directory loads are cached; retry starts a fresh request.
function loadDirectory() {
  if (cachedDirectory && Date.now() - cachedAt < CACHE_MS) return Promise.resolve(cachedDirectory)
  if (pendingDirectory) return pendingDirectory
  pendingDirectory = Promise.allSettled([
    fetchDirectory(), supabase.rpc('get_business_recommendation_counts'),
  ]).then(([providers, recommendationCounts]) => {
    if (providers.status === 'rejected') throw providers.reason
    const recommendations = {}
    if (recommendationCounts.status === 'fulfilled' && !recommendationCounts.value.error) {
      for (const row of recommendationCounts.value.data || []) {
        if (row?.business_id) recommendations[row.business_id] = Number(row.recommendation_count || 0)
      }
    }
    cachedDirectory = { directory:providers.value, recommendations }
    cachedAt = Date.now()
    return cachedDirectory
  }).finally(() => { pendingDirectory = null })
  return pendingDirectory
}

export default function useGuideBusinessDirectory() {
  const [data, setData] = useState({ directory:[], recommendations:{} })
  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    loadDirectory().then(result => {
      if (cancelled) return
      setData(result)
      setStatus('ready')
    }).catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [attempt])
  return { ...data, status, retry:() => setAttempt(value => value + 1) }
}
