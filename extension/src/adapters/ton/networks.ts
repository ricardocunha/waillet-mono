/**
 * TON network configurations
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
export async function initTonNetworks(): Promise<void> {
  const networks = await networkService.getNetworksByChainType(ChainType.TON);
  cachedNetworks = networks;
  cacheInitialized = true;
}

/**
 * Get all TON networks (cached)
 */
export function getTonNetworks(): NetworkConfig[] {
  return cachedNetworks;
}

/**
 * Get TON network by ID
 */
export function getTonNetwork(networkId: string): NetworkConfig | undefined {
  return cachedNetworks.find(n => n.id === networkId);
}

/**
 * Get explorer URL for TON
 */
export function getTonExplorerUrl(networkId: string, type: 'transaction' | 'address', value: string): string {
  const network = getTonNetwork(networkId);
  if (!network) return '';

  switch (type) {
    case 'transaction':
      return `${network.explorerUrl}/transaction/${value}`;
    case 'address':
      return `${network.explorerUrl}/${value}`;
    default:
      return '';
  }
}

/**
 * Get TON API endpoint for a network
 */
export function getTonApiEndpoint(networkId: string): string {
  return networkId === 'ton-mainnet' ? 'https://tonapi.io' : 'https://testnet.tonapi.io';
}

/**
 * Check if networks are loaded from backend
 */
export function isNetworksCacheInitialized(): boolean {
  return cacheInitialized;
}
