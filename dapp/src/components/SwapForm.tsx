import { useState, useEffect } from 'react'
import { JsonRpcSigner } from 'ethers'
import { ArrowDown, AlertTriangle, Loader2 } from 'lucide-react'
import { Chain, Token } from '../types'
import { CHAIN_CONFIG, getTokenAddress } from '../constants'
import { useSwap } from '../hooks'
import { ChainSelector } from './ChainSelector'
import { TokenSelector } from './TokenSelector'
import { AmountInput } from './AmountInput'
import { SwapConfirmModal } from './SwapConfirmModal'
import { TOKEN_CONFIG } from '../constants/tokens'

interface SwapFormProps {
  currentChain: Chain | null
  signer: JsonRpcSigner | null
  isConnected: boolean
  onSwitchChain: (chain: Chain) => Promise<void>
  balance?: string
}

const MAINNET_CHAINS: Chain[] = [Chain.ETHEREUM, Chain.BASE, Chain.BSC]

export function SwapForm({
  currentChain,
  signer,
  isConnected,
  onSwitchChain,
  balance,
}: SwapFormProps) {
  const [chain, setChain] = useState<Chain>(Chain.ETHEREUM)
  const [fromToken, setFromToken] = useState<Token>(Token.ETH)
  const [toToken, setToToken] = useState<Token>(Token.USDC)
  const [amount, setAmount] = useState<string>('')
  const [amountError, setAmountError] = useState<string>('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const swap = useSwap()

  // Validate amount
  useEffect(() => {
    if (!amount) {
      setAmountError('')
      return
    }
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Invalid amount')
    } else if (balance && numAmount > parseFloat(balance) && fromToken === Token.ETH) {
      setAmountError('Insufficient balance')
    } else {
      setAmountError('')
    }
  }, [amount, balance, fromToken])

  const isTestnet = currentChain ? CHAIN_CONFIG[currentChain].isTestnet : false
  const chainConfig = CHAIN_CONFIG[chain]

  const handleGetQuote = async () => {
    if (!amount || amountError || !isConnected || !signer) return

    const fromTokenAddress = getTokenAddress(fromToken, chainConfig.chainId)
    const toTokenAddress = getTokenAddress(toToken, chainConfig.chainId)

    if (!fromTokenAddress || !toTokenAddress) {
      setAmountError('Token not available on this chain')
      return
    }

    const decimals = TOKEN_CONFIG[fromToken].decimals
    const fromAmount = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals)).toString()
    const fromAddress = await signer.getAddress()

    const result = await swap.fetchQuote({
      fromChain: chainConfig.chainId.toString(),
      toChain: chainConfig.chainId.toString(),
      fromToken: fromTokenAddress,
      toToken: toTokenAddress,
      fromAmount,
      fromAddress,
      slippage: '0.03',
    })

    if (result) {
      setShowConfirmModal(true)
    }
  }

  const handleConfirmSwap = async () => {
    if (!signer) return
    setShowConfirmModal(false)

    // Check if on correct chain
    if (currentChain !== chain) {
      await onSwitchChain(chain)
      return
    }

    await swap.executeSwap(signer)
  }

  const handleMax = () => {
    if (balance && fromToken === Token.ETH) {
      const maxAmount = Math.max(0, parseFloat(balance) - 0.005)
      setAmount(maxAmount > 0 ? maxAmount.toFixed(6) : '0')
    }
  }

  const isChainMismatch = isConnected && currentChain !== chain
  const canGetQuote = isConnected && amount && !amountError && fromToken !== toToken && swap.status === 'idle'

  return (
    <div className="space-y-6">
      {/* Testnet Warning */}
      {isTestnet && (
        <div className="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-500 font-medium">Testnet Detected</p>
            <p className="text-yellow-600 text-sm mt-1">
              LI.FI swaps are only available on mainnet. Please switch to a mainnet network.
            </p>
          </div>
        </div>
      )}

      {/* Chain */}
      <ChainSelector
        label="Network"
        value={chain}
        onChange={setChain}
        chains={MAINNET_CHAINS}
      />

      {/* From Token + Amount */}
      <div>
        <TokenSelector
          label="From"
          value={fromToken}
          onChange={setFromToken}
        />
        <div className="mt-2">
          <AmountInput
            value={amount}
            onChange={setAmount}
            balance={fromToken === Token.ETH ? balance : undefined}
            onMax={fromToken === Token.ETH ? handleMax : undefined}
            error={amountError}
            symbol={fromToken}
          />
        </div>
      </div>

      {/* Swap Arrow */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => {
            const temp = fromToken
            setFromToken(toToken)
            setToToken(temp)
          }}
          className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <ArrowDown className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* To Token */}
      <TokenSelector
        label="To"
        value={toToken}
        onChange={setToToken}
      />

      {fromToken === toToken && (
        <p className="text-yellow-400 text-sm">Select different tokens to swap</p>
      )}

      {/* Chain Mismatch */}
      {isChainMismatch && (
        <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-500 font-medium">Wrong Network</p>
            <p className="text-blue-600 text-sm mt-1">
              Please switch to {chainConfig.name} to swap.
            </p>
          </div>
        </div>
      )}

      {/* Get Quote / Execute Button */}
      <button
        onClick={isChainMismatch ? () => onSwitchChain(chain) : handleGetQuote}
        disabled={!canGetQuote && !isChainMismatch}
        className={`w-full py-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
          (canGetQuote || isChainMismatch)
            ? 'bg-purple-600 hover:bg-purple-700 text-white'
            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
        }`}
      >
        {swap.status === 'quoting' && <Loader2 className="w-5 h-5 animate-spin" />}
        {!isConnected
          ? 'Connect Wallet'
          : isChainMismatch
          ? `Switch to ${chainConfig.name}`
          : swap.status === 'quoting'
          ? 'Getting Quote...'
          : swap.status === 'approving'
          ? 'Approving Token...'
          : swap.status === 'confirming'
          ? 'Confirm in Wallet...'
          : swap.status === 'pending'
          ? 'Swap Pending...'
          : swap.status === 'complete'
          ? 'Swap Complete!'
          : 'Get Quote'}
      </button>

      {/* Error Display */}
      {swap.error && (
        <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
          <p className="text-red-400">{swap.error}</p>
          <button
            onClick={swap.reset}
            className="mt-2 text-sm text-red-300 underline hover:text-red-200"
          >
            Try again
          </button>
        </div>
      )}

      {/* Success */}
      {swap.status === 'complete' && swap.txHash && (
        <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
          <p className="text-green-400 font-medium">Swap successful!</p>
          <a
            href={`${chainConfig.explorer}/tx/${swap.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-green-300 underline hover:text-green-200 mt-1 block"
          >
            View on Explorer
          </a>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && swap.quote && (
        <SwapConfirmModal
          quote={swap.quote}
          onConfirm={handleConfirmSwap}
          onCancel={() => setShowConfirmModal(false)}
          isExecuting={swap.status !== 'idle' && swap.status !== 'error'}
        />
      )}
    </div>
  )
}
