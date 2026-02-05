import { HDNodeWallet, Wallet, JsonRpcProvider, parseUnits, formatUnits, Contract } from 'ethers';
import { ChainType } from '../types/chainTypes';
import { chainAdapterRegistry } from '../adapters';
import { networkService } from './networkService';
import { api } from './api';

const BACKEND_RPC_PROXY = 'http://localhost:8000/api/rpc/proxy';

// Ethers error codes
enum EthersErrorCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CALL_EXCEPTION = 'CALL_EXCEPTION',
  NONCE_EXPIRED = 'NONCE_EXPIRED',
  REPLACEMENT_UNDERPRICED = 'REPLACEMENT_UNDERPRICED',
  UNPREDICTABLE_GAS_LIMIT = 'UNPREDICTABLE_GAS_LIMIT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
}

class ProxiedJsonRpcProvider extends JsonRpcProvider {
  private chainName: string;

  constructor(chainName: string) {
    super(BACKEND_RPC_PROXY);
    this.chainName = chainName;
  }

  async _send(payload: any | Array<any>): Promise<Array<any>> {
    const payloads = Array.isArray(payload) ? payload : [payload];
    
    console.log(`🔄 RPC Call: ${this.chainName}`, payloads);

    try {
      // Convert ethers payload to our backend format
      const requests = payloads.map((p) => ({
        chain: this.chainName,
        method: p.method,
        params: p.params || [],
        id: p.id || 1,
        jsonrpc: p.jsonrpc || '2.0',
      }));

      const responses = await Promise.all(
        requests.map(async (request) => {
          const response = await fetch(BACKEND_RPC_PROXY, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend RPC proxy error: ${response.status} - ${errorText}`);
          }

          return response.json();
        })
      );

      console.log(`✅ RPC Results: ${this.chainName}`, responses);

      responses.forEach((result) => {
        if (result.error) {
          throw new Error(result.error.message || JSON.stringify(result.error));
        }
      });

      return responses;
    } catch (error) {
      console.error(`❌ RPC Error: ${this.chainName}`, error);
      throw error;
    }
  }
}

export interface WalletAccount {
  address: string;
  privateKey: string;
  index: number;
  name?: string; // Account label (e.g., "Account 1", "Trading")
  chainType: ChainType; // Chain type (evm, solana, sui, ton)
  network?: string; // Specific network (solana-mainnet, sui-testnet, etc.)
  publicKey?: string; // Public key (needed for Ed25519 chains)
  imported?: boolean; // True if imported via private key (not derived from mnemonic)
  chain?: string; // DEPRECATED: kept for migration, use chainType instead
}

export interface ChainConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  nativeCurrency: string;
  explorer: string;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  token?: string;
  chain: string;
  data?: string;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  explorerUrl: string;
}

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];


// Cached chains from backend (no fallback - must be initialized from API)
let cachedChains: Record<string, ChainConfig> = {};
let chainsInitialized = false;

/**
 * Initialize chains from backend
 */
export async function initChains(): Promise<void> {
  const networks = await networkService.getNetworksByChainType(ChainType.EVM);
  cachedChains = {};
  for (const network of networks) {
    cachedChains[network.id] = {
      name: network.name,
      rpcUrl: network.id, // Use network ID for proxy routing
      chainId: network.chainId || 1,
      nativeCurrency: network.nativeCurrency.symbol,
      explorer: network.explorerUrl,
    };
  }
  chainsInitialized = true;
}

/**
 * Get chain config by network ID
 */
export function getChainConfig(networkId: string): ChainConfig | undefined {
  return cachedChains[networkId];
}

/**
 * Check if chains are loaded from backend
 */
export function isChainsInitialized(): boolean {
  return chainsInitialized;
}

/**
 * Get all chain configs
 */
export function getAllChains(): Record<string, ChainConfig> {
  return cachedChains;
}

// Token addresses are now fetched from backend via api.getTokensForNetwork()
// This is kept for backwards compatibility but should be migrated to use the API
export const TOKENS: Record<string, Record<string, string>> = {};

export class WalletService {
  static generateMnemonic(): string {
    const wallet = Wallet.createRandom();
    return wallet.mnemonic!.phrase;
  }

  /**
   * Derive EVM account from mnemonic (default behavior for backward compatibility)
   */
  static fromMnemonic(mnemonic: string, index: number = 0): WalletAccount {
    const path = `m/44'/60'/0'/0/${index}`;
    const hdNode = HDNodeWallet.fromPhrase(mnemonic, undefined, path);

    return {
      address: hdNode.address,
      privateKey: hdNode.privateKey,
      index,
      name: `Account ${index + 1}`,
      chainType: ChainType.EVM,
      publicKey: hdNode.publicKey
    };
  }

  /**
   * Derive account for any chain type from mnemonic
   */
  static async fromMnemonicForChain(
    mnemonic: string,
    chainType: ChainType,
    index: number = 0
  ): Promise<WalletAccount> {
    const adapter = chainAdapterRegistry.getAdapter(chainType);
    const derived = await adapter.deriveAccount(mnemonic, index);

    // Convert private key bytes to hex string for storage
    const privateKeyHex = '0x' + Array.from(derived.privateKey)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      address: derived.address,
      privateKey: privateKeyHex,
      index,
      name: `${chainType.toUpperCase()} Account ${index + 1}`,
      chainType,
      publicKey: derived.publicKey,
      network: adapter.getDefaultNetwork().id
    };
  }

  /**
   * Derive accounts for all chain types from the same mnemonic
   */
  static async deriveAllChainAccounts(mnemonic: string, index: number = 0): Promise<WalletAccount[]> {
    const accounts: WalletAccount[] = [];

    for (const chainType of Object.values(ChainType)) {
      try {
        const account = await this.fromMnemonicForChain(mnemonic, chainType as ChainType, index);
        accounts.push(account);
      } catch (error) {
        console.error(`Failed to derive ${chainType} account:`, error);
      }
    }

    return accounts;
  }

  static async getProvider(chain: string): Promise<JsonRpcProvider> {
    const chainName = chain.toLowerCase();
    const chainConfig = getChainConfig(chainName);
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    // Always use proxied provider - let backend handle RPC routing
    return new ProxiedJsonRpcProvider(chainName);
  }

  static async sendTransaction(
    privateKey: string,
    to: string,
    value: string,
    data: string,
    chain: string
  ): Promise<string> {
    const provider = await this.getProvider(chain);
    const wallet = new Wallet(privateKey, provider);

    try {
      // Check if user has enough ETH for gas
      const balance = await provider.getBalance(wallet.address);
      if (balance === BigInt(0)) {
        throw new Error(`Insufficient ETH for gas on ${chain}. Your balance is 0 ETH.`);
      }

      console.log(`[WalletService] Sending transaction on ${chain}:`, { to, value, data: data?.slice(0, 20) });

      const tx = await wallet.sendTransaction({
        to,
        value: value === '0x0' || value === '0' ? 0 : value,
        data: data || '0x',
      });

      console.log(`[WalletService] Transaction sent:`, tx.hash);

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction failed');
      }

      console.log(`[WalletService] Transaction confirmed:`, tx.hash);
      return tx.hash;
    } catch (error: any) {
      console.error('[WalletService] Transaction error:', error);

      // Parse ethers errors to provide better messages
      switch (error.code) {
        case EthersErrorCode.INSUFFICIENT_FUNDS:
          throw new Error(`Insufficient ETH for gas on ${chain}. Please add ETH to your wallet.`);

        case EthersErrorCode.CALL_EXCEPTION:
          throw new Error(`Transaction would fail: ${error.reason || 'Contract execution reverted'}. You may not have enough ETH for gas.`);

        case EthersErrorCode.UNPREDICTABLE_GAS_LIMIT:
          throw new Error(`Cannot estimate gas. You may not have enough ETH for gas on ${chain}.`);

        case EthersErrorCode.NONCE_EXPIRED:
          throw new Error('Transaction nonce expired. Please try again.');

        case EthersErrorCode.REPLACEMENT_UNDERPRICED:
          throw new Error('Gas price too low. Please try again with higher gas.');

        case EthersErrorCode.NETWORK_ERROR:
          throw new Error('Network error. Please check your connection and try again.');

        case EthersErrorCode.TIMEOUT:
          throw new Error('Transaction timed out. Please try again.');

        default:
          // Re-throw with original message if we don't have a better one
          throw new Error(error.message || 'Transaction failed');
      }
    }
  }

  static async sendNativeToken(
    privateKey: string,
    to: string,
    amount: string,
    chain: string
  ): Promise<TransactionResult> {
    const provider = await this.getProvider(chain);
    const wallet = new Wallet(privateKey, provider);
    const chainConfig = getChainConfig(chain.toLowerCase());
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    const value = parseUnits(amount, 18);

    const tx = await wallet.sendTransaction({
      to,
      value,
    });

    await tx.wait();

    return {
      hash: tx.hash,
      from: wallet.address,
      to,
      value: amount,
      explorerUrl: `${chainConfig.explorer}/tx/${tx.hash}`,
    };
  }

  static async sendToken(
    privateKey: string,
    to: string,
    amount: string,
    tokenSymbol: string,
    chain: string
  ): Promise<TransactionResult> {
    const provider = await this.getProvider(chain);
    const wallet = new Wallet(privateKey, provider);
    const chainConfig = getChainConfig(chain.toLowerCase());
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    // Fetch token address from backend
    const tokenData = await api.getToken(tokenSymbol.toUpperCase());
    const tokenAddress = tokenData.addresses?.[chain.toLowerCase()]?.contract_address;
    if (!tokenAddress) {
      throw new Error(`Token ${tokenSymbol} not supported on ${chain}`);
    }

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);

    const decimals = tokenData.addresses[chain.toLowerCase()]?.decimals || await tokenContract.decimals();
    const value = parseUnits(amount, decimals);

    const tx = await tokenContract.transfer(to, value);
    await tx.wait();

    return {
      hash: tx.hash,
      from: wallet.address,
      to,
      value: amount,
      explorerUrl: `${chainConfig.explorer}/tx/${tx.hash}`,
    };
  }

  static async getBalance(
    address: string,
    chain: string,
    tokenSymbol?: string
  ): Promise<string> {
    const provider = await this.getProvider(chain);

    if (!tokenSymbol) {
      const balance = await provider.getBalance(address);
      return formatUnits(balance, 18);
    }

    // Fetch token address from backend
    const tokenData = await api.getToken(tokenSymbol.toUpperCase());
    const tokenAddress = tokenData.addresses?.[chain.toLowerCase()]?.contract_address;
    if (!tokenAddress) {
      throw new Error(`Token ${tokenSymbol} not supported on ${chain}`);
    }

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = tokenData.addresses[chain.toLowerCase()]?.decimals || await tokenContract.decimals();
    const balance = await tokenContract.balanceOf(address);

    return formatUnits(balance, decimals);
  }

  static async estimateGas(
    privateKey: string,
    to: string,
    amount: string,
    chain: string,
    tokenSymbol?: string
  ): Promise<{ gasLimit: string; gasPrice: string; gasCost: string }> {
    const provider = await this.getProvider(chain);
    const wallet = new Wallet(privateKey, provider);

    let gasLimit: bigint;
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || parseUnits('20', 'gwei');

    if (!tokenSymbol) {
      const value = parseUnits(amount, 18);
      gasLimit = await provider.estimateGas({
        from: wallet.address,
        to,
        value,
      });
    } else {
      // Fetch token address from backend
      const tokenData = await api.getToken(tokenSymbol.toUpperCase());
      const tokenAddress = tokenData.addresses?.[chain.toLowerCase()]?.contract_address;
      if (!tokenAddress) {
        throw new Error(`Token ${tokenSymbol} not supported on ${chain}`);
      }

      const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);
      const decimals = tokenData.addresses[chain.toLowerCase()]?.decimals || await tokenContract.decimals();
      const value = parseUnits(amount, decimals);

      gasLimit = await tokenContract.transfer.estimateGas(to, value);
    }

    const gasCost = gasLimit * gasPrice;

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: formatUnits(gasPrice, 'gwei'),
      gasCost: formatUnits(gasCost, 18),
    };
  }

  static async signMessage(privateKey: string, message: string): Promise<string> {
    const wallet = new Wallet(privateKey);

    // If message starts with 0x, it's hex-encoded
    if (message.startsWith('0x')) {
      const bytes = message.slice(2);
      const messageBytes = new Uint8Array(bytes.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      return await wallet.signMessage(messageBytes);
    }

    return await wallet.signMessage(message);
  }

  static async signTypedData(
    privateKey: string,
    domain: any,
    types: any,
    value: any
  ): Promise<string> {
    const wallet = new Wallet(privateKey);

    // Remove EIP712Domain from types if present (ethers adds it automatically)
    const cleanTypes = { ...types };
    delete cleanTypes.EIP712Domain;

    return await wallet.signTypedData(domain, cleanTypes, value);
  }
}


