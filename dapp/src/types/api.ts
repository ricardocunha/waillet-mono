// Favorite address stored by user
export interface Favorite {
  id: string
  wallet_address: string
  alias: string
  address: string
  chain: string
  asset?: string
  type?: string
  value?: string
  created_at: string
  updated_at: string
}

// AI Intent action types
export type IntentAction =
  | 'TRANSFER'
  | 'SWAP'
  | 'APPROVE'
  | 'SAVE_FAVORITE'
  | 'LIST_FAVORITES'
  | 'UNKNOWN'

// AI Intent response from backend
export interface IntentResponse {
  action: IntentAction
  to?: string
  value?: string
  token?: string
  chain?: string
  resolved_from?: string
  alias?: string
  confidence: number
  error?: string
  favorites?: Favorite[]
}
