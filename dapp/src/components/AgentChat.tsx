import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, AlertCircle, CheckCircle } from 'lucide-react'
import type {IntentResponse} from '../types'
import { api } from '../services'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'intent'
  content: string
  timestamp: Date
  intent?: IntentResponse
}

interface AgentChatProps {
  walletAddress: string | null
  chain: string | null
  onTransfer?: (intent: IntentResponse) => void
  onSaveFavorite?: (intent: IntentResponse) => void
}

const TIMEOUT_MS = 30000 // 30 seconds

export function AgentChat({ walletAddress, chain, onTransfer, onSaveFavorite }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome! I can help you send tokens, manage favorites, and more. Try saying "send 0.1 ETH to ricardocunha.waillet" or "save binance as my exchange".',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), TIMEOUT_MS)
      })

      // Race between API call and timeout
      const intent = await Promise.race([
        api.parseIntent(userInput, walletAddress, chain || undefined),
        timeoutPromise,
      ])

      // Create response message based on intent
      let responseContent = ''

      switch (intent.action) {
        case 'TRANSFER':
          responseContent = `I'll help you send ${intent.value} ${intent.token || 'ETH'} to ${intent.to}${intent.resolved_from ? ` (resolved from "${intent.resolved_from}")` : ''}.`
          break
        case 'SAVE_FAVORITE':
          responseContent = `I'll save "${intent.alias}" as a favorite address.`
          break
        case 'LIST_FAVORITES':
          if (intent.favorites && intent.favorites.length > 0) {
            responseContent = `Here are your favorites:\n${intent.favorites.map(f => `• ${f.alias}: ${f.address}`).join('\n')}`
          } else {
            responseContent = "You don't have any favorites saved yet."
          }
          break
        case 'UNKNOWN':
          responseContent = intent.error || "I'm not sure what you want to do. Try saying something like 'send 0.1 ETH to vitalik.eth' or 'list my favorites'."
          break
        default:
          responseContent = 'Action recognized but not yet implemented.'
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: intent.action === 'TRANSFER' || intent.action === 'SAVE_FAVORITE' ? 'intent' : 'assistant',
        content: responseContent,
        timestamp: new Date(),
        intent: intent.action !== 'UNKNOWN' ? intent : undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

      let helpText = ''
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        helpText = '\n\nTip: Make sure the backend server is running at http://localhost:8000'
      } else if (errorMessage.includes('timed out')) {
        helpText = '\n\nThe request took too long. The AI service might be slow or unavailable.'
      }

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}${helpText}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
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

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Bot className="w-5 h-5 text-purple-400" />
        AI Agent
      </h2>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-4 mb-4">
        {messages.map((message) => (
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

                {/* Confidence indicator for intents */}
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

              {/* Action buttons for intent messages */}
              {message.type === 'intent' && message.intent && (
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
        ))}

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
          placeholder={walletAddress ? 'Type a command...' : 'Connect wallet to chat'}
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
    </div>
  )
}
