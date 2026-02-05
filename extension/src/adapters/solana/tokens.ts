/**
 * Solana SPL token configurations
 * All token data is fetched from the backend API
 */

import { TokenConfig } from '../../types/chainTypes';
import { api } from '../../services/api';

// Cache for token addresses from backend
let tokenAddressCache: Record<string, Record<string, string>> = {};
let tokenMetadataCache: Record<string, TokenConfig> = {};
let cacheInitialized = false;

/**
 * Initialize token cache from backend
 */
export async function initSolanaTokenCache(networkId: string): Promise<void> {
  try {
    const tokens = await api.getTokensForNetwork(networkId);
    for (const tokenData of tokens) {
      const symbol = tokenData.token.symbol.toUpperCase();

      tokenMetadataCache[symbol] = {
        symbol,
        name: tokenData.token.name,
        decimals: tokenData.addresses[networkId]?.decimals || 9,
        logoUrl: tokenData.token.logo_url
      };

      if (!tokenAddressCache[symbol]) {
        tokenAddressCache[symbol] = {};
      }
      if (tokenData.addresses[networkId]) {
        tokenAddressCache[symbol][networkId] = tokenData.addresses[networkId].contract_address;
      }
    }
    cacheInitialized = true;
  } catch (error) {
    console.warn('[SolanaTokens] Failed to fetch tokens from backend:', error);
  }
}

/**
 * Get token mint address for a network
 */
export function getSolanaTokenAddress(symbol: string, networkId: string): string | undefined {
  return tokenAddressCache[symbol.toUpperCase()]?.[networkId];
}

/**
 * Get token metadata
 */
export function getSolanaTokenMetadata(symbol: string): TokenConfig | undefined {
  return tokenMetadataCache[symbol.toUpperCase()];
}

/**
 * Get available tokens for a network
 */
export function getSolanaNetworkTokens(networkId: string): TokenConfig[] {
  const tokens: TokenConfig[] = [];

  for (const [symbol, addresses] of Object.entries(tokenAddressCache)) {
    if (addresses[networkId]) {
      const metadata = getSolanaTokenMetadata(symbol);
      if (metadata) {
        tokens.push({
          ...metadata,
          address: addresses[networkId]
        });
      }
    }
  }

  return tokens;
}

/**
 * Check if token cache is initialized
 */
export function isSolanaTokenCacheInitialized(): boolean {
  return cacheInitialized;
}
