import React, { useState } from 'react';
import { Shield, AlertTriangle, FileText, X, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { EthMethod } from '../types/messaging';

interface SignatureApprovalModalProps {
  origin: string;
  message?: string;
  typedData?: any;
  method: EthMethod.PERSONAL_SIGN | EthMethod.SIGN | EthMethod.SIGN_TYPED_DATA_V4;
  dangerous?: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export const SignatureApprovalModal: React.FC<SignatureApprovalModalProps> = ({
  origin,
  message,
  typedData,
  method,
  dangerous,
  onApprove,
  onReject
}) => {
  const [showRawData, setShowRawData] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const domain = new URL(origin).hostname;

  // Decode hex message for personal_sign
  const decodeMessage = (hex: string): string => {
    try {
      if (hex.startsWith('0x')) {
        hex = hex.slice(2);
      }
      const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      return new TextDecoder().decode(bytes);
    } catch (e) {
      return hex;
    }
  };

  const displayMessage = message ? decodeMessage(message) : null;
  const isEthSign = method === EthMethod.SIGN;
  const isPersonalSign = method === EthMethod.PERSONAL_SIGN;
  const isTypedData = method === EthMethod.SIGN_TYPED_DATA_V4;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg max-w-lg w-full p-6 my-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield size={24} className={dangerous ? "text-red-400" : "text-purple-400"} />
            Signature Request
          </h2>
          <button
            onClick={onReject}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Origin Display */}
        <div className="bg-slate-700 rounded-lg p-4 mb-4">
          <div className="text-sm text-slate-400 mb-1">Requesting site</div>
          <div className="font-semibold break-all">{domain}</div>
        </div>

        {/* Dangerous Warning (eth_sign) */}
        {dangerous && (
          <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <AlertTriangle className="flex-shrink-0 text-red-400 mt-0.5" size={24} />
              <div className="text-sm text-red-200">
                <div className="font-bold text-base mb-2">⚠️ DANGEROUS SIGNATURE REQUEST</div>
                <p className="mb-2">
                  <strong>eth_sign</strong> can sign arbitrary data, including transactions.
                  A malicious site could steal all your funds.
                </p>
                <p className="font-semibold">
                  Only approve if you absolutely trust this site and understand what you're signing.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Message Display */}
        {isPersonalSign && displayMessage && (
          <div className="bg-slate-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-400">Message to sign</div>
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                {showRawData ? <><EyeOff size={14} /> Hide Raw</> : <><Eye size={14} /> Show Raw</>}
              </button>
            </div>
            <div className="bg-slate-800 rounded p-3 font-mono text-sm break-all max-h-48 overflow-y-auto">
              {showRawData ? message : displayMessage}
            </div>
          </div>
        )}

        {/* eth_sign message (always show raw) */}
        {isEthSign && message && (
          <div className="bg-slate-700 rounded-lg p-4 mb-4">
            <div className="text-sm text-slate-400 mb-2">Data to sign (hex)</div>
            <div className="bg-slate-800 rounded p-3 font-mono text-xs break-all max-h-48 overflow-y-auto text-red-300">
              {message}
            </div>
          </div>
        )}

        {/* Typed Data Display */}
        {isTypedData && typedData && (
          <div className="bg-slate-700 rounded-lg p-4 mb-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between mb-2"
            >
              <div className="text-sm text-slate-400">Structured data to sign</div>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Domain Info */}
            {typedData.domain && (
              <div className="bg-slate-800 rounded p-3 mb-2">
                <div className="text-xs text-slate-400 mb-1">Contract</div>
                <div className="font-semibold text-sm">{typedData.domain.name || 'Unknown'}</div>
                {typedData.domain.verifyingContract && (
                  <div className="font-mono text-xs text-slate-400 mt-1 break-all">
                    {typedData.domain.verifyingContract}
                  </div>
                )}
              </div>
            )}

            {/* Message Preview */}
            {typedData.message && (
              <div className="bg-slate-800 rounded p-3">
                <div className="text-xs text-slate-400 mb-2">Message</div>
                {expanded ? (
                  <pre className="text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(typedData.message, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm">
                    {Object.entries(typedData.message).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="mb-1">
                        <span className="text-slate-400">{key}:</span>{' '}
                        <span className="text-white">{String(value).substring(0, 50)}</span>
                      </div>
                    ))}
                    {Object.keys(typedData.message).length > 3 && (
                      <div className="text-xs text-slate-400">
                        +{Object.keys(typedData.message).length - 3} more fields
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Warning for all signatures */}
        {!dangerous && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <FileText className="flex-shrink-0 text-yellow-400 mt-0.5" size={20} />
              <div className="text-sm text-yellow-200">
                <div className="font-semibold mb-1">Signature Request</div>
                <p>
                  You are signing a message. This will not send a transaction or cost gas,
                  but may grant permissions or verify identity.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className={`flex-1 ${
              dangerous
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white py-3 rounded-lg font-semibold transition-colors`}
          >
            {dangerous ? 'Sign Anyway' : 'Sign'}
          </button>
        </div>
      </div>
    </div>
  );
};
