/**
 * Chain type definitions for multi-chain wallet support
 * Configurations are fetched from backend with localStorage caching for offline support
 */

import { api, type ChainTypeConfig as APIChainTypeConfig } from '../services/api';

// Chain type as string literal type (fetched from backend)
export type ChainType = 'evm' | 'solana' | 'sui' | 'ton';

// Re-export for convenience
export type { ChainTypeConfig as ChainTypeConfigAPI } from '../services/api';

/**
 * Chain configuration with cryptographic details
 */
export interface ChainTypeConfig {
  id: ChainType;
  name: string;
  coinType: number; // BIP-44 coin type
  curve: 'secp256k1' | 'ed25519';
  addressFormat: 'hex' | 'base58' | 'base64url';
  derivationTemplate: string; // Path with {index} placeholder
}

// LocalStorage key for caching
const CHAIN_TYPES_CACHE_KEY = 'waillet_chain_types';

// Cache for runtime use
let chainTypeConfigsCache: Record<ChainType, ChainTypeConfig> | null = null;
let cacheInitialized = false;

/**
 * Convert API response to internal format
 */
function toChainTypeConfig(apiConfig: APIChainTypeConfig): ChainTypeConfig {
  return {
    id: apiConfig.id as ChainType,
    name: apiConfig.name,
    coinType: apiConfig.coin_type,
    curve: apiConfig.curve as 'secp256k1' | 'ed25519',
    addressFormat: apiConfig.address_format as 'hex' | 'base58' | 'base64url',
    derivationTemplate: apiConfig.derivation_template,
  };
}

/**
 * Load cached chain types from localStorage
 */
function loadFromCache(): Record<ChainType, ChainTypeConfig> | null {
  try {
    const cached = localStorage.getItem(CHAIN_TYPES_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('[ChainTypes] Failed to load from cache:', error);
  }
  return null;
}

/**
 * Save chain types to localStorage
 */
function saveToCache(configs: Record<ChainType, ChainTypeConfig>): void {
  try {
    localStorage.setItem(CHAIN_TYPES_CACHE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.warn('[ChainTypes] Failed to save to cache:', error);
  }
}

/**
 * Initialize chain type configs from backend
 * Falls back to localStorage cache if backend is unavailable
 */
export async function initChainTypeConfigs(): Promise<void> {
  try {
    const apiConfigs = await api.getChainTypes();

    chainTypeConfigsCache = {} as Record<ChainType, ChainTypeConfig>;
    for (const apiConfig of apiConfigs) {
      const config = toChainTypeConfig(apiConfig);
      chainTypeConfigsCache[config.id] = config;
    }

    // Save to localStorage for offline use
    saveToCache(chainTypeConfigsCache);
    cacheInitialized = true;
    console.log('[ChainTypes] Loaded from backend:', Object.keys(chainTypeConfigsCache));
  } catch (error) {
    console.warn('[ChainTypes] Failed to fetch from backend, using cache:', error);

    // Try to load from localStorage
    const cached = loadFromCache();
    if (cached) {
      chainTypeConfigsCache = cached;
      cacheInitialized = true;
      console.log('[ChainTypes] Loaded from cache:', Object.keys(chainTypeConfigsCache));
    } else {
      // No cache available - this is a critical error
      console.error('[ChainTypes] No cached chain types available. Key derivation will fail.');
      throw new Error('Chain type configurations not available. Please ensure backend connectivity.');
    }
  }
}

/**
 * Get all chain type configs
 */
export function getChainTypeConfigs(): Record<ChainType, ChainTypeConfig> {
  if (!chainTypeConfigsCache) {
    // Try to load from cache synchronously
    const cached = loadFromCache();
    if (cached) {
      chainTypeConfigsCache = cached;
      return cached;
    }
    throw new Error('Chain type configs not initialized. Call initChainTypeConfigs() first.');
  }
  return chainTypeConfigsCache;
}

/**
 * Get a specific chain type config
 */
export function getChainTypeConfig(chainType: ChainType): ChainTypeConfig {
  const configs = getChainTypeConfigs();
  const config = configs[chainType];
  if (!config) {
    throw new Error(`Unknown chain type: ${chainType}`);
  }
  return config;
}

/**
 * Get derivation path for a chain type and index
 */
export function getDerivationPath(chainType: ChainType, index: number): string {
  const config = getChainTypeConfig(chainType);
  return config.derivationTemplate.replace('{index}', index.toString());
}

/**
 * Check if chain type configs are initialized
 */
export function isChainTypeConfigsInitialized(): boolean {
  return cacheInitialized || chainTypeConfigsCache !== null;
}

/**
 * Get all supported chain types
 */
export function getSupportedChainTypes(): ChainType[] {
  const configs = getChainTypeConfigs();
  return Object.keys(configs) as ChainType[];
}

// ==================== DERIVED TYPES ====================

/**
 * Derived account from a mnemonic
 */
export interface DerivedAccount {
  address: string;
  publicKey: string; // Hex-encoded public key
  privateKey: Uint8Array; // Raw private key bytes
  index: number;
  chainType: ChainType;
}

/**
 * Network configuration for a specific chain
 */
export interface NetworkConfig {
  id: string; // e.g., 'solana-mainnet', 'sui-testnet'
  name: string;
  chainType: ChainType;
  chainId?: number; // EVM chain ID (optional for non-EVM chains)
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
  iconUrl?: string;
  displayColor?: string;
}

/**
 * Token configuration
 */
export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  address?: string; // Contract/mint address (optional for native tokens)
  logoUrl?: string;
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get chain type from network ID
 */
export function getChainTypeFromNetwork(networkId: string): ChainType {
  if (networkId.startsWith('solana')) return 'solana';
  if (networkId.startsWith('sui')) return 'sui';
  if (networkId.startsWith('ton')) return 'ton';
  return 'evm';
}

/**
 * Check if a chain type uses Ed25519 cryptography
 */
export function isEd25519Chain(chainType: ChainType): boolean {
  try {
    const config = getChainTypeConfig(chainType);
    return config.curve === 'ed25519';
  } catch {
    // Fallback for known chain types
    return chainType === 'solana' || chainType === 'sui' || chainType === 'ton';
  }
}

// ==================== LEGACY COMPATIBILITY ====================

// For backward compatibility with existing code that imports ChainType enum-style
export const ChainType = {
  EVM: 'evm' as ChainType,
  SOLANA: 'solana' as ChainType,
  SUI: 'sui' as ChainType,
  TON: 'ton' as ChainType,
} as const;
