import React from 'react';
import { Shield, ArrowRight, X, Network } from 'lucide-react';
import { CHAIN_DISPLAY } from '../constants';
import { Chain } from '../types/messaging';
import { NetworkIcon } from './NetworkIcon';

interface NetworkSwitchModalProps {
  origin: string;
  chainName: string;
  chainIdDecimal: number;
  chainId: string;
  currentChain?: string;
  onApprove: () => void;
  onReject: () => void;
}

export const NetworkSwitchModal: React.FC<NetworkSwitchModalProps> = ({
  origin,
  chainName,
  chainIdDecimal,
  chainId,
  currentChain,
  onApprove,
  onReject
}) => {
  const domain = new URL(origin).hostname;
  const targetChain = CHAIN_DISPLAY[chainName as Chain] || { name: chainName, color: '#6B7280' };
  const fromChain = currentChain ? CHAIN_DISPLAY[currentChain as Chain] : null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg max-w-md w-full p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Network size={20} className="text-purple-400" />
            Switch Network
          </h2>
          <button
            onClick={onReject}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Origin Display */}
        <div className="bg-slate-700 rounded-lg p-3 mb-3">
          <div className="text-xs text-slate-400 mb-1">Requesting site</div>
          <div className="text-sm font-semibold break-all">{domain}</div>
        </div>

        {/* Network Switch Visualization */}
        <div className="bg-slate-700 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            {/* Current Chain */}
            {fromChain && currentChain && (
              <div className="flex-1 text-center">
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: fromChain.color + '30', border: `2px solid ${fromChain.color}` }}
                >
                  <NetworkIcon chain={currentChain as Chain} size="lg" />
                </div>
                <div className="text-xs text-slate-400">Current</div>
                <div className="text-sm font-semibold">{fromChain.name}</div>
              </div>
            )}

            {/* Arrow */}
            {fromChain && (
              <div className="px-2">
                <ArrowRight size={20} className="text-slate-400" />
              </div>
            )}

            {/* Target Chain */}
            <div className="flex-1 text-center">
              <div
                className="w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: targetChain.color + '30', border: `2px solid ${targetChain.color}` }}
              >
                <NetworkIcon chain={chainName as Chain} size="lg" />
              </div>
              <div className="text-xs text-slate-400">Switch to</div>
              <div className="text-sm font-semibold">{targetChain.name}</div>
            </div>
          </div>

          {/* Chain ID Info */}
          <div className="mt-3 pt-3 border-t border-slate-600">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Chain ID:</span>
              <span className="font-mono">{chainIdDecimal} ({chainId})</span>
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
          <div className="flex gap-2">
            <Shield className="flex-shrink-0 text-blue-400 mt-0.5" size={18} />
            <div className="text-xs text-blue-200">
              <div className="font-semibold mb-1">Network Switch</div>
              <p>
                This site is requesting to switch your wallet to {targetChain.name}.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onReject}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onApprove}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
          >
            Switch Network
          </button>
        </div>
      </div>
    </div>
  );
};
