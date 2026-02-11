import { TrendingUp, TrendingDown, Bot, Clock } from 'lucide-react'

interface MockSignal {
  token: string
  direction: 'bullish' | 'bearish'
  confidence: number
  summary: string
}

const MOCK_SIGNALS: MockSignal[] = [
  { token: 'ETH', direction: 'bullish', confidence: 72, summary: 'Strong on-chain activity and institutional inflows' },
  { token: 'BTC', direction: 'bullish', confidence: 68, summary: 'Post-halving supply dynamics favorable' },
  { token: 'USDC', direction: 'bearish', confidence: 45, summary: 'Neutral - stablecoin peg holding steady' },
]

export function SignalsPanel() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">AI Trading Signals</h3>
          <p className="text-sm text-slate-400">AI-powered market insights</p>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <div className="flex items-start gap-3 p-4 bg-purple-900/20 border border-purple-700/50 rounded-lg">
        <Clock className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-purple-300 font-medium">Coming Soon</p>
          <p className="text-purple-400/70 text-sm mt-1">
            AI signals are currently in development. Here's a preview of what's coming.
          </p>
        </div>
      </div>

      {/* Mock Signal Cards */}
      <div className="space-y-3">
        {MOCK_SIGNALS.map((signal) => (
          <div
            key={signal.token}
            className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg opacity-60"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{signal.token}</span>
                {signal.direction === 'bullish' ? (
                  <div className="flex items-center gap-1 text-green-400 text-sm">
                    <TrendingUp className="w-4 h-4" />
                    <span>Bullish</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-400 text-sm">
                    <TrendingDown className="w-4 h-4" />
                    <span>Bearish</span>
                  </div>
                )}
              </div>
              <span className={`text-sm font-medium ${
                signal.confidence >= 60 ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {signal.confidence}% confidence
              </span>
            </div>
            <p className="text-sm text-slate-400">{signal.summary}</p>
          </div>
        ))}
      </div>

      {/* Features Preview */}
      <div className="bg-slate-800/30 rounded-lg p-4">
        <p className="text-sm text-slate-500 mb-3">Planned features:</p>
        <ul className="space-y-2">
          {['Real-time market analysis', 'Risk assessment per token', 'Price trend predictions', 'Custom alert rules'].map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
