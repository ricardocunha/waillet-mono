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
  PENDING_REQUEST = 'pendingRequest',
  CHAT_HISTORY = 'chatHistory'  // AI chat messages (last 24 hours)
}

export const CHAIN_DISPLAY: Partial<Record<Chain, { name: string; color: string }>> = {
  [Chain.ETHEREUM]: { name: 'Ethereum', color: '#627EEA' },
  [Chain.BSC]: { name: 'BNB Chain', color: '#F0B90B' },
  [Chain.BASE]: { name: 'Base', color: '#0052FF' },
  [Chain.SEPOLIA]: { name: 'Sepolia', color: '#A855F7' },
  [Chain.BASE_SEPOLIA]: { name: 'Base Sepolia', color: '#0052FF' },
};

export const MAINNET_CHAINS: Chain[] = [
  Chain.ETHEREUM,
  Chain.BSC,
  Chain.BASE,
];

export const TESTNET_CHAINS: Chain[] = [
  Chain.SEPOLIA,
  Chain.BASE_SEPOLIA,
];

export const SUPPORTED_CHAINS: Chain[] = [...MAINNET_CHAINS, ...TESTNET_CHAINS];
