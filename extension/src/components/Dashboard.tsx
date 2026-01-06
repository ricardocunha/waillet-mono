import React, { useState, useEffect } from 'react';
import { Copy, Check, Send, Download, RefreshCw } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { WalletService, CHAINS } from '../services/wallet';

interface Balance {
  chain: string;
  chainName: string;
  balance: string;
  nativeCurrency: string;
  isLoading: boolean;
}

export const Dashboard: React.FC = () => {
  const { account } = useWallet();
  const [copied, setCopied] = useState(false);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopy = () => {
    if (account) {
      navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const fetchBalances = async () => {
    if (!account) return;

    setIsRefreshing(true);

    const displayChains = ['sepolia', 'base-sepolia'];

    const initialBalances: Balance[] = displayChains.map(chainKey => ({
      chain: chainKey,
      chainName: CHAINS[chainKey].name,
      balance: '0',
      nativeCurrency: CHAINS[chainKey].nativeCurrency,
      isLoading: true,
    }));

    setBalances(initialBalances);

    const fetchBalanceWithRetry = async (chainKey: string, retries = 2): Promise<Balance> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          console.log(`Fetching balance for ${chainKey} (attempt ${attempt + 1}/${retries + 1})`);
          const balance = await WalletService.getBalance(account.address, chainKey);
          console.log(`✅ ${chainKey}: ${balance}`);
          return {
            chain: chainKey,
            chainName: CHAINS[chainKey].name,
            balance: parseFloat(balance).toFixed(6),
            nativeCurrency: CHAINS[chainKey].nativeCurrency,
            isLoading: false,
          };
        } catch (err) {
          console.error(`❌ Failed to fetch balance for ${chainKey} (attempt ${attempt + 1}):`, err);
          if (attempt === retries) {
            return {
              chain: chainKey,
              chainName: CHAINS[chainKey].name,
              balance: 'Error',
              nativeCurrency: CHAINS[chainKey].nativeCurrency,
              isLoading: false,
            };
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      return {
        chain: chainKey,
        chainName: CHAINS[chainKey].name,
        balance: 'Error',
        nativeCurrency: CHAINS[chainKey].nativeCurrency,
        isLoading: false,
      };
    };

    const balancePromises = displayChains.map(chainKey => fetchBalanceWithRetry(chainKey));

    const fetchedBalances = await Promise.all(balancePromises);
    setBalances(fetchedBalances);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchBalances();
  }, [account]);

  if (!account) return null;

  return (
    <div className="h-full bg-slate-900 flex flex-col overflow-y-auto">
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Waillet</h1>
          <button
            onClick={fetchBalances}
            disabled={isRefreshing}
            className="p-2 bg-purple-700/50 hover:bg-purple-700 rounded-full transition-colors disabled:opacity-50"
            title="Refresh balances"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold mb-2">
            {isRefreshing ? 'Loading...' : 'Your Wallet'}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 mx-auto px-3 py-1 bg-purple-700/50 hover:bg-purple-700 rounded-full text-sm transition-colors"
          >
            <span className="font-mono">{formatAddress(account.address)}</span>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-6">
        <button className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
            <Send size={20} />
          </div>
          <span className="font-semibold">Send</span>
        </button>

        <button className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
            <Download size={20} />
          </div>
          <span className="font-semibold">Receive</span>
        </button>
      </div>

      <div className="flex-1 px-6 pb-6">
        <h2 className="text-lg font-bold mb-4">Balances by Network</h2>
        
        {balances.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-4 text-center text-slate-400">
            <p>Loading balances...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {balances.map((balance) => {
              const hasBalance = balance.balance !== 'Error' && parseFloat(balance.balance) > 0;
              
              return (
                <div
                  key={balance.chain}
                  className={`bg-slate-800 rounded-lg p-4 ${
                    hasBalance ? 'border-l-4 border-purple-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{balance.chainName}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {balance.chain}
                      </div>
                    </div>
                    <div className="text-right">
                      {balance.isLoading ? (
                        <div className="text-slate-400">Loading...</div>
                      ) : balance.balance === 'Error' ? (
                        <div className="text-red-400 text-sm">Failed to load</div>
                      ) : (
                        <>
                          <div className="font-bold text-lg">
                            {balance.balance}
                          </div>
                          <div className="text-xs text-slate-400">
                            {balance.nativeCurrency}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 p-4 bg-slate-800/50 rounded-lg text-sm text-slate-400">
          <p className="mb-2">💡 <span className="font-semibold">Tip:</span></p>
          <p>• Click the refresh button (↻) to update balances</p>
          <p className="mt-1">• Get free test tokens from faucets (see docs)</p>
          <p className="mt-1">• Showing 3 testnets only (safe for testing)</p>
        </div>
      </div>
    </div>
  );
};

