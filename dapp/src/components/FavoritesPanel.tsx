import { useState } from 'react'
import { Star, Trash2, Plus, Copy, Check, AlertCircle } from 'lucide-react'
import { isAddress } from 'ethers'
import type { Favorite } from '../types'
import { formatAddress } from '../constants'

interface FavoritesPanelProps {
  favorites: Favorite[]
  isLoading: boolean
  error: string | null
  walletAddress: string | null
  onSave: (data: Omit<Favorite, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSelect?: (address: string) => void
}

export function FavoritesPanel({
  favorites,
  isLoading,
  error,
  walletAddress,
  onSave,
  onDelete,
  onSelect,
}: FavoritesPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [alias, setAlias] = useState('')
  const [address, setAddress] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleSave = async () => {
    if (!alias.trim() || !address.trim() || !walletAddress) return
    if (!isAddress(address)) return

    setIsSaving(true)
    try {
      await onSave({
        wallet_address: walletAddress,
        alias: alias.trim(),
        address: address.trim(),
        chain: '',
      })
      setAlias('')
      setAddress('')
      setShowAddForm(false)
    } catch {
      // error handled by parent
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopy = (addr: string, id: string) => {
    navigator.clipboard.writeText(addr)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!walletAddress) return null

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Favorites
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg space-y-3">
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Name (e.g. Alice)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x address"
            className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 ${
              address && !isAddress(address) ? 'border-red-500' : 'border-slate-700'
            }`}
          />
          {address && !isAddress(address) && (
            <p className="text-xs text-red-400">Invalid address</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!alias.trim() || !address.trim() || !isAddress(address) || isSaving}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/50 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Favorites List */}
      {isLoading ? (
        <div className="text-center py-4 text-slate-400 text-sm">Loading...</div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-4 text-slate-500 text-sm">
          No favorites yet. Click + to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg group"
            >
              <button
                onClick={() => onSelect?.(fav.address)}
                className="flex-1 text-left"
              >
                <span className="text-white font-medium text-sm">{fav.alias}</span>
                <span className="text-slate-400 text-sm ml-2">{formatAddress(fav.address)}</span>
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopy(fav.address, fav.id)}
                  className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                >
                  {copiedId === fav.id ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => onDelete(fav.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
