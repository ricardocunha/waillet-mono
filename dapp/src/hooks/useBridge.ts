import { useState, useCallback } from 'react'
import { Contract, parseEther, JsonRpcSigner } from 'ethers'
import { BridgeStatus, type BridgeParams, type BridgeResult } from '../types'
import { CHAIN_CONFIG, getChainId } from '../constants'
import BridgeSourceABI from '../abis/BridgeSource.json'

export interface UseBridgeReturn {
  status: BridgeStatus
  error: string | null
  txHash: string | null
  result: BridgeResult | null
  executeBridge: (params: BridgeParams, signer: JsonRpcSigner) => Promise<void>
  reset: () => void
}

export function useBridge(): UseBridgeReturn {
  const [status, setStatus] = useState<BridgeStatus>(BridgeStatus.IDLE)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [result, setResult] = useState<BridgeResult | null>(null)

  const reset = useCallback(() => {
    setStatus(BridgeStatus.IDLE)
    setError(null)
    setTxHash(null)
    setResult(null)
  }, [])

  const executeBridge = useCallback(async (params: BridgeParams, signer: JsonRpcSigner) => {
    const { sourceChain, targetChain, amount } = params

    try {
      setStatus(BridgeStatus.CONFIRMING)
      setError(null)

      const sourceConfig = CHAIN_CONFIG[sourceChain]
      const bridgeAddress = sourceConfig.bridgeSourceAddress

      // Check if bridge is deployed
      if (bridgeAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Bridge contract not deployed on this network')
      }

      // Create contract instance
      const contract = new Contract(bridgeAddress, BridgeSourceABI, signer)

      // Check if bridge is paused
      const isPaused = await contract.paused()
      if (isPaused) {
        throw new Error('Bridge is currently paused')
      }

      // Parse amount
      const amountWei = parseEther(amount)

      // Check min/max amounts
      const minAmount = await contract.minAmount()
      const maxAmount = await contract.maxAmount()

      if (amountWei < minAmount) {
        throw new Error(`Minimum amount is ${Number(minAmount) / 1e18} ETH`)
      }

      if (amountWei > maxAmount) {
        throw new Error(`Maximum amount is ${Number(maxAmount) / 1e18} ETH`)
      }

      // Get target chain ID
      const targetChainId = getChainId(targetChain)

      setStatus(BridgeStatus.LOCKING)

      // Execute lock transaction
      const tx = await contract.lock(targetChainId, { value: amountWei })
      setTxHash(tx.hash)

      // Wait for confirmation
      const receipt = await tx.wait()

      // Parse TokensLocked event to get nonce
      const lockEvent = receipt.logs.find((log: { topics: string[]; data: string }) => {
        try {
          const parsed = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data as string
          })
          return parsed?.name === 'TokensLocked'
        } catch {
          return false
        }
      })

      let nonce = BigInt(0)
      if (lockEvent) {
        const parsed = contract.interface.parseLog({
          topics: lockEvent.topics as string[],
          data: lockEvent.data as string
        })
        nonce = parsed?.args?.nonce || BigInt(0)
      }

      setStatus(BridgeStatus.LOCKED)

      // Set result
      setResult({
        txHash: tx.hash,
        nonce,
        amount,
        sourceChain,
        targetChain,
      })

      // Simulate bridging delay (in production, this would be handled by a relayer)
      setStatus(BridgeStatus.BRIDGING)

      // After a short delay, mark as complete
      setTimeout(() => {
        setStatus(BridgeStatus.COMPLETE)
      }, 3000)

    } catch (err: unknown) {
      setStatus(BridgeStatus.ERROR)

      // Handle user rejection
      const error = err as { code?: string | number; message?: string }
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        setError('Transaction rejected by user')
      } else {
        setError(error.message || 'Bridge transaction failed')
      }

      console.error('Bridge error:', err)
    }
  }, [])

  return {
    status,
    error,
    txHash,
    result,
    executeBridge,
    reset,
  }
}
