import { useState, useCallback, useEffect } from 'react'
import type { Favorite } from '../types'
import { api } from '../services'

export interface UseFavoritesReturn {
  favorites: Favorite[]
  isLoading: boolean
  error: string | null
  loadFavorites: () => Promise<void>
  saveFavorite: (data: Omit<Favorite, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  deleteFavorite: (id: string) => Promise<void>
}

export function useFavorites(walletAddress: string | null): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFavorites = useCallback(async () => {
    if (!walletAddress) {
      setFavorites([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await api.getFavorites(walletAddress)
      setFavorites(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load favorites'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress])

  const saveFavorite = useCallback(async (data: Omit<Favorite, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null)
      await api.saveFavorite(data)
      await loadFavorites()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save favorite'
      setError(msg)
      throw err
    }
  }, [loadFavorites])

  const deleteFavorite = useCallback(async (id: string) => {
    try {
      setError(null)
      await api.deleteFavorite(id)
      setFavorites((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete favorite'
      setError(msg)
    }
  }, [])

  // Auto-load when wallet address changes
  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  return {
    favorites,
    isLoading,
    error,
    loadFavorites,
    saveFavorite,
    deleteFavorite,
  }
}
