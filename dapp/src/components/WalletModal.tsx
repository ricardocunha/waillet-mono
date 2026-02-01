import { useEffect, useRef } from 'react'
import { X, Wallet, AlertCircle } from 'lucide-react'
import { detectWallets } from '../hooks'
import type { WalletProviderType } from '../hooks'

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
  onConnect: (providerType: WalletProviderType) => void
  isConnecting: boolean
}

export function WalletModal({ isOpen, onClose, onConnect, isConnecting }: WalletModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const wallets = detectWallets()

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const walletOptions: { type: WalletProviderType; name: string; available: boolean }[] = [
    { type: 'waillet', name: 'wAIllet', available: wallets.waillet },
    { type: 'metamask', name: 'MetaMask', available: wallets.metamask },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-slate-900 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wallet Options */}
        <div className="space-y-3">
          {walletOptions.map((wallet) => (
            <button
              key={wallet.type}
              onClick={() => wallet.available && onConnect(wallet.type)}
              disabled={!wallet.available || isConnecting}
              className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
                wallet.available
                  ? 'border-slate-700 hover:border-purple-500 hover:bg-slate-800 cursor-pointer'
                  : 'border-slate-800 bg-slate-800/50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${wallet.available ? 'bg-purple-600' : 'bg-slate-700'}`}>
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <span className={`font-medium ${wallet.available ? 'text-white' : 'text-slate-500'}`}>
                  {wallet.name}
                </span>
              </div>
              {!wallet.available && (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Not installed</span>
                </div>
              )}
              {wallet.available && isConnecting && (
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              )}
            </button>
          ))}
        </div>

        {/* Help text */}
        <p className="mt-4 text-sm text-slate-400 text-center">
          Don't have a wallet?{' '}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300"
          >
            Get MetaMask
          </a>
        </p>
      </div>
    </div>
  )
}
