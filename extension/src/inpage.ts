/**
 * window.ethereum provider (EIP-1193)
 * Intercepts dApp calls and routes through security analysis
 * Critical methods require user approval, read-only methods pass through
 */

import { WindowMessageType, EthMethod } from './types/messaging';

// Extend Window interface
declare global {
  interface Window {
    ethereum?: any;
    waillet?: any;
  }
}

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
  private pendingRequests: Map<number, { resolve: Function; reject: Function; method: string }> = new Map();
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

    // Handle provider updates (chainChanged, accountsChanged)
    if (message.type === WindowMessageType.WAILLET_PROVIDER_UPDATE) {
      if (message.chainId !== undefined) {
        console.log('[Waillet Provider] Chain changed to:', message.chainId);
        this._updateChainId(message.chainId);
      }
      if (message.accounts !== undefined) {
        console.log('[Waillet Provider] Accounts changed to:', message.accounts);
        this._updateAccounts(message.accounts);
      }
      return;
    }

    // Handle RPC responses
    if (message.type !== WindowMessageType.WAILLET_RESPONSE) return;

    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      console.warn('[Waillet Provider] Received response for unknown request:', message.id);
      return;
    }

    this.pendingRequests.delete(message.id);

    console.log('[Waillet Provider] Processing response for request:', message.id, {
      error: message.error,
      result: message.result,
      resultType: typeof message.result,
      isArray: Array.isArray(message.result)
    });

    if (message.error) {
      const error = new Error(message.error.message) as ProviderRpcError;
      error.code = message.error.code || 4001;
      error.data = message.error.data;
      pending.reject(error);
    } else {
      // Update accounts if the method was eth_requestAccounts or eth_accounts
      if (Array.isArray(message.result) && message.result.length > 0 && typeof message.result[0] === 'string' && message.result[0].startsWith('0x')) {
        console.log('[Waillet Provider] 🔄 Updating accounts from response:', message.result);
        this._updateAccounts(message.result);
      }
      // ONLY update chain ID if the method was eth_chainId
      // This prevents block numbers, signatures, and other hex strings from being mistaken for chainIds
      if (pending.method === EthMethod.CHAIN_ID && typeof message.result === 'string') {
        console.log('[Waillet Provider] 🔄 Updating chainId from response:', message.result);
        this._updateChainId(message.result);
      }
      pending.resolve(message.result);
    }
  }

  async request(args: RequestArguments): Promise<unknown> {
    const { method, params = [] } = args;

    console.log('[Waillet Provider] request:', method, params);

    if (!method || typeof method !== 'string') {
      throw this.createError(4200, 'Invalid method');
    }

    if (method === EthMethod.ACCOUNTS) {
      console.log('[Waillet Provider] Returning accounts:', this._accounts);
      return this._accounts;
    }

    if (method === EthMethod.CHAIN_ID && this._chainId) {
      return this._chainId;
    }

    const id = ++this.requestId;

    // CRITICAL: Add to pending requests BEFORE posting message to avoid race condition
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, method });

      // Now post the message after the pending request is registered
      window.postMessage({
        type: WindowMessageType.WAILLET_REQUEST,
        method,
        params,
        id,
        origin: window.location.origin
      }, '*');

      // Use longer timeout for methods requiring user interaction
      const timeout = this.requiresUserInteraction(method) ? 300000 : 120000; // 5 minutes for user interaction, 2 minutes for read-only
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(this.createError(4900, 'Request timeout'));
        }
      }, timeout);
    });
  }

  private requiresUserInteraction(method: string): boolean {
    return [
      EthMethod.REQUEST_ACCOUNTS,
      EthMethod.SEND_TRANSACTION,
      EthMethod.SIGN,
      EthMethod.PERSONAL_SIGN,
      EthMethod.SIGN_TYPED_DATA_V4,
      EthMethod.WALLET_SWITCH_ETHEREUM_CHAIN,
      EthMethod.WALLET_ADD_ETHEREUM_CHAIN
    ].includes(method as EthMethod);
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
    console.log('[Waillet Provider] _updateAccounts called with:', accounts);
    console.log('[Waillet Provider] Current _accounts:', this._accounts);
    const changed = JSON.stringify(accounts) !== JSON.stringify(this._accounts);
    this._accounts = accounts;
    console.log('[Waillet Provider] ✅ _accounts updated to:', this._accounts);
    if (changed) {
      console.log('[Waillet Provider] 🔔 Emitting accountsChanged event');
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

if (!window.ethereum) {
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: true, // Allow other wallets to override if needed
    configurable: true
  });
}

// Also set as waillet specifically
window.waillet = provider;

// EIP-6963 multi-provider discovery
const getUUID = () => {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback if crypto.randomUUID() not available
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
};

const announceProvider = () => {
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
    detail: Object.freeze({
      info: {
        uuid: getUUID(),
        name: 'Waillet',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23a855f7" width="100" height="100" rx="20"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white" font-family="Arial">W</text></svg>',
        rdns: 'com.waillet'
      },
      provider
    })
  }));
};

// Announce immediately
announceProvider();

// Re-announce when requested
window.addEventListener('eip6963:requestProvider', announceProvider);

// Legacy event
window.dispatchEvent(new Event('ethereum#initialized'));

console.log('[Waillet] Provider injected successfully', {
  hasEthereum: !!window.ethereum,
  isWaillet: window.ethereum?.isWaillet
});
