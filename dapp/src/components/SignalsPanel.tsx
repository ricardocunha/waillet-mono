import { TrendingUp, TrendingDown, Minus, Bot, RefreshCw, AlertCircle } from 'lucide-react'
import { useSignals } from '../hooks'

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  if (price >= 1) return `$${price.toFixed(2)}`
  return `$${price.toFixed(4)}`
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`
  return `$${cap.toLocaleString()}`
}

export function SignalsPanel() {
  const { signals, isLoading, error, refetch } = useSignals()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">AI Trading Signals</h3>
            <p className="text-sm text-slate-400">Market insights from live data</p>
          </div>
        </div>
        <button
          onClick={refetch}
          disabled={isLoading}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && signals.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="h-5 w-20 bg-slate-700 rounded" />
                <div className="h-4 w-16 bg-slate-700 rounded" />
              </div>
              <div className="h-4 w-full bg-slate-700 rounded mt-2" />
            </div>
          ))}
        </div>
      )}

      {/* Signal Cards */}
      {signals.length > 0 && (
        <div className="space-y-3">
          {signals.map((signal) => (
            <div
              key={signal.symbol}
              className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{signal.symbol}</span>
                  {signal.direction === 'bullish' ? (
                    <div className="flex items-center gap-1 text-green-400 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      <span>Bullish</span>
                    </div>
                  ) : signal.direction === 'bearish' ? (
                    <div className="flex items-center gap-1 text-red-400 text-sm">
                      <TrendingDown className="w-4 h-4" />
                      <span>Bearish</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-yellow-400 text-sm">
                      <Minus className="w-4 h-4" />
                      <span>Neutral</span>
                    </div>
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  signal.confidence >= 60 ? 'text-green-400' : signal.confidence >= 30 ? 'text-yellow-400' : 'text-slate-400'
                }`}>
                  {signal.confidence}% confidence
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-white font-medium">{formatPrice(signal.price)}</span>
                <div className="flex items-center gap-3">
                  <span className={signal.percentChange24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                    24h: {signal.percentChange24h >= 0 ? '+' : ''}{signal.percentChange24h.toFixed(2)}%
                  </span>
                  <span className={signal.percentChange7d >= 0 ? 'text-green-400' : 'text-red-400'}>
                    7d: {signal.percentChange7d >= 0 ? '+' : ''}{signal.percentChange7d.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                <span>{signal.name}</span>
                <span>MCap: {formatMarketCap(signal.marketCap)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && signals.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <p>No signal data available.</p>
          <button onClick={refetch} className="mt-2 text-purple-400 underline text-sm">
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
