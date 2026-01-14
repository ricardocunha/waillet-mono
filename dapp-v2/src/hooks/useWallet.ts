import { useState, useCallback } from 'react'
import { BrowserProvider, JsonRpcSigner } from 'ethers'
import { Chain } from '../types'
import { getChainFromId } from '../constants'

// Wallet provider type (MetaMask, wAIllet, etc.)
export type WalletProviderType = 'metamask' | 'waillet'

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

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null)
  const [chain, setChain] = useState<Chain | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)

  const isConnected = !!address

  // Connect wallet - to be implemented
  const connect = useCallback(async (_providerType: WalletProviderType) => {
    setIsConnecting(true)
    setError(null)
    // Implementation will be added in next commit
    setIsConnecting(false)
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

  // Switch chain - to be implemented
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
