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
  // Initialize with account.chain if available, otherwise default to ethereum
  const [currentChain, setCurrentChain] = useState<Chain>(
    (account?.chain as Chain) || Chain.ETHEREUM
  );
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);

  console.log('📊 Dashboard render:', {
    accountChain: account?.chain,
    currentChain,
    showNetworkDropdown
  });

  // Sync currentChain state with account.chain from context
  useEffect(() => {
    if (account?.chain) {
      console.log('🔄 Syncing currentChain with account.chain:', account.chain);
      setCurrentChain(account.chain as Chain);
    }
  }, [account?.chain]);

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

    if (!account) {
      console.error('❌ No account available');
      return;
    }

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

      // Update the chain in storage using the account we already have
      const updatedAccount = { ...account, chain: newChain };
      await chrome.storage.local.set({ [StorageKey.ACCOUNT]: updatedAccount });
      console.log('✅ Storage updated with new chain:', newChain);

      // Fetch new balances - PASS the chain explicitly to avoid using stale state
      console.log('⏳ Fetching balances for', newChain);
      setIsRefreshing(true);
      await fetchBalances(newChain);
      console.log('✅ Network switch complete!');
    } catch (error) {
      console.error('❌ Error switching network:', error);
    }
  };

  const fetchBalances = async (chainToFetch?: Chain) => {
    if (!account) return;

    // Use the passed chain or fall back to current state
    const targetChain = chainToFetch || currentChain;

    setIsRefreshing(true);

    // Determine which tokens are available on target chain
    const availableTokens = CHAIN_TOKENS[targetChain] || [];

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
          balance = await WalletService.getBalance(account.address, targetChain);
        } else {
          // ERC-20 token balance
          const tokenAddress = TOKENS[symbol]?.[targetChain];
          if (!tokenAddress) {
            return {
              symbol,
              balance: '0',
              usdValue: 0,
              isLoading: false,
            };
          }
          balance = await WalletService.getBalance(account.address, targetChain, symbol);
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

  // Fetch balances when currentChain changes (currentChain is already synced with account.chain)
  useEffect(() => {
    if (account) {
      console.log('🔄 Fetching balances for chain:', currentChain);
      fetchBalances();
    }
  }, [currentChain]); // Only depend on currentChain, not account

  if (!account) return null;

  const chainInfo = CHAIN_DISPLAY[currentChain] || { name: currentChain, color: '#6B7280' };

  return (
    <div className="h-full bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-4 relative z-20">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">wAIllet</h1>
          <button
            onClick={() => fetchBalances()}
            disabled={isRefreshing}
            className="p-1.5 bg-purple-700/50 hover:bg-purple-700 rounded-full transition-colors disabled:opacity-50"
            title="Refresh balances"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Total USD Value */}
        <div className="text-center mb-3">
          <div className="text-2xl font-bold mb-0.5">
            {isRefreshing ? 'Loading...' : `$${totalUsd.toFixed(2)}`}
          </div>
          <div className="text-xs text-purple-200">Total Balance</div>
        </div>

        {/* Address */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 mx-auto px-3 py-1 bg-purple-700/50 hover:bg-purple-700 rounded-full text-xs transition-colors mb-3"
        >
          <span className="font-mono">{formatAddress(account.address)}</span>
          {copied ? <Check size={12} /> : <Copy size={12} />}
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
      <div className="p-4">
        <button
          onClick={() => setShowSendModal(true)}
          className="w-full flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
            <Send size={16} />
          </div>
          <span className="font-semibold text-sm">Send Transaction</span>
        </button>
      </div>

      {/* Token Balances */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        <h2 className="text-sm font-bold mb-3">Tokens</h2>

        {tokenBalances.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-3 text-center text-slate-400 text-sm">
            <p>No tokens available on this network</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tokenBalances.map((token) => {
              const hasBalance = token.balance !== 'Error' && parseFloat(token.balance) > 0;

              return (
                <div
                  key={token.symbol}
                  className={`bg-slate-800 rounded-lg p-3 ${
                    hasBalance ? 'border-l-4 border-purple-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center font-bold text-xs">
                        {token.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{token.symbol}</div>
                        <div className="text-xs text-slate-400">
                          ${token.usdValue.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {token.isLoading || isRefreshing ? (
                        <div className="text-slate-400 text-xs">Loading...</div>
                      ) : token.balance === 'Error' ? (
                        <div className="text-slate-400 text-xs">—</div>
                      ) : (
                        <div className="font-bold text-sm">
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
