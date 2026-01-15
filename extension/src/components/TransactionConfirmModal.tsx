import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, X, ExternalLink, Loader2 } from 'lucide-react';
import { WalletService, CHAINS } from '../services/wallet';
import { RegistryService } from '../services/registry';
import { useWallet } from '../context/WalletContext';
import type { IntentResponse } from '../types/api';
import { isAddress } from 'ethers';
import { TransactionStatus } from '../constants/enums';

interface TransactionConfirmModalProps {
  intent: IntentResponse;
  onConfirm: (txHash: string) => void;
  onCancel: () => void;
}

export const TransactionConfirmModal: React.FC<TransactionConfirmModalProps> = ({
  intent,
  onConfirm,
  onCancel,
}) => {
  const { getPrivateKey, account } = useWallet();
  const [status, setStatus] = useState<TransactionStatus>(TransactionStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [gasEstimate, setGasEstimate] = useState<{ gasLimit: string; gasPrice: string; gasCost: string } | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  useEffect(() => {
    resolveAndEstimate();
    checkBalance();
  }, []);

  const resolveAddressIfNeeded = async (addressOrENS: string | undefined, chain: string): Promise<string> => {
    if (!addressOrENS) {
      throw new Error('No recipient address provided');
    }

    const address = addressOrENS;

    // 1. If it's already a valid address, return it
    // Wrap in Boolean() to prevent type narrowing from isAddress type predicate
    if (Boolean(isAddress(address))) {
      return address;
    }

    // 2. Check if it's an email or .waillet alias - try registry first
    const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(address);
    const isWailletAlias = address.toLowerCase().endsWith('.waillet') ||
      /^[a-z0-9][a-z0-9.]{0,28}[a-z0-9]$/.test(address.toLowerCase());

    if (isEmail || isWailletAlias) {
      try {
        console.log(`[TransactionConfirm] Looking up ${address} in registry...`);
        const resolved = await RegistryService.resolve(address);
        if (resolved) {
          console.log(`[TransactionConfirm] Resolved ${address} via registry to ${resolved}`);
          return resolved;
        }
      } catch (err) {
        console.warn('[TransactionConfirm] Registry lookup failed:', err);
      }

      // Registry lookup failed or not found - show specific error
      if (isEmail) {
        throw new Error(`Email "${address}" is not registered. The recipient needs to register it first.`);
      }
      if (isWailletAlias) {
        throw new Error(`Alias "${address}" is not registered. The recipient needs to register it first.`);
      }
    }

    // 3. Check if it's an ENS name (ends with .eth)
    const isENS = address.toLowerCase().endsWith('.eth');

    if (isENS) {
      try {
        const provider = await WalletService.getProvider(chain);
        const resolved = await provider.resolveName(address);
        if (resolved) {
          return resolved;
        }
        throw new Error(`Could not resolve ENS name: ${address}`);
      } catch (err) {
        console.error('ENS resolution failed:', err);
        throw new Error(`Failed to resolve ENS name: ${address}`);
      }
    }

    // Invalid address format
    throw new Error(`Invalid address or ENS name: ${address}`);
  };

  const resolveAndEstimate = async () => {
    if (!intent.to || !intent.value || !intent.chain) return;

    setStatus(TransactionStatus.ESTIMATING);
    setError(null);

    try {
      // Resolve ENS if needed
      const resolved = await resolveAddressIfNeeded(intent.to, intent.chain);
      setResolvedAddress(resolved);

      // Now estimate gas with the resolved address
      const privateKey = await getPrivateKey();
      const isNativeToken = !intent.token || intent.token === CHAINS[intent.chain.toLowerCase()]?.nativeCurrency;

      const estimate = await WalletService.estimateGas(
        privateKey,
        resolved,
        intent.value,
        intent.chain,
        isNativeToken ? undefined : intent.token
      );

      setGasEstimate(estimate);
      setStatus(TransactionStatus.IDLE);
    } catch (err: any) {
      console.error('Address resolution or gas estimation failed:', err);
      setError(err.message || 'Failed to estimate gas. Please check the recipient address.');
      setStatus(TransactionStatus.ERROR);
    }
  };

  const checkBalance = async () => {
    if (!account || !intent.chain) return;

    try {
      const bal = await WalletService.getBalance(
        account.address,
        intent.chain,
        intent.token
      );
      setBalance(bal);
    } catch (err) {
      console.error('Failed to check balance:', err);
    }
  };

  const handleConfirm = async () => {
    if (!resolvedAddress || !intent.value || !intent.chain) {
      setError('Missing transaction parameters or address not resolved');
      return;
    }

    setStatus(TransactionStatus.CONFIRMING);
    setError(null);

    try {
      const privateKey = await getPrivateKey();
      setStatus(TransactionStatus.SENDING);

      const isNativeToken = !intent.token || intent.token === CHAINS[intent.chain.toLowerCase()]?.nativeCurrency;

      let result;
      if (isNativeToken) {
        result = await WalletService.sendNativeToken(
          privateKey,
          resolvedAddress,
          intent.value,
          intent.chain
        );
      } else {
        result = await WalletService.sendToken(
          privateKey,
          resolvedAddress,
          intent.value,
          intent.token!,
          intent.chain
        );
      }

      setTxHash(result.hash);
      setStatus(TransactionStatus.SUCCESS);

      // Wait a bit so user can see success message
      setTimeout(() => {
        onConfirm(result.hash);
      }, 2000);
    } catch (err: any) {
      console.error('Transaction failed:', err);
      setError(err.message || 'Transaction failed');
      setStatus(TransactionStatus.ERROR);
    }
  };

  const chainConfig = intent.chain ? CHAINS[intent.chain.toLowerCase()] : null;
  const explorerUrl = txHash && chainConfig ? `${chainConfig.explorer}/tx/${txHash}` : null;

  const hasInsufficientBalance = balance && intent.value && parseFloat(balance) < parseFloat(intent.value);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg max-w-md w-full max-h-[90vh] p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Confirm Transaction</h2>
          <button
            onClick={onCancel}
            disabled={status === TransactionStatus.SENDING}
            className="text-slate-400 hover:text-white disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Transaction Details */}
        <div className="space-y-4 mb-6 overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">To</div>
            <div className="font-mono text-sm break-all">{intent.to}</div>
            {resolvedAddress && resolvedAddress !== intent.to && (
              <div className="text-xs text-slate-400 mt-1 font-mono break-all">
                → {resolvedAddress}
              </div>
            )}
            {intent.resolved_from && (
              <div className="text-xs text-purple-400 mt-1">({intent.resolved_from})</div>
            )}
          </div>

          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Amount</div>
            <div className="text-2xl font-bold">
              {intent.value} {intent.token}
            </div>
            {balance && (
              <div className={`text-sm mt-1 ${hasInsufficientBalance ? 'text-red-400' : 'text-slate-400'}`}>
                Balance: {parseFloat(balance).toFixed(4)} {intent.token}
              </div>
            )}
          </div>

          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Network</div>
            <div className="font-semibold">{chainConfig?.name || intent.chain}</div>
          </div>

          {gasEstimate && (
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Estimated Gas</div>
              <div className="text-sm">
                <div>Gas Price: {parseFloat(gasEstimate.gasPrice).toFixed(2)} Gwei</div>
                <div>Total Cost: ~{parseFloat(gasEstimate.gasCost).toFixed(6)} {chainConfig?.nativeCurrency}</div>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 flex gap-2">
            <AlertCircle className="flex-shrink-0 text-red-400 mt-0.5" size={20} />
            <div className="text-sm text-red-200 break-words flex-1">{error}</div>
          </div>
        )}

        {/* Insufficient Balance Warning */}
        {hasInsufficientBalance && (
          <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-3 mb-4 flex gap-2">
            <AlertCircle className="flex-shrink-0 text-yellow-400" size={20} />
            <div className="text-sm text-yellow-200">Insufficient balance for this transaction</div>
          </div>
        )}

        {/* Success Message */}
        {status === TransactionStatus.SUCCESS && explorerUrl && (
          <div className="bg-green-900/50 border border-green-700 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="text-green-400" size={20} />
              <div className="text-sm text-green-200 font-semibold">Transaction Sent!</div>
            </div>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View on Explorer <ExternalLink size={12} />
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={status === TransactionStatus.SENDING || status === TransactionStatus.SUCCESS}
            className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              status === TransactionStatus.SENDING ||
              status === TransactionStatus.SUCCESS ||
              status === TransactionStatus.ESTIMATING ||
              hasInsufficientBalance ||
              !intent.to ||
              !intent.value
            }
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {status === TransactionStatus.ESTIMATING && (
              <>
                <Loader2 className="animate-spin" size={18} />
                Estimating...
              </>
            )}
            {status === TransactionStatus.CONFIRMING && (
              <>
                <Loader2 className="animate-spin" size={18} />
                Preparing...
              </>
            )}
            {status === TransactionStatus.SENDING && (
              <>
                <Loader2 className="animate-spin" size={18} />
                Sending...
              </>
            )}
            {status === TransactionStatus.SUCCESS && (
              <>
                <Check size={18} />
                Sent!
              </>
            )}
            {status === TransactionStatus.IDLE && 'Confirm'}
            {status === TransactionStatus.ERROR && 'Try Again'}
          </button>
        </div>
      </div>
    </div>
  );
};

