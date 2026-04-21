import { supabase } from './supabase'

const cache = new Map() // userId → { avatarUrl, ts }
const TTL = 5 * 60 * 1000

export async function fetchAvatarsByIds(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]
  if (!uniqueIds.length) return new Map()

  const now = Date.now()
  const toFetch = uniqueIds.filter(id => {
    const hit = cache.get(id)
    return !hit || now - hit.ts > TTL
  })

  if (toFetch.length) {
    let response = await supabase
      .from('profile_public')
      .select('id, avatar_url')
      .in('id', toFetch)

    if (response.error) {
      response = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', toFetch)
    }

    const foundIds = new Set()
    ;(response.data || []).forEach(row => {
      cache.set(row.id, { avatarUrl: row.avatar_url || null, ts: now })
      foundIds.add(row.id)
    })
    // cache misses so we don't re-fetch every render
    toFetch.filter(id => !foundIds.has(id)).forEach(id => {
      cache.set(id, { avatarUrl: null, ts: now })
    })
  }

  return new Map(uniqueIds.map(id => [id, cache.get(id)?.avatarUrl || null]))
}

// Invalidate one entry after the user updates their own avatar
export function invalidateAvatarCache(userId) {
  cache.delete(userId)
}
