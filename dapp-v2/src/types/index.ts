// Chain enum for supported networks
export enum Chain {
  ETHEREUM = 'ethereum',
  BASE = 'base',
  SEPOLIA = 'sepolia',
  BASE_SEPOLIA = 'base_sepolia',
  BSC = 'bsc',
}

// Token enum for supported tokens
export enum Token {
  ETH = 'ETH',
  USDT = 'USDT',
  USDC = 'USDC',
}

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

// Bridge status enum
export enum BridgeStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  SWITCHING_CHAIN = 'switching_chain',
  CONFIRMING = 'confirming',
  LOCKING = 'locking',
  LOCKED = 'locked',
  BRIDGING = 'bridging',
  COMPLETE = 'complete',
  ERROR = 'error',
}

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
