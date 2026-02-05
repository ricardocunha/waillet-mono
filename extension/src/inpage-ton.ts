/**
 * TON Connect v2 Bridge Provider
 * Provides TON wallet functionality for dApps via TON Connect protocol
 */

import { WindowMessageType } from './types/messaging';

// Extend Window interface
declare global {
  interface Window {
    tonconnect?: any;
    waillet?: any;
  }
}

// TON-specific message types
enum TonMessageType {
  CONNECT = 'ton_connect',
  DISCONNECT = 'ton_disconnect',
  SEND_TRANSACTION = 'ton_sendTransaction',
  SIGN_DATA = 'ton_signData',
}

// TON Connect device info
interface DeviceInfo {
  platform: string;
  appName: string;
  appVersion: string;
  maxProtocolVersion: number;
  features: string[];
}

// TON Connect wallet info
interface WalletInfo {
  name: string;
  image: string;
  tondns?: string;
  about_url?: string;
}

// TON Connect account
interface TonAccount {
  address: string;
  chain: string; // '-239' for mainnet, '-3' for testnet
  walletStateInit?: string;
  publicKey?: string;
}

/**
 * TON Connect v2 Provider
 */
class WailletTonConnectProvider {
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();

  public walletInfo: WalletInfo = {
    name: 'wAIllet',
    image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23a855f7" width="100" height="100" rx="20"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white" font-family="Arial">W</text></svg>',
    about_url: 'https://waillet.io'
  };

  public deviceInfo: DeviceInfo = {
    platform: 'browser',
    appName: 'wAIllet',
    appVersion: '1.0.0',
    maxProtocolVersion: 2,
    features: [
      'SendTransaction',
      'SignData'
    ]
  };

  public account: TonAccount | null = null;
  public connected: boolean = false;

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    if (event.source !== window) return;
    const message = event.data;

    if (message.type !== WindowMessageType.WAILLET_RESPONSE) return;
    if (!message.isTon) return;

    const pending = this.pendingRequests.get(message.id);
    if (!pending) return;

    this.pendingRequests.delete(message.id);

    if (message.error) {
      pending.reject({
        code: message.error.code || 1,
        message: message.error.message || 'Unknown error'
      });
    } else {
      pending.resolve(message.result);
    }
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      window.postMessage({
        type: WindowMessageType.WAILLET_REQUEST,
        method,
        params,
        id,
        origin: window.location.origin,
        isTon: true
      }, '*');

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject({ code: 408, message: 'Request timeout' });
        }
      }, 300000);
    });
  }

  /**
   * Connect to the wallet (TON Connect)
   * @param request - Connect request with manifest and items
   */
  async connect(request: {
    manifestUrl: string;
    items: Array<{ name: string; payload?: string }>;
  }): Promise<{
    device: DeviceInfo;
    items: Array<any>;
  }> {
    const result = await this.sendRequest(TonMessageType.CONNECT, request);

    if (result?.account) {
      this.account = {
        address: result.account.address,
        chain: result.account.chain || '-239', // Default to mainnet
        publicKey: result.account.publicKey,
        walletStateInit: result.account.walletStateInit
      };
      this.connected = true;
      this.emit('connect', this.account);
    }

    return {
      device: this.deviceInfo,
      items: result.items || []
    };
  }

  /**
   * Restore connection from previous session
   */
  async restoreConnection(): Promise<TonAccount | null> {
    try {
      const result = await this.sendRequest(TonMessageType.CONNECT, { restore: true });
      if (result?.account) {
        this.account = result.account;
        this.connected = true;
        return this.account;
      }
    } catch (e) {
      // Ignore restore errors
    }
    return null;
  }

  /**
   * Disconnect from the wallet
   */
  async disconnect(): Promise<void> {
    await this.sendRequest(TonMessageType.DISCONNECT);
    this.account = null;
    this.connected = false;
    this.emit('disconnect');
  }

  /**
   * Send a transaction
   * @param request - Transaction request with messages
   */
  async sendTransaction(request: {
    validUntil: number;
    network?: string; // '-239' for mainnet, '-3' for testnet
    from?: string;
    messages: Array<{
      address: string;
      amount: string;
      stateInit?: string;
      payload?: string;
    }>;
  }): Promise<{
    boc: string;
  }> {
    if (!this.connected) {
      throw { code: 100, message: 'Wallet not connected' };
    }

    const result = await this.sendRequest(TonMessageType.SEND_TRANSACTION, request);

    return {
      boc: result.boc
    };
  }

  /**
   * Sign arbitrary data (proof of ownership)
   * @param request - Sign data request
   */
  async signData(request: {
    schema_crc: number;
    cell: string;
    publicKey?: string;
  }): Promise<{
    signature: string;
    timestamp: number;
  }> {
    if (!this.connected) {
      throw { code: 100, message: 'Wallet not connected' };
    }

    const result = await this.sendRequest(TonMessageType.SIGN_DATA, request);

    return {
      signature: result.signature,
      timestamp: result.timestamp
    };
  }

  /**
   * Get current wallet state
   */
  getWallet(): {
    device: DeviceInfo;
    wallet: WalletInfo;
    account: TonAccount | null;
    connected: boolean;
  } {
    return {
      device: this.deviceInfo,
      wallet: this.walletInfo,
      account: this.account,
      connected: this.connected
    };
  }

  // Event handling
  on(event: string, handler: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);

    return () => this.off(event, handler);
  }

  off(event: string, handler: Function): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[Waillet TON] Error in ${event} handler:`, error);
      }
    });
  }

  /**
   * TON Connect bridge mode - listen for incoming connections
   */
  listen(callback: (event: any) => void): () => void {
    return this.on('message', callback);
  }
}

// Create and inject the provider
const tonProvider = new WailletTonConnectProvider();

if (!window.tonconnect) {
  Object.defineProperty(window, 'tonconnect', {
    value: tonProvider,
    writable: true,
    configurable: true
  });
}

// Also expose on waillet namespace
if (window.waillet) {
  window.waillet.ton = tonProvider;
}

// Announce TON Connect wallet availability
const announceTonWallet = () => {
  window.dispatchEvent(new CustomEvent('tonconnect-wallet-injected', {
    detail: {
      name: tonProvider.walletInfo.name,
      image: tonProvider.walletInfo.image,
      about_url: tonProvider.walletInfo.about_url
    }
  }));
};

announceTonWallet();
window.addEventListener('tonconnect-request-wallets', announceTonWallet);

console.log('[Waillet] TON Connect provider injected');
