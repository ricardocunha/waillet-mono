import { useState, useEffect } from 'react';
import { X, Send, Loader2, CheckCircle, ExternalLink, AlertCircle, Fuel } from 'lucide-react';
import { api } from '../services/api';
import { SmartDocumentShareService } from '../services/smartDocumentShare';
import type { SmartDocument } from '../types/documents';

interface ShareDocumentModalProps {
  document: SmartDocument;
  privateKey: string;
  onClose: () => void;
  onSuccess: () => void;
}

type ShareStep = 'form' | 'processing' | 'success' | 'error';

const EXPIRY_PRESETS = [
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
  { label: '30 days', seconds: 2592000 },
];

export function ShareDocumentModal({ document, privateKey, onClose, onSuccess }: ShareDocumentModalProps) {
  const [step, setStep] = useState<ShareStep>('form');
  const [recipient, setRecipient] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(1); // Default: 24 hours
  const [customExpiry, setCustomExpiry] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [txHash, setTxHash] = useState('');
  const [explorerUrl, setExplorerUrl] = useState('');

  const isValidRecipient = /^0x[0-9a-fA-F]{40}$/.test(recipient);

  const getExpiresAt = (): number => {
    if (useCustom && customExpiry) {
      return Math.floor(new Date(customExpiry).getTime() / 1000);
    }
    return Math.floor(Date.now() / 1000) + EXPIRY_PRESETS[selectedPreset].seconds;
  };

  // Estimate gas when recipient is valid
  useEffect(() => {
    if (!isValidRecipient || !privateKey) return;
    setGasEstimate(null);

    const docIdentifier = `doc:${document.id}:${document.s3_url}`;
    const expiresAt = getExpiresAt();

    SmartDocumentShareService.estimateShareGas(privateKey, docIdentifier, recipient, expiresAt)
      .then((est) => setGasEstimate(`~${parseFloat(est.gasCost).toFixed(6)} ETH`))
      .catch(() => setGasEstimate('Unable to estimate'));
  }, [recipient, selectedPreset, customExpiry, useCustom]);

  const handleShare = async () => {
    if (!isValidRecipient) return;

    setStep('processing');
    setErrorMsg('');

    try {
      const expiresAt = getExpiresAt();

      // Step 1: Initiate share on backend
      setStatusMsg('Creating share record...');
      const { share_id, document_hash } = await api.initiateShare(document.id, recipient, expiresAt);

      // Step 2: Register document on-chain if needed
      setStatusMsg('Registering document on-chain...');
      await SmartDocumentShareService.registerDocument(privateKey, document_hash);

      // Step 3: Mint share NFT
      setStatusMsg('Minting share NFT...');
      const result = await SmartDocumentShareService.shareDocument(
        privateKey,
        document_hash,
        recipient,
        expiresAt
      );

      // Step 4: Confirm share on backend
      setStatusMsg('Confirming share...');
      await api.confirmShare(share_id, result.tokenId, result.txHash);

      setTxHash(result.txHash);
      setExplorerUrl(result.explorerUrl);
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to share document');
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Share Document</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {step === 'form' && (
            <div className="space-y-4">
              {/* Document name */}
              <div className="text-xs text-slate-400">
                Sharing: <span className="text-white font-medium">{document.metadata?.title || document.title}</span>
              </div>

              {/* Recipient */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Recipient Wallet Address</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                  placeholder="0x..."
                  className={`w-full bg-slate-700 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:ring-1 ${
                    recipient && !isValidRecipient ? 'ring-1 ring-red-500' : 'focus:ring-purple-500'
                  }`}
                />
                {recipient && !isValidRecipient && (
                  <p className="text-red-400 text-[10px] mt-1">Invalid Ethereum address</p>
                )}
              </div>

              {/* Expiration */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Access Duration</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {EXPIRY_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedPreset(i);
                        setUseCustom(false);
                      }}
                      className={`text-xs py-1.5 rounded-lg border transition-colors ${
                        !useCustom && selectedPreset === i
                          ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setUseCustom(!useCustom)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 mt-1.5 transition-colors"
                >
                  {useCustom ? 'Use preset' : 'Custom date'}
                </button>
                {useCustom && (
                  <input
                    type="datetime-local"
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full bg-slate-700 text-white text-xs rounded-lg px-3 py-2 mt-1.5 outline-none focus:ring-1 focus:ring-purple-500"
                  />
                )}
              </div>

              {/* Gas estimate */}
              {isValidRecipient && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Fuel className="w-3 h-3" />
                  <span>Est. gas: {gasEstimate || 'Calculating...'}</span>
                </div>
              )}

              {/* Share button */}
              <button
                onClick={handleShare}
                disabled={!isValidRecipient}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                Share Document
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-white text-sm font-medium">{statusMsg}</p>
              <p className="text-slate-500 text-xs">Please wait, this may take a moment...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle className="w-10 h-10 text-green-400" />
              <p className="text-white text-sm font-medium">Document Shared!</p>
              <p className="text-slate-400 text-xs text-center">
                A soulbound NFT has been minted to grant access.
              </p>
              <div className="bg-slate-700/50 rounded-lg p-3 w-full space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Recipient</span>
                  <span className="text-white font-mono text-[10px]">
                    {recipient.slice(0, 6)}...{recipient.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tx Hash</span>
                  <span className="text-white font-mono text-[10px]">
                    {txHash.slice(0, 10)}...{txHash.slice(-6)}
                  </span>
                </div>
              </div>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-xs transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Explorer
                </a>
              )}
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors mt-2"
              >
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-white text-sm font-medium">Share Failed</p>
              <p className="text-red-400 text-xs text-center">{errorMsg}</p>
              <div className="flex gap-2 w-full mt-2">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
