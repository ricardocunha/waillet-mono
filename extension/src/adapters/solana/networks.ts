/**
 * Solana network configurations
 * All networks are fetched from the backend API
 */

import { ChainType, NetworkConfig } from '../../types/chainTypes';
import { networkService } from '../../services/networkService';

// Cached networks from backend
let cachedNetworks: NetworkConfig[] = [];
let cacheInitialized = false;

/**
 * Initialize networks from backend
 */
export async function initSolanaNetworks(): Promise<void> {
  const networks = await networkService.getNetworksByChainType(ChainType.SOLANA);
  cachedNetworks = networks;
  cacheInitialized = true;
}

/**
 * Get all Solana networks (cached)
 */
export function getSolanaNetworks(): NetworkConfig[] {
  return cachedNetworks;
}

/**
 * Get Solana network by ID
 */
export function getSolanaNetwork(networkId: string): NetworkConfig | undefined {
  return cachedNetworks.find(n => n.id === networkId);
}

/**
 * Get explorer URL for Solana
 */
export function getSolanaExplorerUrl(networkId: string, type: 'tx' | 'address' | 'token', value: string): string {
  const network = getSolanaNetwork(networkId);
  if (!network) return '';

  const baseUrl = network.explorerUrl.split('?')[0];
  const isMainnet = networkId === 'solana-mainnet';
  const cluster = isMainnet ? '' : `?cluster=${networkId.replace('solana-', '')}`;

  return `${baseUrl}/${type}/${value}${cluster}`;
}

/**
 * Check if networks are loaded from backend
 */
export function isNetworksCacheInitialized(): boolean {
  return cacheInitialized;
}
