import { useState, useCallback } from 'react'

const KEY = 'latido_favorites'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{"ads":[],"jobs":[]}') }
  catch { return { ads:[], jobs:[] } }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState(load)

  const toggleFavorite = useCallback((type, id) => {
    setFavorites(prev => {
      const list = prev[type] || []
      const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
      const updated = { ...prev, [type]: next }
      localStorage.setItem(KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const isFavorite = useCallback((type, id) => {
    return (favorites[type] || []).includes(id)
  }, [favorites])

  return { favorites, toggleFavorite, isFavorite }
}
