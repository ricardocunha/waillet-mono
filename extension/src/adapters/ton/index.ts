/**
 * TON Chain Adapter
 * Handles TON blockchain operations using @ton/ton
 */

import { TonClient, WalletContractV4, internal, toNano, fromNano, Address } from '@ton/ton';
import { ChainType, DerivedAccount, NetworkConfig, TokenConfig } from '../../types/chainTypes';
import {
  BaseChainAdapter,
  TransactionParams,
  TransactionResult,
  SignedTransaction,
  SignedMessage,
  FeeEstimate
} from '../types';
import { getTonNetworks, getTonNetwork, getTonExplorerUrl, getTonApiEndpoint } from './networks';
import { getTonNetworkTokens, getTonJettonAddress } from './jettons';
import {
  deriveEd25519Key,
  mnemonicToSeed,
  getDerivationPath,
  isValidTonAddress,
  bytesToHex,
  base64UrlEncode
} from '../../services/keyDerivation';
import nacl from 'tweetnacl';

/**
 * TON Chain Adapter implementation
 */
export class TONAdapter extends BaseChainAdapter {
  readonly chainType = ChainType.TON;

  private clientCache: Map<string, TonClient> = new Map();

  getNetworks(): NetworkConfig[] {
    return getTonNetworks();
  }

  getDefaultNetwork(): NetworkConfig {
    const networks = getTonNetworks();
    return networks.find((n: NetworkConfig) => n.id === 'ton-mainnet') || networks[0];
  }

  async deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount> {
    // Generate seed from mnemonic
    const seed = await mnemonicToSeed(mnemonic);

    // Derive private key using SLIP-10
    const path = getDerivationPath(ChainType.TON, index);
    const privateKey = await deriveEd25519Key(seed, path);

    // Generate keypair from seed
    const keypair = nacl.sign.keyPair.fromSeed(privateKey);

    // Create wallet contract to derive address
    // TON uses V4R2 wallet by default
    const workchain = 0;
    const wallet = WalletContractV4.create({
      workchain,
      publicKey: Buffer.from(keypair.publicKey)
    });

    const address = wallet.address.toString({ bounceable: false, testOnly: false });

    return {
      address,
      publicKey: bytesToHex(keypair.publicKey),
      privateKey,
      index,
      chainType: ChainType.TON
    };
  }

  async getBalance(address: string, networkId: string, tokenAddress?: string): Promise<string> {
    const client = this.getClient(networkId);

    if (!tokenAddress) {
      // Native TON balance
      const balance = await client.getBalance(Address.parse(address));
      return fromNano(balance);
    }

    // Jetton balance - requires calling jetton wallet contract
    try {
      const apiEndpoint = getTonApiEndpoint(networkId);
      const response = await fetch(
        `${apiEndpoint}/v2/accounts/${address}/jettons/${tokenAddress}`
      );

      if (!response.ok) {
        return '0';
      }

      const data = await response.json();
      const decimals = data.jetton?.decimals || 9;
      return (Number(data.balance) / Math.pow(10, decimals)).toString();
    } catch (error) {
      console.error('Failed to fetch jetton balance:', error);
      return '0';
    }
  }

  async signTransaction(
    privateKey: Uint8Array,
    params: TransactionParams,
    networkId: string
  ): Promise<SignedTransaction> {
    const client = this.getClient(networkId);

    // Generate keypair
    const keypair = nacl.sign.keyPair.fromSeed(privateKey);

    // Create wallet contract
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: Buffer.from(keypair.publicKey)
    });

    const contract = client.open(wallet);

    // Get seqno for transaction
    const seqno = await contract.getSeqno();

    // Prepare transfer
    const amount = toNano(params.value || '0');

    if (params.token) {
      // Jetton transfer
      const jettonAddress = getTonJettonAddress(params.token, networkId);
      if (!jettonAddress) {
        throw new Error(`Token ${params.token} not supported on ${networkId}`);
      }

      // For jetton transfers, we need to construct a message to the jetton wallet
      // This is more complex and requires knowing the jetton wallet address
      throw new Error('Jetton transfers not yet implemented');
    }

    // Create transfer (will be signed)
    const transfer = contract.createTransfer({
      seqno,
      secretKey: Buffer.from(keypair.secretKey),
      messages: [
        internal({
          to: params.to,
          value: amount,
          body: params.memo || ''
        })
      ]
    });

    return {
      chainType: ChainType.TON,
      raw: {
        transfer,
        wallet,
        seqno
      }
    };
  }

  async sendTransaction(networkId: string, signedTx: SignedTransaction): Promise<TransactionResult> {
    const client = this.getClient(networkId);
    const { transfer, wallet } = signedTx.raw;

    const contract = client.open(wallet);

    // Send transaction
    await contract.send(transfer);

    // TON doesn't return tx hash immediately, need to query
    // For now, return a placeholder
    const txHash = 'pending';

    return {
      hash: txHash,
      from: wallet.address.toString(),
      to: '',
      value: '0',
      explorerUrl: getTonExplorerUrl(networkId, 'address', wallet.address.toString())
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

    // Generate keypair
    const keypair = nacl.sign.keyPair.fromSeed(privateKey);

    // Create wallet contract
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: Buffer.from(keypair.publicKey)
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    const amount = toNano(params.value || '0');

    // Send transfer
    await contract.sendTransfer({
      seqno,
      secretKey: Buffer.from(keypair.secretKey),
      messages: [
        internal({
          to: params.to,
          value: amount,
          body: params.memo || ''
        })
      ]
    });

    return {
      hash: 'pending', // TON needs to query for tx hash
      from: wallet.address.toString(),
      to: params.to,
      value: params.value || '0',
      explorerUrl: getTonExplorerUrl(networkId, 'address', wallet.address.toString())
    };
  }

  async signMessage(privateKey: Uint8Array, message: string): Promise<SignedMessage> {
    const keypair = nacl.sign.keyPair.fromSeed(privateKey);

    // Convert message to bytes
    let messageBytes: Uint8Array;
    if (message.startsWith('0x')) {
      const hex = message.slice(2);
      messageBytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
      messageBytes = new TextEncoder().encode(message);
    }

    // Sign with Ed25519
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    // Create wallet to get address
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: Buffer.from(keypair.publicKey)
    });

    return {
      message,
      signature: base64UrlEncode(signature),
      publicKey: wallet.address.toString()
    };
  }

  validateAddress(address: string): boolean {
    return isValidTonAddress(address);
  }

  async estimateFee(_params: TransactionParams, _networkId: string): Promise<FeeEstimate> {
    // TON fees are typically very low (~0.01 TON for simple transfers)
    const baseFee = 0.01;

    return {
      estimatedFee: baseFee.toFixed(9),
      currency: 'TON',
      details: {}
    };
  }

  getTokens(networkId: string): TokenConfig[] {
    return getTonNetworkTokens(networkId);
  }

  async getTokenBalance(address: string, tokenAddress: string, networkId: string): Promise<string> {
    return this.getBalance(address, networkId, tokenAddress);
  }

  /**
   * Get or create client for a network
   */
  private getClient(networkId: string): TonClient {
    let client = this.clientCache.get(networkId);
    if (!client) {
      const network = getTonNetwork(networkId);
      if (!network) {
        throw new Error(`Unknown TON network: ${networkId}`);
      }
      client = new TonClient({
        endpoint: network.rpcUrl
      });
      this.clientCache.set(networkId, client);
    }
    return client;
  }
}

// Export singleton instance
export const tonAdapter = new TONAdapter();
