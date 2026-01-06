import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletAccount, WalletService } from '../services/wallet';
import { decrypt, encrypt } from '../utils/crypto';

interface WalletContextType {
  account: WalletAccount | null;
  isUnlocked: boolean;
  hasWallet: boolean;
  unlock: (password: string) => Promise<void>;
  createWallet: (password: string) => Promise<string>;
  confirmMnemonic: (mnemonic: string) => void;
  importWallet: (mnemonic: string, password: string) => Promise<void>;
  getPrivateKey: () => Promise<string>;
  isLoading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const SESSION_TIMEOUT = 30 * 1000; // 30 seconds in milliseconds

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const saveSession = (mnemonic: string) => {
    const sessionData = {
      mnemonic,
      timestamp: Date.now()
    };
    try {
      sessionStorage.setItem('walletSession', JSON.stringify(sessionData));
      localStorage.setItem('walletSession', JSON.stringify(sessionData));
      console.log('✅ Session saved, expires in 30 seconds');
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  };

  const checkSession = (): string | null => {
    try {
      const sessionStr = sessionStorage.getItem('walletSession') ||
                        localStorage.getItem('walletSession');
      
      if (!sessionStr) {
        console.log('❌ No session found');
        return null;
      }

      const session = JSON.parse(sessionStr);
      const now = Date.now();
      const elapsed = now - session.timestamp;
      const remaining = SESSION_TIMEOUT - elapsed;

      console.log(`⏱️  Session age: ${Math.round(elapsed/1000)}s / 30s (${Math.round(remaining/1000)}s remaining)`);

      if (elapsed < SESSION_TIMEOUT) {
        console.log('✅ Session valid, auto-unlocking');
        return session.mnemonic;
      }

      console.log('❌ Session expired, clearing');
      clearSession();
      return null;
    } catch (err) {
      console.error('Session check error:', err);
      clearSession();
      return null;
    }
  };

  const clearSession = () => {
    sessionStorage.removeItem('walletSession');
    localStorage.removeItem('walletSession');
  };

  useEffect(() => {
    const checkWallet = async () => {
      try {
        const encrypted = localStorage.getItem('wallet');
        setHasWallet(!!encrypted);

        if (encrypted) {
          const sessionMnemonic = checkSession();
          if (sessionMnemonic) {
            console.log('Session found, restoring wallet...');
            try {
              const wallet = WalletService.fromMnemonic(sessionMnemonic);
              setAccount(wallet);
              setIsUnlocked(true);
              console.log('Session restored successfully');
            } catch (err) {
              console.error('Failed to restore session:', err);
              clearSession();
            }
          } else {
            console.log('No valid session found');
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

  const unlock = async (password: string) => {
    const encrypted = localStorage.getItem('wallet');
    if (!encrypted) throw new Error('No wallet found');
    
    const mnemonic = await decrypt(encrypted, password);
    const wallet = WalletService.fromMnemonic(mnemonic);
    setAccount(wallet);
    setIsUnlocked(true);

    saveSession(mnemonic);
  };

  const createWallet = async (password: string): Promise<string> => {
    const mnemonic = WalletService.generateMnemonic();
    const encrypted = await encrypt(mnemonic, password);
    localStorage.setItem('wallet', encrypted);

    return mnemonic;
  };

  const confirmMnemonic = (mnemonic: string) => {
    const wallet = WalletService.fromMnemonic(mnemonic);
    setAccount(wallet);
    setIsUnlocked(true);
    setHasWallet(true);

    saveSession(mnemonic);
  };

  const importWallet = async (mnemonic: string, password: string) => {
    const encrypted = await encrypt(mnemonic, password);
    localStorage.setItem('wallet', encrypted);
    
    const wallet = WalletService.fromMnemonic(mnemonic);
    setAccount(wallet);
    setIsUnlocked(true);
    setHasWallet(true);

    saveSession(mnemonic);
  };

  const getPrivateKey = async (): Promise<string> => {
    if (!account) throw new Error('Wallet not unlocked');
    return account.privateKey;
  };

  return (
    <WalletContext.Provider value={{
      account,
      isUnlocked,
      hasWallet,
      unlock,
      createWallet,
      confirmMnemonic,
      importWallet,
      getPrivateKey,
      isLoading
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

