/**
 * EVM token configurations
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
export async function initTokenCache(networkId: string): Promise<void> {
  const tokens = await api.getTokensForNetwork(networkId);
  for (const tokenData of tokens) {
    const symbol = tokenData.token.symbol.toUpperCase();

    tokenMetadataCache[symbol] = {
      symbol,
      name: tokenData.token.name,
      decimals: tokenData.addresses[networkId]?.decimals || 18,
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
}

/**
 * Get token address for a network
 */
export function getTokenAddress(symbol: string, networkId: string): string | undefined {
  return tokenAddressCache[symbol.toUpperCase()]?.[networkId];
}

/**
 * Get token metadata
 */
export function getTokenMetadata(symbol: string): TokenConfig | undefined {
  return tokenMetadataCache[symbol.toUpperCase()];
}

/**
 * Get available tokens for a network
 */
export function getNetworkTokens(networkId: string): TokenConfig[] {
  const tokens: TokenConfig[] = [];

  for (const [symbol, addresses] of Object.entries(tokenAddressCache)) {
    if (addresses[networkId]) {
      const metadata = getTokenMetadata(symbol);
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
export function isTokenCacheInitialized(): boolean {
  return cacheInitialized;
}

/**
 * ERC-20 ABI for basic token operations
 */
export const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];
