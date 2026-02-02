import { useState, useEffect } from 'react'
import { JsonRpcSigner } from 'ethers'
import { ArrowDown, AlertTriangle } from 'lucide-react'
import { Chain, Token, BridgeStatus } from '../types'
import { CHAIN_CONFIG, getTargetChains, getDefaultTargetChain } from '../constants'
import { useBridge } from '../hooks'
import { ChainSelector } from './ChainSelector'
import { TokenSelector } from './TokenSelector'
import { AmountInput } from './AmountInput'

interface BridgeFormProps {
  currentChain: Chain | null
  signer: JsonRpcSigner | null
  isConnected: boolean
  onSwitchChain: (chain: Chain) => Promise<void>
  balance?: string
}

export function BridgeForm({
  currentChain,
  signer,
  isConnected,
  onSwitchChain,
  balance,
}: BridgeFormProps) {
  const [sourceChain, setSourceChain] = useState<Chain>(Chain.SEPOLIA)
  const [targetChain, setTargetChain] = useState<Chain>(Chain.BASE_SEPOLIA)
  const [token, setToken] = useState<Token>(Token.ETH)
  const [amount, setAmount] = useState<string>('')
  const [amountError, setAmountError] = useState<string>('')

  const bridge = useBridge()

  // Update target chain when source changes
  useEffect(() => {
    const defaultTarget = getDefaultTargetChain(sourceChain)
    if (defaultTarget) {
      setTargetChain(defaultTarget)
    }
  }, [sourceChain])

  // Validate amount
  useEffect(() => {
    if (!amount) {
      setAmountError('')
      return
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount)) {
      setAmountError('Invalid amount')
    } else if (numAmount < 0.001) {
      setAmountError('Minimum: 0.001 ETH')
    } else if (numAmount > 1) {
      setAmountError('Maximum: 1 ETH')
    } else if (balance && numAmount > parseFloat(balance)) {
      setAmountError('Insufficient balance')
    } else {
      setAmountError('')
    }
  }, [amount, balance])

  const handleMax = () => {
    if (balance) {
      // Leave some for gas
      const maxAmount = Math.max(0, parseFloat(balance) - 0.001)
      setAmount(maxAmount.toFixed(4))
    }
  }

  const handleBridge = async () => {
    if (!signer || !isConnected) return

    // Check if on correct chain
    if (currentChain !== sourceChain) {
      await onSwitchChain(sourceChain)
      return
    }

    await bridge.executeBridge(
      { sourceChain, targetChain, token, amount },
      signer
    )
  }

  const isChainMismatch = isConnected && currentChain !== sourceChain
  const canBridge = isConnected && amount && !amountError && bridge.status === BridgeStatus.IDLE
  const isLoading = bridge.status !== BridgeStatus.IDLE && bridge.status !== BridgeStatus.COMPLETE && bridge.status !== BridgeStatus.ERROR

  const sourceConfig = CHAIN_CONFIG[sourceChain]
  const isBridgeDeployed = sourceConfig.bridgeSourceAddress !== '0x0000000000000000000000000000000000000000'

  return (
    <div className="space-y-6">
      {/* Source Chain */}
      <ChainSelector
        label="From"
        value={sourceChain}
        onChange={setSourceChain}
        chains={[Chain.ETHEREUM, Chain.BASE, Chain.SEPOLIA, Chain.BASE_SEPOLIA]}
      />

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="bg-slate-800 p-2 rounded-lg">
          <ArrowDown className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      {/* Target Chain */}
      <ChainSelector
        label="To"
        value={targetChain}
        onChange={setTargetChain}
        chains={getTargetChains(sourceChain)}
        disabled={getTargetChains(sourceChain).length <= 1}
      />

      {/* Token */}
      <TokenSelector
        label="Token"
        value={token}
        onChange={setToken}
      />

      {/* Amount */}
      <AmountInput
        label="Amount"
        value={amount}
        onChange={setAmount}
        balance={balance}
        onMax={handleMax}
        error={amountError}
        symbol="ETH"
      />

      {/* Warnings */}
      {!isBridgeDeployed && (
        <div className="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-500 font-medium">Bridge Not Available</p>
            <p className="text-yellow-600 text-sm mt-1">
              The bridge contract is not yet deployed on {sourceConfig.name}.
            </p>
          </div>
        </div>
      )}

      {isChainMismatch && (
        <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-500 font-medium">Wrong Network</p>
            <p className="text-blue-600 text-sm mt-1">
              Please switch to {sourceConfig.name} to bridge.
            </p>
          </div>
        </div>
      )}

      {/* Bridge Button */}
      <button
        onClick={handleBridge}
        disabled={!canBridge || !isBridgeDeployed}
        className={`w-full py-4 rounded-lg font-semibold transition-colors ${
          canBridge && isBridgeDeployed
            ? 'bg-purple-600 hover:bg-purple-700 text-white'
            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
        }`}
      >
        {!isConnected
          ? 'Connect Wallet'
          : isLoading
          ? 'Processing...'
          : isChainMismatch
          ? `Switch to ${sourceConfig.name}`
          : 'Bridge ETH'}
      </button>

      {/* Error Display */}
      {bridge.error && (
        <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
          <p className="text-red-400">{bridge.error}</p>
        </div>
      )}
    </div>
  )
}
