import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { CHAINS } from '../services/wallet';
import { TransactionConfirmModal } from './TransactionConfirmModal';
import type { IntentResponse } from '../types/api';
import { isAddress } from 'ethers';
import { IntentAction } from '../constants/enums';

interface TokenWithBalance {
  symbol: string;
  balance: string;
}

interface SendTransactionModalProps {
  onClose: () => void;
  tokensWithBalance?: TokenWithBalance[];
  currentChain?: string;
}

export const SendTransactionModal: React.FC<SendTransactionModalProps> = ({
  onClose,
  tokensWithBalance = [],
  currentChain = 'sepolia'
}) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [chain, setChain] = useState(currentChain);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<IntentResponse | null>(null);

  // Use tokens with balance, fallback to native token if none
  const availableTokens = tokensWithBalance.length > 0
    ? tokensWithBalance.map(t => t.symbol)
    : ['ETH'];
  const [token, setToken] = useState(availableTokens[0] || 'ETH');

  // Update token when available tokens change
  useEffect(() => {
    if (availableTokens.length > 0 && !availableTokens.includes(token)) {
      setToken(availableTokens[0]);
    }
  }, [availableTokens, token]);

  const availableChains = Object.keys(CHAINS);

  const handleReviewTransaction = () => {
    setError(null);

    // Validate inputs
    if (!recipient.trim()) {
      setError('Please enter a recipient address');
      return;
    }

    // Check if it's an ENS name or Ethereum address
    const isENS = recipient.toLowerCase().endsWith('.eth');
    if (!isENS && !isAddress(recipient)) {
      setError('Invalid Ethereum address format');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!token) {
      setError('Please select a token');
      return;
    }

    if (!chain) {
      setError('Please select a network');
      return;
    }

    // Create intent object for TransactionConfirmModal
    const intent: IntentResponse = {
      action: IntentAction.TRANSFER,
      to: recipient,
      value: amount,
      token: token,
      chain: chain,
      confidence: 100, // Manual input = 100% confidence
    };

    setPendingIntent(intent);
    setShowConfirmModal(true);
  };

  const handleTransactionConfirm = () => {
    setShowConfirmModal(false);
    setPendingIntent(null);
    // Close the send modal after successful transaction
    onClose();
  };

  const handleTransactionCancel = () => {
    setShowConfirmModal(false);
    setPendingIntent(null);
    // Return to the send modal
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
        <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Send Transaction</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Recipient */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Recipient Address or ENS
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x... or name.eth"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 font-mono text-sm"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                step="0.000001"
                min="0"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Token */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Token
              </label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
              >
                {availableTokens.map((t) => {
                  const tokenData = tokensWithBalance.find(tb => tb.symbol === t);
                  const balanceDisplay = tokenData ? ` (${tokenData.balance})` : '';
                  return (
                    <option key={t} value={t}>
                      {t}{balanceDisplay}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Network */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Network
              </label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
              >
                {availableChains.map((chainKey) => (
                  <option key={chainKey} value={chainKey}>
                    {CHAINS[chainKey].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-900/50 border border-red-700 rounded-lg p-3 flex gap-2">
              <AlertCircle className="flex-shrink-0 text-red-400 mt-0.5" size={20} />
              <div className="text-sm text-red-200">{error}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReviewTransaction}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Review Transaction
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Confirm Modal */}
      {showConfirmModal && pendingIntent && (
        <TransactionConfirmModal
          intent={pendingIntent}
          onConfirm={handleTransactionConfirm}
          onCancel={handleTransactionCancel}
        />
      )}
    </>
  );
};
