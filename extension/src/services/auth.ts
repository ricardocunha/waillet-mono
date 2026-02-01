import { WalletService } from './wallet';
import { browserAPI } from '../utils/browser-api';

const API_BASE_URL = 'http://localhost:8000/api';
const AUTH_STORAGE_KEY = 'auth_tokens';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp
  walletAddress: string;
}

export interface NonceResponse {
  nonce: string;
  message: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

class AuthService {
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;

  async initialize(): Promise<void> {
    const stored = await this.getStoredTokens();
    if (stored) {
      this.tokens = stored;
    }
  }

  async getNonce(walletAddress: string): Promise<NonceResponse> {
    const response = await fetch(
      `${API_BASE_URL}/auth/nonce?wallet_address=${walletAddress}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get nonce: ${error}`);
    }

    return response.json();
  }

  async authenticate(privateKey: string, walletAddress: string): Promise<AuthTokens> {
    // 1. Get nonce and SIWE message from backend
    const { message } = await this.getNonce(walletAddress);

    // 2. Sign the message with the wallet's private key
    const signature = await WalletService.signMessage(privateKey, message);

    // 3. Verify signature and get JWT tokens
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, signature }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${error}`);
    }

    const tokenResponse: AuthTokenResponse = await response.json();

    // 4. Store tokens
    const tokens: AuthTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      walletAddress: walletAddress.toLowerCase(),
    };

    await this.storeTokens(tokens);
    this.tokens = tokens;

    console.log('[AuthService] Authenticated successfully:', walletAddress);
    return tokens;
  }

  async refreshAccessToken(): Promise<AuthTokens> {
    // Prevent multiple simultaneous refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<AuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: this.tokens.refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed, clear tokens
      await this.clearTokens();
      throw new Error('Token refresh failed');
    }

    const tokenResponse: AuthTokenResponse = await response.json();

    const tokens: AuthTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      walletAddress: this.tokens.walletAddress,
    };

    await this.storeTokens(tokens);
    this.tokens = tokens;

    console.log('[AuthService] Token refreshed successfully');
    return tokens;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.tokens) {
      const stored = await this.getStoredTokens();
      if (!stored) return null;
      this.tokens = stored;
    }

    // Check if token is expired (with 30 second buffer)
    const isExpired = this.tokens.expiresAt - 30000 < Date.now();

    if (isExpired) {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('[AuthService] Token refresh failed:', error);
        return null;
      }
    }

    return this.tokens?.accessToken || null;
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  async isAuthenticatedForWallet(walletAddress: string): Promise<boolean> {
    if (!this.tokens) {
      const stored = await this.getStoredTokens();
      if (!stored) return false;
      this.tokens = stored;
    }

    return (
      this.tokens.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
      (await this.isAuthenticated())
    );
  }

  async logout(): Promise<void> {
    const token = await this.getAccessToken();

    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('[AuthService] Logout API call failed:', error);
      }
    }

    await this.clearTokens();
    console.log('[AuthService] Logged out');
  }

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    await browserAPI.storage.local.set({ [AUTH_STORAGE_KEY]: tokens });
  }

  private async getStoredTokens(): Promise<AuthTokens | null> {
    const result = await browserAPI.storage.local.get(AUTH_STORAGE_KEY);
    return result[AUTH_STORAGE_KEY] || null;
  }

  private async clearTokens(): Promise<void> {
    this.tokens = null;
    await browserAPI.storage.local.remove(AUTH_STORAGE_KEY);
  }

  getTokens(): AuthTokens | null {
    return this.tokens;
  }
}

export const authService = new AuthService();
