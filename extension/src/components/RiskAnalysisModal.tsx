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
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
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

        <div className="p-4 space-y-4">
          {/* HIGH RISK WARNING BANNER */}
          {risk_level === RiskLevel.HIGH && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <div className="font-semibold text-red-400 mb-1">⚠️ High Risk Transaction</div>
                  <div className="text-sm text-red-300">
                    This transaction shows patterns commonly associated with scams or dangerous operations.
                    Proceed only if you absolutely trust this source.
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
          <div className={`${styles.bg} ${styles.border} border rounded-lg p-4`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {styles.icon}
                <span className={`font-semibold ${styles.text}`}>{risk_level} RISK</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {risk_score}<span className="text-sm text-slate-400">/100</span>
              </div>
            </div>

            {/* AI Summary */}
            <div className="text-sm text-slate-300 leading-relaxed">
              {ai_summary}
            </div>
          </div>

          {/* Contract Info (if applicable) */}
          {contract_info.is_contract && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm">
              <div className="font-medium text-white mb-1">Contract Interaction</div>
              <div className="space-y-1 text-slate-300">
                {contract_info.name && (
                  <div>Name: <span className="text-purple-400">{contract_info.name}</span></div>
                )}
                <div>
                  Verification:{' '}
                  <span className={contract_info.verified ? 'text-green-400' : 'text-yellow-400'}>
                    {contract_info.verified ? '✓ Verified' : '⚠ Unverified'}
                  </span>
                </div>
                {value_usd > 0 && (
                  <div>Value: <span className="text-white font-medium">${value_usd.toFixed(2)} USD</span></div>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div>
            <div className="font-medium text-white mb-2 text-sm">Recommendations:</div>
            <div className="space-y-2">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
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
              className="flex items-center justify-between w-full text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
              <span>Why is this {risk_level.toLowerCase()} risk?</span>
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showDetails && (
              <div className="mt-3 space-y-2">
                {factors.map((factor, idx) => (
                  <div key={idx} className="bg-slate-700/30 rounded p-3 text-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-medium text-white">{factor.title}</div>
                      <div className="text-xs text-slate-400 flex-shrink-0">+{factor.points} pts</div>
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
          <div className="text-xs text-slate-500 text-center pt-2">
            Powered by AI risk analysis • Not financial advice
          </div>
        </div>
      </div>
    </div>
  );
}
