import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Copy, Check, AlertCircle, Key, AtSign, Loader2, Trash2, Brain } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { RegistryService, GasEstimate } from '../services/registry';
import { api } from '../services/api';
import { browserAPI } from '../utils/browser-api';
import { StorageKey } from '../constants';

interface AccountSettingsModalProps {
  onClose: () => void;
  onAIKeyChanged?: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ onClose, onAIKeyChanged }) => {
  const { account } = useWallet();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Address Shortcut state
  const [shortcutInput, setShortcutInput] = useState('');
  const [registeredShortcuts, setRegisteredShortcuts] = useState<string[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<string | null>(null);

  // OpenAI API Key state
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [openaiError, setOpenaiError] = useState<string | null>(null);
  const [openaiSuccess, setOpenaiSuccess] = useState<string | null>(null);

  // Load registered shortcuts and OpenAI status on mount
  useEffect(() => {
    if (account?.address) {
      loadRegisteredShortcuts();
    }
    loadOpenAIStatus();
  }, [account?.address]);

  const loadRegisteredShortcuts = async () => {
    if (!account) return;
    const shortcuts = await RegistryService.getLocalShortcuts(account.address);
    setRegisteredShortcuts(shortcuts);
  };

  const loadOpenAIStatus = async () => {
    try {
      // Check local storage first
      const result = await browserAPI.storage.local.get(StorageKey.OPENAI_API_KEY);
      const localKey = result[StorageKey.OPENAI_API_KEY];

      if (localKey) {
        setOpenaiConfigured(true);
        // Also sync with backend if key exists locally
        try {
          await api.setOpenAIKey(localKey);
        } catch {
          // Backend may be offline, but local key is still valid
        }
        return;
      }

      // Fallback to checking backend status
      const status = await api.getOpenAIStatus();
      setOpenaiConfigured(status.configured);
    } catch {
      // Backend may be offline, check local storage only
      const result = await browserAPI.storage.local.get(StorageKey.OPENAI_API_KEY);
      setOpenaiConfigured(!!result[StorageKey.OPENAI_API_KEY]);
    }
  };

  const handleSaveOpenAIKey = async () => {
    if (!openaiKeyInput.trim()) return;

    setIsSavingKey(true);
    setOpenaiError(null);
    setOpenaiSuccess(null);

    try {
      const keyToSave = openaiKeyInput.trim();

      // Save to local storage first (always works)
      await browserAPI.storage.local.set({ [StorageKey.OPENAI_API_KEY]: keyToSave });

      // Also send to backend (may fail if offline/unauthenticated)
      try {
        await api.setOpenAIKey(keyToSave);
      } catch {
        // Backend sync failed, but local storage succeeded - that's OK
        console.log('[Settings] Backend sync failed, key saved locally');
      }

      setOpenaiConfigured(true);
      setOpenaiKeyInput('');
      setOpenaiSuccess('API key saved successfully');
      onAIKeyChanged?.();
      setTimeout(() => setOpenaiSuccess(null), 3000);
    } catch (err: any) {
      setOpenaiError(err.message || 'Failed to save API key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleEstimateGas = async () => {
    if (!shortcutInput.trim() || !account) return;

    setIsEstimating(true);
    setRegistrationError(null);
    setGasEstimate(null);

    try {
      const estimate = await RegistryService.estimateRegistrationGas(
        account.privateKey,
        shortcutInput
      );
      setGasEstimate(estimate);
    } catch (err: any) {
      setRegistrationError(err.message || 'Failed to estimate gas');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleRegisterShortcut = async () => {
    if (!shortcutInput.trim() || !account) return;

    setIsRegistering(true);
    setRegistrationError(null);
    setRegistrationSuccess(null);

    try {
      const result = await RegistryService.register(account.privateKey, shortcutInput);

      // Save to chrome.storage for UI display
      await RegistryService.saveShortcutLocally(account.address, result.identifier);

      setRegisteredShortcuts([...registeredShortcuts, result.identifier]);
      setShortcutInput('');
      setGasEstimate(null);
      setRegistrationSuccess(`Registered! Tx: ${result.hash.slice(0, 10)}...`);
      setTimeout(() => setRegistrationSuccess(null), 5000);
    } catch (err: any) {
      setRegistrationError(err.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRemoveShortcut = async (shortcut: string) => {
    if (!account) return;

    setIsRemoving(shortcut);
    setRegistrationError(null);

    try {
      await RegistryService.removeRegistration(account.privateKey, shortcut);
      await RegistryService.removeShortcutLocally(account.address, shortcut);
      setRegisteredShortcuts(registeredShortcuts.filter((s) => s !== shortcut));
    } catch (err: any) {
      setRegistrationError(err.message || 'Failed to remove shortcut');
    } finally {
      setIsRemoving(null);
    }
  };

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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-1 z-40">
      <div className="bg-slate-800 rounded-lg max-w-md w-full p-3 max-h-[95vh] overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">Account Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Private Key Section */}
        <div className="space-y-2">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Key size={16} className="text-purple-400" />
              <label className="text-sm font-semibold text-slate-300">Private Key</label>
            </div>
            <p className="text-xs text-yellow-400 mb-1">Never share your private key - anyone with it can access your funds.</p>

            {/* Private Key Display */}
            <div className="bg-slate-700 border border-slate-600 rounded p-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex-1 font-mono text-xs break-all text-slate-400 overflow-hidden" style={{ maxHeight: '2rem' }}>
                  {showPrivateKey ? account.privateKey : maskPrivateKey()}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="p-1 bg-slate-600 hover:bg-slate-500 rounded transition-colors"
                    title={showPrivateKey ? 'Hide' : 'Show'}
                  >
                    {showPrivateKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={handleCopyPrivateKey}
                    className="p-1 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                    title="Copy"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded p-1.5 flex gap-1.5">
              <AlertCircle className="flex-shrink-0 text-red-400" size={14} />
              <div className="text-xs text-red-200">{error}</div>
            </div>
          )}

          {/* Address Shortcut Section */}
          <div className="pt-2 border-t border-slate-700">
            <div className="flex items-center gap-1.5 mb-0.5">
              <AtSign size={16} className="text-purple-400" />
              <label className="text-sm font-semibold text-slate-300">Address Shortcut</label>
              <span className="text-xs text-slate-500 ml-auto">Base Sepolia</span>
            </div>
            <p className="text-xs text-slate-400 mb-1.5">Register an email or alias so others can send you crypto easily.</p>

            {/* Registered Shortcuts Display */}
            {registeredShortcuts.length > 0 && (
              <div className="mb-1.5">
                <div className="text-xs text-slate-400 mb-0.5">Registered:</div>
                <div className="space-y-0.5">
                  {registeredShortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-slate-700 rounded px-2 py-1"
                    >
                      <span className="text-xs font-mono truncate">{shortcut}</span>
                      <button
                        onClick={() => handleRemoveShortcut(shortcut)}
                        disabled={isRemoving === shortcut}
                        className="text-red-400 hover:text-red-300 p-0.5 disabled:opacity-50"
                        title="Remove"
                      >
                        {isRemoving === shortcut ? (
                          <Loader2 className="animate-spin" size={12} />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input for new shortcut */}
            <div className="space-y-1.5">
              <input
                type="text"
                value={shortcutInput}
                onChange={(e) => {
                  setShortcutInput(e.target.value);
                  setRegistrationError(null);
                  setGasEstimate(null);
                }}
                placeholder="email@example.com or myname.waillet"
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
              />

              {/* Gas Estimate Display */}
              {gasEstimate && (
                <div className="bg-slate-700/50 rounded p-1.5 text-xs flex items-center justify-between">
                  <span className="text-slate-400">Gas:</span>
                  <span className="text-white font-semibold">~{parseFloat(gasEstimate.gasCost).toFixed(6)} ETH</span>
                </div>
              )}

              {/* Registration Error */}
              {registrationError && (
                <div className="bg-red-900/50 border border-red-700 rounded p-1 text-xs text-red-200">
                  {registrationError}
                </div>
              )}

              {/* Registration Success */}
              {registrationSuccess && (
                <div className="bg-green-900/50 border border-green-700 rounded p-1 text-xs text-green-200">
                  {registrationSuccess}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-1.5">
                <button
                  onClick={handleEstimateGas}
                  disabled={!shortcutInput.trim() || isEstimating || isRegistering}
                  className="flex-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:opacity-50 text-white py-1 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  {isEstimating ? (
                    <>
                      <Loader2 className="animate-spin" size={12} />
                      Estimating...
                    </>
                  ) : (
                    'Estimate'
                  )}
                </button>
                <button
                  onClick={handleRegisterShortcut}
                  disabled={!shortcutInput.trim() || !gasEstimate || isRegistering}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white py-1 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="animate-spin" size={12} />
                      Registering...
                    </>
                  ) : (
                    'Register'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* OpenAI API Key Section */}
        <div className="mt-2 pt-2 border-t border-slate-700">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Brain size={16} className="text-purple-400" />
            <label className="text-sm font-semibold text-slate-300">OpenAI API Key</label>
            <span className={`text-xs ml-auto ${openaiConfigured ? 'text-green-400' : 'text-yellow-400'}`}>
              {openaiConfigured ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-1.5">Required for the AI Agent chat feature.</p>

          <div className="space-y-1.5">
            <input
              type="password"
              value={openaiKeyInput}
              onChange={(e) => {
                setOpenaiKeyInput(e.target.value);
                setOpenaiError(null);
              }}
              placeholder="sk-..."
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
            />

            {openaiError && (
              <div className="bg-red-900/50 border border-red-700 rounded p-1 text-xs text-red-200">
                {openaiError}
              </div>
            )}

            {openaiSuccess && (
              <div className="bg-green-900/50 border border-green-700 rounded p-1 text-xs text-green-200">
                {openaiSuccess}
              </div>
            )}

            <button
              onClick={handleSaveOpenAIKey}
              disabled={!openaiKeyInput.trim() || isSavingKey}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white py-1 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
            >
              {isSavingKey ? (
                <>
                  <Loader2 className="animate-spin" size={12} />
                  Saving...
                </>
              ) : (
                'Save Key'
              )}
            </button>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-2">
          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-1.5 rounded font-semibold transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

