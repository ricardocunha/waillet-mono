import { Chain } from '../types/messaging';

/**
 * Chrome storage keys enum
 */
export enum StorageKey {
  ACCOUNT = 'account',
  ACCOUNTS = 'accounts',  // Array of all accounts
  ACTIVE_ACCOUNT_INDEX = 'activeAccountIndex',  // Index of active account
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
  [Chain.BASE_SEPOLIA]: { name: 'Base Sepolia', color: '#0052FF' },
  [Chain.BSC]: { name: 'BNB Chain', color: '#F0B90B' }
};

/**
 * Supported chains for network switching
 */
export const SUPPORTED_CHAINS: Chain[] = [
  Chain.SEPOLIA,
  Chain.ETHEREUM,
  Chain.BASE_SEPOLIA,
  Chain.BSC
];
