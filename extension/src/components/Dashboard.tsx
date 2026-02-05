import React, { useState, useEffect, useCallback } from 'react';
import { Send, RefreshCw, ChevronDown, Star, MoreVertical, Settings, Check } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { SendTransactionModal } from './SendTransactionModal';
import { SaveFavoriteModal } from './SaveFavoriteModal';
import { AccountSettingsModal } from './AccountSettingsModal';
import { AccountSelector } from './AccountSelector';
import { AddAccountModal } from './AddAccountModal';
import { NetworkIcon } from './NetworkIcon';
import { TokenIcon } from './TokenIcon';
import { Chain } from '../types/messaging';
import {
  CHAIN_DISPLAY,
  EVM_MAINNET_CHAINS,
  EVM_TESTNET_CHAINS,
  SOLANA_MAINNET_CHAINS,
  SOLANA_TESTNET_CHAINS,
  SUI_MAINNET_CHAINS,
  SUI_TESTNET_CHAINS,
  TON_MAINNET_CHAINS,
  TON_TESTNET_CHAINS
} from '../constants';
import { NetworkService } from '../services/networkService';
import { ChainType, TokenConfig } from '../types/chainTypes';
import { chainAdapterRegistry } from '../adapters';
import { initTokenCache } from '../adapters/evm/tokens';
import { initSolanaTokenCache } from '../adapters/solana/tokens';
import { initSuiTokenCache } from '../adapters/sui/tokens';
import { initTonTokenCache } from '../adapters/ton/jettons';

interface TokenBalance {
  symbol: string;
  balance: string;
  usdValue: number;
  isLoading: boolean;
}

interface DashboardProps {
  onAIKeyChanged?: () => void;
}

// Get mainnet and testnet chains for a chain type
const getNetworksForChainType = (chainType: ChainType): { mainnets: Chain[], testnets: Chain[] } => {
  switch (chainType) {
    case ChainType.SOLANA:
      return { mainnets: SOLANA_MAINNET_CHAINS, testnets: SOLANA_TESTNET_CHAINS };
    case ChainType.SUI:
      return { mainnets: SUI_MAINNET_CHAINS, testnets: SUI_TESTNET_CHAINS };
    case ChainType.TON:
      return { mainnets: TON_MAINNET_CHAINS, testnets: TON_TESTNET_CHAINS };
    case ChainType.EVM:
    default:
      return { mainnets: EVM_MAINNET_CHAINS, testnets: EVM_TESTNET_CHAINS };
  }
};

export const Dashboard: React.FC<DashboardProps> = ({ onAIKeyChanged }) => {
  const { account, activeChainType, updateChain } = useWallet();
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
  const [tokenPrices, setTokenPrices] = useState<Map<string, number>>(new Map());

  // Fetch token prices from backend
  const fetchPrices = useCallback(async (symbols: string[]) => {
    try {
      const prices = await NetworkService.getTokenPrices(symbols);
      setTokenPrices(prices);
      return prices;
    } catch (error) {
      console.error('Failed to fetch token prices:', error);
      return new Map<string, number>();
    }
  }, []);

  // Update current network when account or chain type changes
  useEffect(() => {
    const { mainnets, testnets } = getNetworksForChainType(activeChainType);
    const validNetworks = [...mainnets, ...testnets];

    // If account has a chain set and it's valid for the current chain type, use it
    if (account?.chain && validNetworks.includes(account.chain as Chain)) {
      setCurrentChain(account.chain as Chain);
    } else if (mainnets.length > 0) {
      // Otherwise, set to first mainnet of the chain type
      setCurrentChain(mainnets[0]);
    }
  }, [account?.chain, activeChainType]);

  const handleNetworkSwitch = async (newChain: Chain) => {
    if (!account) return;

    try {
      setCurrentChain(newChain);
      setShowNetworkDropdown(false);

      // Get adapter for current chain type
      const adapter = chainAdapterRegistry.getAdapter(activeChainType);

      // Initialize token cache for EVM networks
      if (activeChainType === ChainType.EVM) {
        try {
          await initTokenCache(newChain);
        } catch (error) {
          console.warn('Failed to initialize token cache:', error);
        }
      }

      const networkTokens = adapter.getTokens(newChain);
      const network = adapter.getNetwork(newChain);
      const nativeSymbol = network?.nativeCurrency?.symbol || 'ETH';

      const availableTokens = [nativeSymbol, ...networkTokens.map(t => t.symbol).filter(s => s !== nativeSymbol)];
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

    // Get adapter for current chain type
    const adapter = chainAdapterRegistry.getAdapter(activeChainType);

    // Initialize token cache for the current chain type (lazy loading)
    try {
      switch (activeChainType) {
        case ChainType.EVM:
          await initTokenCache(targetChain);
          break;
        case ChainType.SOLANA:
          await initSolanaTokenCache(targetChain);
          break;
        case ChainType.SUI:
          await initSuiTokenCache(targetChain);
          break;
        case ChainType.TON:
          await initTonTokenCache(targetChain);
          break;
      }
    } catch (error) {
      console.warn('Failed to initialize token cache:', error);
    }

    // Get tokens from adapter for the network
    const networkTokens: TokenConfig[] = adapter.getTokens(targetChain);

    // Get native currency info from the network config
    const network = adapter.getNetwork(targetChain);
    const nativeSymbol = network?.nativeCurrency?.symbol || 'ETH';

    // Build token list: native token first, then other tokens
    const availableTokens = [nativeSymbol, ...networkTokens.map(t => t.symbol).filter(s => s !== nativeSymbol)];

    const initialBalances: TokenBalance[] = availableTokens.map(symbol => ({
      symbol,
      balance: '0',
      usdValue: 0,
      isLoading: true,
    }));
    setTokenBalances(initialBalances);

    // Fetch prices from backend
    const prices = await fetchPrices(availableTokens);

    const balancePromises = availableTokens.map(async (symbol): Promise<TokenBalance> => {
      try {
        let balance: string;

        if (symbol === nativeSymbol) {
          // Native token balance
          balance = await adapter.getBalance(targetAddress, targetChain);
        } else {
          // Token balance - find the token config to get address
          const tokenConfig = networkTokens.find(t => t.symbol === symbol);
          if (!tokenConfig?.address) {
            return { symbol, balance: '0', usdValue: 0, isLoading: false };
          }
          balance = await adapter.getBalance(targetAddress, targetChain, tokenConfig.address);
        }

        const balanceNum = parseFloat(balance);
        const price = prices.get(symbol) ?? tokenPrices.get(symbol) ?? 0;
        const usdValue = balanceNum * price;
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
    <div className="h-full bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-4 relative z-20 flex-shrink-0">
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
              <NetworkIcon chain={currentChain} size="sm" />
              <span className="font-semibold">{chainInfo.name}</span>
            </div>
            <ChevronDown size={16} className={showNetworkDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>

          {showNetworkDropdown && (
            <div className="absolute top-full mt-2 w-full bg-slate-800 rounded-lg border border-slate-700 shadow-lg z-50 max-h-80 overflow-y-auto scrollbar-hide">
              {/* Mainnets section */}
              {getNetworksForChainType(activeChainType).mainnets.length > 0 && (
                <>
                  <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-4 py-1.5 z-10">
                    <span className="text-xs text-slate-400 font-medium">Mainnets</span>
                  </div>
                  {getNetworksForChainType(activeChainType).mainnets.map((chain) => {
                    const info = CHAIN_DISPLAY[chain];
                    if (!info) return null;
                    return (
                      <button
                        key={chain}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleNetworkSwitch(chain);
                        }}
                        type="button"
                        className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-700 transition-colors ${
                          chain === currentChain ? 'bg-slate-700' : ''
                        }`}
                      >
                        <NetworkIcon chain={chain} size="sm" />
                        <span className="font-medium text-sm">{info.name}</span>
                        {chain === currentChain && <Check size={14} className="ml-auto text-purple-400" />}
                      </button>
                    );
                  })}
                </>
              )}

              {/* Testnets section */}
              {getNetworksForChainType(activeChainType).testnets.length > 0 && (
                <>
                  <div className="sticky top-0 bg-slate-800 border-t border-b border-slate-700 px-4 py-1.5 z-10">
                    <span className="text-xs text-slate-400 font-medium">Testnets</span>
                  </div>
                  {getNetworksForChainType(activeChainType).testnets.map((chain) => {
                    const info = CHAIN_DISPLAY[chain];
                    if (!info) return null;
                    return (
                      <button
                        key={chain}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleNetworkSwitch(chain);
                        }}
                        type="button"
                        className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-700 transition-colors ${
                          chain === currentChain ? 'bg-slate-700' : ''
                        }`}
                      >
                        <NetworkIcon chain={chain} size="sm" />
                        <span className="font-medium text-sm">{info.name}</span>
                        {chain === currentChain && <Check size={14} className="ml-auto text-purple-400" />}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 flex gap-2 flex-shrink-0">
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
      <div className="flex-1 min-h-0 px-4 pb-4">
        <h2 className="text-sm font-bold mb-2">Tokens</h2>

        {(() => {
          // Filter tokens with balance > 0
          const tokensWithBalance = tokenBalances.filter(
            token => token.balance !== 'Error' && parseFloat(token.balance) > 0
          );

          // Show loading state
          if (isRefreshing && tokensWithBalance.length === 0) {
            return (
              <div className="bg-slate-800 rounded-lg p-3 text-center text-slate-400 text-xs">
                <RefreshCw size={16} className="animate-spin mx-auto mb-1" />
                <p>Loading balances...</p>
              </div>
            );
          }

          // Show empty state when no tokens with balance
          if (tokensWithBalance.length === 0) {
            return (
              <div className="bg-slate-800 rounded-lg p-3 text-center text-slate-400 text-xs">
                <p className="mb-1">No tokens found</p>
                <p className="text-[10px]">Your wallet doesn't have any tokens on this network yet</p>
              </div>
            );
          }

          // Show tokens with balance
          return (
            <div className="space-y-1">
              {tokensWithBalance.map((token) => (
                <div
                  key={token.symbol}
                  className="bg-slate-800 rounded-lg px-3 py-2 border-l-4 border-purple-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={token.symbol} size="md" />
                      <div>
                        <div className="font-semibold text-xs">{token.symbol}</div>
                        <div className="text-[10px] text-slate-400">
                          ${token.usdValue.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-xs text-slate-300">
                        {token.balance}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Modals */}
      {showSendModal && (
        <SendTransactionModal
          onClose={() => setShowSendModal(false)}
          tokensWithBalance={tokenBalances
            .filter(t => t.balance !== 'Error' && parseFloat(t.balance) > 0)
            .map(t => ({ symbol: t.symbol, balance: t.balance }))}
          currentChain={currentChain}
        />
      )}
      {showSaveFavoriteModal && (
        <SaveFavoriteModal onClose={() => setShowSaveFavoriteModal(false)} />
      )}
      {showAccountSettingsModal && (
        <AccountSettingsModal onClose={() => setShowAccountSettingsModal(false)} onAIKeyChanged={onAIKeyChanged} />
      )}
      {showAddAccountModal && (
        <AddAccountModal onClose={() => setShowAddAccountModal(false)} />
      )}
    </div>
  );
};
