import React, { useState } from 'react';
import { Wallet, Download, AlertCircle, Copy, Check } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { OnboardingMode } from '../constants/enums';

export const Onboarding: React.FC = () => {
  const { createWallet, confirmMnemonic, importWallet } = useWallet();
  const [mode, setMode] = useState<OnboardingMode>(OnboardingMode.CHOICE);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [error, setError] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const mnemonic = await createWallet(password);
      setGeneratedMnemonic(mnemonic);
      setShowMnemonic(true);
    } catch (err) {
      setError('Failed to create wallet');
    }
  };

  const handleCopyMnemonic = async () => {
    try {
      await navigator.clipboard.writeText(generatedMnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleImport = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!mnemonic.trim()) {
      setError('Please enter your recovery phrase');
      return;
    }

    try {
      await importWallet(mnemonic, password);
    } catch (err) {
      setError('Invalid recovery phrase');
    }
  };

  if (showMnemonic) {
    return (
      <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-full bg-slate-800 rounded-lg p-6">
          <div className="text-center mb-4">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold">Save Your Recovery Phrase</h2>
            <p className="text-sm text-slate-400 mt-2">
              Write this down and keep it safe. You'll need it to recover your wallet.
            </p>
          </div>

          <div className="bg-slate-700 rounded p-4 mb-3">
            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
              {generatedMnemonic.split(' ').map((word, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">{i + 1}.</span>
                  <span className="font-mono font-medium">{word}</span>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleCopyMnemonic}
              className="w-full bg-slate-600 hover:bg-slate-500 text-white py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={16} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy All Words
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              confirmMnemonic(generatedMnemonic);
              setShowMnemonic(false);
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold"
          >
            I've Saved It
          </button>
        </div>
      </div>
    );
  }

  if (mode === OnboardingMode.CHOICE) {
    return (
      <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <Wallet className="w-16 h-16 text-purple-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Welcome to <span style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', cursive" }}>wAIllet</span></h1>
          <p className="text-slate-400 mt-2">Your AI-powered crypto wallet</p>
        </div>

        <div className="w-full max-w-md space-y-3">
          <button
            onClick={() => setMode(OnboardingMode.CREATE)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            <Wallet size={20} />
            Create New Wallet
          </button>

          <button
            onClick={() => setMode(OnboardingMode.IMPORT)}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            <Download size={20} />
            Import Existing Wallet
          </button>
        </div>
      </div>
    );
  }

  if (mode === OnboardingMode.CREATE) {
    return (
      <div className="h-full bg-slate-900 flex flex-col p-6">
        <button
          onClick={() => setMode(OnboardingMode.CHOICE)}
          className="text-slate-400 hover:text-white mb-4 text-left"
        >
          ← Back
        </button>

        <div className="flex-1 flex flex-col justify-center">
          <h2 className="text-2xl font-bold mb-6">Create Password</h2>
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                placeholder="Enter password again"
              />
            </div>

            <button
              onClick={handleCreate}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold mt-6"
            >
              Create Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-900 flex flex-col p-6">
      <button
        onClick={() => setMode(OnboardingMode.CHOICE)}
        className="text-slate-400 hover:text-white mb-4 text-left"
      >
        ← Back
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <h2 className="text-2xl font-bold mb-6">Import Wallet</h2>
        
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Recovery Phrase</label>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 h-24"
              placeholder="Enter your 12 or 24 word recovery phrase"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Create Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            onClick={handleImport}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold mt-6"
          >
            Import Wallet
          </button>
        </div>
      </div>
    </div>
  );
};

