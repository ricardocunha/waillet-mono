import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, Copy, ExternalLink, User } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { getAllChains } from '../services/wallet';
import { ChainType } from '../types/chainTypes';
import { chainAdapterRegistry } from '../adapters';

interface AccountSelectorProps {
  onAddAccount: () => void;
}

// Chain type display configuration
const CHAIN_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  [ChainType.EVM]: { label: 'EVM', color: '#627EEA' },
  [ChainType.SOLANA]: { label: 'Solana', color: '#9945FF' },
  [ChainType.SUI]: { label: 'SUI', color: '#4DA2FF' },
  [ChainType.TON]: { label: 'TON', color: '#0098EA' },
};

export const AccountSelector: React.FC<AccountSelectorProps> = ({ onAddAccount }) => {
  const { account, accounts, activeAccountIndex, activeChainType, switchAccount, getAccountsByChainType } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Group accounts by chain type
  const accountsByChainType = {
    [ChainType.EVM]: getAccountsByChainType(ChainType.EVM),
    [ChainType.SOLANA]: getAccountsByChainType(ChainType.SOLANA),
    [ChainType.SUI]: getAccountsByChainType(ChainType.SUI),
    [ChainType.TON]: getAccountsByChainType(ChainType.TON),
  };

  // Order of chain types to display
  const chainTypeOrder = [ChainType.EVM, ChainType.SOLANA, ChainType.SUI, ChainType.TON];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchAccount = async (index: number) => {
    if (index !== activeAccountIndex) {
      await switchAccount(index);
    }
    setIsOpen(false);
  };

  const handleCopyAddress = async (address: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(address);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleViewExplorer = (address: string, chainType: ChainType, e: React.MouseEvent) => {
    e.stopPropagation();

    let explorerUrl: string;

    if (chainType === ChainType.EVM || !chainType) {
      const chain = account?.chain || 'ethereum';
      const chains = getAllChains();
      const explorer = chains[chain]?.explorer || 'https://etherscan.io';
      explorerUrl = `${explorer}/address/${address}`;
    } else {
      // Use adapter's explorer URL method
      const adapter = chainAdapterRegistry.getAdapter(chainType) as any;
      const defaultNetwork = adapter.getDefaultNetwork();
      explorerUrl = adapter.getAddressExplorerUrl?.(defaultNetwork.id, address) ||
                    `${defaultNetwork.explorerUrl}/address/${address}`;
    }

    window.open(explorerUrl, '_blank');
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!account) return null;

  const currentChainConfig = CHAIN_TYPE_CONFIG[activeChainType] || CHAIN_TYPE_CONFIG[ChainType.EVM];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Account Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-purple-700/50 hover:bg-purple-700 rounded-lg px-3 py-2 transition-colors w-full"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: currentChainConfig.color + '30' }}
        >
          <User className="w-4 h-4" style={{ color: currentChainConfig.color }} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {account.name || `Account ${activeAccountIndex + 1}`}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: currentChainConfig.color + '30', color: currentChainConfig.color }}
            >
              {currentChainConfig.label}
            </span>
          </div>
          <div className="text-xs text-purple-200 font-mono">
            {formatAddress(account.address)}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-purple-200 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Account List - grouped by chain type */}
          <div className="max-h-80 overflow-y-auto">
            {chainTypeOrder.map((chainType) => {
              const chainAccounts = accountsByChainType[chainType];
              const config = CHAIN_TYPE_CONFIG[chainType];

              return (
                <div key={chainType}>
                  {/* Chain Type Header */}
                  <div
                    className="sticky top-0 bg-slate-700/90 backdrop-blur-sm px-3 py-1.5 border-b border-slate-600 flex items-center gap-2"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-xs font-medium" style={{ color: config.color }}>
                      {config.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({chainAccounts.length})
                    </span>
                  </div>

                  {/* Accounts for this chain type */}
                  {chainAccounts.length === 0 ? (
                    <div className="px-3 py-2 text-center text-slate-500 text-xs">
                      No accounts
                    </div>
                  ) : (
                    chainAccounts.map((acc) => {
                      const index = accounts.indexOf(acc);
                      return (
                        <div
                          key={acc.address}
                          onClick={() => handleSwitchAccount(index)}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                            index === activeAccountIndex
                              ? 'bg-purple-600/20 border-l-2'
                              : 'hover:bg-slate-700 border-l-2 border-transparent'
                          }`}
                          style={index === activeAccountIndex ? { borderLeftColor: config.color } : {}}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: config.color + '30' }}
                          >
                            <User className="w-4 h-4" style={{ color: config.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white truncate">
                                {acc.name || `Account ${index + 1}`}
                              </span>
                              {acc.imported && (
                                <span className="text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded">
                                  Imported
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {formatAddress(acc.address)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Copy button */}
                            <button
                              onClick={(e) => handleCopyAddress(acc.address, index, e)}
                              className="p-1.5 hover:bg-slate-600 rounded transition-colors"
                              title="Copy address"
                            >
                              {copiedIndex === index ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                            {/* Explorer button */}
                            <button
                              onClick={(e) => handleViewExplorer(acc.address, acc.chainType, e)}
                              className="p-1.5 hover:bg-slate-600 rounded transition-colors"
                              title="View on explorer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            {/* Selected indicator */}
                            {index === activeAccountIndex && (
                              <Check className="w-4 h-4 ml-1" style={{ color: config.color }} />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Account Button */}
          <div className="border-t border-slate-700">
            <button
              onClick={() => {
                setIsOpen(false);
                onAddAccount();
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-slate-700 transition-colors text-purple-400"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">Add Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};