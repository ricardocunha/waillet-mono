import { Token, type TokenConfig } from '../types'

// Token configurations
export const TOKEN_CONFIG: Record<Token, TokenConfig> = {
  [Token.ETH]: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    enabled: true,
  },
  [Token.USDT]: {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    enabled: false, // Coming soon
  },
  [Token.USDC]: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    enabled: false, // Coming soon
  },
}

// Get all enabled tokens
export function getEnabledTokens(): Token[] {
  return Object.entries(TOKEN_CONFIG)
    .filter(([, config]) => config.enabled)
    .map(([token]) => token as Token)
}

// Get all tokens (for display, even disabled ones)
export function getAllTokens(): Token[] {
  return Object.keys(TOKEN_CONFIG) as Token[]
}
