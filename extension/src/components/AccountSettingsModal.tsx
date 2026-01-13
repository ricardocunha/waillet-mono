import React, { useState } from 'react';
import { X, Eye, EyeOff, Copy, Check, AlertCircle, Key } from 'lucide-react';
import { useWallet } from '../context/WalletContext';

interface AccountSettingsModalProps {
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ onClose }) => {
  const { account } = useWallet();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopyPrivateKey = async () => {
    if (!account?.privateKey) {
      setError('Private key not available');
      return;
    }

    try {
      await navigator.clipboard.writeText(account.privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const maskPrivateKey = () => {
    return '•'.repeat(64);
  };

  if (!account) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
      <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Account Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Private Key Section */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Key size={18} className="text-purple-400" />
              <label className="text-sm font-semibold text-slate-300">
                Private Key
              </label>
            </div>

            {/* Warning */}
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 mb-4">
              <div className="flex gap-2">
                <AlertCircle className="flex-shrink-0 text-yellow-400 mt-0.5" size={16} />
                <p className="text-xs text-yellow-200">
                  Never share your private key. Anyone with this key can access your funds.
                </p>
              </div>
            </div>

            {/* Private Key Display */}
            <div className="bg-slate-700 border border-slate-600 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 font-mono text-sm break-all">
                  {showPrivateKey ? account.privateKey : maskPrivateKey()}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
                    title={showPrivateKey ? 'Hide private key' : 'Show private key'}
                  >
                    {showPrivateKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={handleCopyPrivateKey}
                    className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 flex gap-2">
              <AlertCircle className="flex-shrink-0 text-red-400 mt-0.5" size={16} />
              <div className="text-sm text-red-200">{error}</div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};