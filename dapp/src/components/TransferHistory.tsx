import { useState, useEffect, useCallback } from 'react'
import { ArrowDownLeft, ArrowUpRight, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'
import { Chain } from '../types'
import { formatAddress, CHAIN_CONFIG } from '../constants'
import { fetchTransactionHistory, type TransactionDisplay } from '../services/etherscan'

interface TransferHistoryProps {
  address: string | null
  chain: Chain | null
}

export function TransferHistory({ address, chain }: TransferHistoryProps) {
  const [transactions, setTransactions] = useState<TransactionDisplay[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    if (!address || !chain) {
      setTransactions([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const txs = await fetchTransactionHistory(address, chain)
      setTransactions(txs)
    } catch (err) {
      setError('Failed to load transaction history')
      console.error('History load error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [address, chain])

  // Load on mount and when dependencies change
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  if (!address) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
        <p className="text-slate-400 text-center py-8">
          Connect your wallet to view transaction history
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Transaction History</h2>
        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Chain indicator */}
      {chain && (
        <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: CHAIN_CONFIG[chain].color }}
          />
          <span>{CHAIN_CONFIG[chain].name}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/50 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Transaction List */}
      {isLoading && transactions.length === 0 ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No transactions found</div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto hide-scrollbar">
          {transactions.map((tx) => (
            <a
              key={tx.hash}
              href={tx.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tx.isIncoming ? 'bg-green-900/30' : 'bg-blue-900/30'}`}>
                  {tx.isIncoming ? (
                    <ArrowDownLeft className="w-4 h-4 text-green-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">
                      {tx.isIncoming ? 'Received' : 'Sent'}
                    </span>
                    {tx.isFailed && (
                      <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">
                        Failed
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-sm">
                    {tx.isIncoming ? `From ${formatAddress(tx.from)}` : `To ${formatAddress(tx.to)}`}
                  </span>
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <div className={`font-medium ${tx.isIncoming ? 'text-green-400' : 'text-white'}`}>
                    {tx.isIncoming ? '+' : '-'}{tx.value} ETH
                  </div>
                  <div className="text-slate-500 text-sm">{tx.relativeTime}</div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
