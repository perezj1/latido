import { useState, useCallback } from 'react'

const KEY = 'latido_favorites'

const DEFAULT_FAVORITES = { ads:[], jobs:[], businesses:[], communities:[], events:[] }

function load() {
  try { return { ...DEFAULT_FAVORITES, ...JSON.parse(localStorage.getItem(KEY) || '{}') } }
  catch { return DEFAULT_FAVORITES }
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
