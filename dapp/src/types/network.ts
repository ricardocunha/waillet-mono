// Backend API response types for GET /api/networks and GET /api/tokens/{symbol}

export interface NetworkApiResponse {
  id: number
  slug: string
  chain_type: 'evm' | 'solana' | 'sui' | 'ton'
  name: string
  chain_id?: number
  rpc_url: string
  rpc_url_fallback?: string
  explorer_url: string
  native_currency_symbol: string
  native_currency_name: string
  native_currency_decimals: number
  is_testnet: boolean
  display_color: string
  icon_url?: string
}

export interface TokenAddressApiResponse {
  contract_address: string
  decimals: number
  is_native: boolean
}

export interface TokenListItemResponse {
  id: number
  cmc_id: number
  symbol: string
  name: string
  slug: string
  cmc_rank?: number
  price_usd?: number
  market_cap_usd?: number
  volume_24h_usd?: number
  percent_change_24h?: number
  percent_change_7d?: number
  logo_url?: string
}

export interface TokenApiResponse {
  token: TokenListItemResponse
  addresses: Record<string, TokenAddressApiResponse> // keyed by network slug
}
