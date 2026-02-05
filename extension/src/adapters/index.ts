/**
 * Chain Adapter Registry
 * Manages all chain-specific adapters and provides a unified interface
 */

import { ChainType, DerivedAccount, NetworkConfig, getChainTypeFromNetwork } from '../types/chainTypes';
import { ChainAdapter, TransactionParams, TransactionResult, SignedMessage, FeeEstimate } from './types';
import { evmAdapter } from './evm';
import { solanaAdapter } from './solana';
import { suiAdapter } from './sui';
import { tonAdapter } from './ton';

// Re-export types and adapters
export * from './types';
export { evmAdapter } from './evm';
export { solanaAdapter } from './solana';
export { suiAdapter } from './sui';
export { tonAdapter } from './ton';

/**
 * Chain Adapter Registry
 * Singleton that manages all chain adapters
 */
export class ChainAdapterRegistry {
  private adapters: Map<ChainType, ChainAdapter> = new Map();

  constructor() {
    // Register all adapters
    this.register(evmAdapter);
    this.register(solanaAdapter);
    this.register(suiAdapter);
    this.register(tonAdapter);
  }

  /**
   * Register a chain adapter
   */
  register(adapter: ChainAdapter): void {
    this.adapters.set(adapter.chainType, adapter);
  }

  /**
   * Get adapter for a chain type
   */
  getAdapter(chainType: ChainType): ChainAdapter {
    const adapter = this.adapters.get(chainType);
    if (!adapter) {
      throw new Error(`No adapter registered for chain type: ${chainType}`);
    }
    return adapter;
  }

  /**
   * Get adapter for a network ID
   */
  getAdapterForNetwork(networkId: string): ChainAdapter {
    const chainType = getChainTypeFromNetwork(networkId);
    return this.getAdapter(chainType);
  }

  /**
   * Get all registered chain types
   */
  getChainTypes(): ChainType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all networks across all adapters
   */
  getAllNetworks(): NetworkConfig[] {
    const networks: NetworkConfig[] = [];
    for (const adapter of this.adapters.values()) {
      networks.push(...adapter.getNetworks());
    }
    return networks;
  }

  /**
   * Get networks for a specific chain type
   */
  getNetworks(chainType: ChainType): NetworkConfig[] {
    return this.getAdapter(chainType).getNetworks();
  }

  /**
   * Derive accounts from mnemonic for all chain types
   */
  async deriveAllAccounts(mnemonic: string, index: number): Promise<DerivedAccount[]> {
    const accounts: DerivedAccount[] = [];

    for (const adapter of this.adapters.values()) {
      try {
        const account = await adapter.deriveAccount(mnemonic, index);
        accounts.push(account);
      } catch (error) {
        console.error(`Failed to derive account for ${adapter.chainType}:`, error);
      }
    }

    return accounts;
  }

  /**
   * Derive account for a specific chain type
   */
  async deriveAccount(chainType: ChainType, mnemonic: string, index: number): Promise<DerivedAccount> {
    return this.getAdapter(chainType).deriveAccount(mnemonic, index);
  }

  /**
   * Get balance for an address on a network
   */
  async getBalance(address: string, networkId: string, tokenAddress?: string): Promise<string> {
    const adapter = this.getAdapterForNetwork(networkId);
    return adapter.getBalance(address, networkId, tokenAddress);
  }

  /**
   * Send a transaction
   */
  async sendTransaction(
    privateKey: Uint8Array,
    params: TransactionParams,
    networkId: string
  ): Promise<TransactionResult> {
    const adapter = this.getAdapterForNetwork(networkId);
    const signedTx = await adapter.signTransaction(privateKey, params, networkId);
    return adapter.sendTransaction(networkId, signedTx);
  }

  /**
   * Sign a message
   */
  async signMessage(
    chainType: ChainType,
    privateKey: Uint8Array,
    message: string
  ): Promise<SignedMessage> {
    return this.getAdapter(chainType).signMessage(privateKey, message);
  }

  /**
   * Validate an address for a chain type
   */
  validateAddress(chainType: ChainType, address: string): boolean {
    return this.getAdapter(chainType).validateAddress(address);
  }

  /**
   * Validate an address for a network
   */
  validateAddressForNetwork(networkId: string, address: string): boolean {
    const adapter = this.getAdapterForNetwork(networkId);
    return adapter.validateAddress(address);
  }

  /**
   * Estimate transaction fee
   */
  async estimateFee(params: TransactionParams, networkId: string): Promise<FeeEstimate> {
    const adapter = this.getAdapterForNetwork(networkId);
    return adapter.estimateFee(params, networkId);
  }

  /**
   * Get explorer URL for a transaction
   */
  getExplorerUrl(networkId: string, txHash: string): string {
    const adapter = this.getAdapterForNetwork(networkId);
    return adapter.getExplorerUrl(networkId, txHash);
  }

  /**
   * Get explorer URL for an address
   */
  getAddressExplorerUrl(networkId: string, address: string): string {
    const adapter = this.getAdapterForNetwork(networkId);
    return adapter.getAddressExplorerUrl(networkId, address);
  }
}

// Export singleton instance
export const chainAdapterRegistry = new ChainAdapterRegistry();

/**
 * Convenience function to get adapter for a chain type
 */
export function getAdapter(chainType: ChainType): ChainAdapter {
  return chainAdapterRegistry.getAdapter(chainType);
}

/**
 * Convenience function to get adapter for a network
 */
export function getAdapterForNetwork(networkId: string): ChainAdapter {
  return chainAdapterRegistry.getAdapterForNetwork(networkId);
}
