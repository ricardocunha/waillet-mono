/**
 * window.solana provider (Phantom-compatible)
 * Provides Solana wallet functionality for dApps
 */

import { WindowMessageType } from './types/messaging';

// Extend Window interface
declare global {
  interface Window {
    solana?: any;
    waillet?: any;
  }
}

interface ConnectOptions {
  onlyIfTrusted?: boolean;
}

interface SendOptions {
  skipPreflight?: boolean;
  preflightCommitment?: string;
  maxRetries?: number;
  minContextSlot?: number;
}

// Solana-specific message types
enum SolanaMessageType {
  CONNECT = 'solana_connect',
  DISCONNECT = 'solana_disconnect',
  SIGN_TRANSACTION = 'solana_signTransaction',
  SIGN_ALL_TRANSACTIONS = 'solana_signAllTransactions',
  SIGN_MESSAGE = 'solana_signMessage',
  SIGN_AND_SEND_TRANSACTION = 'solana_signAndSendTransaction',
}

/**
 * Phantom-compatible Solana Provider
 */
class WailletSolanaProvider {
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();

  public isWaillet: boolean = true;
  public isPhantom: boolean = true; // For compatibility with dApps checking for Phantom
  public publicKey: { toBase58: () => string } | null = null;
  public isConnected: boolean = false;

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent) {
    if (event.source !== window) return;
    const message = event.data;

    if (message.type !== WindowMessageType.WAILLET_RESPONSE) return;
    if (!message.isSolana) return; // Only handle Solana responses

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
        isSolana: true
      }, '*');

      // 5 minute timeout for user interaction
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
  async connect(options?: ConnectOptions): Promise<{ publicKey: { toBase58: () => string } }> {
    const result = await this.sendRequest(SolanaMessageType.CONNECT, options);

    if (result?.publicKey) {
      this.publicKey = {
        toBase58: () => result.publicKey
      };
      this.isConnected = true;
      this.emit('connect', this.publicKey);
    }

    return { publicKey: this.publicKey! };
  }

  /**
   * Disconnect from the wallet
   */
  async disconnect(): Promise<void> {
    await this.sendRequest(SolanaMessageType.DISCONNECT);
    this.publicKey = null;
    this.isConnected = false;
    this.emit('disconnect');
  }

  /**
   * Sign a transaction
   */
  async signTransaction(transaction: any): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    // Serialize transaction for transport
    const serialized = transaction.serialize ?
      Buffer.from(transaction.serialize({ requireAllSignatures: false })).toString('base64') :
      transaction;

    const result = await this.sendRequest(SolanaMessageType.SIGN_TRANSACTION, {
      transaction: serialized
    });

    return result.signedTransaction;
  }

  /**
   * Sign multiple transactions
   */
  async signAllTransactions(transactions: any[]): Promise<any[]> {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    const serialized = transactions.map(tx =>
      tx.serialize ? Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64') : tx
    );

    const result = await this.sendRequest(SolanaMessageType.SIGN_ALL_TRANSACTIONS, {
      transactions: serialized
    });

    return result.signedTransactions;
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array; publicKey: { toBase58: () => string } }> {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    const result = await this.sendRequest(SolanaMessageType.SIGN_MESSAGE, {
      message: Buffer.from(message).toString('base64'),
      display
    });

    return {
      signature: new Uint8Array(Buffer.from(result.signature, 'base64')),
      publicKey: this.publicKey!
    };
  }

  /**
   * Sign and send a transaction
   */
  async signAndSendTransaction(transaction: any, options?: SendOptions): Promise<{ signature: string }> {
    if (!this.isConnected) {
      throw new Error('Wallet not connected');
    }

    const serialized = transaction.serialize ?
      Buffer.from(transaction.serialize({ requireAllSignatures: false })).toString('base64') :
      transaction;

    const result = await this.sendRequest(SolanaMessageType.SIGN_AND_SEND_TRANSACTION, {
      transaction: serialized,
      options
    });

    return { signature: result.signature };
  }

  /**
   * Request to connect (alias for connect)
   */
  async request(args: { method: string; params?: any }): Promise<any> {
    switch (args.method) {
      case 'connect':
        return this.connect(args.params);
      case 'disconnect':
        return this.disconnect();
      case 'signTransaction':
        return this.signTransaction(args.params?.transaction);
      case 'signAllTransactions':
        return this.signAllTransactions(args.params?.transactions);
      case 'signMessage':
        return this.signMessage(args.params?.message, args.params?.display);
      case 'signAndSendTransaction':
        return this.signAndSendTransaction(args.params?.transaction, args.params?.options);
      default:
        throw new Error(`Method ${args.method} not supported`);
    }
  }

  // Event handling
  on(event: string, handler: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  removeListener(event: string, handler: Function): void {
    this.off(event, handler);
  }

  private emit(event: string, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[Waillet Solana] Error in ${event} handler:`, error);
      }
    });
  }
}

// Create and inject the provider
const solanaProvider = new WailletSolanaProvider();

if (!window.solana) {
  Object.defineProperty(window, 'solana', {
    value: solanaProvider,
    writable: true,
    configurable: true
  });
}

// Also expose on waillet namespace
if (window.waillet) {
  window.waillet.solana = solanaProvider;
}

console.log('[Waillet] Solana provider injected');
