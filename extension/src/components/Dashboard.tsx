import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, ChevronDown, Star, MoreVertical, Settings, Check } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { WalletService, TOKENS } from '../services/wallet';
import { SendTransactionModal } from './SendTransactionModal';
import { SaveFavoriteModal } from './SaveFavoriteModal';
import { AccountSettingsModal } from './AccountSettingsModal';
import { AccountSelector } from './AccountSelector';
import { AddAccountModal } from './AddAccountModal';
import { Chain, Token, CHAIN_TOKENS } from '../types/messaging';
import { CHAIN_DISPLAY, MAINNET_CHAINS, TESTNET_CHAINS } from '../constants';

interface TokenBalance {
  symbol: string;
  balance: string;
  usdValue: number;
  isLoading: boolean;
}

// TODO: fetch real prices from CoinGecko/CoinMarketCap
const TOKEN_PRICES: Partial<Record<Token, number>> = {
  [Token.ETH]: 2500,
  [Token.BNB]: 600,
  [Token.USDT]: 1,
  [Token.USDC]: 1,
};

export const Dashboard: React.FC = () => {
  const { account, updateChain } = useWallet();
  const [currentChain, setCurrentChain] = useState<Chain>(
    (account?.chain as Chain) || Chain.ETHEREUM
  );
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  useEffect(() => {
    if (account?.chain) {
      setCurrentChain(account.chain as Chain);
    }
  }, [account?.chain]);

  const handleNetworkSwitch = async (newChain: Chain) => {
    if (!account) return;

    try {
      setCurrentChain(newChain);
      setShowNetworkDropdown(false);

      const availableTokens = CHAIN_TOKENS[newChain] || [];
      const loadingBalances = availableTokens.map(symbol => ({
        symbol,
        balance: '0',
        usdValue: 0,
        isLoading: true,
      }));
      setTokenBalances(loadingBalances);
      setTotalUsd(0);

      // Update chain in wallet context (persists to storage)
      await updateChain(newChain);

      setIsRefreshing(true);
      await fetchBalances(newChain, account.address);
    } catch (error) {
      console.error('Error switching network:', error);
    }
  };

  const fetchBalances = async (chainToFetch?: Chain, addressToFetch?: string) => {
    const targetAddress = addressToFetch || account?.address;
    if (!targetAddress) return;

    const targetChain = chainToFetch || currentChain;
    setIsRefreshing(true);

    const availableTokens = CHAIN_TOKENS[targetChain] || [];
    const initialBalances: TokenBalance[] = availableTokens.map(symbol => ({
      symbol,
      balance: '0',
      usdValue: 0,
      isLoading: true,
    }));
    setTokenBalances(initialBalances);

    const balancePromises = availableTokens.map(async (symbol): Promise<TokenBalance> => {
      try {
        let balance: string;

        if (symbol === Token.ETH || symbol === Token.BNB) {
          balance = await WalletService.getBalance(targetAddress, targetChain);
        } else {
          const tokenAddress = TOKENS[symbol]?.[targetChain];
          if (!tokenAddress) {
            return { symbol, balance: '0', usdValue: 0, isLoading: false };
          }
          balance = await WalletService.getBalance(targetAddress, targetChain, symbol);
        }

        const balanceNum = parseFloat(balance);
        const usdValue = balanceNum * (TOKEN_PRICES[symbol as Token] || 0);
        return { symbol, balance: balanceNum.toFixed(6), usdValue, isLoading: false };
      } catch (err) {
        console.error(`Failed to fetch ${symbol} balance:`, err);
        return { symbol, balance: 'Error', usdValue: 0, isLoading: false };
      }
    });

    const fetchedBalances = await Promise.all(balancePromises);
    setTokenBalances(fetchedBalances);
    setTotalUsd(fetchedBalances.reduce((sum, token) => sum + token.usdValue, 0));
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (account?.address) {
      fetchBalances(currentChain, account.address);
    }
  }, [currentChain, account?.address]);

  if (!account) return null;

  const chainInfo = CHAIN_DISPLAY[currentChain] || { name: currentChain, color: '#6B7280' };

  return (
    <div className="h-full bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-4 relative z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-48.png" alt="wAIllet" className="w-8 h-8" />
            <h1 className="text-lg font-bold" style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', cursive" }}>wAIllet</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchBalances()}
              disabled={isRefreshing}
              className="p-1.5 bg-purple-700/50 hover:bg-purple-700 rounded-full transition-colors disabled:opacity-50"
              title="Refresh balances"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            {/* Settings Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(prev => !prev)}
                className="p-1.5 bg-purple-700/50 hover:bg-purple-700 rounded-full transition-colors"
                title="Menu"
              >
                <MoreVertical size={14} />
              </button>

              {showSettingsMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 rounded-lg border border-slate-700 shadow-lg z-50">
                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      setShowAccountSettingsModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors rounded-lg"
                  >
                    <Settings size={16} className="text-purple-400" />
                    <span className="font-medium">Account Settings</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Total USD Value */}
        <div className="text-center mb-3">
          <div className="text-2xl font-bold mb-0.5">
            {isRefreshing ? 'Loading...' : `$${totalUsd.toFixed(2)}`}
          </div>
          <div className="text-xs text-purple-200">Total Balance</div>
        </div>

        {/* Account Selector */}
        <div className="mb-3">
          <AccountSelector onAddAccount={() => setShowAddAccountModal(true)} />
        </div>

        {/* Network Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
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
            <div className="absolute top-full mt-2 w-full bg-slate-800 rounded-lg border border-slate-700 shadow-lg z-50 overflow-hidden">
              {MAINNET_CHAINS.map((chain, index) => {
                const info = CHAIN_DISPLAY[chain]!;
                return (
                  <button
                    key={chain}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNetworkSwitch(chain);
                    }}
                    type="button"
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 transition-colors ${
                      chain === currentChain ? 'bg-slate-700' : ''
                    } ${index === 0 ? 'rounded-t-lg' : ''}`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: info.color }} />
                    <span className="font-medium">{info.name}</span>
                    {chain === currentChain && <Check size={14} className="ml-auto text-purple-400" />}
                  </button>
                );
              })}

              <div className="border-t border-slate-700 px-4 py-1.5">
                <span className="text-xs text-slate-500">Testnets</span>
              </div>

              {TESTNET_CHAINS.map((chain, index) => {
                const info = CHAIN_DISPLAY[chain]!;
                return (
                  <button
                    key={chain}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNetworkSwitch(chain);
                    }}
                    type="button"
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 transition-colors ${
                      chain === currentChain ? 'bg-slate-700' : ''
                    } ${index === TESTNET_CHAINS.length - 1 ? 'rounded-b-lg' : ''}`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: info.color }} />
                    <span className="font-medium">{info.name}</span>
                    {chain === currentChain && <Check size={14} className="ml-auto text-purple-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 flex gap-2">
        <button
          onClick={() => setShowSendModal(true)}
          className="flex-1 flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
            <Send size={16} />
          </div>
          <span className="font-semibold text-sm">Send</span>
        </button>

        <button
          onClick={() => setShowSaveFavoriteModal(true)}
          className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
            <Star size={16} />
          </div>
          <span className="font-semibold text-sm">Favorite</span>
        </button>
      </div>

      {/* Token Balances */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto scrollbar-hide">
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
      {showSaveFavoriteModal && (
        <SaveFavoriteModal onClose={() => setShowSaveFavoriteModal(false)} />
      )}
      {showAccountSettingsModal && (
        <AccountSettingsModal onClose={() => setShowAccountSettingsModal(false)} />
      )}
      {showAddAccountModal && (
        <AddAccountModal onClose={() => setShowAddAccountModal(false)} />
      )}
    </div>
  );
};
