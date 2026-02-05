/**
 * SUI network configurations
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
export async function initSuiNetworks(): Promise<void> {
  const networks = await networkService.getNetworksByChainType(ChainType.SUI);
  cachedNetworks = networks;
  cacheInitialized = true;
}

/**
 * Get all SUI networks (cached)
 */
export function getSuiNetworks(): NetworkConfig[] {
  return cachedNetworks;
}

/**
 * Get SUI network by ID
 */
export function getSuiNetwork(networkId: string): NetworkConfig | undefined {
  return cachedNetworks.find(n => n.id === networkId);
}

/**
 * Get explorer URL for SUI
 */
export function getSuiExplorerUrl(networkId: string, type: 'tx' | 'address' | 'object', value: string): string {
  const network = getSuiNetwork(networkId);
  if (!network) return '';

  const baseExplorerUrl = network.explorerUrl.replace(/\/(mainnet|testnet|devnet)$/, '');
  const suffix = networkId === 'sui-mainnet' ? 'mainnet' : networkId.replace('sui-', '');

  switch (type) {
    case 'tx':
      return `${baseExplorerUrl}/${suffix}/tx/${value}`;
    case 'address':
      return `${baseExplorerUrl}/${suffix}/account/${value}`;
    case 'object':
      return `${baseExplorerUrl}/${suffix}/object/${value}`;
    default:
      return '';
  }
}

/**
 * Check if networks are loaded from backend
 */
export function isNetworksCacheInitialized(): boolean {
  return cacheInitialized;
}
