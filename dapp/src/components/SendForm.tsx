import { useState, useEffect } from 'react'
import { JsonRpcSigner, isAddress, BrowserProvider } from 'ethers'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { Chain, Token } from '../types'
import { CHAIN_CONFIG, getChainFromId } from '../constants'
import { useSend } from '../hooks'
import { TokenSelector } from './TokenSelector'
import { AmountInput } from './AmountInput'

interface SendFormProps {
  currentChain: Chain | null
  signer: JsonRpcSigner | null
  isConnected: boolean
  onSwitchChain: (chain: Chain) => Promise<void>
  balance?: string
  prefillTo?: string
  prefillAmount?: string
  prefillToken?: Token
}

export function SendForm({
  currentChain,
  signer,
  isConnected,
  onSwitchChain,
  balance,
  prefillTo,
  prefillAmount,
  prefillToken,
}: SendFormProps) {
  const [recipient, setRecipient] = useState(prefillTo || '')
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [token, setToken] = useState<Token>(prefillToken || Token.ETH)
  const [amount, setAmount] = useState(prefillAmount || '')
  const [amountError, setAmountError] = useState('')

  const send = useSend()

  // Update prefilled values when props change
  useEffect(() => {
    if (prefillTo) setRecipient(prefillTo)
  }, [prefillTo])

  useEffect(() => {
    if (prefillAmount) setAmount(prefillAmount)
  }, [prefillAmount])

  useEffect(() => {
    if (prefillToken) setToken(prefillToken)
  }, [prefillToken])

  // Validate and resolve address
  useEffect(() => {
    if (!recipient) {
      setAddressError('')
      setResolvedAddress(null)
      return
    }

    // Direct 0x address
    if (recipient.startsWith('0x')) {
      if (isAddress(recipient)) {
        setAddressError('')
        setResolvedAddress(null)
      } else {
        setAddressError('Invalid address')
        setResolvedAddress(null)
      }
      return
    }

    // ENS name resolution
    if (recipient.endsWith('.eth')) {
      setIsResolving(true)
      setAddressError('')

      const resolveENS = async () => {
        try {
          if (!signer) {
            setAddressError('Connect wallet to resolve ENS names')
            return
          }
          const provider = signer.provider as BrowserProvider
          const resolved = await provider.resolveName(recipient)
          if (resolved) {
            setResolvedAddress(resolved)
            setAddressError('')
          } else {
            setResolvedAddress(null)
            setAddressError('ENS name not found')
          }
        } catch {
          setResolvedAddress(null)
          setAddressError('Failed to resolve ENS name')
        } finally {
          setIsResolving(false)
        }
      }

      const timeout = setTimeout(resolveENS, 500)
      return () => clearTimeout(timeout)
    }

    setAddressError('Enter a valid 0x address or ENS name')
    setResolvedAddress(null)
  }, [recipient, signer])

  // Validate amount
  useEffect(() => {
    if (!amount) {
      setAmountError('')
      return
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Invalid amount')
    } else if (balance && numAmount > parseFloat(balance)) {
      setAmountError('Insufficient balance')
    } else {
      setAmountError('')
    }
  }, [amount, balance])

  const handleMax = () => {
    if (balance) {
      const maxAmount = Math.max(0, parseFloat(balance) - 0.001)
      setAmount(maxAmount.toFixed(4))
    }
  }

  const handleSend = async () => {
    if (!signer || !isConnected) return

    const toAddress = resolvedAddress || recipient
    if (!isAddress(toAddress)) return

    const chainId = currentChain ? CHAIN_CONFIG[currentChain].chainId : 1

    await send.executeSend(
      { to: toAddress, amount, token, chainId },
      signer
    )
  }

  const effectiveAddress = resolvedAddress || recipient
  const isValidAddress = effectiveAddress && isAddress(effectiveAddress) && !addressError
  const canSend = isConnected && amount && !amountError && isValidAddress && send.status === 'idle' && !isResolving
  const isLoading = send.status === 'confirming' || send.status === 'pending'
  const chainConfig = currentChain ? CHAIN_CONFIG[currentChain] : null

  return (
    <div className="space-y-6">
      {/* Recipient Address */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">
          Recipient
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x... or name.eth"
          className={`w-full bg-slate-800 border ${
            addressError ? 'border-red-500' : 'border-slate-700'
          } rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500`}
        />
        <div className="mt-2 text-sm">
          {isResolving && (
            <span className="text-slate-400">Resolving...</span>
          )}
          {resolvedAddress && !addressError && (
            <span className="text-green-400">
              Resolved: {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
            </span>
          )}
          {addressError && (
            <span className="text-red-400">{addressError}</span>
          )}
        </div>
      </div>

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
        symbol={token}
      />

      {/* Not Connected Warning */}
      {!isConnected && (
        <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-blue-400 text-sm">Connect your wallet to send tokens.</p>
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={!canSend}
        className={`w-full py-4 rounded-lg font-semibold transition-colors ${
          canSend
            ? 'bg-purple-600 hover:bg-purple-700 text-white'
            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
        }`}
      >
        {!isConnected
          ? 'Connect Wallet'
          : isLoading
          ? send.status === 'confirming'
            ? 'Confirm in Wallet...'
            : 'Sending...'
          : send.status === 'complete'
          ? 'Send Complete!'
          : 'Send'}
      </button>

      {/* Error Display */}
      {send.error && (
        <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
          <p className="text-red-400">{send.error}</p>
          <button
            onClick={send.reset}
            className="mt-2 text-sm text-red-300 underline hover:text-red-200"
          >
            Try again
          </button>
        </div>
      )}

      {/* Success */}
      {send.status === 'complete' && send.txHash && chainConfig && (
        <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
          <p className="text-green-400 font-medium">Transaction sent successfully!</p>
          <a
            href={`${chainConfig.explorer}/tx/${send.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-green-300 underline hover:text-green-200 mt-1 inline-flex items-center gap-1"
          >
            View on Explorer <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  )
}
