import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletAccount, WalletService, initChains } from '../services/wallet';
import { decrypt, encrypt } from '../utils/crypto';
import { StorageKey } from '../constants';
import { browserAPI } from '../utils/browser-api';
import { ChainType, initChainTypeConfigs } from '../types/chainTypes';

interface WalletContextType {
  account: WalletAccount | null;
  accounts: WalletAccount[];
  activeAccountIndex: number;
  activeChainType: ChainType;
  isUnlocked: boolean;
  hasWallet: boolean;
  isLoading: boolean;
  switchAccount: (index: number) => Promise<void>;
  switchChainType: (chainType: ChainType) => Promise<void>;
  addAccount: (chainType?: ChainType) => Promise<WalletAccount>;
  importAccount: (mnemonic: string, name?: string) => Promise<WalletAccount>;
  renameAccount: (index: number, name: string) => Promise<void>;
  updateChain: (chain: string) => Promise<void>;
  updateNetwork: (network: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  createWallet: (password: string) => Promise<string>;
  confirmMnemonic: (mnemonic: string) => Promise<void>;
  importWallet: (mnemonic: string, password: string) => Promise<void>;
  getPrivateKey: () => Promise<string>;
  getAccountsByChainType: (chainType: ChainType) => WalletAccount[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const SESSION_TIMEOUT = 300 * 1000; // 5 minutes

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [activeAccountIndex, setActiveAccountIndex] = useState(0);
  const [activeChainType, setActiveChainType] = useState<ChainType>(ChainType.EVM);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get current account based on active index
  const account = accounts.length > 0 ? accounts[activeAccountIndex] || accounts[0] : null;

  // Get accounts filtered by chain type
  const getAccountsByChainType = (chainType: ChainType): WalletAccount[] => {
    return accounts.filter(acc => acc.chainType === chainType);
  };

  const saveSession = (mnemonic: string) => {
    const sessionData = { mnemonic, timestamp: Date.now() };
    try {
      sessionStorage.setItem('walletSession', JSON.stringify(sessionData));
      localStorage.setItem('walletSession', JSON.stringify(sessionData));
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  };

  const checkSession = (): string | null => {
    try {
      const sessionStr = sessionStorage.getItem('walletSession') || localStorage.getItem('walletSession');
      if (!sessionStr) return null;

      const session = JSON.parse(sessionStr);
      const elapsed = Date.now() - session.timestamp;

      if (elapsed < SESSION_TIMEOUT) {
        return session.mnemonic;
      }

      clearSession();
      return null;
    } catch (err) {
      clearSession();
      return null;
    }
  };

  const clearSession = () => {
    sessionStorage.removeItem('walletSession');
    localStorage.removeItem('walletSession');
  };

  const saveAccountsToStorage = async (accountsList: WalletAccount[], activeIndex: number, chainType?: ChainType) => {
    await browserAPI.storage.local.set({
      [StorageKey.ACCOUNTS]: accountsList,
      [StorageKey.ACTIVE_ACCOUNT_INDEX]: activeIndex,
      [StorageKey.ACCOUNT]: accountsList[activeIndex] || null,
      activeChainType: chainType || activeChainType
    });
  };

  const loadAccountsFromStorage = async (): Promise<{ accounts: WalletAccount[], activeIndex: number, chainType: ChainType }> => {
    const result = await browserAPI.storage.local.get([
      StorageKey.ACCOUNTS,
      StorageKey.ACTIVE_ACCOUNT_INDEX,
      StorageKey.ACCOUNT,
      'activeChainType'
    ]);

    const chainType = result.activeChainType || ChainType.EVM;

    if (result[StorageKey.ACCOUNTS]?.length > 0) {
      // Migrate accounts without chainType (all existing accounts are EVM)
      const migratedAccounts = result[StorageKey.ACCOUNTS].map((acc: WalletAccount) => ({
        ...acc,
        chainType: acc.chainType || ChainType.EVM
      }));

      return {
        accounts: migratedAccounts,
        activeIndex: result[StorageKey.ACTIVE_ACCOUNT_INDEX] || 0,
        chainType
      };
    }

    // Migrate old single-account storage
    if (result[StorageKey.ACCOUNT]) {
      const singleAccount = result[StorageKey.ACCOUNT];
      singleAccount.name = singleAccount.name || 'Account 1';
      singleAccount.chainType = singleAccount.chainType || ChainType.EVM;
      return { accounts: [singleAccount], activeIndex: 0, chainType };
    }

    return { accounts: [], activeIndex: 0, chainType };
  };

  useEffect(() => {
    const checkWallet = async () => {
      try {
        // Initialize chain configs and network data from backend
        // These run in parallel for better startup time
        await Promise.all([
          initChainTypeConfigs().catch(err => {
            console.warn('[WalletContext] Failed to init chain types:', err);
          }),
          initChains().catch(err => {
            console.warn('[WalletContext] Failed to init chains:', err);
          })
        ]);

        const encrypted = localStorage.getItem('wallet');
        setHasWallet(!!encrypted);

        if (encrypted) {
          const sessionMnemonic = checkSession();
          if (sessionMnemonic) {
            try {
              const { accounts: savedAccounts, activeIndex, chainType } = await loadAccountsFromStorage();

              setActiveChainType(chainType);

              if (savedAccounts.length > 0) {
                const restoredAccounts = await Promise.all(savedAccounts.map(async (acc) => {
                  if (acc.imported) return acc;

                  // Restore private key based on chain type
                  if (acc.chainType === ChainType.EVM || !acc.chainType) {
                    const derived = WalletService.fromMnemonic(sessionMnemonic, acc.index);
                    return { ...acc, privateKey: derived.privateKey, chainType: acc.chainType || ChainType.EVM };
                  } else {
                    // For non-EVM chains, re-derive from mnemonic
                    const derived = await WalletService.fromMnemonicForChain(
                      sessionMnemonic,
                      acc.chainType,
                      acc.index
                    );
                    return { ...acc, privateKey: derived.privateKey };
                  }
                }));

                setAccounts(restoredAccounts);
                setActiveAccountIndex(activeIndex);
                await saveAccountsToStorage(restoredAccounts, activeIndex, chainType);
              } else {
                const wallet = WalletService.fromMnemonic(sessionMnemonic);
                const walletWithChain = { ...wallet, chain: 'ethereum', chainType: ChainType.EVM };
                setAccounts([walletWithChain]);
                setActiveAccountIndex(0);
                await saveAccountsToStorage([walletWithChain], 0, ChainType.EVM);
              }

              setIsUnlocked(true);
            } catch (err) {
              console.error('Failed to restore session:', err);
              clearSession();
            }
          }
        }
      } catch (err) {
        console.error('Error checking wallet:', err);
      } finally {
        setIsLoading(false);
      }
    };
    checkWallet();
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[StorageKey.ACCOUNTS]?.newValue) {
        setAccounts(changes[StorageKey.ACCOUNTS].newValue);
      }
      if (changes[StorageKey.ACTIVE_ACCOUNT_INDEX] !== undefined) {
        setActiveAccountIndex(changes[StorageKey.ACTIVE_ACCOUNT_INDEX].newValue || 0);
      }
    };

    browserAPI.storage.onChanged.addListener(handleStorageChange);
    return () => browserAPI.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const unlock = async (password: string) => {
    const encrypted = localStorage.getItem('wallet');
    if (!encrypted) throw new Error('No wallet found');

    const mnemonic = await decrypt(encrypted, password);
    const { accounts: savedAccounts, activeIndex, chainType } = await loadAccountsFromStorage();

    setActiveChainType(chainType);

    if (savedAccounts.length > 0) {
      const restoredAccounts = await Promise.all(savedAccounts.map(async (acc) => {
        if (acc.imported) return acc;

        if (acc.chainType === ChainType.EVM || !acc.chainType) {
          const derived = WalletService.fromMnemonic(mnemonic, acc.index);
          return { ...acc, privateKey: derived.privateKey, chainType: acc.chainType || ChainType.EVM };
        } else {
          const derived = await WalletService.fromMnemonicForChain(mnemonic, acc.chainType, acc.index);
          return { ...acc, privateKey: derived.privateKey };
        }
      }));

      setAccounts(restoredAccounts);
      setActiveAccountIndex(activeIndex);
      await saveAccountsToStorage(restoredAccounts, activeIndex, chainType);
    } else {
      const wallet = WalletService.fromMnemonic(mnemonic);
      const walletWithChain = { ...wallet, chain: 'ethereum', chainType: ChainType.EVM };
      setAccounts([walletWithChain]);
      setActiveAccountIndex(0);
      await saveAccountsToStorage([walletWithChain], 0, ChainType.EVM);
    }

    setIsUnlocked(true);
    saveSession(mnemonic);
  };

  const createWallet = async (password: string): Promise<string> => {
    const mnemonic = WalletService.generateMnemonic();
    const encrypted = await encrypt(mnemonic, password);
    localStorage.setItem('wallet', encrypted);

    return mnemonic;
  };

  const confirmMnemonic = async (mnemonic: string) => {
    const wallet = WalletService.fromMnemonic(mnemonic);
    const walletWithChain = { ...wallet, chain: 'ethereum', chainType: ChainType.EVM };

    setAccounts([walletWithChain]);
    setActiveAccountIndex(0);
    setActiveChainType(ChainType.EVM);
    await saveAccountsToStorage([walletWithChain], 0, ChainType.EVM);

    setIsUnlocked(true);
    setHasWallet(true);

    saveSession(mnemonic);
  };

  const importWallet = async (mnemonic: string, password: string) => {
    const encrypted = await encrypt(mnemonic, password);
    localStorage.setItem('wallet', encrypted);

    const wallet = WalletService.fromMnemonic(mnemonic);
    const walletWithChain = { ...wallet, chain: 'ethereum', chainType: ChainType.EVM };

    setAccounts([walletWithChain]);
    setActiveAccountIndex(0);
    setActiveChainType(ChainType.EVM);
    await saveAccountsToStorage([walletWithChain], 0, ChainType.EVM);

    setIsUnlocked(true);
    setHasWallet(true);

    saveSession(mnemonic);
  };

  const switchAccount = async (index: number) => {
    if (index < 0 || index >= accounts.length) {
      throw new Error('Invalid account index');
    }
    setActiveAccountIndex(index);
    await saveAccountsToStorage(accounts, index);
  };

  const addAccount = async (chainType: ChainType = ChainType.EVM): Promise<WalletAccount> => {
    const sessionStr = sessionStorage.getItem('walletSession') || localStorage.getItem('walletSession');
    if (!sessionStr) {
      throw new Error('Session expired. Please unlock your wallet again.');
    }

    const session = JSON.parse(sessionStr);
    const mnemonic = session.mnemonic;

    // Find max index for accounts of this chain type
    const accountsOfType = accounts.filter(acc => (acc.chainType || ChainType.EVM) === chainType && !acc.imported);
    const maxIndex = accountsOfType.reduce((max, acc) => Math.max(max, acc.index), -1);
    const newIndex = maxIndex + 1;

    let newAccount: WalletAccount;

    if (chainType === ChainType.EVM) {
      const derived = WalletService.fromMnemonic(mnemonic, newIndex);
      newAccount = {
        ...derived,
        chain: account?.chain || 'ethereum',
        chainType: ChainType.EVM,
        name: `EVM Account ${accountsOfType.length + 1}`
      };
    } else {
      newAccount = await WalletService.fromMnemonicForChain(mnemonic, chainType, newIndex);
      newAccount.name = `${chainType.toUpperCase()} Account ${accountsOfType.length + 1}`;
    }

    const newAccounts = [...accounts, newAccount];
    setAccounts(newAccounts);
    setActiveAccountIndex(newAccounts.length - 1);
    setActiveChainType(chainType);
    await saveAccountsToStorage(newAccounts, newAccounts.length - 1, chainType);
    return newAccount;
  };

  const switchChainType = async (chainType: ChainType) => {
    setActiveChainType(chainType);

    // Find first account of this chain type
    const accountsOfType = accounts.filter(acc => (acc.chainType || ChainType.EVM) === chainType);

    if (accountsOfType.length > 0) {
      const index = accounts.indexOf(accountsOfType[0]);
      setActiveAccountIndex(index);
      await saveAccountsToStorage(accounts, index, chainType);
    } else {
      // No account of this type exists, create one
      await addAccount(chainType);
    }
  };

  const importAccount = async (mnemonic: string, name?: string): Promise<WalletAccount> => {
    try {
      const importedAccount = WalletService.fromMnemonic(mnemonic, 0);

      const existing = accounts.find(acc =>
        acc.address.toLowerCase() === importedAccount.address.toLowerCase()
      );
      if (existing) {
        throw new Error('This account is already in your wallet');
      }

      const accountWithChain: WalletAccount = {
        ...importedAccount,
        chain: account?.chain || 'ethereum',
        chainType: ChainType.EVM,
        name: name || `Imported ${accounts.filter(a => a.imported).length + 1}`,
        imported: true
      };

      const newAccounts = [...accounts, accountWithChain];
      setAccounts(newAccounts);
      setActiveAccountIndex(newAccounts.length - 1);
      await saveAccountsToStorage(newAccounts, newAccounts.length - 1, ChainType.EVM);
      return accountWithChain;
    } catch (err: any) {
      if (err.message.includes('already in your wallet')) {
        throw err;
      }
      throw new Error('Invalid recovery phrase');
    }
  };

  const renameAccount = async (index: number, name: string) => {
    if (index < 0 || index >= accounts.length) {
      throw new Error('Invalid account index');
    }

    const newAccounts = accounts.map((acc, i) =>
      i === index ? { ...acc, name } : acc
    );

    setAccounts(newAccounts);
    await saveAccountsToStorage(newAccounts, activeAccountIndex);
  };

  const updateChain = async (chain: string) => {
    if (accounts.length === 0) return;

    const newAccounts = accounts.map((acc, i) =>
      i === activeAccountIndex ? { ...acc, chain } : acc
    );

    setAccounts(newAccounts);
    await saveAccountsToStorage(newAccounts, activeAccountIndex, activeChainType);
  };

  const updateNetwork = async (network: string) => {
    if (accounts.length === 0) return;

    const newAccounts = accounts.map((acc, i) =>
      i === activeAccountIndex ? { ...acc, network } : acc
    );

    setAccounts(newAccounts);
    await saveAccountsToStorage(newAccounts, activeAccountIndex, activeChainType);
  };

  const getPrivateKey = async (): Promise<string> => {
    if (!account) throw new Error('Wallet not unlocked');
    return account.privateKey;
  };

  return (
    <WalletContext.Provider value={{
      account,
      accounts,
      activeAccountIndex,
      activeChainType,
      isUnlocked,
      hasWallet,
      isLoading,
      switchAccount,
      switchChainType,
      addAccount,
      importAccount,
      renameAccount,
      updateChain,
      updateNetwork,
      unlock,
      createWallet,
      confirmMnemonic,
      importWallet,
      getPrivateKey,
      getAccountsByChainType,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};