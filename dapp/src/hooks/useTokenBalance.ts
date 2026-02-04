import { useState, useEffect, useCallback } from 'react'
import { BrowserProvider } from 'ethers'
import { formatEth } from '../constants'

const REFRESH_INTERVAL = 15000 // 15 seconds

export interface UseTokenBalanceReturn {
  balance: string
  balanceWei: bigint
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useTokenBalance(
  address: string | null,
  provider: BrowserProvider | null
): UseTokenBalanceReturn {
  const [balance, setBalance] = useState<string>('0.0000')
  const [balanceWei, setBalanceWei] = useState<bigint>(BigInt(0))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!address || !provider) {
      setBalance('0.0000')
      setBalanceWei(BigInt(0))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const wei = await provider.getBalance(address)
      setBalanceWei(wei)
      setBalance(formatEth(wei))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch balance'
      setError(message)
      console.error('Balance fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [address, provider])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Auto-refresh interval
  useEffect(() => {
    if (!address || !provider) return

    const interval = setInterval(fetchBalance, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [address, provider, fetchBalance])

  return {
    balance,
    balanceWei,
    isLoading,
    error,
    refetch: fetchBalance,
  }
}
