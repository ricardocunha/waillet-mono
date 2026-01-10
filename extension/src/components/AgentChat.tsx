import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useWallet } from '../context/WalletContext';
import { TransactionConfirmModal } from './TransactionConfirmModal';
import type { IntentResponse } from '../types/api';
import { MessageType, IntentAction } from '../constants/enums';

interface Message {
  id: string;
  type: MessageType;
  content: string;
  intent?: IntentResponse;
  timestamp: Date;
}

export const AgentChat: React.FC = () => {
  const { account } = useWallet();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: MessageType.SYSTEM,
      content: 'Hi! I\'m your AI wallet assistant. You can ask me to send crypto, check balances, or manage favorites. Try: "send 10 USDC to ricardo" or "show my favorites"',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<IntentResponse | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !account || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: MessageType.USER,
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout - AI took too long to respond. Check backend logs.')), 30000)
      );
      
      const intent = await Promise.race([
        api.parseIntent({
          prompt: input,
          wallet_address: account.address
        }),
        timeoutPromise
      ]) as IntentResponse;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: MessageType.ASSISTANT,
        content: formatIntentResponse(intent),
        intent,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Intent Error:', error);
      
      let errorMsg = 'Failed to process your request.';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMsg = '⏱️ Request timed out. Check:\n• Backend running?\n• OpenAI API key set?\n• Internet connection?';
        } else if (error.message.includes('fetch')) {
          errorMsg = '🔌 Cannot connect to backend.\n• Is it running on http://localhost:8000?\n• Try: cd backend && uv run uvicorn app.main:app --reload';
        } else if (error.message.includes('CORS')) {
          errorMsg = '🚫 CORS error. Restart backend to apply CORS fix.';
        } else {
          errorMsg = `❌ ${error.message}`;
        }
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: MessageType.SYSTEM,
        content: errorMsg,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatIntentResponse = (intent: IntentResponse): string => {
    if (intent.error) {
      return `❌ ${intent.error}`;
    }

    if (intent.action === IntentAction.TRANSFER && intent.to && intent.value && intent.token) {
      const fromInfo = intent.resolved_from ? ` (${intent.resolved_from})` : '';
      return `I understand! You want to send **${intent.value} ${intent.token}** to ${intent.to}${fromInfo} on ${intent.chain}.\n\nClick "Send Transaction" below to proceed.`;
    }

    if (intent.action === IntentAction.UNKNOWN) {
      return `I'm not sure what you mean. Could you rephrase? For example:\n• "send 50 USDC to binance"\n• "transfer 0.1 ETH to 0x123..."\n• "show my favorites"`;
    }

    return `Parsed action: ${intent.action}\nConfidence: ${intent.confidence}%`;
  };

  const handleTransactionConfirm = (txHash: string) => {
    setShowConfirmModal(false);
    setPendingIntent(null);

    // Add success message
    const successMessage: Message = {
      id: (Date.now() + 2).toString(),
      type: MessageType.SYSTEM,
      content: `✅ Transaction sent successfully!\n\nTransaction hash: ${txHash}\n\nYou can check its status on the blockchain explorer.`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, successMessage]);
  };

  const handleTransactionCancel = () => {
    setShowConfirmModal(false);
    setPendingIntent(null);

    const cancelMessage: Message = {
      id: (Date.now() + 2).toString(),
      type: MessageType.SYSTEM,
      content: 'Transaction cancelled.',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, cancelMessage]);
  };

  const handleExecuteTransaction = (intent: IntentResponse) => {
    setPendingIntent(intent);
    setShowConfirmModal(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="bg-slate-800 p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold">AI Agent</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.type === MessageType.USER ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.type === MessageType.USER
                  ? 'bg-purple-600'
                  : message.type === MessageType.ASSISTANT
                  ? 'bg-blue-600'
                  : 'bg-slate-700'
              }`}
            >
              {message.type === MessageType.USER ? (
                <User size={16} />
              ) : message.type === MessageType.ASSISTANT ? (
                <Bot size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
            </div>

            <div
              className={`flex-1 p-3 rounded-lg ${
                message.type === MessageType.USER
                  ? 'bg-purple-600 text-white'
                  : message.type === MessageType.ASSISTANT
                  ? 'bg-slate-800 text-slate-100'
                  : 'bg-slate-700/50 text-slate-300 text-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>

              {message.intent && message.intent.action === IntentAction.TRANSFER && !message.intent.error && (
                <div className="mt-3 space-y-2">
                  <div className="p-2 bg-slate-700/50 rounded border border-slate-600 text-xs">
                    <div className="font-semibold mb-1">Transaction Preview:</div>
                    <div>To: {message.intent.to}</div>
                    <div>Amount: {message.intent.value} {message.intent.token}</div>
                    <div>Chain: {message.intent.chain}</div>
                    {message.intent.resolved_from && (
                      <div>From Favorite: {message.intent.resolved_from}</div>
                    )}
                    <div className="mt-1 text-slate-400">Confidence: {message.intent.confidence}%</div>
                  </div>
                  <button
                    onClick={() => handleExecuteTransaction(message.intent!)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm font-semibold transition-colors"
                  >
                    Send Transaction
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div className="flex-1 p-3 rounded-lg bg-slate-800">
              <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Try: send 50 USDC to binance"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 text-sm"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
        <div className="text-xs text-slate-400 mt-2">
          💡 Tip: Save favorites for quick access (e.g., "binance", "my-wallet")
        </div>
      </div>

      {showConfirmModal && pendingIntent && (
        <TransactionConfirmModal
          intent={pendingIntent}
          onConfirm={handleTransactionConfirm}
          onCancel={handleTransactionCancel}
        />
      )}
    </div>
  );
};

