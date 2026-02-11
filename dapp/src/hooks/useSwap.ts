import { useState, useCallback } from 'react'
import { JsonRpcSigner, Contract } from 'ethers'
import type { LifiQuoteResponse } from '../types'
import { lifiService, type LifiQuoteParams } from '../services/lifi'

export type SwapStatus = 'idle' | 'quoting' | 'approving' | 'confirming' | 'pending' | 'complete' | 'error'

export interface UseSwapReturn {
  status: SwapStatus
  quote: LifiQuoteResponse | null
  error: string | null
  txHash: string | null
  fetchQuote: (params: LifiQuoteParams) => Promise<LifiQuoteResponse | null>
  executeSwap: (signer: JsonRpcSigner) => Promise<void>
  reset: () => void
}

const ERC20_APPROVE_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]

export function useSwap(): UseSwapReturn {
  const [status, setStatus] = useState<SwapStatus>('idle')
  const [quote, setQuote] = useState<LifiQuoteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setQuote(null)
    setError(null)
    setTxHash(null)
  }, [])

  const fetchQuote = useCallback(async (params: LifiQuoteParams): Promise<LifiQuoteResponse | null> => {
    try {
      setStatus('quoting')
      setError(null)
      const result = await lifiService.getQuote(params)
      setQuote(result)
      setStatus('idle')
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get quote'
      setError(message)
      setStatus('error')
      return null
    }
  }, [])

  const executeSwap = useCallback(async (signer: JsonRpcSigner) => {
    if (!quote) {
      setError('No quote available')
      return
    }

    try {
      const { transactionRequest, estimate } = quote

      // Handle ERC20 approval if needed
      if (estimate.approvalAddress && quote.action.fromToken.address !== '0x0000000000000000000000000000000000000000') {
        setStatus('approving')

        const tokenContract = new Contract(
          quote.action.fromToken.address,
          ERC20_APPROVE_ABI,
          signer
        )

        const ownerAddress = await signer.getAddress()
        const currentAllowance = await tokenContract.allowance(ownerAddress, estimate.approvalAddress)

        if (BigInt(currentAllowance) < BigInt(quote.action.fromAmount)) {
          const approveTx = await tokenContract.approve(
            estimate.approvalAddress,
            quote.action.fromAmount
          )
          await approveTx.wait()
        }
      }

      // Execute the swap transaction
      setStatus('confirming')

      const tx = await signer.sendTransaction({
        to: transactionRequest.to,
        data: transactionRequest.data,
        value: transactionRequest.value,
        gasLimit: transactionRequest.gasLimit || undefined,
      })

      setTxHash(tx.hash)
      setStatus('pending')

      await tx.wait()
      setStatus('complete')
    } catch (err: unknown) {
      setStatus('error')
      const error = err as { code?: string | number; message?: string }
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        setError('Transaction rejected by user')
      } else {
        setError(error.message || 'Swap transaction failed')
      }
    }
  }, [quote])

  return {
    status,
    quote,
    error,
    txHash,
    fetchQuote,
    executeSwap,
    reset,
  }
}