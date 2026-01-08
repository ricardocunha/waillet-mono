/**
 * Waillet Inpage Provider
 *
 * This script runs in the webpage context and injects a custom window.ethereum provider
 * that implements EIP-1193. It intercepts Web3 RPC calls from dApps and routes them
 * through our security analysis system.
 *
 * Security-critical methods (eth_sendTransaction, eth_requestAccounts) require user approval.
 * Read-only methods are passed through to the RPC proxy.
 */

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

/**
 * Custom Ethereum Provider implementing EIP-1193
 */
class WailletProvider {
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private eventListeners: Map<EventName, Set<Function>> = new Map();
  public isWaillet: boolean = true;
  public isMetaMask: boolean = false; // Some dApps check for this
  private _chainId: string | null = null;
  private _accounts: string[] = [];

  constructor() {
    // Listen for responses from content script
    window.addEventListener('message', this.handleMessage.bind(this));

    // Initialize by requesting current state
    this.initialize();
  }

  private async initialize() {
    try {
      // Request initial chain ID
      const chainId = await this.request({ method: 'eth_chainId' });
      this._chainId = chainId as string;
      console.log('[Waillet] Initialized with chain ID:', this._chainId);
    } catch (error) {
      console.error('[Waillet] Failed to initialize:', error);
    }
  }

  /**
   * Handle messages from content script
   */
  private handleMessage(event: MessageEvent) {
    // Only accept messages from same origin
    if (event.source !== window) return;

    const message = event.data;
    if (message.type !== 'WAILLET_RESPONSE') return;

    const pending = this.pendingRequests.get(message.id);
    if (!pending) return;

    this.pendingRequests.delete(message.id);

    if (message.error) {
      const error = new Error(message.error.message) as ProviderRpcError;
      error.code = message.error.code || 4001;
      error.data = message.error.data;
      pending.reject(error);
    } else {
      // Update accounts if this was an eth_requestAccounts call
      if (Array.isArray(message.result) && message.result.length > 0 && message.result[0].startsWith('0x')) {
        this._updateAccounts(message.result);
      }
      // Update chain ID if this was an eth_chainId call
      if (typeof message.result === 'string' && message.result.startsWith('0x') && !message.result.includes('.')) {
        // Looks like a chain ID (hex string without dots)
        this._updateChainId(message.result);
      }
      pending.resolve(message.result);
    }
  }

  /**
   * Main request method (EIP-1193)
   */
  async request(args: RequestArguments): Promise<unknown> {
    const { method, params = [] } = args;

    // Validate method
    if (!method || typeof method !== 'string') {
      throw this.createError(4200, 'Invalid method');
    }

    // Handle special cases
    if (method === 'eth_accounts') {
      return this._accounts;
    }

    // For eth_chainId, always fetch fresh if we don't have it cached
    if (method === 'eth_chainId' && this._chainId) {
      return this._chainId;
    }

    // Create unique request ID
    const id = ++this.requestId;

    // Send request to content script
    window.postMessage({
      type: 'WAILLET_REQUEST',
      method,
      params,
      id,
      origin: window.location.origin
    }, '*');

    // Return promise that will be resolved when we get response
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(this.createError(4900, 'Request timeout'));
        }
      }, 60000);
    });
  }

  /**
   * Legacy send method (for backward compatibility)
   */
  send(methodOrPayload: string | { method: string; params?: Array<any> }, paramsOrCallback?: Array<any> | Function): Promise<unknown> {
    // Handle different call signatures
    if (typeof methodOrPayload === 'string') {
      // send(method, params)
      return this.request({ method: methodOrPayload, params: paramsOrCallback as Array<any> });
    } else {
      // send(payload)
      return this.request(methodOrPayload);
    }
  }

  /**
   * Legacy sendAsync method
   */
  sendAsync(payload: { method: string; params?: Array<any>; id?: number; jsonrpc?: string }, callback: (error: Error | null, result?: any) => void): void {
    this.request(payload)
      .then(result => callback(null, { id: payload.id || 1, jsonrpc: '2.0', result }))
      .catch(error => callback(error));
  }

  /**
   * Event listeners (EIP-1193)
   */
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

  /**
   * Emit events to listeners
   */
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

  /**
   * Update accounts (called when user connects/disconnects)
   */
  _updateAccounts(accounts: string[]): void {
    const changed = JSON.stringify(accounts) !== JSON.stringify(this._accounts);
    this._accounts = accounts;
    if (changed) {
      this.emit('accountsChanged', accounts);
    }
  }

  /**
   * Update chain ID
   */
  _updateChainId(chainId: string): void {
    if (this._chainId !== chainId) {
      this._chainId = chainId;
      this.emit('chainChanged', chainId);
    }
  }

  /**
   * Create standardized error
   */
  private createError(code: number, message: string): ProviderRpcError {
    const error = new Error(message) as ProviderRpcError;
    error.code = code;
    return error;
  }
}

// Inject provider before page scripts load
const provider = new WailletProvider();

// Announce provider via multiple methods for compatibility
Object.defineProperty(window, 'ethereum', {
  value: provider,
  writable: false,
  configurable: false
});

// Dispatch initialization event
window.dispatchEvent(new Event('ethereum#initialized'));

// EIP-6963: Multi-provider discovery
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
