import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, AlertCircle, Loader2, Star, Trash2, Globe } from 'lucide-react';
import { api } from '../services/api';
import { useWallet } from '../context/WalletContext';
import { TransactionConfirmModal } from './TransactionConfirmModal';
import { SaveFavoriteModal } from './SaveFavoriteModal';
import { CHAINS } from '../services/wallet';
import type { IntentResponse } from '../types/api';
import { MessageType, IntentAction } from '../constants/enums';
import { loadChatHistory, saveChatHistory, toStoredMessage, fromStoredMessage } from '../utils/chatStorage';

interface Message {
  id: string;
  type: MessageType;
  content: string;
  intent?: IntentResponse;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  type: MessageType.SYSTEM,
  content: 'Hi! I\'m your AI wallet assistant. You can ask me to send crypto, check balances, or manage favorites. Try: "send 10 USDC to ricardo" or "show my favorites"',
  timestamp: new Date()
};

export const AgentChat: React.FC = () => {
  const { account } = useWallet();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<IntentResponse | null>(null);
  const [saveFavoriteIntent, setSaveFavoriteIntent] = useState<IntentResponse | null>(null);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load chat history from storage on mount
  useEffect(() => {
    if (!account?.address) return;

    const loadHistory = async () => {
      const storedMessages = await loadChatHistory(account.address);
      if (storedMessages.length > 0) {
        // Convert stored messages back to Message format with Date objects
        const loadedMessages = storedMessages.map(fromStoredMessage);
        setMessages([WELCOME_MESSAGE, ...loadedMessages]);
      }
      setIsHistoryLoaded(true);
    };

    loadHistory();
  }, [account?.address]);

  // Save chat history when messages change (skip welcome message)
  const saveHistory = useCallback(async (msgs: Message[]) => {
    if (!account?.address || !isHistoryLoaded) return;

    // Filter out the welcome message and convert to storage format
    const messagesToSave = msgs
      .filter(msg => msg.id !== 'welcome')
      .map(toStoredMessage);

    await saveChatHistory(account.address, messagesToSave);
  }, [account?.address, isHistoryLoaded]);

  useEffect(() => {
    saveHistory(messages);
  }, [messages, saveHistory]);

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

    // Handle transfer that needs network selection
    if (intent.action === IntentAction.TRANSFER && intent.needs_network && intent.to && intent.value && intent.token) {
      const fromInfo = intent.resolved_from ? ` (${intent.resolved_from})` : '';
      return `I understand! You want to send **${intent.value} ${intent.token}** to ${intent.to}${fromInfo}.\n\nPlease select a network:`;
    }

    // Handle transfer with network already specified
    if (intent.action === IntentAction.TRANSFER && intent.to && intent.value && intent.token && intent.chain) {
      const fromInfo = intent.resolved_from ? ` (${intent.resolved_from})` : '';
      return `I understand! You want to send **${intent.value} ${intent.token}** to ${intent.to}${fromInfo} on **${CHAINS[intent.chain]?.name || intent.chain}**.\n\nClick "Send Transaction" below to proceed.`;
    }

    if (intent.action === IntentAction.SAVE_FAVORITE) {
      const parts = [];
      if (intent.alias) parts.push(`Alias: **${intent.alias}**`);
      if (intent.to) parts.push(`Address: ${intent.to}`);
      if (intent.token) parts.push(`Token: ${intent.token}`);

      const details = parts.length > 0 ? '\n' + parts.join('\n') : '';
      return `Got it! I'll help you save this favorite.${details}\n\nClick "Save Favorite" below to confirm.`;
    }

    if (intent.action === IntentAction.LIST_FAVORITES) {
      if (!intent.favorites || intent.favorites.length === 0) {
        return `You don't have any saved favorites yet.\n\nTry saving one with: "save favorite binance 0x123..."`;
      }
      return `Here are your saved favorites:`;
    }

    if (intent.action === IntentAction.DELETE_FAVORITE) {
      if (!intent.alias) {
        return `Please specify which favorite to delete. For example: "delete binance from favorites"`;
      }
      return `Got it! I'll delete **${intent.alias}** from your favorites.\n\nClick "Delete Favorite" below to confirm.`;
    }

    if (intent.action === IntentAction.UNKNOWN) {
      return `I'm not sure what you mean. Could you rephrase? For example:\n• "send 50 USDC to binance on base-sepolia"\n• "transfer 0.1 ETH to 0x123... on sepolia"\n• "save favorite johndoe 0x123..."`;
    }

    return `Parsed action: ${intent.action}\nConfidence: ${intent.confidence}%`;
  };

  // Handle network selection - updates the message with the selected chain
  const handleNetworkSelect = (messageId: string, chain: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.intent) {
        const updatedIntent = { ...msg.intent, chain, needs_network: false };
        return {
          ...msg,
          content: formatIntentResponse(updatedIntent),
          intent: updatedIntent
        };
      }
      return msg;
    }));
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

  const handleExecuteSaveFavorite = (intent: IntentResponse) => {
    setSaveFavoriteIntent(intent);
    setShowSaveFavoriteModal(true);
  };

  const handleSaveFavoriteComplete = () => {
    setShowSaveFavoriteModal(false);
    setSaveFavoriteIntent(null);

    const successMessage: Message = {
      id: (Date.now() + 2).toString(),
      type: MessageType.SYSTEM,
      content: '✅ Favorite saved successfully! You can now use it in transactions.',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, successMessage]);
  };

  const handleSaveFavoriteCancel = () => {
    setShowSaveFavoriteModal(false);
    setSaveFavoriteIntent(null);

    const cancelMessage: Message = {
      id: (Date.now() + 2).toString(),
      type: MessageType.SYSTEM,
      content: 'Save favorite cancelled.',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, cancelMessage]);
  };

  const handleDeleteFavorite = async (alias: string) => {
    try {
      // First get the favorites list to find the ID
      const favorites = await api.getFavorites(account!.address);
      const favorite = favorites.find(f => f.alias.toLowerCase() === alias.toLowerCase());

      if (!favorite) {
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          type: MessageType.SYSTEM,
          content: `❌ Favorite "${alias}" not found.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }

      await api.deleteFavorite(favorite.id);

      const successMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: MessageType.SYSTEM,
        content: `✅ Favorite "${alias}" deleted successfully!`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      console.error('Delete favorite error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: MessageType.SYSTEM,
        content: `❌ Failed to delete favorite: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
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

              {/* Network Selection - when transfer needs network */}
              {message.intent && message.intent.action === IntentAction.TRANSFER && message.intent.needs_network && !message.intent.error && (
                <div className="mt-3 space-y-2">
                  <div className="p-2 bg-slate-700/50 rounded border border-slate-600 text-xs">
                    <div className="font-semibold mb-1">Transaction Preview:</div>
                    <div>To: {message.intent.to}</div>
                    <div>Amount: {message.intent.value} {message.intent.token}</div>
                    {message.intent.resolved_from && (
                      <div>From Favorite: {message.intent.resolved_from}</div>
                    )}
                    <div className="mt-1 text-slate-400">Confidence: {message.intent.confidence}%</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(CHAINS).map(([chainKey, chainConfig]) => (
                      <button
                        key={chainKey}
                        onClick={() => handleNetworkSelect(message.id, chainKey)}
                        className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded text-sm font-medium transition-colors border border-slate-600 hover:border-purple-500"
                      >
                        <Globe size={14} />
                        {chainConfig.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Transfer with chain selected - ready to send */}
              {message.intent && message.intent.action === IntentAction.TRANSFER && !message.intent.needs_network && message.intent.chain && !message.intent.error && (
                <div className="mt-3 space-y-2">
                  <div className="p-2 bg-slate-700/50 rounded border border-slate-600 text-xs">
                    <div className="font-semibold mb-1">Transaction Preview:</div>
                    <div>To: {message.intent.to}</div>
                    <div>Amount: {message.intent.value} {message.intent.token}</div>
                    <div>Network: {CHAINS[message.intent.chain]?.name || message.intent.chain}</div>
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

              {message.intent && message.intent.action === IntentAction.SAVE_FAVORITE && !message.intent.error && (
                <div className="mt-3 space-y-2">
                  <div className="p-2 bg-slate-700/50 rounded border border-slate-600 text-xs">
                    <div className="font-semibold mb-1">Favorite Preview:</div>
                    {message.intent.alias && <div>Alias: {message.intent.alias}</div>}
                    {message.intent.to && <div>Address: {message.intent.to}</div>}
                    {message.intent.token && <div>Token: {message.intent.token}</div>}
                    {message.intent.chain && <div>Network: {message.intent.chain}</div>}
                    <div className="mt-1 text-slate-400">Confidence: {message.intent.confidence}%</div>
                  </div>
                  <button
                    onClick={() => handleExecuteSaveFavorite(message.intent!)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm font-semibold transition-colors"
                  >
                    Save Favorite
                  </button>
                </div>
              )}

              {message.intent && message.intent.action === IntentAction.LIST_FAVORITES && message.intent.favorites && message.intent.favorites.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.intent.favorites.map((fav, index) => (
                    <div key={index} className="p-3 bg-slate-700/50 rounded border border-slate-600 text-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <Star size={14} className="text-purple-400" />
                        <span className="font-semibold text-sm">{fav.alias}</span>
                      </div>
                      <div className="space-y-1 text-slate-300">
                        <div className="font-mono text-xs break-all">{fav.address}</div>
                        {fav.asset && (
                          <div className="text-slate-400">
                            <span>{fav.asset}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {message.intent && message.intent.action === IntentAction.DELETE_FAVORITE && message.intent.alias && !message.intent.error && (
                <div className="mt-3 space-y-2">
                  <div className="p-2 bg-red-900/30 rounded border border-red-700/50 text-xs">
                    <div className="font-semibold mb-1 text-red-300">Delete Favorite:</div>
                    <div>Alias: {message.intent.alias}</div>
                    <div className="mt-1 text-slate-400">Confidence: {message.intent.confidence}%</div>
                  </div>
                  <button
                    onClick={() => handleDeleteFavorite(message.intent!.alias!)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Delete Favorite
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

      {showSaveFavoriteModal && (
        <SaveFavoriteModal
          prefilledIntent={saveFavoriteIntent}
          onClose={handleSaveFavoriteCancel}
          onSuccess={handleSaveFavoriteComplete}
        />
      )}
    </div>
  );
};

