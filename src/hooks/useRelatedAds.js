import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const COLUMNS = {
  listings:'id,title,desc,cat,sub,type,city,canton,privacy,img_url,photo_urls,price,price_amount,price_unit,rooms,active,created_at,expires_at,lifecycle_status',
  jobs:'id,title,company,desc,job_intent,type,city,canton,logo_url,salary,salary_amount,salary_unit,profile_visibility,active,created_at,expires_at,lifecycle_status',
}
const cache = new Map()
const pending = new Map()
const CACHE_MS = 5*60*1000

function loadSource(source) {
  const cached = cache.get(source)
  if (cached && Date.now()-cached.at < CACHE_MS) return Promise.resolve(cached.rows)
  if (pending.has(source)) return pending.get(source)
  const request = (async () => {
    const rows = []
    for (let from=0; ; from+=500) {
      let query = supabase.from(source).select(COLUMNS[source]).or('active.is.null,active.eq.true')
        .order('id').range(from,from+499)
      query = source === 'listings' ? query.or('privacy.is.null,privacy.eq.public') : query.or('profile_visibility.is.null,profile_visibility.eq.public')
      const {data,error} = await query
      if (error) throw error
      rows.push(...(data || []))
      if ((data || []).length < 500) break
    }
    cache.set(source,{rows,at:Date.now()})
    return rows
  })().finally(() => pending.delete(source))
  pending.set(source,request)
  return request
}

// Repeated package steps share public snapshots and in-flight requests. Failures
// stay separate so legacy employment ads survive an unavailable jobs table.
export default function useRelatedAds({enabled=true, includeJobs=false}={}) {
  const [state,setState] = useState({})
  const [attempt,setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    const sources = enabled ? includeJobs ? ['listings','jobs'] : ['listings'] : []
    setState(Object.fromEntries(sources.map(source => [source,{status:'loading',rows:[]}])) )
    for (const source of sources) {
      loadSource(source).then(rows => {
        if (!cancelled) setState(previous => ({...previous,[source]:{status:'ready',rows}}))
      }).catch(() => {
        if (!cancelled) setState(previous => ({...previous,[source]:{status:'error',rows:[]}}))
      })
    }
    return () => {cancelled=true}
  },[enabled,includeJobs,attempt])
  const statuses = enabled ? (includeJobs ? ['listings','jobs'] : ['listings']).map(source => state[source]?.status || 'loading') : []
  return {
    listings:state.listings?.rows || [], jobs:state.jobs?.rows || [],
    loading:statuses.includes('loading'), failed:statuses.includes('error'),
    retry:() => setAttempt(value => value+1),
  }
}
