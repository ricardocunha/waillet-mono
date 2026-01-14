import { Chain } from '../types'

// Chain pair for bridging
export interface ChainPair {
  source: Chain
  target: Chain
  enabled: boolean
}

// Supported bridge chain pairs
export const CHAIN_PAIRS: ChainPair[] = [
  // Mainnet pair
  {
    source: Chain.ETHEREUM,
    target: Chain.BASE,
    enabled: true,
  },
  {
    source: Chain.BASE,
    target: Chain.ETHEREUM,
    enabled: true,
  },
  // Testnet pair
  {
    source: Chain.SEPOLIA,
    target: Chain.BASE_SEPOLIA,
    enabled: true,
  },
  {
    source: Chain.BASE_SEPOLIA,
    target: Chain.SEPOLIA,
    enabled: true,
  },
]

// Get valid target chains for a source chain
export function getTargetChains(sourceChain: Chain): Chain[] {
  return CHAIN_PAIRS
    .filter((pair) => pair.source === sourceChain && pair.enabled)
    .map((pair) => pair.target)
}

// Check if a chain pair is valid for bridging
export function isValidChainPair(source: Chain, target: Chain): boolean {
  return CHAIN_PAIRS.some(
    (pair) => pair.source === source && pair.target === target && pair.enabled
  )
}

// Get default target chain for a source
export function getDefaultTargetChain(sourceChain: Chain): Chain | undefined {
  const targets = getTargetChains(sourceChain)
  return targets.length > 0 ? targets[0] : undefined
}
