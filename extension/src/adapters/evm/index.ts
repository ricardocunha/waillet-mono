/**
 * EVM Chain Adapter
 * Handles Ethereum and EVM-compatible chains (Polygon, BSC, Arbitrum, etc.)
 */

import { HDNodeWallet, Wallet, JsonRpcProvider, parseUnits, formatUnits, Contract } from 'ethers';
import { ChainType, DerivedAccount, NetworkConfig, TokenConfig } from '../../types/chainTypes';
import {
  BaseChainAdapter,
  TransactionParams,
  TransactionResult,
  SignedTransaction,
  SignedMessage,
  FeeEstimate
} from '../types';
import { getEvmNetworks, getEvmNetwork, getEvmChainId } from './networks';
import { ERC20_ABI, getNetworkTokens, getTokenAddress } from './tokens';
import { isValidEvmAddress, bytesToHex } from '../../services/keyDerivation';

const BACKEND_RPC_PROXY = 'http://localhost:8000/api/rpc/proxy';

/**
 * Proxied JSON RPC provider for backend routing
 */
class ProxiedJsonRpcProvider extends JsonRpcProvider {
  private chainName: string;

  constructor(chainName: string) {
    super(BACKEND_RPC_PROXY);
    this.chainName = chainName;
  }

  async _send(payload: any | Array<any>): Promise<Array<any>> {
    const payloads = Array.isArray(payload) ? payload : [payload];

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Backend RPC proxy error: ${response.status} - ${errorText}`);
        }

        return response.json();
      })
    );

    responses.forEach((result) => {
      if (result.error) {
        throw new Error(result.error.message || JSON.stringify(result.error));
      }
    });

    return responses;
  }
}

/**
 * EVM Chain Adapter implementation
 */
export class EVMAdapter extends BaseChainAdapter {
  readonly chainType = ChainType.EVM;

  getNetworks(): NetworkConfig[] {
    return getEvmNetworks();
  }

  getDefaultNetwork(): NetworkConfig {
    return getEvmNetworks().find(n => n.id === 'ethereum') || getEvmNetworks()[0];
  }

  async deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount> {
    const path = `m/44'/60'/0'/0/${index}`;
    const hdNode = HDNodeWallet.fromPhrase(mnemonic, undefined, path);

    // Get raw private key bytes (remove 0x prefix and convert)
    const privateKeyHex = hdNode.privateKey.slice(2);
    const privateKey = new Uint8Array(privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    return {
      address: hdNode.address,
      publicKey: hdNode.publicKey,
      privateKey,
      index,
      chainType: ChainType.EVM
    };
  }

  async getBalance(address: string, networkId: string, tokenAddress?: string): Promise<string> {
    const provider = await this.getProvider(networkId);

    if (!tokenAddress) {
      const balance = await provider.getBalance(address);
      return formatUnits(balance, 18);
    }

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await tokenContract.decimals();
    const balance = await tokenContract.balanceOf(address);
    return formatUnits(balance, decimals);
  }

  async signTransaction(
    privateKey: Uint8Array,
    params: TransactionParams,
    networkId: string
  ): Promise<SignedTransaction> {
    const provider = await this.getProvider(networkId);
    const wallet = new Wallet('0x' + bytesToHex(privateKey), provider);

    let tx: any = {
      to: params.to,
    };

    if (params.token) {
      // Token transfer
      const tokenAddress = this.getTokenAddressForNetwork(params.token, networkId);
      if (!tokenAddress) {
        throw new Error(`Token ${params.token} not supported on ${networkId}`);
      }

      const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);
      const decimals = await tokenContract.decimals();
      const value = parseUnits(params.value || '0', decimals);

      tx = await tokenContract.transfer.populateTransaction(params.to, value);
    } else {
      // Native token transfer
      tx.value = params.value ? parseUnits(params.value, 18) : 0;
      if (params.data) {
        tx.data = params.data;
      }
    }

    const signedTx = await wallet.signTransaction(tx);

    return {
      chainType: ChainType.EVM,
      raw: signedTx,
      signature: signedTx
    };
  }

  async sendTransaction(networkId: string, signedTx: SignedTransaction): Promise<TransactionResult> {
    const provider = await this.getProvider(networkId);
    const network = getEvmNetwork(networkId);

    const tx = await provider.broadcastTransaction(signedTx.raw);
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction failed');
    }

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to || '',
      value: tx.value?.toString() || '0',
      explorerUrl: `${network?.explorerUrl}/tx/${tx.hash}`
    };
  }

  /**
   * Send a transaction directly (convenience method combining sign + send)
   */
  async sendTransactionDirect(
    privateKey: Uint8Array,
    params: TransactionParams,
    networkId: string
  ): Promise<TransactionResult> {
    const provider = await this.getProvider(networkId);
    const wallet = new Wallet('0x' + bytesToHex(privateKey), provider);
    const network = getEvmNetwork(networkId);

    let tx;
    if (params.token) {
      const tokenAddress = this.getTokenAddressForNetwork(params.token, networkId);
      if (!tokenAddress) {
        throw new Error(`Token ${params.token} not supported on ${networkId}`);
      }

      const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);
      const decimals = await tokenContract.decimals();
      const value = parseUnits(params.value || '0', decimals);

      tx = await tokenContract.transfer(params.to, value);
    } else {
      tx = await wallet.sendTransaction({
        to: params.to,
        value: params.value ? parseUnits(params.value, 18) : 0,
        data: params.data || '0x'
      });
    }

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Transaction failed');
    }

    return {
      hash: tx.hash,
      from: wallet.address,
      to: params.to,
      value: params.value || '0',
      explorerUrl: `${network?.explorerUrl}/tx/${tx.hash}`
    };
  }

  async signMessage(privateKey: Uint8Array, message: string): Promise<SignedMessage> {
    const wallet = new Wallet('0x' + bytesToHex(privateKey));

    let signature: string;
    if (message.startsWith('0x')) {
      const bytes = message.slice(2);
      const messageBytes = new Uint8Array(bytes.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      signature = await wallet.signMessage(messageBytes);
    } else {
      signature = await wallet.signMessage(message);
    }

    return {
      message,
      signature,
      publicKey: wallet.address
    };
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(
    privateKey: Uint8Array,
    domain: any,
    types: any,
    value: any
  ): Promise<string> {
    const wallet = new Wallet('0x' + bytesToHex(privateKey));

    // Remove EIP712Domain from types if present (ethers adds it automatically)
    const cleanTypes = { ...types };
    delete cleanTypes.EIP712Domain;

    return await wallet.signTypedData(domain, cleanTypes, value);
  }

  validateAddress(address: string): boolean {
    return isValidEvmAddress(address);
  }

  async estimateFee(params: TransactionParams, networkId: string): Promise<FeeEstimate> {
    const provider = await this.getProvider(networkId);
    const network = getEvmNetwork(networkId);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || parseUnits('20', 'gwei');

    let gasLimit: bigint;
    if (params.token) {
      // Estimate gas for token transfer
      gasLimit = BigInt(65000); // Default for ERC-20 transfer
    } else {
      gasLimit = await provider.estimateGas({
        to: params.to,
        value: params.value ? parseUnits(params.value, 18) : 0,
        data: params.data
      });
    }

    const gasCost = gasLimit * gasPrice;

    return {
      estimatedFee: formatUnits(gasCost, 18),
      currency: network?.nativeCurrency.symbol || 'ETH',
      details: {
        gasLimit: gasLimit.toString(),
        gasPrice: formatUnits(gasPrice, 'gwei')
      }
    };
  }

  getTokens(networkId: string): TokenConfig[] {
    return getNetworkTokens(networkId);
  }

  async getTokenBalance(address: string, tokenAddress: string, networkId: string): Promise<string> {
    return this.getBalance(address, networkId, tokenAddress);
  }

  /**
   * Get provider for a network
   */
  private async getProvider(networkId: string): Promise<JsonRpcProvider> {
    const network = getEvmNetwork(networkId);
    if (!network) {
      throw new Error(`Unsupported network: ${networkId}`);
    }

    // Always use proxied provider - let backend handle RPC routing
    return new ProxiedJsonRpcProvider(networkId);
  }

  /**
   * Get token address for a network
   */
  private getTokenAddressForNetwork(tokenSymbol: string, networkId: string): string | undefined {
    return getTokenAddress(tokenSymbol, networkId);
  }

  /**
   * Get chain ID for a network
   */
  getChainId(networkId: string): number | undefined {
    return getEvmChainId(networkId);
  }

  /**
   * Get chain ID as hex string
   */
  getChainIdHex(networkId: string): string {
    const chainId = this.getChainId(networkId);
    return chainId ? `0x${chainId.toString(16)}` : '0x1';
  }
}

// Export singleton instance
export const evmAdapter = new EVMAdapter();
