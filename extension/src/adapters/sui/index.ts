/**
 * SUI Chain Adapter
 * Handles SUI blockchain operations using @mysten/sui
 */

import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { ChainType, DerivedAccount, NetworkConfig, TokenConfig } from '../../types/chainTypes';
import {
  BaseChainAdapter,
  TransactionParams,
  TransactionResult,
  SignedTransaction,
  SignedMessage,
  FeeEstimate
} from '../types';
import { getSuiNetworks, getSuiNetwork, getSuiExplorerUrl } from './networks';
import { getSuiNetworkTokens, getSuiTokenAddress, SUI_COIN_TYPE } from './tokens';
import {
  deriveEd25519Key,
  mnemonicToSeed,
  getDerivationPath,
  isValidSuiAddress
} from '../../services/keyDerivation';

const MIST_PER_SUI = 1_000_000_000; // 10^9

/**
 * SUI Chain Adapter implementation
 */
export class SUIAdapter extends BaseChainAdapter {
  readonly chainType = ChainType.SUI;

  private clientCache: Map<string, SuiClient> = new Map();

  getNetworks(): NetworkConfig[] {
    return getSuiNetworks();
  }

  getDefaultNetwork(): NetworkConfig {
    const networks = getSuiNetworks();
    return networks.find((n: NetworkConfig) => n.id === 'sui-mainnet') || networks[0];
  }

  async deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount> {
    // Generate seed from mnemonic
    const seed = await mnemonicToSeed(mnemonic);

    // Derive private key using SLIP-10
    const path = getDerivationPath(ChainType.SUI, index);
    const privateKey = await deriveEd25519Key(seed, path);

    // Create keypair
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);

    // Get address (0x prefixed, 32 bytes)
    const address = keypair.getPublicKey().toSuiAddress();
    const publicKey = keypair.getPublicKey().toBase64();

    return {
      address,
      publicKey,
      privateKey,
      index,
      chainType: ChainType.SUI
    };
  }

  async getBalance(address: string, networkId: string, tokenAddress?: string): Promise<string> {
    const client = this.getClient(networkId);

    const coinType = tokenAddress || SUI_COIN_TYPE;

    const balance = await client.getBalance({
      owner: address,
      coinType
    });

    // SUI uses 9 decimals (MIST)
    const decimals = coinType === SUI_COIN_TYPE ? 9 : 6; // Most bridged tokens use 6
    return (Number(balance.totalBalance) / Math.pow(10, decimals)).toString();
  }

  async signTransaction(
    privateKey: Uint8Array,
    params: TransactionParams,
    networkId: string
  ): Promise<SignedTransaction> {
    const client = this.getClient(networkId);
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();

    const tx = new Transaction();
    tx.setSender(senderAddress);

    if (params.token && params.token.toUpperCase() !== 'SUI') {
      // Token transfer
      const coinType = getSuiTokenAddress(params.token, networkId);
      if (!coinType) {
        throw new Error(`Token ${params.token} not supported on ${networkId}`);
      }

      const decimals = 6; // Most bridged tokens use 6 decimals
      const amount = BigInt(Math.floor(parseFloat(params.value || '0') * Math.pow(10, decimals)));

      // Get coins of this type
      const coins = await client.getCoins({
        owner: senderAddress,
        coinType
      });

      if (coins.data.length === 0) {
        throw new Error(`No ${params.token} coins found`);
      }

      // Use first coin for transfer
      const [coin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [amount]);
      tx.transferObjects([coin], params.to);
    } else {
      // Native SUI transfer
      const amount = BigInt(Math.floor(parseFloat(params.value || '0') * MIST_PER_SUI));
      const [coin] = tx.splitCoins(tx.gas, [amount]);
      tx.transferObjects([coin], params.to);
    }

    // Build and sign transaction
    const txBytes = await tx.build({ client });
    const signature = await keypair.signTransaction(txBytes);

    return {
      chainType: ChainType.SUI,
      raw: {
        txBytes,
        signature
      }
    };
  }

  async sendTransaction(networkId: string, signedTx: SignedTransaction): Promise<TransactionResult> {
    const client = this.getClient(networkId);

    const result = await client.executeTransactionBlock({
      transactionBlock: signedTx.raw.txBytes,
      signature: signedTx.raw.signature.signature
    });

    return {
      hash: result.digest,
      from: '',
      to: '',
      value: '0',
      explorerUrl: getSuiExplorerUrl(networkId, 'tx', result.digest)
    };
  }

  /**
   * Send transaction directly (convenience method)
   */
  async sendTransactionDirect(
    privateKey: Uint8Array,
    params: TransactionParams,
    networkId: string
  ): Promise<TransactionResult> {
    const client = this.getClient(networkId);
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();

    const tx = new Transaction();
    tx.setSender(senderAddress);

    if (params.token && params.token.toUpperCase() !== 'SUI') {
      const coinType = getSuiTokenAddress(params.token, networkId);
      if (!coinType) {
        throw new Error(`Token ${params.token} not supported on ${networkId}`);
      }

      const decimals = 6;
      const amount = BigInt(Math.floor(parseFloat(params.value || '0') * Math.pow(10, decimals)));

      const coins = await client.getCoins({ owner: senderAddress, coinType });
      if (coins.data.length === 0) {
        throw new Error(`No ${params.token} coins found`);
      }

      const [coin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [amount]);
      tx.transferObjects([coin], params.to);
    } else {
      const amount = BigInt(Math.floor(parseFloat(params.value || '0') * MIST_PER_SUI));
      const [coin] = tx.splitCoins(tx.gas, [amount]);
      tx.transferObjects([coin], params.to);
    }

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair
    });

    return {
      hash: result.digest,
      from: senderAddress,
      to: params.to,
      value: params.value || '0',
      explorerUrl: getSuiExplorerUrl(networkId, 'tx', result.digest)
    };
  }

  async signMessage(privateKey: Uint8Array, message: string): Promise<SignedMessage> {
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);

    // Convert message to bytes
    let messageBytes: Uint8Array;
    if (message.startsWith('0x')) {
      const hex = message.slice(2);
      messageBytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
      messageBytes = new TextEncoder().encode(message);
    }

    // Sign message
    const { signature } = await keypair.signPersonalMessage(messageBytes);

    return {
      message,
      signature,
      publicKey: keypair.getPublicKey().toBase64()
    };
  }

  validateAddress(address: string): boolean {
    return isValidSuiAddress(address);
  }

  async estimateFee(_params: TransactionParams, _networkId: string): Promise<FeeEstimate> {
    // SUI gas is typically very low
    const baseFee = 0.001; // ~0.001 SUI for simple transfers

    return {
      estimatedFee: baseFee.toFixed(9),
      currency: 'SUI',
      details: {
        computeUnits: 1000
      }
    };
  }

  getTokens(networkId: string): TokenConfig[] {
    return getSuiNetworkTokens(networkId);
  }

  async getTokenBalance(address: string, tokenAddress: string, networkId: string): Promise<string> {
    return this.getBalance(address, networkId, tokenAddress);
  }

  /**
   * Get or create client for a network
   */
  private getClient(networkId: string): SuiClient {
    let client = this.clientCache.get(networkId);
    if (!client) {
      const network = getSuiNetwork(networkId);
      if (!network) {
        throw new Error(`Unknown SUI network: ${networkId}`);
      }
      client = new SuiClient({ url: network.rpcUrl });
      this.clientCache.set(networkId, client);
    }
    return client;
  }
}

// Export singleton instance
export const suiAdapter = new SUIAdapter();
