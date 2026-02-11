import { X, ArrowRight, Clock, Shield, Loader2 } from 'lucide-react'
import type { LifiQuoteResponse } from '../types'

interface SwapConfirmModalProps {
  quote: LifiQuoteResponse
  onConfirm: () => void
  onCancel: () => void
  isExecuting: boolean
}

function formatTokenAmount(amount: string, decimals: number): string {
  const num = Number(amount) / 10 ** decimals
  return num < 0.001 ? num.toExponential(2) : num.toFixed(6).replace(/\.?0+$/, '')
}

export function SwapConfirmModal({ quote, onConfirm, onCancel, isExecuting }: SwapConfirmModalProps) {
  const { action, estimate } = quote
  const fromAmount = formatTokenAmount(action.fromAmount, action.fromToken.decimals)
  const toAmount = formatTokenAmount(estimate.toAmount, action.toToken.decimals)
  const toAmountMin = formatTokenAmount(estimate.toAmountMin, action.toToken.decimals)

  const totalGasUSD = estimate.gasCosts?.reduce((sum, gc) => sum + parseFloat(gc.amountUSD || '0'), 0) || 0
  const executionMinutes = Math.ceil(estimate.executionDuration / 60)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Confirm Swap</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Swap Details */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-800 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{fromAmount}</p>
            <p className="text-sm text-slate-400">{action.fromToken.symbol}</p>
          </div>
          <ArrowRight className="w-6 h-6 text-purple-400 mx-4" />
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{toAmount}</p>
            <p className="text-sm text-slate-400">{action.toToken.symbol}</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Min. Received</span>
            <span className="text-white">{toAmountMin} {action.toToken.symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Slippage</span>
            <span className="text-white">{(action.slippage * 100).toFixed(1)}%</span>
          </div>
          {totalGasUSD > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Est. Gas</span>
              <span className="text-white">${totalGasUSD.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Est. Time
            </span>
            <span className="text-white">~{executionMinutes} min</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Provider
            </span>
            <span className="text-white">{quote.tool}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isExecuting}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isExecuting}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Swap'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
