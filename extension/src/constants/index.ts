import { Chain } from '../types/messaging';

/**
 * Chrome storage keys enum
 */
export enum StorageKey {
  ACCOUNT = 'account',
  ENCRYPTED_WALLET = 'encryptedWallet',
  CONNECTED_SITES = 'connectedSites',
  PENDING_REQUEST = 'pendingRequest'
}

/**
 * Chain display configuration (only supported chains)
 */
export const CHAIN_DISPLAY: Partial<Record<Chain, { name: string; color: string }>> = {
  [Chain.ETHEREUM]: { name: 'Ethereum', color: '#627EEA' },
  [Chain.SEPOLIA]: { name: 'Sepolia', color: '#A855F7' },
  [Chain.BASE_SEPOLIA]: { name: 'Base Sepolia', color: '#0052FF' }
};

/**
 * Supported chains for network switching
 */
export const SUPPORTED_CHAINS: Chain[] = [
  Chain.SEPOLIA,
  Chain.ETHEREUM,
  Chain.BASE_SEPOLIA
];
