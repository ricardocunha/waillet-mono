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
  CHAT_HISTORY = 'chatHistory',  // AI chat messages (last 24 hours)
  OPENAI_API_KEY = 'openaiApiKey'  // OpenAI API key stored locally
}

// CoinMarketCap CDN URL format for token icons
// Format: https://s2.coinmarketcap.com/static/img/coins/64x64/{cmc_id}.png
// CMC IDs for native/governance tokens:
// ETH=1027, BNB=1839, MATIC/POL=3890, AVAX=5805, FTM=3513, CRO=3635
// xDAI=5601, MNT=27075, CELO=5567, GLMR=6836, METIS=9640, KAVA=4846, ONE=3945
// ARB=11841, OP=11840, ZK=24091

export interface ChainDisplayInfo {
  name: string;
  color: string;
  iconUrl: string;
}

export const CHAIN_DISPLAY: Partial<Record<Chain, ChainDisplayInfo>> = {
  // Major L1 Networks
  [Chain.ETHEREUM]: {
    name: 'Ethereum',
    color: '#627EEA',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png'
  },
  [Chain.BSC]: {
    name: 'BNB Chain',
    color: '#F0B90B',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png'
  },
  [Chain.POLYGON]: {
    name: 'Polygon',
    color: '#8247E5',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png'
  },
  [Chain.AVALANCHE]: {
    name: 'Avalanche',
    color: '#E84142',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png'
  },
  [Chain.FANTOM]: {
    name: 'Fantom',
    color: '#1969FF',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3513.png'
  },
  [Chain.CRONOS]: {
    name: 'Cronos',
    color: '#002D74',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3635.png'
  },
  [Chain.GNOSIS]: {
    name: 'Gnosis',
    color: '#04795B',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1659.png' // GNO token
  },
  [Chain.CELO]: {
    name: 'Celo',
    color: '#35D07F',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5567.png'
  },
  [Chain.MOONBEAM]: {
    name: 'Moonbeam',
    color: '#53CBC9',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6836.png'
  },
  [Chain.KAVA]: {
    name: 'Kava',
    color: '#FF433E',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4846.png'
  },
  [Chain.HARMONY]: {
    name: 'Harmony',
    color: '#00AEE9',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3945.png'
  },

  // L2 Optimistic Rollups - use governance token icons where available
  [Chain.ARBITRUM]: {
    name: 'Arbitrum',
    color: '#28A0F0',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png' // ARB token
  },
  [Chain.OPTIMISM]: {
    name: 'Optimism',
    color: '#FF0420',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png' // OP token
  },
  [Chain.BASE]: {
    name: 'Base',
    color: '#0052FF',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27716.png' // BASE (Coinbase wrapped staked ETH has this, closest to Base branding)
  },
  [Chain.MANTLE]: {
    name: 'Mantle',
    color: '#000000',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png' // MNT token
  },
  [Chain.METIS]: {
    name: 'Metis',
    color: '#00DACC',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/9640.png' // METIS token
  },
  [Chain.BLAST]: {
    name: 'Blast',
    color: '#FCFC03',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28480.png' // BLAST token
  },
  [Chain.MODE]: {
    name: 'Mode',
    color: '#DFFE00',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/30915.png' // MODE token
  },

  // L2 ZK Rollups
  [Chain.ZKSYNC]: {
    name: 'zkSync Era',
    color: '#8C8DFC',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24091.png' // ZK token
  },
  [Chain.LINEA]: {
    name: 'Linea',
    color: '#61DFFF',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png' // Uses ETH (no token yet)
  },
  [Chain.POLYGON_ZKEVM]: {
    name: 'Polygon zkEVM',
    color: '#8247E5',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png' // POL token (Polygon branding)
  },
  [Chain.SCROLL]: {
    name: 'Scroll',
    color: '#FFEEDA',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/26998.png' // SCR token
  },
  [Chain.MANTA]: {
    name: 'Manta Pacific',
    color: '#0091FF',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/13631.png' // MANTA token
  },

  // Testnets
  [Chain.SEPOLIA]: {
    name: 'Sepolia',
    color: '#A855F7',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png'
  },
  [Chain.BASE_SEPOLIA]: {
    name: 'Base Sepolia',
    color: '#0052FF',
    iconUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27716.png'
  },
};

export const MAINNET_CHAINS: Chain[] = [
  Chain.ETHEREUM,
  Chain.BSC,
  Chain.POLYGON,
  Chain.ARBITRUM,
  Chain.OPTIMISM,
  Chain.BASE,
  Chain.AVALANCHE,
  Chain.FANTOM,
  Chain.ZKSYNC,
  Chain.LINEA,
];

export const TESTNET_CHAINS: Chain[] = [
  Chain.SEPOLIA,
  Chain.BASE_SEPOLIA,
];

export const SUPPORTED_CHAINS: Chain[] = [...MAINNET_CHAINS, ...TESTNET_CHAINS];
