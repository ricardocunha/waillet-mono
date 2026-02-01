import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authService, AuthTokens } from '../services/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  tokens: AuthTokens | null;
  authenticate: (privateKey: string, walletAddress: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);

  // Initialize auth service and check existing tokens on mount
  useEffect(() => {
    const init = async () => {
      await authService.initialize();
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      setTokens(authService.getTokens());
    };
    init();
  }, []);

  const authenticate = useCallback(async (privateKey: string, walletAddress: string) => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Check if already authenticated for this wallet
      const alreadyAuth = await authService.isAuthenticatedForWallet(walletAddress);
      if (alreadyAuth) {
        setIsAuthenticated(true);
        setTokens(authService.getTokens());
        console.log('[AuthContext] Already authenticated for wallet:', walletAddress);
        return;
      }

      const newTokens = await authService.authenticate(privateKey, walletAddress);
      setIsAuthenticated(true);
      setTokens(newTokens);
      console.log('[AuthContext] Authentication successful');
    } catch (error: any) {
      console.error('[AuthContext] Authentication failed:', error);
      setAuthError(error.message || 'Authentication failed');
      setIsAuthenticated(false);
      setTokens(null);
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    } finally {
      setIsAuthenticated(false);
      setTokens(null);
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAuthenticating,
        authError,
        tokens,
        authenticate,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
