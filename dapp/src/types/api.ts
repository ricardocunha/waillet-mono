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
  | 'BRIDGE'
  | 'SIGNAL'
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
  from_token?: string
  to_token?: string
  from_chain?: string
  to_chain?: string
  slippage?: number
  needs_network?: boolean
  confidence: number
  error?: string
  favorites?: Favorite[]
}
