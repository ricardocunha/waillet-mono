/**
 * window.suiWallet provider (SUI Wallet Standard)
 * Provides SUI wallet functionality for dApps
 */

import { WindowMessageType } from './types/messaging';

// Extend Window interface
declare global {
  interface Window {
    suiWallet?: any;
    waillet?: any;
  }
}

// SUI-specific message types
enum SuiMessageType {
  CONNECT = 'sui_connect',
  DISCONNECT = 'sui_disconnect',
  GET_ACCOUNTS = 'sui_getAccounts',
  SIGN_TRANSACTION_BLOCK = 'sui_signTransactionBlock',
  SIGN_AND_EXECUTE_TRANSACTION_BLOCK = 'sui_signAndExecuteTransactionBlock',
  SIGN_MESSAGE = 'sui_signMessage',
  SIGN_PERSONAL_MESSAGE = 'sui_signPersonalMessage',
}

interface WalletAccount {
  address: string;
  publicKey: string;
  chains: string[];
  features: string[];
}

/**
 * SUI Wallet Standard Provider
 */
class WailletSuiProvider {
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();

  public name: string = 'wAIllet';
  public version: string = '1.0.0';
  public icon: string = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23a855f7" width="100" height="100" rx="20"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white" font-family="Arial">W</text></svg>';

  public accounts: WalletAccount[] = [];
  public currentAccount: WalletAccount | null = null;
  public connected: boolean = false;

  // SUI Wallet Standard features
  public features = {
    'standard:connect': {
      version: '1.0.0',
      connect: this.connect.bind(this)
    },
    'standard:disconnect': {
      version: '1.0.0',
      disconnect: this.disconnect.bind(this)
    },
    'standard:events': {
      version: '1.0.0',
      on: this.on.bind(this),
      off: this.off.bind(this)
    },
    'sui:signTransactionBlock': {
      version: '1.0.0',
      signTransactionBlock: this.signTransactionBlock.bind(this)
    },
    'sui:signAndExecuteTransactionBlock': {
      version: '1.0.0',
      signAndExecuteTransactionBlock: this.signAndExecuteTransactionBlock.bind(this)
    },
    'sui:signMessage': {
      version: '1.0.0',
      signMessage: this.signMessage.bind(this)
    },
    'sui:signPersonalMessage': {
      version: '1.0.0',
      signPersonalMessage: this.signPersonalMessage.bind(this)
    }
  };

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    if (event.source !== window) return;
    const message = event.data;

    if (message.type !== WindowMessageType.WAILLET_RESPONSE) return;
    if (!message.isSui) return;

    const pending = this.pendingRequests.get(message.id);
    if (!pending) return;

    this.pendingRequests.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error.message || 'Unknown error'));
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
        isSui: true
      }, '*');

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 300000);
    });
  }

  /**
   * Connect to the wallet
   */
  async connect(): Promise<{ accounts: WalletAccount[] }> {
    const result = await this.sendRequest(SuiMessageType.CONNECT);

    if (result?.accounts) {
      this.accounts = result.accounts.map((acc: any) => ({
        address: acc.address,
        publicKey: acc.publicKey,
        chains: ['sui:mainnet', 'sui:testnet', 'sui:devnet'],
        features: Object.keys(this.features)
      }));
      this.currentAccount = this.accounts[0] || null;
      this.connected = true;
      this.emit('change', { accounts: this.accounts });
    }

    return { accounts: this.accounts };
  }

  /**
   * Disconnect from the wallet
   */
  async disconnect(): Promise<void> {
    await this.sendRequest(SuiMessageType.DISCONNECT);
    this.accounts = [];
    this.currentAccount = null;
    this.connected = false;
    this.emit('change', { accounts: [] });
  }

  /**
   * Get accounts
   */
  async getAccounts(): Promise<WalletAccount[]> {
    if (!this.connected) {
      return [];
    }
    return this.accounts;
  }

  /**
   * Sign a transaction block
   */
  async signTransactionBlock(input: {
    transactionBlock: any;
    account: WalletAccount;
    chain: string;
  }): Promise<{
    transactionBlockBytes: string;
    signature: string;
  }> {
    if (!this.connected) {
      throw new Error('Wallet not connected');
    }

    const result = await this.sendRequest(SuiMessageType.SIGN_TRANSACTION_BLOCK, {
      transactionBlock: input.transactionBlock,
      account: input.account.address,
      chain: input.chain
    });

    return {
      transactionBlockBytes: result.transactionBlockBytes,
      signature: result.signature
    };
  }

  /**
   * Sign and execute a transaction block
   */
  async signAndExecuteTransactionBlock(input: {
    transactionBlock: any;
    account: WalletAccount;
    chain: string;
    options?: any;
  }): Promise<any> {
    if (!this.connected) {
      throw new Error('Wallet not connected');
    }

    const result = await this.sendRequest(SuiMessageType.SIGN_AND_EXECUTE_TRANSACTION_BLOCK, {
      transactionBlock: input.transactionBlock,
      account: input.account.address,
      chain: input.chain,
      options: input.options
    });

    return result;
  }

  /**
   * Sign a message (deprecated, use signPersonalMessage)
   */
  async signMessage(input: {
    message: Uint8Array;
    account: WalletAccount;
  }): Promise<{
    messageBytes: string;
    signature: string;
  }> {
    return this.signPersonalMessage(input);
  }

  /**
   * Sign a personal message
   */
  async signPersonalMessage(input: {
    message: Uint8Array;
    account: WalletAccount;
  }): Promise<{
    messageBytes: string;
    signature: string;
  }> {
    if (!this.connected) {
      throw new Error('Wallet not connected');
    }

    const result = await this.sendRequest(SuiMessageType.SIGN_PERSONAL_MESSAGE, {
      message: Buffer.from(input.message).toString('base64'),
      account: input.account.address
    });

    return {
      messageBytes: result.messageBytes,
      signature: result.signature
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
        console.error(`[Waillet SUI] Error in ${event} handler:`, error);
      }
    });
  }
}

// Create and inject the provider
const suiProvider = new WailletSuiProvider();

if (!window.suiWallet) {
  Object.defineProperty(window, 'suiWallet', {
    value: suiProvider,
    writable: true,
    configurable: true
  });
}

// Register with SUI Wallet Standard
const announceWallet = () => {
  window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', {
    detail: {
      register: (wallets: any) => {
        wallets.register(suiProvider);
      }
    }
  }));
};

announceWallet();
window.addEventListener('wallet-standard:app-ready', announceWallet);

// Also expose on waillet namespace
if (window.waillet) {
  window.waillet.sui = suiProvider;
}

console.log('[Waillet] SUI provider injected');
