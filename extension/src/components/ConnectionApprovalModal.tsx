import React from 'react';
import { Shield, AlertCircle, Globe, X } from 'lucide-react';

interface ConnectionApprovalModalProps {
  origin: string;
  onApprove: () => void;
  onReject: () => void;
}

export const ConnectionApprovalModal: React.FC<ConnectionApprovalModalProps> = ({
  origin,
  onApprove,
  onReject
}) => {
  // Extract domain from origin for display
  const domain = new URL(origin).hostname;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield size={24} className="text-purple-400" />
            Connection Request
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
        <div className="bg-slate-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-purple-600 rounded-full p-2">
              <Globe size={20} />
            </div>
            <div className="flex-1">
              <div className="text-sm text-slate-400">Requesting site</div>
              <div className="font-semibold break-all">{domain}</div>
            </div>
          </div>
        </div>

        {/* Privacy Warning */}
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="flex-shrink-0 text-yellow-400 mt-0.5" size={20} />
            <div className="text-sm text-yellow-200">
              <div className="font-semibold mb-1">Privacy Notice</div>
              <p>
                This site will be able to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>View your wallet address</li>
                <li>Request transaction approvals</li>
                <li>View your account balance</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onApprove}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-colors"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};
