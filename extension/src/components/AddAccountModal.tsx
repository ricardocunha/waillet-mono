import React, { useState } from 'react';
import { X, Plus, FileText, Loader2, AlertCircle, Check } from 'lucide-react';
import { useWallet } from '../context/WalletContext';

interface AddAccountModalProps {
  onClose: () => void;
}

type Mode = 'select' | 'import';

export const AddAccountModal: React.FC<AddAccountModalProps> = ({ onClose }) => {
  const { addAccount, importAccount } = useWallet();
  const [mode, setMode] = useState<Mode>('select');
  const [mnemonic, setMnemonic] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCreateNew = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await addAccount();
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      setError('Please enter a valid 12 or 24 word recovery phrase');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await importAccount(mnemonic.trim().toLowerCase(), accountName.trim() || undefined);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to import account');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-xl p-6 w-80 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Account Added!</h3>
          <p className="text-sm text-slate-400">Your new account is now active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {mode === 'select' ? 'Add Account' : 'Import Wallet'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {mode === 'select' ? (
            <div className="space-y-3">
              {/* Create New Account */}
              <button
                onClick={handleCreateNew}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 rounded-lg transition-colors text-left"
              >
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  ) : (
                    <Plus className="w-6 h-6 text-purple-400" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-white">Create New Account</div>
                  <div className="text-sm text-slate-400">
                    Derive a new account from your seed phrase
                  </div>
                </div>
              </button>

              {/* Import Account */}
              <button
                onClick={() => setMode('import')}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 rounded-lg transition-colors text-left"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-white">Import Wallet</div>
                  <div className="text-sm text-slate-400">
                    Import using a 12-word recovery phrase
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Account Name (optional) */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Account Name (optional)
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g., Trading Account"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                  disabled={isLoading}
                />
              </div>

              {/* Recovery Phrase */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Recovery Phrase <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                  placeholder="Enter your 12-word recovery phrase separated by spaces"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 text-sm resize-none h-24"
                  disabled={isLoading}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Your recovery phrase will be used to derive the account.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setMode('select');
                    setError(null);
                    setMnemonic('');
                    setAccountName('');
                  }}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 rounded-lg font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={isLoading || !mnemonic.trim()}
                  className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Import'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};