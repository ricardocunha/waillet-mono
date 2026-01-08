import React, { useState, useEffect } from 'react';
import { Copy, Check, Send, RefreshCw, ChevronDown } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { WalletService, TOKENS } from '../services/wallet';
import { SendTransactionModal } from './SendTransactionModal';
import { Chain, Token, CHAIN_TOKENS } from '../types/messaging';
import { CHAIN_DISPLAY, SUPPORTED_CHAINS, StorageKey } from '../constants';

interface TokenBalance {
  symbol: string;
  balance: string;
  usdValue: number;
  isLoading: boolean;
}

// Token prices in USD
//TODO connect with coin market kap or coingecko to get tokens real price
const TOKEN_PRICES: Partial<Record<Token, number>> = {
  [Token.ETH]: 2500,
  [Token.USDT]: 1,
  [Token.LINK]: 15,
};

export const Dashboard: React.FC = () => {
  const { account } = useWallet();
  const [copied, setCopied] = useState(false);
  const [currentChain, setCurrentChain] = useState<Chain>(Chain.SEPOLIA);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);

  console.log('📊 Dashboard render - showNetworkDropdown:', showNetworkDropdown);
  console.log('🔗 SUPPORTED_CHAINS:', SUPPORTED_CHAINS);

  // Load current chain from storage
  useEffect(() => {
    const loadChain = async () => {
      const result = await chrome.storage.local.get(StorageKey.ACCOUNT);
      if (result.account?.chain) {
        setCurrentChain(result.account.chain as Chain);
      }
    };
    loadChain();
  }, []);

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

  const handleNetworkSwitch = async (newChain: Chain) => {
    console.log('🔄 Network switch clicked!', newChain);

    try {
      // Update state immediately for UI
      setCurrentChain(newChain);
      setShowNetworkDropdown(false);

      // Clear token balances and show loading state immediately
      const availableTokens = CHAIN_TOKENS[newChain] || [];
      const loadingBalances = availableTokens.map(symbol => ({
        symbol,
        balance: '0',
        usdValue: 0,
        isLoading: true,
      }));
      setTokenBalances(loadingBalances);
      setTotalUsd(0);

      // Get current account from storage
      const result = await chrome.storage.local.get(StorageKey.ACCOUNT);
      console.log('📦 Storage retrieved:', result);

      // Update the chain in storage if account exists
      if (result.account) {
        const updatedAccount = { ...result.account, chain: newChain };
        await chrome.storage.local.set({ [StorageKey.ACCOUNT]: updatedAccount });
        console.log('✅ Storage updated with new chain:', newChain);
      } else {
        console.warn('⚠️ No account in storage, only updating UI state');
      }

      // Fetch new balances
      console.log('⏳ Fetching balances for', newChain);
      setIsRefreshing(true);
      await fetchBalances();
      console.log('✅ Network switch complete!');
    } catch (error) {
      console.error('❌ Error switching network:', error);
    }
  };

  const fetchBalances = async () => {
    if (!account) return;

    setIsRefreshing(true);

    // Determine which tokens are available on current chain
    const availableTokens = CHAIN_TOKENS[currentChain] || [];

    const initialBalances: TokenBalance[] = availableTokens.map(symbol => ({
      symbol,
      balance: '0',
      usdValue: 0,
      isLoading: true,
    }));

    setTokenBalances(initialBalances);

    // Fetch balances for each token
    const balancePromises = availableTokens.map(async (symbol): Promise<TokenBalance> => {
      try {
        let balance: string;

        if (symbol === Token.ETH) {
          // Native token balance
          balance = await WalletService.getBalance(account.address, currentChain);
        } else {
          // ERC-20 token balance
          const tokenAddress = TOKENS[symbol]?.[currentChain];
          if (!tokenAddress) {
            return {
              symbol,
              balance: '0',
              usdValue: 0,
              isLoading: false,
            };
          }
          balance = await WalletService.getBalance(account.address, currentChain, symbol);
        }

        const balanceNum = parseFloat(balance);
        const usdValue = balanceNum * (TOKEN_PRICES[symbol as Token] || 0);

        return {
          symbol,
          balance: balanceNum.toFixed(6),
          usdValue,
          isLoading: false,
        };
      } catch (err) {
        console.error(`Failed to fetch ${symbol} balance:`, err);
        return {
          symbol,
          balance: 'Error',
          usdValue: 0,
          isLoading: false,
        };
      }
    });

    const fetchedBalances = await Promise.all(balancePromises);
    setTokenBalances(fetchedBalances);

    // Calculate total USD value
    const total = fetchedBalances.reduce((sum, token) => sum + token.usdValue, 0);
    setTotalUsd(total);

    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchBalances();
  }, [account, currentChain]);

  if (!account) return null;

  const chainInfo = CHAIN_DISPLAY[currentChain] || { name: currentChain, color: '#6B7280' };

  return (
    <div className="h-full bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-6 relative z-20">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">wAIllet</h1>
          <button
            onClick={fetchBalances}
            disabled={isRefreshing}
            className="p-2 bg-purple-700/50 hover:bg-purple-700 rounded-full transition-colors disabled:opacity-50"
            title="Refresh balances"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Total USD Value */}
        <div className="text-center mb-4">
          <div className="text-3xl font-bold mb-1">
            {isRefreshing ? 'Loading...' : `$${totalUsd.toFixed(2)}`}
          </div>
          <div className="text-sm text-purple-200">Total Balance</div>
        </div>

        {/* Address */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 mx-auto px-3 py-1 bg-purple-700/50 hover:bg-purple-700 rounded-full text-sm transition-colors mb-4"
        >
          <span className="font-mono">{formatAddress(account.address)}</span>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>

        {/* Network Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🖱️ SELECTOR CLICKED! Current:', showNetworkDropdown);
              setShowNetworkDropdown(prev => !prev);
            }}
            className="w-full flex items-center justify-between px-4 py-2 bg-purple-700/50 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: chainInfo.color }}
              />
              <span className="font-semibold">{chainInfo.name}</span>
            </div>
            <ChevronDown size={16} className={showNetworkDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>

          {showNetworkDropdown && (
            <div className="absolute top-full mt-2 w-full bg-slate-800 rounded-lg border border-slate-700 shadow-lg z-50">
              {SUPPORTED_CHAINS.map((chain, index) => {
                const info = CHAIN_DISPLAY[chain]!;
                console.log('🔧 Rendering chain button:', chain, info);
                return (
                  <button
                    key={chain}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🎯 BUTTON CLICKED:', chain);
                      handleNetworkSwitch(chain);
                    }}
                    type="button"
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors ${
                      chain === currentChain ? 'bg-slate-700' : ''
                    } ${index === 0 ? 'rounded-t-lg' : ''} ${
                      index === SUPPORTED_CHAINS.length - 1 ? 'rounded-b-lg' : ''
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: info.color }}
                    />
                    <span className="font-medium">{info.name}</span>
                    {chain === currentChain && (
                      <Check size={14} className="ml-auto text-purple-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Send Button */}
      <div className="p-6">
        <button
          onClick={() => setShowSendModal(true)}
          className="w-full flex items-center justify-center gap-3 p-4 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
            <Send size={20} />
          </div>
          <span className="font-semibold text-lg">Send Transaction</span>
        </button>
      </div>

      {/* Token Balances */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Tokens</h2>

        {tokenBalances.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-4 text-center text-slate-400">
            <p>No tokens available on this network</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokenBalances.map((token) => {
              const hasBalance = token.balance !== 'Error' && parseFloat(token.balance) > 0;

              return (
                <div
                  key={token.symbol}
                  className={`bg-slate-800 rounded-lg p-4 ${
                    hasBalance ? 'border-l-4 border-purple-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-sm">
                        {token.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold">{token.symbol}</div>
                        <div className="text-xs text-slate-400">
                          ${token.usdValue.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {token.isLoading || isRefreshing ? (
                        <div className="text-slate-400 text-sm">Loading...</div>
                      ) : token.balance === 'Error' ? (
                        <div className="text-slate-400 text-sm">—</div>
                      ) : (
                        <div className="font-bold text-lg">
                          {token.balance}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showSendModal && <SendTransactionModal onClose={() => setShowSendModal(false)} />}
    </div>
  );
};
