/**
 * Shared enums for extension messaging and communication
 */

// Message types for chrome.runtime.sendMessage communication
export enum BackgroundMessageType {
  RPC_REQUEST = 'RPC_REQUEST',
  DAPP_REQUEST = 'DAPP_REQUEST',
  USER_DECISION = 'USER_DECISION',
  CONTENT_SCRIPT_READY = 'CONTENT_SCRIPT_READY'
}

// Message types for window.postMessage communication (webpage <-> content script)
export enum WindowMessageType {
  WAILLET_REQUEST = 'WAILLET_REQUEST',
  WAILLET_RESPONSE = 'WAILLET_RESPONSE',
  WAILLET_PROVIDER_UPDATE = 'WAILLET_PROVIDER_UPDATE'
}

// Types of pending requests from dApps
export enum PendingRequestType {
  CONNECT = 'connect',
  TRANSACTION = 'transaction',
  SIGN_MESSAGE = 'sign_message',
  SIGN_TYPED_DATA = 'sign_typed_data',
  SWITCH_NETWORK = 'switch_network'
}

// Ethereum JSON-RPC methods
export enum EthMethod {
  // Account management
  REQUEST_ACCOUNTS = 'eth_requestAccounts',
  ACCOUNTS = 'eth_accounts',

  // Network info
  CHAIN_ID = 'eth_chainId',
  NET_VERSION = 'net_version',

  // Transactions
  SEND_TRANSACTION = 'eth_sendTransaction',
  SIGN_TRANSACTION = 'eth_signTransaction',

  // Signing
  SIGN = 'eth_sign',
  PERSONAL_SIGN = 'personal_sign',
  SIGN_TYPED_DATA = 'eth_signTypedData',
  SIGN_TYPED_DATA_V3 = 'eth_signTypedData_v3',
  SIGN_TYPED_DATA_V4 = 'eth_signTypedData_v4',

  // Read-only queries
  GET_BALANCE = 'eth_getBalance',
  GET_CODE = 'eth_getCode',
  GET_STORAGE_AT = 'eth_getStorageAt',
  CALL = 'eth_call',
  ESTIMATE_GAS = 'eth_estimateGas',
  GAS_PRICE = 'eth_gasPrice',
  BLOCK_NUMBER = 'eth_blockNumber',
  GET_BLOCK_BY_NUMBER = 'eth_getBlockByNumber',
  GET_BLOCK_BY_HASH = 'eth_getBlockByHash',
  GET_TRANSACTION_BY_HASH = 'eth_getTransactionByHash',
  GET_TRANSACTION_RECEIPT = 'eth_getTransactionReceipt',
  GET_TRANSACTION_COUNT = 'eth_getTransactionCount',

  // Web3
  WEB3_CLIENT_VERSION = 'web3_clientVersion',
  WEB3_SHA3 = 'web3_sha3',

  // Wallet methods
  WALLET_SWITCH_ETHEREUM_CHAIN = 'wallet_switchEthereumChain',
  WALLET_ADD_ETHEREUM_CHAIN = 'wallet_addEthereumChain'
}

// Supported blockchain networks
export enum Chain {
  // Major L1 Networks
  ETHEREUM = 'ethereum',
  BSC = 'bsc',
  POLYGON = 'polygon',
  AVALANCHE = 'avalanche',
  FANTOM = 'fantom',
  CRONOS = 'cronos',
  GNOSIS = 'gnosis',
  CELO = 'celo',
  MOONBEAM = 'moonbeam',
  KAVA = 'kava',
  HARMONY = 'harmony',

  // L2 Optimistic Rollups
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
  BASE = 'base',
  MANTLE = 'mantle',
  METIS = 'metis',
  BLAST = 'blast',
  MODE = 'mode',

  // L2 ZK Rollups
  ZKSYNC = 'zksync',
  LINEA = 'linea',
  POLYGON_ZKEVM = 'polygon-zkevm',
  SCROLL = 'scroll',
  MANTA = 'manta',

  // Testnets
  SEPOLIA = 'sepolia',
  BASE_SEPOLIA = 'base-sepolia',
}

// Supported tokens
export enum Token {
  ETH = 'ETH',
  BNB = 'BNB',
  MATIC = 'MATIC',
  POL = 'POL',
  AVAX = 'AVAX',
  FTM = 'FTM',
  CRO = 'CRO',
  xDAI = 'xDAI',
  CELO = 'CELO',
  GLMR = 'GLMR',
  KAVA = 'KAVA',
  ONE = 'ONE',
  MNT = 'MNT',
  METIS = 'METIS',
  USDT = 'USDT',
  USDC = 'USDC'
}

export const CHAIN_TOKENS: Partial<Record<Chain, Token[]>> = {
  // Major L1 Networks
  [Chain.ETHEREUM]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.BSC]: [Token.BNB, Token.USDT, Token.USDC],
  [Chain.POLYGON]: [Token.POL, Token.USDT, Token.USDC],
  [Chain.AVALANCHE]: [Token.AVAX, Token.USDT, Token.USDC],
  [Chain.FANTOM]: [Token.FTM, Token.USDT, Token.USDC],
  [Chain.CRONOS]: [Token.CRO, Token.USDT, Token.USDC],
  [Chain.GNOSIS]: [Token.xDAI, Token.USDC],
  [Chain.CELO]: [Token.CELO, Token.USDT, Token.USDC],
  [Chain.MOONBEAM]: [Token.GLMR, Token.USDT, Token.USDC],
  [Chain.KAVA]: [Token.KAVA, Token.USDT, Token.USDC],
  [Chain.HARMONY]: [Token.ONE, Token.USDT, Token.USDC],

  // L2 Optimistic Rollups (use ETH)
  [Chain.ARBITRUM]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.OPTIMISM]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.BASE]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.MANTLE]: [Token.MNT, Token.USDT, Token.USDC],
  [Chain.METIS]: [Token.METIS, Token.USDT, Token.USDC],
  [Chain.BLAST]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.MODE]: [Token.ETH, Token.USDC],

  // L2 ZK Rollups (use ETH)
  [Chain.ZKSYNC]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.LINEA]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.POLYGON_ZKEVM]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.SCROLL]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.MANTA]: [Token.ETH, Token.USDC],

  // Testnets
  [Chain.SEPOLIA]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.BASE_SEPOLIA]: [Token.ETH, Token.USDT, Token.USDC],
}
