/**
 * EVM network configurations
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
export async function initEvmNetworks(): Promise<void> {
  const networks = await networkService.getNetworksByChainType(ChainType.EVM);
  cachedNetworks = networks;
  cacheInitialized = true;
}

/**
 * Get all EVM networks (cached)
 */
export function getEvmNetworks(): NetworkConfig[] {
  return cachedNetworks;
}

/**
 * Get EVM network by ID
 */
export function getEvmNetwork(networkId: string): NetworkConfig | undefined {
  return cachedNetworks.find(n => n.id === networkId);
}

/**
 * Get all EVM mainnet networks
 */
export function getEvmMainnets(): NetworkConfig[] {
  return cachedNetworks.filter(n => !n.isTestnet);
}

/**
 * Get all EVM testnet networks
 */
export function getEvmTestnets(): NetworkConfig[] {
  return cachedNetworks.filter(n => n.isTestnet);
}

/**
 * Get chain ID for a network
 */
export function getEvmChainId(networkId: string): number | undefined {
  const network = getEvmNetwork(networkId);
  return network?.chainId;
}

/**
 * Get network ID from chain ID
 */
export function getNetworkIdFromChainId(chainId: number): string | undefined {
  const network = cachedNetworks.find(n => n.chainId === chainId);
  return network?.id;
}

/**
 * Check if networks are loaded from backend
 */
export function isNetworksCacheInitialized(): boolean {
  return cacheInitialized;
}
