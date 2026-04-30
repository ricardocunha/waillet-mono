import { useState, useCallback } from 'react'
import { Contract, parseEther, parseUnits, JsonRpcSigner } from 'ethers'
import { Token } from '../types'
import { getTokenAddress, NATIVE_TOKEN_ADDRESS, TOKEN_CONFIG } from '../constants'

export type SendStatus = 'idle' | 'confirming' | 'pending' | 'complete' | 'error'

export interface SendParams {
  to: string
  amount: string
  token: Token
  chainId: number
}

export interface UseSendReturn {
  status: SendStatus
  error: string | null
  txHash: string | null
  executeSend: (params: SendParams, signer: JsonRpcSigner) => Promise<void>
  reset: () => void
}

const ERC20_TRANSFER_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
]

export function useSend(): UseSendReturn {
  const [status, setStatus] = useState<SendStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setTxHash(null)
  }, [])

  const executeSend = useCallback(async (params: SendParams, signer: JsonRpcSigner) => {
    const { to, amount, token, chainId } = params

    try {
      setStatus('confirming')
      setError(null)
      setTxHash(null)

      const tokenAddress = getTokenAddress(token, chainId)
      const isNativeToken = !tokenAddress || tokenAddress === NATIVE_TOKEN_ADDRESS

      let tx

      if (isNativeToken) {
        // Send native ETH
        tx = await signer.sendTransaction({
          to,
          value: parseEther(amount),
        })
      } else {
        // Send ERC-20 token
        const tokenConfig = TOKEN_CONFIG[token as keyof typeof TOKEN_CONFIG]
        const decimals = tokenConfig?.decimals ?? 18
        const parsedAmount = parseUnits(amount, decimals)

        const contract = new Contract(tokenAddress, ERC20_TRANSFER_ABI, signer)
        tx = await contract.transfer(to, parsedAmount)
      }

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
        setError(error.message || 'Send transaction failed')
      }
    }
  }, [])

  return {
    status,
    error,
    txHash,
    executeSend,
    reset,
  }
}
