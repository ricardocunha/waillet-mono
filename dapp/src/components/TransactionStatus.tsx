import { ExternalLink, Check, Loader2, AlertCircle } from 'lucide-react'
import { BridgeStatus, type BridgeResult, Chain } from '../types'
import { getExplorerTxUrl, CHAIN_CONFIG } from '../constants'

interface TransactionStatusProps {
  status: BridgeStatus
  result: BridgeResult | null
  txHash: string | null
  onReset: () => void
}

const statusConfig: Record<BridgeStatus, { label: string; color: string }> = {
  [BridgeStatus.IDLE]: { label: 'Ready', color: 'slate' },
  [BridgeStatus.CONNECTING]: { label: 'Connecting...', color: 'blue' },
  [BridgeStatus.SWITCHING_CHAIN]: { label: 'Switching Chain...', color: 'blue' },
  [BridgeStatus.CONFIRMING]: { label: 'Confirm in Wallet', color: 'yellow' },
  [BridgeStatus.LOCKING]: { label: 'Locking ETH...', color: 'blue' },
  [BridgeStatus.LOCKED]: { label: 'ETH Locked', color: 'green' },
  [BridgeStatus.BRIDGING]: { label: 'Bridging...', color: 'purple' },
  [BridgeStatus.COMPLETE]: { label: 'Complete', color: 'green' },
  [BridgeStatus.ERROR]: { label: 'Failed', color: 'red' },
}

export function TransactionStatus({ status, result, txHash, onReset }: TransactionStatusProps) {
  if (status === BridgeStatus.IDLE) return null

  const config = statusConfig[status]
  const isComplete = status === BridgeStatus.COMPLETE
  const isError = status === BridgeStatus.ERROR
  const isLoading = !isComplete && !isError

  return (
    <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {isLoading && (
            <Loader2 className={`w-5 h-5 text-${config.color}-500 animate-spin`} />
          )}
          {isComplete && (
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
          {isError && (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span className={`font-medium text-${config.color}-400`}>{config.label}</span>
        </div>

        {(isComplete || isError) && (
          <button
            onClick={onReset}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            New Bridge
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { status: BridgeStatus.CONFIRMING, label: 'Confirm' },
          { status: BridgeStatus.LOCKING, label: 'Lock' },
          { status: BridgeStatus.BRIDGING, label: 'Bridge' },
          { status: BridgeStatus.COMPLETE, label: 'Done' },
        ].map((step, index) => {
          const stepOrder: BridgeStatus[] = [BridgeStatus.CONFIRMING, BridgeStatus.LOCKING, BridgeStatus.LOCKED, BridgeStatus.BRIDGING, BridgeStatus.COMPLETE]
          const currentIndex = stepOrder.indexOf(status as BridgeStatus)
          const stepIndex = stepOrder.indexOf(step.status)
          const isActive = currentIndex >= stepIndex

          return (
            <div key={step.status} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {index + 1}
              </div>
              <span className={`text-xs ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                {step.label}
              </span>
              {index < 3 && (
                <div className={`flex-1 h-0.5 ${isActive ? 'bg-purple-600' : 'bg-slate-700'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Transaction Details */}
      {result && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Amount:</span>
            <span className="text-white">{result.amount} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Route:</span>
            <span className="text-white">
              {CHAIN_CONFIG[result.sourceChain].name} → {CHAIN_CONFIG[result.targetChain].name}
            </span>
          </div>
          {result.nonce > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Lock Nonce:</span>
              <span className="text-white">#{result.nonce.toString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Explorer Link */}
      {txHash && (
        <a
          href={getExplorerTxUrl(result?.sourceChain || Chain.SEPOLIA, txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
        >
          <span>View on Explorer</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  )
}
