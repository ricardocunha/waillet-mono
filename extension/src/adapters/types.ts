/**
 * Chain adapter interface and types
 * Defines the contract that all chain adapters must implement
 */

import { ChainType, DerivedAccount, NetworkConfig, TokenConfig } from '../types/chainTypes';
// Re-export types for convenience
export type { NetworkConfig, TokenConfig };

/**
 * Transaction parameters (chain-agnostic)
 */
export interface TransactionParams {
  to: string;
  value?: string;
  data?: string;
  token?: string; // Token symbol or address
  memo?: string; // For chains that support memos (TON, etc.)
}

/**
 * Transaction result
 */
export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  explorerUrl: string;
}

/**
 * Signed transaction (chain-specific format)
 */
export interface SignedTransaction {
  chainType: ChainType;
  raw: any; // Chain-specific signed transaction data
  signature?: string;
}

/**
 * Message signing result
 */
export interface SignedMessage {
  message: string;
  signature: string;
  publicKey?: string;
}

/**
 * Gas/fee estimation result
 */
export interface FeeEstimate {
  estimatedFee: string;
  currency: string;
  details?: {
    gasLimit?: string;
    gasPrice?: string;
    priorityFee?: string;
    computeUnits?: number;
  };
}

/**
 * Chain adapter interface
 * All chain-specific adapters must implement this interface
 */
export interface ChainAdapter {
  /**
   * The chain type this adapter handles
   */
  readonly chainType: ChainType;

  /**
   * Get supported networks for this chain type
   */
  getNetworks(): NetworkConfig[];

  /**
   * Get the default network for this chain type
   */
  getDefaultNetwork(): NetworkConfig;

  /**
   * Derive an account from a mnemonic
   * @param mnemonic - BIP-39 mnemonic phrase
   * @param index - Account index for derivation
   */
  deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount>;

  /**
   * Get the balance of an address
   * @param address - The address to check
   * @param networkId - The network to query
   * @param tokenAddress - Optional token address (for non-native tokens)
   */
  getBalance(address: string, networkId: string, tokenAddress?: string): Promise<string>;

  /**
   * Build and sign a transaction
   * @param privateKey - The private key as Uint8Array
   * @param params - Transaction parameters
   * @param networkId - The network to use
   */
  signTransaction(
    privateKey: Uint8Array,
    params: TransactionParams,
    networkId: string
  ): Promise<SignedTransaction>;

  /**
   * Send a signed transaction to the network
   * @param networkId - The network to broadcast to
   * @param signedTx - The signed transaction
   */
  sendTransaction(
    networkId: string,
    signedTx: SignedTransaction
  ): Promise<TransactionResult>;

  /**
   * Sign a message
   * @param privateKey - The private key as Uint8Array
   * @param message - The message to sign (string or hex)
   */
  signMessage(privateKey: Uint8Array, message: string): Promise<SignedMessage>;

  /**
   * Validate an address format
   * @param address - The address to validate
   */
  validateAddress(address: string): boolean;

  /**
   * Estimate transaction fees
   * @param params - Transaction parameters
   * @param networkId - The network to estimate on
   */
  estimateFee(params: TransactionParams, networkId: string): Promise<FeeEstimate>;

  /**
   * Get supported tokens for a network
   * @param networkId - The network ID
   */
  getTokens(networkId: string): TokenConfig[];

  /**
   * Get token balance
   * @param address - Wallet address
   * @param tokenAddress - Token contract/mint address
   * @param networkId - Network ID
   */
  getTokenBalance(
    address: string,
    tokenAddress: string,
    networkId: string
  ): Promise<string>;

  /**
   * Get network by ID
   * @param networkId - Network ID
   */
  getNetwork(networkId: string): NetworkConfig | undefined;

  /**
   * Get explorer URL for a transaction
   * @param networkId - Network ID
   * @param txHash - Transaction hash
   */
  getExplorerUrl(networkId: string, txHash: string): string;

  /**
   * Get explorer URL for an address
   * @param networkId - Network ID
   * @param address - Address
   */
  getAddressExplorerUrl(networkId: string, address: string): string;
}

/**
 * Base adapter class with common functionality
 */
export abstract class BaseChainAdapter implements ChainAdapter {
  abstract readonly chainType: ChainType;

  abstract getNetworks(): NetworkConfig[];
  abstract getDefaultNetwork(): NetworkConfig;
  abstract deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount>;
  abstract getBalance(address: string, networkId: string, tokenAddress?: string): Promise<string>;
  abstract signTransaction(privateKey: Uint8Array, params: TransactionParams, networkId: string): Promise<SignedTransaction>;
  abstract sendTransaction(networkId: string, signedTx: SignedTransaction): Promise<TransactionResult>;
  abstract signMessage(privateKey: Uint8Array, message: string): Promise<SignedMessage>;
  abstract validateAddress(address: string): boolean;
  abstract estimateFee(params: TransactionParams, networkId: string): Promise<FeeEstimate>;
  abstract getTokens(networkId: string): TokenConfig[];
  abstract getTokenBalance(address: string, tokenAddress: string, networkId: string): Promise<string>;

  /**
   * Get network by ID
   */
  getNetwork(networkId: string): NetworkConfig | undefined {
    return this.getNetworks().find(n => n.id === networkId);
  }

  /**
   * Get explorer URL for a transaction
   */
  getExplorerUrl(networkId: string, txHash: string): string {
    const network = this.getNetwork(networkId);
    if (!network) return '';
    return `${network.explorerUrl}/tx/${txHash}`;
  }

  /**
   * Get explorer URL for an address
   */
  getAddressExplorerUrl(networkId: string, address: string): string {
    const network = this.getNetwork(networkId);
    if (!network) return '';
    return `${network.explorerUrl}/address/${address}`;
  }
}
