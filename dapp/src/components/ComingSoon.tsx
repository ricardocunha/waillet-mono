import { Clock } from 'lucide-react'

interface ComingSoonProps {
  icon?: React.ReactNode
  title: string
  description: string
  features?: string[]
}

export function ComingSoon({ icon, title, description, features }: ComingSoonProps) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-full mb-4">
        {icon || <Clock className="w-8 h-8 text-slate-400" />}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 mb-6 max-w-md mx-auto">{description}</p>

      {features && features.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4 max-w-sm mx-auto">
          <p className="text-sm text-slate-500 mb-3">Planned features:</p>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-slate-300">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Pre-configured coming soon components for each tab
export function SwapComingSoon() {
  return (
    <ComingSoon
      title="Token Swap"
      description="Swap tokens directly within the app with best rates from multiple DEXs."
      features={[
        'Multi-DEX aggregation',
        'Best rate finder',
        'Slippage protection',
        'ETH/WETH wrapping',
      ]}
    />
  )
}

export function SendComingSoon() {
  return (
    <ComingSoon
      title="Send Tokens"
      description="Send tokens to any address or ENS name with AI-assisted validation."
      features={[
        'ENS name resolution',
        'Address book integration',
        'Gas estimation',
        'Transaction preview',
      ]}
    />
  )
}

export function SignalsComingSoon() {
  return (
    <ComingSoon
      title="AI Trading Signals"
      description="Get AI-powered trading insights and market analysis."
      features={[
        'Real-time market analysis',
        'Risk assessment',
        'Price predictions',
        'Custom alerts',
      ]}
    />
  )
}
