import { useState, useEffect, useCallback } from 'react';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { ChainType } from '../types/chainTypes';
import { getEvmNetwork, getEvmChainId } from '../adapters/evm/networks';
import { CHAIN_DISPLAY } from '../constants';
import { Chain } from '../types/messaging';
import { fetchEVMTransactionHistory, type TransactionHistoryItem } from '../services/transactionHistory';

interface TransactionHistoryProps {
  currentChain: string;
  address: string | null;
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export function TransactionHistory({ currentChain, address }: TransactionHistoryProps) {
  const { activeChainType } = useWallet();
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEVM = activeChainType === ChainType.EVM;
  const chainDisplay = CHAIN_DISPLAY[currentChain as Chain];
  const chainName = chainDisplay?.name || currentChain;

  const loadHistory = useCallback(async () => {
    if (!address || !isEVM) {
      setTransactions([]);
      return;
    }

    const chainId = getEvmChainId(currentChain);
    const network = getEvmNetwork(currentChain);

    if (!chainId || !network) {
      setError('Network not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const txs = await fetchEVMTransactionHistory(
        address,
        chainId,
        network.explorerUrl,
        network.nativeCurrency.symbol
      );
      setTransactions(txs);
    } catch (err) {
      setError('Failed to load transaction history');
      console.error('History load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address, currentChain, isEVM]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (!address) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-slate-400 text-center">No wallet connected</p>
      </div>
    );
  }

  // Non-EVM: coming soon placeholder
  if (!isEVM) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 gap-3">
        <Clock className="w-10 h-10 text-slate-500" />
        <p className="text-slate-400 text-center">
          Transaction history for {chainName} coming soon
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">History</h2>
          {chainDisplay && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: chainDisplay.color }}
              />
              <span>{chainName}</span>
            </div>
          )}
        </div>
        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-900/20 border border-red-700/50 rounded-lg mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-red-400 text-xs">{error}</span>
        </div>
      )}

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && transactions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            Loading transactions...
          </div>
        ) : transactions.length === 0 && !error ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            No transactions found
          </div>
        ) : (
          <div className="space-y-1.5">
            {transactions.map((tx) => (
              <div
                key={tx.hash}
                className="p-2.5 bg-slate-800 hover:bg-slate-750 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: direction + info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${tx.isIncoming ? 'bg-green-900/30' : 'bg-blue-900/30'}`}>
                      {tx.isIncoming ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white text-xs font-medium">
                          {tx.isIncoming ? 'Received' : 'Sent'}
                        </span>
                        {tx.method !== 'Transfer' && (
                          <span className="text-slate-500 text-[10px] truncate max-w-[80px]">
                            {tx.method}
                          </span>
                        )}
                        {tx.isFailed && (
                          <span className="text-[10px] bg-red-900/50 text-red-400 px-1 py-0.5 rounded">
                            Failed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-purple-400 text-[10px] font-mono transition-colors flex items-center gap-0.5"
                        >
                          {truncateHash(tx.hash)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Right: amount + time */}
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-medium ${tx.isIncoming ? 'text-green-400' : 'text-white'}`}>
                      {tx.isIncoming ? '+' : '-'}{tx.value} {tx.nativeCurrency}
                    </div>
                    <div className="text-slate-500 text-[10px]">{tx.localTime}</div>
                  </div>
                </div>

                {/* Gas cost row */}
                <div className="mt-1 text-[10px] text-slate-600 pl-9">
                  Gas: {tx.gasCost} {tx.nativeCurrency}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
