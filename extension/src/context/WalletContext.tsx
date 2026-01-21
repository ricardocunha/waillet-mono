import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletAccount, WalletService } from '../services/wallet';
import { decrypt, encrypt } from '../utils/crypto';
import { StorageKey } from '../constants';

interface WalletContextType {
  account: WalletAccount | null;
  accounts: WalletAccount[];
  activeAccountIndex: number;
  isUnlocked: boolean;
  hasWallet: boolean;
  isLoading: boolean;
  switchAccount: (index: number) => Promise<void>;
  addAccount: () => Promise<WalletAccount>;
  importAccount: (mnemonic: string, name?: string) => Promise<WalletAccount>;
  renameAccount: (index: number, name: string) => Promise<void>;
  updateChain: (chain: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  createWallet: (password: string) => Promise<string>;
  confirmMnemonic: (mnemonic: string) => Promise<void>;
  importWallet: (mnemonic: string, password: string) => Promise<void>;
  getPrivateKey: () => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const SESSION_TIMEOUT = 300 * 1000; // 5 minutes

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [activeAccountIndex, setActiveAccountIndex] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const account = accounts.length > 0 ? accounts[activeAccountIndex] || accounts[0] : null;

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

  const saveAccountsToStorage = async (accountsList: WalletAccount[], activeIndex: number) => {
    await chrome.storage.local.set({
      [StorageKey.ACCOUNTS]: accountsList,
      [StorageKey.ACTIVE_ACCOUNT_INDEX]: activeIndex,
      [StorageKey.ACCOUNT]: accountsList[activeIndex] || null
    });
  };

  const loadAccountsFromStorage = async (): Promise<{ accounts: WalletAccount[], activeIndex: number }> => {
    const result = await chrome.storage.local.get([
      StorageKey.ACCOUNTS,
      StorageKey.ACTIVE_ACCOUNT_INDEX,
      StorageKey.ACCOUNT
    ]);

    if (result[StorageKey.ACCOUNTS]?.length > 0) {
      return {
        accounts: result[StorageKey.ACCOUNTS],
        activeIndex: result[StorageKey.ACTIVE_ACCOUNT_INDEX] || 0
      };
    }

    // Migrate old single-account storage
    if (result[StorageKey.ACCOUNT]) {
      const singleAccount = result[StorageKey.ACCOUNT];
      singleAccount.name = singleAccount.name || 'Account 1';
      return { accounts: [singleAccount], activeIndex: 0 };
    }

    return { accounts: [], activeIndex: 0 };
  };

  useEffect(() => {
    const checkWallet = async () => {
      try {
        const encrypted = localStorage.getItem('wallet');
        setHasWallet(!!encrypted);

        if (encrypted) {
          const sessionMnemonic = checkSession();
          if (sessionMnemonic) {
            try {
              const { accounts: savedAccounts, activeIndex } = await loadAccountsFromStorage();

              if (savedAccounts.length > 0) {
                const restoredAccounts = savedAccounts.map((acc) => {
                  if (acc.imported) return acc;
                  const derived = WalletService.fromMnemonic(sessionMnemonic, acc.index);
                  return { ...acc, privateKey: derived.privateKey };
                });

                setAccounts(restoredAccounts);
                setActiveAccountIndex(activeIndex);
                await saveAccountsToStorage(restoredAccounts, activeIndex);
              } else {
                const wallet = WalletService.fromMnemonic(sessionMnemonic);
                const walletWithChain = { ...wallet, chain: 'ethereum' };
                setAccounts([walletWithChain]);
                setActiveAccountIndex(0);
                await saveAccountsToStorage([walletWithChain], 0);
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

    chrome.storage.local.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.local.onChanged.removeListener(handleStorageChange);
  }, []);

  const unlock = async (password: string) => {
    const encrypted = localStorage.getItem('wallet');
    if (!encrypted) throw new Error('No wallet found');

    const mnemonic = await decrypt(encrypted, password);
    const { accounts: savedAccounts, activeIndex } = await loadAccountsFromStorage();

    if (savedAccounts.length > 0) {
      const restoredAccounts = savedAccounts.map((acc) => {
        if (acc.imported) return acc;
        const derived = WalletService.fromMnemonic(mnemonic, acc.index);
        return { ...acc, privateKey: derived.privateKey };
      });

      setAccounts(restoredAccounts);
      setActiveAccountIndex(activeIndex);
      await saveAccountsToStorage(restoredAccounts, activeIndex);
    } else {
      const wallet = WalletService.fromMnemonic(mnemonic);
      const walletWithChain = { ...wallet, chain: 'ethereum' };
      setAccounts([walletWithChain]);
      setActiveAccountIndex(0);
      await saveAccountsToStorage([walletWithChain], 0);
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
    const walletWithChain = { ...wallet, chain: 'ethereum' };

    setAccounts([walletWithChain]);
    setActiveAccountIndex(0);
    await saveAccountsToStorage([walletWithChain], 0);

    setIsUnlocked(true);
    setHasWallet(true);

    saveSession(mnemonic);
  };

  const importWallet = async (mnemonic: string, password: string) => {
    const encrypted = await encrypt(mnemonic, password);
    localStorage.setItem('wallet', encrypted);

    const wallet = WalletService.fromMnemonic(mnemonic);
    const walletWithChain = { ...wallet, chain: 'ethereum' };

    setAccounts([walletWithChain]);
    setActiveAccountIndex(0);
    await saveAccountsToStorage([walletWithChain], 0);

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

  const addAccount = async (): Promise<WalletAccount> => {
    const sessionStr = sessionStorage.getItem('walletSession') || localStorage.getItem('walletSession');
    if (!sessionStr) {
      throw new Error('Session expired. Please unlock your wallet again.');
    }

    const session = JSON.parse(sessionStr);
    const mnemonic = session.mnemonic;

    const maxIndex = accounts
      .filter(acc => !acc.imported)
      .reduce((max, acc) => Math.max(max, acc.index), -1);
    const newIndex = maxIndex + 1;

    const newAccount = WalletService.fromMnemonic(mnemonic, newIndex);
    const accountWithChain = {
      ...newAccount,
      chain: account?.chain || 'ethereum',
      name: `Account ${accounts.length + 1}`
    };

    const newAccounts = [...accounts, accountWithChain];
    setAccounts(newAccounts);
    setActiveAccountIndex(newAccounts.length - 1);
    await saveAccountsToStorage(newAccounts, newAccounts.length - 1);
    return accountWithChain;
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
        name: name || `Imported ${accounts.filter(a => a.imported).length + 1}`,
        imported: true
      };

      const newAccounts = [...accounts, accountWithChain];
      setAccounts(newAccounts);
      setActiveAccountIndex(newAccounts.length - 1);
      await saveAccountsToStorage(newAccounts, newAccounts.length - 1);
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
    await saveAccountsToStorage(newAccounts, activeAccountIndex);
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
      isUnlocked,
      hasWallet,
      isLoading,
      switchAccount,
      addAccount,
      importAccount,
      renameAccount,
      updateChain,
      unlock,
      createWallet,
      confirmMnemonic,
      importWallet,
      getPrivateKey,
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