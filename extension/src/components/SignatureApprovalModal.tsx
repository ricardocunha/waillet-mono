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

  // Helper to format values for display
  const formatValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-slate-500">null</span>;

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        // For arrays, show first few items or expand button
        return (
          <div className="text-sm">
            {value.length <= 2 ? (
              value.map((item, i) => (
                <div key={i} className="ml-2">• {formatValue(item)}</div>
              ))
            ) : (
              <span className="text-slate-400">[{value.length} items - expand to view]</span>
            )}
          </div>
        );
      }
      // For objects, show key-value pairs
      const entries = Object.entries(value);
      if (entries.length === 0) return <span className="text-slate-500">{'{}'}</span>;

      return (
        <div className="ml-2 text-xs space-y-1">
          {entries.map(([k, v]) => (
            <div key={k}>
              <span className="text-purple-400">{k}:</span>{' '}
              <span className="text-white">
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    const str = String(value);
    return str.length > 50 ? str.substring(0, 50) + '...' : str;
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-3 z-50">
      <div className="bg-slate-800 rounded-lg max-w-lg w-full p-3 my-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Shield size={18} className={dangerous ? "text-red-400" : "text-purple-400"} />
            Signature Request
          </h2>
          <button
            onClick={onReject}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Origin Display */}
        <div className="bg-slate-700 rounded-lg p-2 mb-2">
          <div className="text-xs text-slate-400">Requesting site</div>
          <div className="text-xs font-semibold break-all">{domain}</div>
        </div>

        {/* Dangerous Warning (eth_sign) */}
        {dangerous && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-2 mb-2">
            <div className="flex gap-2">
              <AlertTriangle className="flex-shrink-0 text-red-400 mt-0.5" size={16} />
              <div className="text-xs text-red-200">
                <div className="font-bold mb-1">⚠️ DANGEROUS REQUEST</div>
                <p>
                  <strong>eth_sign</strong> can sign arbitrary data. Only approve if you trust this site.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Message Display */}
        {isPersonalSign && displayMessage && (
          <div className="bg-slate-700 rounded-lg p-2 mb-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-slate-400">Message</div>
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                {showRawData ? <><EyeOff size={12} /> Hide Raw</> : <><Eye size={12} /> Show Raw</>}
              </button>
            </div>
            <div className="bg-slate-800 rounded p-2 font-mono text-xs break-all max-h-32 overflow-y-auto scrollbar-hide">
              {showRawData ? message : displayMessage}
            </div>
          </div>
        )}

        {/* eth_sign message (always show raw) */}
        {isEthSign && message && (
          <div className="bg-slate-700 rounded-lg p-2 mb-2">
            <div className="text-xs text-slate-400 mb-1">Data to sign (hex)</div>
            <div className="bg-slate-800 rounded p-2 font-mono text-xs break-all max-h-32 overflow-y-auto scrollbar-hide text-red-300">
              {message}
            </div>
          </div>
        )}

        {/* Typed Data Display */}
        {isTypedData && typedData && (
          <div className="bg-slate-700 rounded-lg p-2 mb-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between mb-1"
            >
              <div className="text-xs text-slate-400">Structured data</div>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Domain Info */}
            {typedData.domain && (
              <div className="bg-slate-800 rounded p-2 mb-1">
                <div className="text-xs text-slate-400">Contract</div>
                <div className="font-semibold text-xs">{typedData.domain.name || 'Unknown'}</div>
                {typedData.domain.verifyingContract && (
                  <div className="font-mono text-xs text-slate-400 mt-0.5 break-all">
                    {typedData.domain.verifyingContract}
                  </div>
                )}
              </div>
            )}

            {/* Message Preview */}
            {typedData.message && (
              <div className="bg-slate-800 rounded p-2">
                <div className="text-xs text-slate-400 mb-1">Message</div>
                {expanded ? (
                  <pre className="text-xs font-mono overflow-x-auto scrollbar-hide max-h-40 overflow-y-auto scrollbar-hide">
                    {JSON.stringify(typedData.message, null, 2)}
                  </pre>
                ) : (
                  <div className="text-xs space-y-0.5">
                    {Object.entries(typedData.message).slice(0, 4).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-slate-400 font-semibold">{key}: </span>
                        <span className="text-white">{formatValue(value)}</span>
                      </div>
                    ))}
                    {Object.keys(typedData.message).length > 4 && (
                      <div className="text-xs text-slate-400 mt-1">
                        +{Object.keys(typedData.message).length - 4} more (expand to view)
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
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-2 mb-2">
            <div className="flex gap-2">
              <FileText className="flex-shrink-0 text-yellow-400 mt-0.5" size={16} />
              <div className="text-xs text-yellow-200">
                <p>
                  You are signing a message. This will not cost gas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onReject}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className={`flex-1 ${
              dangerous
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white py-2 rounded-lg font-semibold transition-colors text-sm`}
          >
            {dangerous ? 'Sign Anyway' : 'Sign'}
          </button>
        </div>
      </div>
    </div>
  );
};
