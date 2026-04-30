import { useState, useCallback, useEffect, useRef } from 'react'
import type { TokenSignal } from '../types'
import { api } from '../services'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

function deriveSignal(
  symbol: string,
  name: string,
  price: number,
  change24h: number,
  change7d: number,
  marketCap: number,
  volume: number
): TokenSignal {
  let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  if (change24h > 2) direction = 'bullish'
  else if (change24h < -2) direction = 'bearish'

  // Confidence based on magnitude of change and volume relative to market cap
  const changeMagnitude = Math.min(Math.abs(change24h) * 5, 50)
  const volumeRatio = marketCap > 0 ? Math.min((volume / marketCap) * 100, 50) : 0
  const confidence = Math.round(Math.min(changeMagnitude + volumeRatio, 95))

  return {
    symbol,
    name,
    price,
    percentChange24h: change24h,
    percentChange7d: change7d,
    marketCap,
    volume24h: volume,
    direction,
    confidence: Math.max(confidence, 10),
  }
}

export interface UseSignalsReturn {
  signals: TokenSignal[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useSignals(): UseSignalsReturn {
  const [signals, setSignals] = useState<TokenSignal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSignals = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const tokens = await api.getTokenList(20)
      const derived = tokens.map((t) =>
        deriveSignal(
          t.symbol,
          t.name,
          t.price_usd ?? 0,
          t.percent_change_24h ?? 0,
          t.percent_change_7d ?? 0,
          t.market_cap_usd ?? 0,
          t.volume_24h_usd ?? 0
        )
      )
      setSignals(derived)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch signals'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSignals()
    intervalRef.current = setInterval(fetchSignals, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchSignals])

  return {
    signals,
    isLoading,
    error,
    refetch: fetchSignals,
  }
}
