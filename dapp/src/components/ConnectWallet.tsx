import { Wallet, LogOut, Loader2 } from 'lucide-react'
import { formatAddress } from '../constants'

interface ConnectWalletProps {
  address: string | null
  isConnecting: boolean
  onConnect: () => void
  onDisconnect: () => void
}

export function ConnectWallet({
  address,
  isConnecting,
  onConnect,
  onDisconnect,
}: ConnectWalletProps) {
  if (isConnecting) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg cursor-not-allowed"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Connecting...</span>
      </button>
    )
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-white font-medium">{formatAddress(address)}</span>
        </div>
        <button
          onClick={onDisconnect}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Disconnect"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onConnect}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
    >
      <Wallet className="w-4 h-4" />
      <span>Connect Wallet</span>
    </button>
  )
}
