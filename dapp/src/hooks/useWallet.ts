import { useState, useCallback } from 'react'
import { BrowserProvider, JsonRpcSigner, type Eip1193Provider } from 'ethers'
import { Chain } from '../types'
import { getChainFromId } from '../constants'

// Wallet provider type (MetaMask, wAIllet, etc.)
export type WalletProviderType = 'metamask' | 'waillet'

// Extend window for wallet providers
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean
      providers?: Array<Eip1193Provider & { isMetaMask?: boolean }>
    }
    waillet?: Eip1193Provider
  }
}

// Hook return type
export interface UseWalletReturn {
  address: string | null
  chain: Chain | null
  chainId: number | null
  isConnecting: boolean
  isConnected: boolean
  error: string | null
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  connect: (providerType: WalletProviderType) => Promise<void>
  disconnect: () => void
  switchChain: (chain: Chain) => Promise<void>
}

// Detect available wallet providers
export function detectWallets(): { metamask: boolean; waillet: boolean } {
  const hasMetaMask = !!(
    window.ethereum?.isMetaMask ||
    window.ethereum?.providers?.some((p) => p.isMetaMask)
  )
  const hasWaillet = !!window.waillet

  return { metamask: hasMetaMask, waillet: hasWaillet }
}

// Get the raw provider based on type
function getRawProvider(providerType: WalletProviderType): Eip1193Provider | null {
  if (providerType === 'waillet' && window.waillet) {
    return window.waillet
  }

  if (providerType === 'metamask') {
    // Handle multiple providers (e.g., when both MetaMask and other wallets are installed)
    if (window.ethereum?.providers) {
      const metamaskProvider = window.ethereum.providers.find((p) => p.isMetaMask)
      if (metamaskProvider) return metamaskProvider
    }
    if (window.ethereum?.isMetaMask) {
      return window.ethereum
    }
  }

  // Fallback to window.ethereum
  if (window.ethereum) {
    return window.ethereum
  }

  return null
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null)
  const [chain, setChain] = useState<Chain | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)

  const isConnected = !!address

  // Connect wallet
  const connect = useCallback(async (providerType: WalletProviderType) => {
    setIsConnecting(true)
    setError(null)

    try {
      const rawProvider = getRawProvider(providerType)

      if (!rawProvider) {
        throw new Error(
          providerType === 'waillet'
            ? 'wAIllet wallet not found. Please install the extension.'
            : 'MetaMask not found. Please install the extension.'
        )
      }

      // Create ethers provider
      const ethersProvider = new BrowserProvider(rawProvider)

      // Request account access
      const accounts = await ethersProvider.send('eth_requestAccounts', [])

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your wallet.')
      }

      // Get signer and network
      const ethersSigner = await ethersProvider.getSigner()
      const network = await ethersProvider.getNetwork()
      const currentChainId = Number(network.chainId)
      const currentChain = getChainFromId(currentChainId)

      // Update state
      setAddress(accounts[0])
      setChainId(currentChainId)
      setChain(currentChain || null)
      setProvider(ethersProvider)
      setSigner(ethersSigner)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(message)
      console.error('Wallet connection error:', err)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setAddress(null)
    setChain(null)
    setChainId(null)
    setProvider(null)
    setSigner(null)
    setError(null)
  }, [])

  // Switch chain - to be implemented in next commit
  const switchChain = useCallback(async (_chain: Chain) => {
    // Implementation will be added in next commit
  }, [])

  return {
    address,
    chain,
    chainId,
    isConnecting,
    isConnected,
    error,
    provider,
    signer,
    connect,
    disconnect,
    switchChain,
  }
}
