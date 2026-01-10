/**
 * Risk Analysis Modal
 */

import { useState } from 'react';
import { Shield, AlertTriangle, AlertCircle, CheckCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  RiskLevel,
  RiskFactorType,
  type RiskAnalysisResponse
} from '../services/api';

interface RiskAnalysisData extends RiskAnalysisResponse {}

interface RiskAnalysisModalProps {
  riskData: RiskAnalysisData;
  origin: string;
  onProceed: () => void;
  onBlock: () => void;
  onLimitApproval?: () => void;  // Optional: for ERC-20 approvals
}

export function RiskAnalysisModal({
  riskData,
  origin,
  onProceed,
  onBlock,
  onLimitApproval
}: RiskAnalysisModalProps) {
  const [showDetails, setShowDetails] = useState(false);

  const { risk_score, risk_level, ai_summary, factors, recommendations, contract_info, value_usd } = riskData;

  // Risk level styling
  const getRiskStyles = () => {
    switch (risk_level) {
      case RiskLevel.LOW:
        return {
          bg: 'bg-green-500/10',
          border: 'border-green-500/30',
          text: 'text-green-400',
          icon: <CheckCircle className="text-green-400" size={24} />
        };
      case RiskLevel.MEDIUM:
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          text: 'text-yellow-400',
          icon: <AlertCircle className="text-yellow-400" size={24} />
        };
      case RiskLevel.HIGH:
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-400',
          icon: <AlertTriangle className="text-red-400" size={24} />
        };
      default:
        return {
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/30',
          text: 'text-gray-400',
          icon: <Shield className="text-gray-400" size={24} />
        };
    }
  };

  const styles = getRiskStyles();

  // Check if this is an unlimited approval
  const hasUnlimitedApproval = factors.some(f => f.type === RiskFactorType.UNLIMITED_APPROVAL);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-60">
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-purple-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Security Analysis</h2>
          </div>
          <button
            onClick={onBlock}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {/* HIGH RISK WARNING BANNER */}
          {risk_level === RiskLevel.HIGH && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
                <div className="text-sm">
                  <div className="font-semibold text-red-400 mb-1">⚠️ High Risk</div>
                  <div className="text-red-300">
                    Potential scam pattern detected. Only proceed if you fully trust this site.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Requesting Site */}
          <div className="text-sm text-slate-400">
            <span className="font-medium text-white">Requesting site:</span>{' '}
            <span className="text-purple-400">{origin}</span>
          </div>

          {/* Risk Score Badge */}
          <div className={`${styles.bg} ${styles.border} border rounded-lg p-3`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {styles.icon}
                <span className={`font-semibold ${styles.text} text-sm`}>{risk_level} RISK</span>
              </div>
              <div className="text-xl font-bold text-white">
                {risk_score}<span className="text-xs text-slate-400">/100</span>
              </div>
            </div>

            {/* AI Summary - Compact */}
            <div className="text-xs text-slate-300 leading-snug">
              {ai_summary.split('.')[0]}.
            </div>
          </div>

          {/* Contract Info (if applicable) */}
          {contract_info.is_contract && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-xs">
              <div className="font-medium text-white mb-1.5">Contract Details</div>
              <div className="space-y-0.5 text-slate-300">
                {contract_info.name && (
                  <div>• <span className="text-purple-400">{contract_info.name}</span></div>
                )}
                <div>
                  • {contract_info.verified ? '✓ Verified' : '⚠ Unverified'}
                </div>
                {value_usd > 0 && (
                  <div>• <span className="text-white font-medium">${value_usd.toFixed(2)} USD</span></div>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div>
            <div className="font-medium text-white mb-1.5 text-sm">Tips:</div>
            <div className="space-y-1">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0 mt-0.5">{rec.icon}</span>
                  <span className="text-slate-300">{rec.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expandable Risk Factors */}
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
              <span>Why {risk_level.toLowerCase()} risk?</span>
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showDetails && (
              <div className="mt-2 space-y-1.5">
                {factors.map((factor, idx) => (
                  <div key={idx} className="bg-slate-700/30 rounded p-2 text-xs">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div className="font-medium text-white">{factor.title}</div>
                      <div className="text-xs text-slate-400 flex-shrink-0">+{factor.points}</div>
                    </div>
                    <div className="text-slate-300 text-xs">{factor.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {/* Block Button (always available, emphasized for HIGH risk) */}
            <button
              onClick={onBlock}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                risk_level === RiskLevel.HIGH
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              Block
            </button>

            {/* Limited Approval Button (only for unlimited approvals) */}
            {hasUnlimitedApproval && onLimitApproval && (
              <button
                onClick={onLimitApproval}
                className="flex-1 py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold transition-colors"
              >
                Set Limited Approval
              </button>
            )}

            {/* Proceed Button (de-emphasized for HIGH risk) */}
            <button
              onClick={onProceed}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                risk_level === RiskLevel.LOW
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : risk_level === RiskLevel.MEDIUM
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
              }`}
            >
              {risk_level === RiskLevel.HIGH ? 'Proceed Anyway' : 'Proceed'}
            </button>
          </div>

          {/* Footer Note */}
          <div className="text-xs text-slate-500 text-center pt-1">
            AI-powered • Not financial advice
          </div>
        </div>
      </div>
    </div>
  );
}
