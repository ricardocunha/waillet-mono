import { useState, useCallback, useEffect } from 'react'
import { BrowserProvider, JsonRpcSigner } from 'ethers'
import type { Eip1193Provider } from 'ethers'
import { Chain } from '../types'
import { getChainFromId, CHAIN_CONFIG } from '../constants'

// Wallet provider type (MetaMask, wAIllet, etc.)
export type WalletProviderType = 'metamask' | 'waillet'

// Extend window for wallet providers
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean
      providers?: Array<Eip1193Provider & { isMetaMask?: boolean }>
      on?: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
    }
    waillet?: Eip1193Provider & {
      on?: (event: string, callback: (...args: unknown[]) => void) => void
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
    }
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
    if (window.ethereum?.providers) {
      const metamaskProvider = window.ethereum.providers.find((p) => p.isMetaMask)
      if (metamaskProvider) return metamaskProvider
    }
    if (window.ethereum?.isMetaMask) {
      return window.ethereum
    }
  }

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
  const [currentProviderType, setCurrentProviderType] = useState<WalletProviderType | null>(null)

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

      const ethersProvider = new BrowserProvider(rawProvider)
      const accounts = await ethersProvider.send('eth_requestAccounts', [])

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your wallet.')
      }

      const ethersSigner = await ethersProvider.getSigner()
      const network = await ethersProvider.getNetwork()
      const currentChainId = Number(network.chainId)
      const currentChain = getChainFromId(currentChainId)

      setAddress(accounts[0])
      setChainId(currentChainId)
      setChain(currentChain || null)
      setProvider(ethersProvider)
      setSigner(ethersSigner)
      setCurrentProviderType(providerType)
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
    setCurrentProviderType(null)
  }, [])

  // Switch chain
  const switchChain = useCallback(async (targetChain: Chain) => {
    if (!provider) {
      setError('Wallet not connected')
      return
    }

    const config = CHAIN_CONFIG[targetChain]
    const targetChainIdHex = `0x${config.chainId.toString(16)}`

    try {
      await provider.send('wallet_switchEthereumChain', [
        { chainId: targetChainIdHex }
      ])

      const network = await provider.getNetwork()
      const newChainId = Number(network.chainId)
      setChainId(newChainId)
      setChain(getChainFromId(newChainId) || null)

      const newSigner = await provider.getSigner()
      setSigner(newSigner)
    } catch (switchError: unknown) {
      const error = switchError as { code?: number }
      if (error.code === 4902) {
        try {
          await provider.send('wallet_addEthereumChain', [
            {
              chainId: targetChainIdHex,
              chainName: config.name,
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: [config.rpcUrl],
              blockExplorerUrls: [config.explorer],
            }
          ])

          const network = await provider.getNetwork()
          const newChainId = Number(network.chainId)
          setChainId(newChainId)
          setChain(getChainFromId(newChainId) || null)

          const newSigner = await provider.getSigner()
          setSigner(newSigner)
        } catch (addError) {
          const message = addError instanceof Error ? addError.message : 'Failed to add chain'
          setError(message)
          console.error('Add chain error:', addError)
        }
      } else {
        const message = switchError instanceof Error ? switchError.message : 'Failed to switch chain'
        setError(message)
        console.error('Switch chain error:', switchError)
      }
    }
  }, [provider])

  // Set up event listeners for wallet changes
  useEffect(() => {
    if (!currentProviderType) return

    const rawProvider = currentProviderType === 'waillet' ? window.waillet : window.ethereum
    if (!rawProvider?.on || !rawProvider?.removeListener) return

    // Handle account changes
    const handleAccountsChanged = async (accounts: unknown) => {
      const accountList = accounts as string[]
      if (accountList.length === 0) {
        // User disconnected their wallet
        disconnect()
      } else if (accountList[0] !== address) {
        // User switched accounts
        setAddress(accountList[0])
        if (provider) {
          const newSigner = await provider.getSigner()
          setSigner(newSigner)
        }
      }
    }

    // Handle chain changes
    const handleChainChanged = (newChainId: unknown) => {
      const chainIdNum = typeof newChainId === 'string'
        ? parseInt(newChainId, 16)
        : Number(newChainId)
      setChainId(chainIdNum)
      setChain(getChainFromId(chainIdNum) || null)

      // Reload provider and signer for new chain
      if (currentProviderType) {
        const rawProv = getRawProvider(currentProviderType)
        if (rawProv) {
          const newProvider = new BrowserProvider(rawProv)
          setProvider(newProvider)
          newProvider.getSigner().then(setSigner).catch(console.error)
        }
      }
    }

    // Add listeners
    rawProvider.on('accountsChanged', handleAccountsChanged)
    rawProvider.on('chainChanged', handleChainChanged)

    // Cleanup listeners on unmount
    return () => {
      rawProvider.removeListener?.('accountsChanged', handleAccountsChanged)
      rawProvider.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [currentProviderType, address, provider, disconnect])

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
