import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import { CHAINS } from '../services/wallet';
import { api } from '../services/api';
import type { IntentResponse, FavoriteCreate } from '../types/api';
import { isAddress } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { FavoriteType } from '../constants/enums';

interface SaveFavoriteModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  prefilledIntent?: IntentResponse | null;
}

export const SaveFavoriteModal: React.FC<SaveFavoriteModalProps> = ({ onClose, onSuccess, prefilledIntent }) => {
  const { account } = useWallet();
  const [alias, setAlias] = useState('');
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('sepolia');
  const [asset, setAsset] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const availableChains = Object.keys(CHAINS);

  // Prefill from AI agent intent
  useEffect(() => {
    if (prefilledIntent && prefilledIntent.action === 'save_favorite') {
      if (prefilledIntent.alias) setAlias(prefilledIntent.alias);
      if (prefilledIntent.to) setAddress(prefilledIntent.to);
      if (prefilledIntent.chain) setChain(prefilledIntent.chain);
      if (prefilledIntent.token) setAsset(prefilledIntent.token);
    }
  }, [prefilledIntent]);

  const handleSaveFavorite = async () => {
    setError(null);

    // Validate inputs
    if (!alias.trim()) {
      setError('Please enter an alias/name');
      return;
    }

    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    // Check if it's an ENS name or Ethereum address
    const isENS = address.toLowerCase().endsWith('.eth');
    if (!isENS && !isAddress(address)) {
      setError('Invalid Ethereum address format');
      return;
    }

    if (!chain) {
      setError('Please select a network');
      return;
    }

    if (!account?.address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsSaving(true);

      const favorite: FavoriteCreate = {
        wallet_address: account.address,
        alias: alias.trim(),
        address: address.trim(),
        chain: chain,
        asset: asset.trim() || undefined,
        type: FavoriteType.ADDRESS,
      };

      await api.createFavorite(favorite);
      setSuccess(true);

      // Call success handler if provided
      if (onSuccess) {
        onSuccess();
      }

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save favorite';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
      <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Save Favorite Address</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            disabled={isSaving}
          >
            <X size={24} />
          </button>
        </div>

        {success ? (
          // Success State
          <div className="flex flex-col items-center justify-center py-8">
            <div className="bg-green-500 rounded-full p-3 mb-4">
              <Check size={32} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold text-green-400 mb-2">Favorite Saved!</h3>
            <p className="text-slate-400 text-sm text-center">
              You can now use "{alias}" as a shortcut in transactions
            </p>
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="space-y-4">
              {/* Alias */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Alias / Nickname <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="e.g., johndoe, my-wallet, binance"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                  disabled={isSaving}
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x... or name.eth"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 font-mono text-sm"
                  disabled={isSaving}
                />
              </div>

              {/* Network */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Network <span className="text-red-400">*</span>
                </label>
                <select
                  value={chain}
                  onChange={(e) => setChain(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                  disabled={isSaving}
                >
                  {availableChains.map((chainKey) => (
                    <option key={chainKey} value={chainKey}>
                      {CHAINS[chainKey].name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Asset (Optional) */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Asset / Token (Optional)
                </label>
                <input
                  type="text"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  placeholder="e.g., ETH, USDT, LINK"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                  disabled={isSaving}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Optionally specify a preferred token for this address
                </p>
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
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFavorite}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Favorite'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
