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
  ETHEREUM = 'ethereum',
  SEPOLIA = 'sepolia',
  BASE_SEPOLIA = 'base-sepolia',
  POLYGON = 'polygon',
  BSC = 'bsc',
  BASE = 'base'
}

// Supported tokens
export enum Token {
  ETH = 'ETH',
  BNB = 'BNB',
  USDT = 'USDT',
  USDC = 'USDC'
}

// Token availability per chain
export const CHAIN_TOKENS: Partial<Record<Chain, Token[]>> = {
  [Chain.ETHEREUM]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.SEPOLIA]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.BASE_SEPOLIA]: [Token.ETH, Token.USDT, Token.USDC],
  [Chain.BSC]: [Token.BNB, Token.USDT, Token.USDC]
}
