// Chain type for supported networks
export const Chain = {
  ETHEREUM: 'ethereum',
  BASE: 'base',
  SEPOLIA: 'sepolia',
  BASE_SEPOLIA: 'base_sepolia',
  BSC: 'bsc',
} as const

export type Chain = (typeof Chain)[keyof typeof Chain]

// Token type for supported tokens
export const Token = {
  ETH: 'ETH',
  USDT: 'USDT',
  USDC: 'USDC',
} as const

export type Token = (typeof Token)[keyof typeof Token]

// Chain configuration interface
export interface ChainConfig {
  chainId: number
  name: string
  rpcUrl: string
  explorer: string
  bridgeSourceAddress: string
  bridgeTargetAddress: string
  color: string
  isTestnet: boolean
}

// Token configuration interface
export interface TokenConfig {
  name: string
  symbol: string
  decimals: number
  enabled: boolean
}

// Bridge status type
export const BridgeStatus = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  SWITCHING_CHAIN: 'switching_chain',
  CONFIRMING: 'confirming',
  LOCKING: 'locking',
  LOCKED: 'locked',
  BRIDGING: 'bridging',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const

export type BridgeStatus = (typeof BridgeStatus)[keyof typeof BridgeStatus]

// Bridge parameters
export interface BridgeParams {
  sourceChain: Chain
  targetChain: Chain
  token: Token
  amount: string
}

// Bridge result
export interface BridgeResult {
  txHash: string
  nonce: bigint
  amount: string
  sourceChain: Chain
  targetChain: Chain
}

// Lock event from bridge contract
export interface LockEvent {
  nonce: bigint
  sender: string
  amount: bigint
  targetChainId: number
  timestamp: number
}

// Re-export API types
export * from './api'
export * from './lifi'
export * from './network'
