import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, AlertCircle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react'
import { JsonRpcSigner } from 'ethers'
import type { IntentResponse, LifiQuoteResponse } from '../types'
import { Chain } from '../types'
import { api, lifiService } from '../services'
import { useSwap } from '../hooks'
import { CHAIN_CONFIG, getChainFromName, getTokenAddress } from '../constants'
import { TOKEN_CONFIG } from '../constants'
import { SwapConfirmModal } from './SwapConfirmModal'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'intent' | 'quote'
  content: string
  timestamp: Date
  intent?: IntentResponse
  quote?: LifiQuoteResponse
}

interface AgentChatProps {
  walletAddress: string | null
  chain: string | null
  chainId: number | null
  signer: JsonRpcSigner | null
  onSwitchChain: (chain: Chain) => Promise<void>
  onTransfer?: (intent: IntentResponse) => void
  onSaveFavorite?: (intent: IntentResponse) => void
}

const TIMEOUT_MS = 30000

export function AgentChat({
  walletAddress,
  chain,
  chainId,
  signer,
  onSwitchChain,
  onTransfer,
  onSaveFavorite,
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome! I can help you swap tokens, bridge across chains, send transfers, and manage favorites. Try:\n\n• "swap 100 USDC to ETH on base"\n• "bridge 0.1 ETH from ethereum to base"\n• "send 0.1 ETH to vitalik.eth"\n• "show signals for ETH"',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSwapConfirmModal, setShowSwapConfirmModal] = useState(false)
  const [pendingQuote, setPendingQuote] = useState<LifiQuoteResponse | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const swap = useSwap()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: Date.now().toString() + Math.random().toString(36).slice(2), timestamp: new Date() },
    ])
  }

  const fetchSwapQuote = async (intent: IntentResponse, targetChain: Chain) => {
    if (!signer || !walletAddress) return

    const targetConfig = CHAIN_CONFIG[targetChain]
    const fromSymbol = intent.from_token || intent.token || 'ETH'
    const toSymbol = intent.to_token || 'USDC'

    const fromTokenAddr = getTokenAddress(fromSymbol, targetConfig.chainId)
    const toTokenAddr = getTokenAddress(toSymbol, targetConfig.chainId)

    if (!fromTokenAddr || !toTokenAddr) {
      addMessage({ type: 'assistant', content: `Token ${fromSymbol} or ${toSymbol} is not available on ${targetConfig.name}.` })
      return
    }

    const fromTokenConfig = TOKEN_CONFIG[fromSymbol as keyof typeof TOKEN_CONFIG]
    const decimals = fromTokenConfig?.decimals ?? 18
    const fromAmount = BigInt(Math.floor(parseFloat(intent.value || '0') * 10 ** decimals)).toString()

    addMessage({ type: 'assistant', content: `Fetching quote for ${intent.value} ${fromSymbol} -> ${toSymbol} on ${targetConfig.name}...` })

    const quote = await swap.fetchQuote({
      fromChain: targetConfig.chainId.toString(),
      toChain: targetConfig.chainId.toString(),
      fromToken: fromTokenAddr,
      toToken: toTokenAddr,
      fromAmount,
      fromAddress: walletAddress,
      slippage: intent.slippage?.toString() || '0.03',
    })

    if (quote) {
      setPendingQuote(quote)


      const toAmount = Number(quote.estimate.toAmount) / 10 ** quote.action.toToken.decimals
      const toAmountMin = Number(quote.estimate.toAmountMin) / 10 ** quote.action.toToken.decimals
      const gasUSD = quote.estimate.gasCosts?.reduce((s, g) => s + parseFloat(g.amountUSD || '0'), 0) || 0

      addMessage({
        type: 'quote',
        content: `Quote received:\n${intent.value} ${fromSymbol} -> ${toAmount.toFixed(6)} ${toSymbol}\nMin received: ${toAmountMin.toFixed(6)} ${toSymbol}\nEst. gas: $${gasUSD.toFixed(2)}\nProvider: ${quote.tool}\nTime: ~${Math.ceil(quote.estimate.executionDuration / 60)} min`,
        quote,
      })
    } else {
      addMessage({ type: 'assistant', content: `Failed to get quote: ${swap.error || 'Unknown error'}. Try again or adjust your parameters.` })
    }
  }

  const fetchBridgeQuote = async (intent: IntentResponse) => {
    if (!signer || !walletAddress) return

    const fromChainName = intent.from_chain
    const toChainName = intent.to_chain

    if (!fromChainName || !toChainName) {
      addMessage({ type: 'assistant', content: 'I need both source and destination chains for bridging. Try: "bridge 0.1 ETH from ethereum to base"' })
      return
    }

    const fromChain = getChainFromName(fromChainName)
    const toChain = getChainFromName(toChainName)

    if (!fromChain || !toChain) {
      addMessage({ type: 'assistant', content: `Unsupported chain: ${!fromChain ? fromChainName : toChainName}. Supported: ethereum, base, bsc` })
      return
    }

    const fromConfig = CHAIN_CONFIG[fromChain]
    const toConfig = CHAIN_CONFIG[toChain]
    const tokenSymbol = intent.from_token || intent.token || 'ETH'

    const fromTokenAddr = getTokenAddress(tokenSymbol, fromConfig.chainId)
    const toTokenAddr = getTokenAddress(tokenSymbol, toConfig.chainId)

    if (!fromTokenAddr || !toTokenAddr) {
      addMessage({ type: 'assistant', content: `Token ${tokenSymbol} is not available on ${fromConfig.name} or ${toConfig.name}.` })
      return
    }

    const tokenConfig = TOKEN_CONFIG[tokenSymbol as keyof typeof TOKEN_CONFIG]
    const decimals = tokenConfig?.decimals ?? 18
    const fromAmount = BigInt(Math.floor(parseFloat(intent.value || '0') * 10 ** decimals)).toString()

    addMessage({ type: 'assistant', content: `Fetching bridge route for ${intent.value} ${tokenSymbol} from ${fromConfig.name} to ${toConfig.name}...` })

    try {
      const quote = await lifiService.getQuote({
        fromChain: fromConfig.chainId.toString(),
        toChain: toConfig.chainId.toString(),
        fromToken: fromTokenAddr,
        toToken: toTokenAddr,
        fromAmount,
        fromAddress: walletAddress,
        slippage: intent.slippage?.toString() || '0.03',
      })

      setPendingQuote(quote)


      const toAmount = Number(quote.estimate.toAmount) / 10 ** quote.action.toToken.decimals
      const toAmountMin = Number(quote.estimate.toAmountMin) / 10 ** quote.action.toToken.decimals
      const gasUSD = quote.estimate.gasCosts?.reduce((s, g) => s + parseFloat(g.amountUSD || '0'), 0) || 0

      addMessage({
        type: 'quote',
        content: `Bridge route found:\n${intent.value} ${tokenSymbol} (${fromConfig.name}) -> ${toAmount.toFixed(6)} ${tokenSymbol} (${toConfig.name})\nMin received: ${toAmountMin.toFixed(6)} ${tokenSymbol}\nEst. gas: $${gasUSD.toFixed(2)}\nProvider: ${quote.tool}\nTime: ~${Math.ceil(quote.estimate.executionDuration / 60)} min`,
        quote,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get bridge route'
      addMessage({ type: 'assistant', content: `Bridge error: ${msg}` })
    }
  }

  const handleConfirmSwap = async () => {
    if (!signer || !pendingQuote) return

    setShowSwapConfirmModal(false)

    // Check chain match
    const requiredChainId = pendingQuote.action.fromChainId
    if (chainId !== requiredChainId) {
      const requiredChain = Object.entries(CHAIN_CONFIG).find(([, c]) => c.chainId === requiredChainId)
      if (requiredChain) {
        addMessage({ type: 'assistant', content: `Please switch to ${requiredChain[1].name} first.` })
        await onSwitchChain(requiredChain[0] as Chain)
        return
      }
    }

    addMessage({ type: 'assistant', content: 'Executing swap... Please confirm in your wallet.' })

    await swap.executeSwap(signer)

    if (swap.status === 'complete') {
      addMessage({ type: 'assistant', content: `Swap successful! TX: ${swap.txHash}` })
    }
  }

  // Watch for swap completion/error
  useEffect(() => {
    if (swap.status === 'complete' && swap.txHash) {
      addMessage({ type: 'assistant', content: `Transaction confirmed! Hash: ${swap.txHash}` })
      setPendingQuote(null)
    } else if (swap.status === 'error' && swap.error) {
      addMessage({ type: 'assistant', content: `Transaction failed: ${swap.error}` })
    }
    // Only fire on status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swap.status])

  const handleSend = async () => {
    if (!input.trim() || isLoading || !walletAddress) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const userInput = input.trim()
    setInput('')
    setIsLoading(true)

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), TIMEOUT_MS)
      })

      const intent = await Promise.race([
        api.parseIntent(userInput, walletAddress, chain || undefined),
        timeoutPromise,
      ])

      switch (intent.action) {
        case 'TRANSFER': {
          const content = `I'll help you send ${intent.value} ${intent.token || 'ETH'} to ${intent.to}${intent.resolved_from ? ` (resolved from "${intent.resolved_from}")` : ''}.`
          addMessage({ type: 'intent', content, intent })
          break
        }

        case 'SWAP': {
          addMessage({
            type: 'intent',
            content: `Swap ${intent.value} ${intent.from_token || 'ETH'} -> ${intent.to_token || 'USDC'}${intent.chain ? ` on ${intent.chain}` : ''}`,
            intent,
          })

          if (intent.needs_network && !intent.chain) {
            addMessage({
              type: 'assistant',
              content: 'Which network would you like to swap on?',
            })
            // Show chain selection buttons in the next render
            const chainOptions = [Chain.ETHEREUM, Chain.BASE, Chain.BSC]
            addMessage({
              type: 'system',
              content: `__CHAIN_SELECT__${JSON.stringify({ intent: intent, chains: chainOptions })}`,
            })
          } else {
            const targetChain = intent.chain ? getChainFromName(intent.chain) : (chain ? getChainFromName(chain) : null)
            if (targetChain) {
              await fetchSwapQuote(intent, targetChain)
            } else {
              addMessage({ type: 'assistant', content: 'Could not determine the target chain. Please specify: "swap 100 USDC to ETH on base"' })
            }
          }
          break
        }

        case 'BRIDGE': {
          addMessage({
            type: 'intent',
            content: `Bridge ${intent.value} ${intent.from_token || intent.token || 'ETH'} from ${intent.from_chain || '?'} to ${intent.to_chain || '?'}`,
            intent,
          })

          if (!intent.from_chain && intent.needs_network) {
            addMessage({ type: 'assistant', content: 'Please specify both source and destination chains. Example: "bridge 0.1 ETH from ethereum to base"' })
          } else {
            await fetchBridgeQuote(intent)
          }
          break
        }

        case 'SIGNAL': {
          const tokenHint = intent.token ? ` for ${intent.token}` : ''
          addMessage({
            type: 'assistant',
            content: `AI Signals${tokenHint} are coming soon! This feature will provide:\n\n• Real-time market analysis\n• Bullish/bearish indicators\n• Risk assessments\n• Price trend predictions\n\nCheck the AI Signals tab for a preview.`,
          })
          break
        }

        case 'SAVE_FAVORITE': {
          addMessage({ type: 'intent', content: `I'll save "${intent.alias}" as a favorite address.`, intent })
          break
        }

        case 'LIST_FAVORITES': {
          if (intent.favorites && intent.favorites.length > 0) {
            addMessage({
              type: 'assistant',
              content: `Here are your favorites:\n${intent.favorites.map((f) => `• ${f.alias}: ${f.address}`).join('\n')}`,
            })
          } else {
            addMessage({ type: 'assistant', content: "You don't have any favorites saved yet." })
          }
          break
        }

        case 'UNKNOWN':
        default: {
          addMessage({
            type: 'assistant',
            content: intent.error || "I'm not sure what you want to do. Try:\n• \"swap 100 USDC to ETH on base\"\n• \"bridge 0.1 ETH from ethereum to base\"\n• \"send 0.1 ETH to vitalik.eth\"\n• \"show signals for ETH\"",
          })
          break
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      let helpText = ''
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        helpText = '\n\nTip: Make sure the backend server is running at http://localhost:8000'
      } else if (errorMessage.includes('timed out')) {
        helpText = '\n\nThe request took too long. The AI service might be slow or unavailable.'
      }
      addMessage({ type: 'assistant', content: `Sorry, I encountered an error: ${errorMessage}${helpText}` })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAction = (message: Message) => {
    if (!message.intent) return

    if (message.intent.action === 'TRANSFER' && onTransfer) {
      onTransfer(message.intent)
    } else if (message.intent.action === 'SAVE_FAVORITE' && onSaveFavorite) {
      onSaveFavorite(message.intent)
    }
  }

  const handleChainSelect = async (intent: IntentResponse, selectedChain: Chain) => {
    await fetchSwapQuote(intent, selectedChain)
  }

  const renderMessage = (message: Message) => {
    // Handle chain selection messages
    if (message.type === 'system' && message.content.startsWith('__CHAIN_SELECT__')) {
      try {
        const data = JSON.parse(message.content.replace('__CHAIN_SELECT__', ''))
        const chainOptions = data.chains as Chain[]
        const intent = data.intent as IntentResponse

        return (
          <div key={message.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-wrap gap-2">
              {chainOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => handleChainSelect(intent, c)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
                >
                  {CHAIN_CONFIG[c].name}
                </button>
              ))}
            </div>
          </div>
        )
      } catch {
        return null
      }
    }

    // Handle quote messages
    if (message.type === 'quote' && message.quote) {
      return (
        <div key={message.id} className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="max-w-[80%]">
            <div className="p-3 bg-slate-800 rounded-lg border border-purple-600/30">
              <p className="text-sm whitespace-pre-wrap text-white">{message.content}</p>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setShowSwapConfirmModal(true)}
                disabled={swap.status !== 'idle'}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {swap.status !== 'idle' ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Processing...</>
                ) : (
                  <>Confirm <ArrowRight className="w-3 h-3" /></>
                )}
              </button>
              <button
                onClick={() => {
                  setPendingQuote(null)
                  swap.reset()
                  addMessage({ type: 'assistant', content: 'Swap cancelled.' })
                }}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Standard messages
    return (
      <div
        key={message.id}
        className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : ''}`}
      >
        {message.type !== 'user' && (
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="max-w-[80%]">
          <div
            className={`p-3 rounded-lg ${
              message.type === 'user'
                ? 'bg-purple-600 text-white'
                : message.type === 'system'
                ? 'bg-slate-800 text-slate-300'
                : 'bg-slate-800 text-white'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

            {message.intent && message.intent.confidence !== undefined && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {message.intent.confidence >= 80 ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-yellow-400" />
                )}
                <span className={message.intent.confidence >= 80 ? 'text-green-400' : 'text-yellow-400'}>
                  {message.intent.confidence}% confidence
                </span>
              </div>
            )}
          </div>

          {/* Action buttons for transfer/save intent messages */}
          {message.type === 'intent' && message.intent && (message.intent.action === 'TRANSFER' || message.intent.action === 'SAVE_FAVORITE') && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleAction(message)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
              >
                {message.intent.action === 'TRANSFER' ? 'Send Transaction' : 'Save Favorite'}
              </button>
              <button
                onClick={() => setMessages((prev) => prev.filter((m) => m.id !== message.id))}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        {message.type === 'user' && (
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Bot className="w-5 h-5 text-purple-400" />
        AI Agent
      </h2>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-4 mb-4">
        {messages.map((message) => renderMessage(message))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-800 p-3 rounded-lg">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={walletAddress ? 'Ask me to swap, bridge, send...' : 'Connect wallet to chat'}
          disabled={!walletAddress || isLoading}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={!walletAddress || !input.trim() || isLoading}
          className="p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Swap Confirm Modal */}
      {showSwapConfirmModal && pendingQuote && (
        <SwapConfirmModal
          quote={pendingQuote}
          onConfirm={handleConfirmSwap}
          onCancel={() => setShowSwapConfirmModal(false)}
          isExecuting={swap.status !== 'idle' && swap.status !== 'error'}
        />
      )}
    </div>
  )
}
