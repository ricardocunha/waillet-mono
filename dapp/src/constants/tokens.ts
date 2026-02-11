import { Token, type TokenConfig } from '../types'

// Native token address used by LI.FI for native tokens
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

// Token contract addresses by symbol and chainId — populated from backend at startup.
export const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {}

// Get token address for a given symbol and chainId
export function getTokenAddress(symbol: string, chainId: number): string | undefined {
  return TOKEN_ADDRESSES[symbol.toUpperCase()]?.[chainId]
}

// Token configurations — populated from backend at startup.
export const TOKEN_CONFIG: Record<string, TokenConfig> = {}

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
