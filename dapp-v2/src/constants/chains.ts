import { Chain, type ChainConfig } from '../types'

// Chain configurations for all supported networks
export const CHAIN_CONFIG: Record<Chain, ChainConfig> = {
  [Chain.ETHEREUM]: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    bridgeSourceAddress: '0x0000000000000000000000000000000000000000', // TODO: Deploy
    bridgeTargetAddress: '0x0000000000000000000000000000000000000000',
    color: '#627EEA',
    isTestnet: false,
  },
  [Chain.BASE]: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    bridgeSourceAddress: '0x0000000000000000000000000000000000000000',
    bridgeTargetAddress: '0x0000000000000000000000000000000000000000',
    color: '#0052FF',
    isTestnet: false,
  },
  [Chain.SEPOLIA]: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
    bridgeSourceAddress: '0xYourBridgeSourceAddress', // TODO: Update after deployment
    bridgeTargetAddress: '0xYourBridgeTargetAddress',
    color: '#A855F7',
    isTestnet: true,
  },
  [Chain.BASE_SEPOLIA]: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    bridgeSourceAddress: '0xYourBridgeSourceAddress',
    bridgeTargetAddress: '0xYourBridgeTargetAddress',
    color: '#0052FF',
    isTestnet: true,
  },
  [Chain.BSC]: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    bridgeSourceAddress: '0x0000000000000000000000000000000000000000',
    bridgeTargetAddress: '0x0000000000000000000000000000000000000000',
    color: '#F0B90B',
    isTestnet: false,
  },
}

// Helper to get chain ID from Chain enum
export function getChainId(chain: Chain): number {
  return CHAIN_CONFIG[chain].chainId
}

// Helper to get Chain enum from chain ID
export function getChainFromId(chainId: number): Chain | undefined {
  const entry = Object.entries(CHAIN_CONFIG).find(
    ([, config]) => config.chainId === chainId
  )
  return entry ? (entry[0] as Chain) : undefined
}

// Helper to format address (first 6 + last 4 chars)
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Helper to format ETH value from wei
export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18
  return eth.toFixed(4)
}

// Get explorer URL for a transaction
export function getExplorerTxUrl(chain: Chain, txHash: string): string {
  return `${CHAIN_CONFIG[chain].explorer}/tx/${txHash}`
}

// Get explorer URL for an address
export function getExplorerAddressUrl(chain: Chain, address: string): string {
  return `${CHAIN_CONFIG[chain].explorer}/address/${address}`
}
