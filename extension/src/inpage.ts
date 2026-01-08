/**
 * window.ethereum provider (EIP-1193)
 * Intercepts dApp calls and routes through security analysis
 * Critical methods require user approval, read-only methods pass through
 */

import { WindowMessageType, EthMethod } from './types/messaging';

interface RequestArguments {
  method: string;
  params?: Array<any>;
}

interface ProviderRpcError extends Error {
  code: number;
  data?: unknown;
}

interface ProviderMessage {
  type: string;
  data: unknown;
}

interface EthereumEvent {
  connect: (connectInfo: { chainId: string }) => void;
  disconnect: (error: ProviderRpcError) => void;
  accountsChanged: (accounts: string[]) => void;
  chainChanged: (chainId: string) => void;
  message: (message: ProviderMessage) => void;
}

type EventName = keyof EthereumEvent;

class WailletProvider {
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private eventListeners: Map<EventName, Set<Function>> = new Map();
  public isWaillet: boolean = true;
  public isMetaMask: boolean = false; // dApp compatibility
  private _chainId: string | null = null;
  private _accounts: string[] = [];

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
    this.initialize();
  }

  private async initialize() {
    try {
      const chainId = await this.request({ method: EthMethod.CHAIN_ID });
      this._chainId = chainId as string;
      console.log('[Waillet] Initialized with chain ID:', this._chainId);
    } catch (error) {
      console.error('[Waillet] Failed to initialize:', error);
    }
  }

  private handleMessage(event: MessageEvent) {
    if (event.source !== window) return;

    const message = event.data;
    if (message.type !== WindowMessageType.WAILLET_RESPONSE) return;

    const pending = this.pendingRequests.get(message.id);
    if (!pending) return;

    this.pendingRequests.delete(message.id);

    if (message.error) {
      const error = new Error(message.error.message) as ProviderRpcError;
      error.code = message.error.code || 4001;
      error.data = message.error.data;
      pending.reject(error);
    } else {
      // Update accounts if returned
      if (Array.isArray(message.result) && message.result.length > 0 && message.result[0].startsWith('0x')) {
        this._updateAccounts(message.result);
      }
      // Update chain ID if returned
      if (typeof message.result === 'string' && message.result.startsWith('0x') && !message.result.includes('.')) {
        this._updateChainId(message.result);
      }
      pending.resolve(message.result);
    }
  }

  async request(args: RequestArguments): Promise<unknown> {
    const { method, params = [] } = args;

    if (!method || typeof method !== 'string') {
      throw this.createError(4200, 'Invalid method');
    }

    if (method === EthMethod.ACCOUNTS) {
      return this._accounts;
    }

    if (method === EthMethod.CHAIN_ID && this._chainId) {
      return this._chainId;
    }

    const id = ++this.requestId;

    window.postMessage({
      type: WindowMessageType.WAILLET_REQUEST,
      method,
      params,
      id,
      origin: window.location.origin
    }, '*');

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(this.createError(4900, 'Request timeout'));
        }
      }, 60000);
    });
  }

  // Legacy methods for compatibility
  send(methodOrPayload: string | { method: string; params?: Array<any> }, paramsOrCallback?: Array<any> | Function): Promise<unknown> {
    if (typeof methodOrPayload === 'string') {
      return this.request({ method: methodOrPayload, params: paramsOrCallback as Array<any> });
    } else {
      return this.request(methodOrPayload);
    }
  }
  sendAsync(payload: { method: string; params?: Array<any>; id?: number; jsonrpc?: string }, callback: (error: Error | null, result?: any) => void): void {
    this.request(payload)
      .then(result => callback(null, { id: payload.id || 1, jsonrpc: '2.0', result }))
      .catch(error => callback(error));
  }

  // Event listeners
  on(eventName: EventName, handler: Function): this {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName)!.add(handler);
    return this;
  }

  removeListener(eventName: EventName, handler: Function): this {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.delete(handler);
    }
    return this;
  }

  removeAllListeners(eventName?: EventName): this {
    if (eventName) {
      this.eventListeners.delete(eventName);
    } else {
      this.eventListeners.clear();
    }
    return this;
  }

  private emit(eventName: EventName, ...args: any[]): void {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[Waillet] Error in ${eventName} handler:`, error);
        }
      });
    }
  }

  _updateAccounts(accounts: string[]): void {
    const changed = JSON.stringify(accounts) !== JSON.stringify(this._accounts);
    this._accounts = accounts;
    if (changed) {
      this.emit('accountsChanged', accounts);
    }
  }

  _updateChainId(chainId: string): void {
    if (this._chainId !== chainId) {
      this._chainId = chainId;
      this.emit('chainChanged', chainId);
    }
  }

  private createError(code: number, message: string): ProviderRpcError {
    const error = new Error(message) as ProviderRpcError;
    error.code = code;
    return error;
  }
}

const provider = new WailletProvider();

Object.defineProperty(window, 'ethereum', {
  value: provider,
  writable: false,
  configurable: false
});

window.dispatchEvent(new Event('ethereum#initialized'));

// EIP-6963 multi-provider discovery
window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
  detail: Object.freeze({
    info: {
      uuid: crypto.randomUUID(),
      name: 'Waillet',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23a855f7" width="100" height="100" rx="20"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white" font-family="Arial">W</text></svg>',
      rdns: 'com.waillet'
    },
    provider
  })
}));

console.log('[Waillet] Provider injected successfully');
