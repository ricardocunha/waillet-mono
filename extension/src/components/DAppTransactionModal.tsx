import React, { useState, useEffect } from 'react';
import { Shield, Globe, X, AlertCircle, Loader2 } from 'lucide-react';
import { formatUnits } from 'ethers';
import { api, type RiskAnalysisResponse } from '../services/api';
import { RiskAnalysisModal } from './RiskAnalysisModal';
import { useWallet } from '../context/WalletContext';

interface DAppTransactionModalProps {
  txParams: {
    from?: string;
    to: string;
    value?: string;
    data?: string;
    gas?: string;
    gasPrice?: string;
  };
  origin: string;
  onApprove: (txHash: string) => void;
  onReject: (error?: string) => void;
}

export const DAppTransactionModal: React.FC<DAppTransactionModalProps> = ({
  txParams,
  origin,
  onApprove,
  onReject
}) => {
  const { account } = useWallet();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [riskData, setRiskData] = useState<RiskAnalysisResponse | null>(null);
  const [showRiskModal, setShowRiskModal] = useState(false);

  // Extract domain from origin
  const domain = new URL(origin).hostname;

  // Parse transaction value
  const valueInWei = txParams.value ? BigInt(txParams.value) : BigInt(0);
  const valueInEth = formatUnits(valueInWei, 18);

  // Determine if this is a contract interaction
  const isContractInteraction = txParams.data && txParams.data !== '0x' && txParams.data.length > 2;

  // Auto-trigger risk analysis on mount
  useEffect(() => {
    performRiskAnalysis();
  }, []);

  const performRiskAnalysis = async () => {
    if (!account) {
      setError('Wallet not available');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('[DAppTransactionModal] Starting risk analysis...');

      const analysis = await api.analyzeRisk({
        wallet_address: account.address,
        to_address: txParams.to,
        value: txParams.value || '0x0',
        data: txParams.data || '0x',
        chain: 'sepolia' // TODO: Get from account storage
      });

      console.log('[DAppTransactionModal] Risk analysis complete:', analysis);

      setRiskData(analysis);
      setShowRiskModal(true);
      setIsAnalyzing(false);
    } catch (err: any) {
      console.error('[DAppTransactionModal] Risk analysis error:', err);
      setError(err.message || 'Risk analysis failed');
      setIsAnalyzing(false);
    }
  };

  const handleRiskProceed = async () => {
    if (!riskData || !account) return;

    setShowRiskModal(false);
    setIsExecuting(true);
    setError(null);

    try {
      console.log('[DAppTransactionModal] Executing transaction...');

      // Send transaction via background script
      const txHash = await sendTransaction({
        from: account.address,
        to: txParams.to,
        value: txParams.value || '0x0',
        data: txParams.data || '0x',
        chain: 'sepolia' // TODO: Get from account storage
      });

      // Record decision
      await api.recordRiskDecision({
        risk_log_id: riskData.risk_log_id,
        approved: true,
        tx_hash: txHash
      });

      console.log('[DAppTransactionModal] Transaction successful:', txHash);
      onApprove(txHash);
    } catch (err: any) {
      console.error('[DAppTransactionModal] Transaction error:', err);
      setError(err.message || 'Transaction failed');
      setIsExecuting(false);
      setShowRiskModal(true); // Show risk modal again
    }
  };

  const handleRiskBlock = async () => {
    if (!riskData) return;

    try {
      // Record blocked decision
      await api.recordRiskDecision({
        risk_log_id: riskData.risk_log_id,
        approved: false
      });

      console.log('[DAppTransactionModal] Transaction blocked by user');
      onReject('User blocked transaction based on risk analysis');
    } catch (err: any) {
      console.error('[DAppTransactionModal] Error recording block:', err);
      // Still reject even if logging fails
      onReject('User blocked transaction');
    }
  };

  const handleReject = async () => {
    if (riskData) {
      // Record rejection if risk analysis was done
      try {
        await api.recordRiskDecision({
          risk_log_id: riskData.risk_log_id,
          approved: false
        });
      } catch (err) {
        console.error('[DAppTransactionModal] Error recording rejection:', err);
      }
    }

    onReject('User rejected transaction');
  };

  // Helper function to send transaction
  const sendTransaction = async (_params: {
    from: string;
    to: string;
    value: string;
    data: string;
    chain: string;
  }): Promise<string> => {
    // TODO: Integrate with actual transaction sending logic
    // For now, simulate transaction execution
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate random success/failure for testing
        const success = Math.random() > 0.1; // 90% success rate
        if (success) {
          // Generate fake tx hash
          const fakeTxHash = '0x' + Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join('');
          resolve(fakeTxHash);
        } else {
          reject(new Error('Insufficient funds for gas'));
        }
      }, 2000);
    });
  };

  return (
    <>
      {/* Risk Analysis Modal (shown after analysis completes) */}
      {showRiskModal && riskData && (
        <RiskAnalysisModal
          riskData={riskData}
          origin={origin}
          onProceed={handleRiskProceed}
          onBlock={handleRiskBlock}
        />
      )}

      {/* Transaction Preview Modal (shown during analysis or execution) */}
      {!showRiskModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Shield size={24} className="text-purple-400" />
                {isAnalyzing ? 'Analyzing Transaction' : isExecuting ? 'Executing Transaction' : 'Transaction Request'}
              </h2>
              <button
                onClick={handleReject}
                className="text-slate-400 hover:text-white transition"
                aria-label="Close"
                disabled={isAnalyzing || isExecuting}
              >
                <X size={24} />
              </button>
            </div>

        {/* Origin */}
        <div className="bg-slate-700 rounded-lg p-3 mb-4 flex items-center gap-3">
          <Globe size={18} className="text-slate-400" />
          <div>
            <div className="text-xs text-slate-400">Requesting from</div>
            <div className="font-semibold text-sm break-all">{domain}</div>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-slate-700/50 rounded-lg p-4 mb-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-400 text-sm">To</span>
            <span className="font-mono text-sm break-all max-w-[200px] text-right">
              {txParams.to.slice(0, 10)}...{txParams.to.slice(-8)}
            </span>
          </div>

          {valueInWei > BigInt(0) && (
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Amount</span>
              <span className="font-semibold">{valueInEth} ETH</span>
            </div>
          )}

          {isContractInteraction && (
            <div className="flex justify-between items-start">
              <span className="text-slate-400 text-sm">Type</span>
              <span className="text-sm bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                Contract Interaction
              </span>
            </div>
          )}

          {txParams.data && txParams.data.length > 10 && (
            <div className="pt-2 border-t border-slate-600">
              <div className="text-xs text-slate-400 mb-1">Data</div>
              <div className="font-mono text-xs bg-slate-800 p-2 rounded break-all">
                {txParams.data.slice(0, 50)}...
              </div>
            </div>
          )}
        </div>

            {/* Analyzing Notice */}
            {isAnalyzing && (
              <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin text-purple-400" size={24} />
                  <div>
                    <div className="font-semibold text-purple-300 mb-1">Analyzing Transaction Security</div>
                    <div className="text-sm text-purple-200">
                      Checking for scams, unlimited approvals, and other risks...
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Executing Notice */}
            {isExecuting && (
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin text-blue-400" size={24} />
                  <div>
                    <div className="font-semibold text-blue-300 mb-1">Executing Transaction</div>
                    <div className="text-sm text-blue-200">
                      Please wait while your transaction is being processed...
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4">
                <div className="flex gap-2">
                  <AlertCircle className="flex-shrink-0 text-red-400" size={18} />
                  <div className="text-sm text-red-200 break-words flex-1">{error}</div>
                </div>
              </div>
            )}

            {/* Actions - only shown during analysis/execution */}
            {!isAnalyzing && !isExecuting && (
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
