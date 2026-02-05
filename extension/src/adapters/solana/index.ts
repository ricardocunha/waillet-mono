/**
 * Solana Chain Adapter
 * Handles Solana blockchain operations using @solana/web3.js
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getAccount
} from '@solana/spl-token';
import { ChainType, DerivedAccount, NetworkConfig, TokenConfig } from '../../types/chainTypes';
import {
  BaseChainAdapter,
  TransactionParams,
  TransactionResult,
  SignedTransaction,
  SignedMessage,
  FeeEstimate
} from '../types';
import { getSolanaNetworks, getSolanaNetwork, getSolanaExplorerUrl } from './networks';
import { getSolanaNetworkTokens, getSolanaTokenAddress } from './tokens';
import {
  deriveEd25519Key,
  mnemonicToSeed,
  getDerivationPath,
  base58Encode,
  isValidSolanaAddress,
  bytesToHex
} from '../../services/keyDerivation';
import nacl from 'tweetnacl';

/**
 * Solana Chain Adapter implementation
 */
export class SolanaAdapter extends BaseChainAdapter {
  readonly chainType = ChainType.SOLANA;

  private connectionCache: Map<string, Connection> = new Map();

  getNetworks(): NetworkConfig[] {
    return getSolanaNetworks();
  }

  getDefaultNetwork(): NetworkConfig {
    const networks = getSolanaNetworks();
    return networks.find((n: NetworkConfig) => n.id === 'solana-mainnet') || networks[0];
  }

  async deriveAccount(mnemonic: string, index: number): Promise<DerivedAccount> {
    // Generate seed from mnemonic
    const seed = await mnemonicToSeed(mnemonic);

    // Derive private key using SLIP-10
    const path = getDerivationPath(ChainType.SOLANA, index);
    const privateKey = await deriveEd25519Key(seed, path);

    // Generate keypair from seed (Ed25519)
    const keypair = nacl.sign.keyPair.fromSeed(privateKey);

    // Solana address is the base58-encoded public key
    const address = base58Encode(keypair.publicKey);

    return {
      address,
      publicKey: bytesToHex(keypair.publicKey),
      privateKey: privateKey,
      index,
      chainType: ChainType.SOLANA
    };
  }

  async getBalance(address: string, networkId: string, tokenAddress?: string): Promise<string> {
    const connection = this.getConnection(networkId);

    if (!tokenAddress) {
      // Native SOL balance
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      return (balance / LAMPORTS_PER_SOL).toFixed(9);
    }

    // SPL token balance
    try {
      const ownerPublicKey = new PublicKey(address);
      const mintPublicKey = new PublicKey(tokenAddress);

      const tokenAccountAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        ownerPublicKey
      );

      const tokenAccount = await getAccount(connection, tokenAccountAddress);
      // Get token decimals from mint
      const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);
      const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;

      return (Number(tokenAccount.amount) / Math.pow(10, decimals)).toString();
    } catch (error: any) {
      // Token account doesn't exist - balance is 0
      if (error.message?.includes('could not find account')) {
        return '0';
      }
      throw error;
    }
  }

  async signTransaction(
    privateKey: Uint8Array,
    params: TransactionParams,
    networkId: string
  ): Promise<SignedTransaction> {
    const connection = this.getConnection(networkId);

    // Create keypair from private key
    const keypair = Keypair.fromSeed(privateKey);

    const transaction = new Transaction();

    if (params.token) {
      // SPL token transfer
      const tokenMint = getSolanaTokenAddress(params.token, networkId);
      if (!tokenMint) {
        throw new Error(`Token ${params.token} not supported on ${networkId}`);
      }

      const mintPublicKey = new PublicKey(tokenMint);
      const fromPublicKey = keypair.publicKey;
      const toPublicKey = new PublicKey(params.to);

      const fromAta = await getAssociatedTokenAddress(mintPublicKey, fromPublicKey);
      const toAta = await getAssociatedTokenAddress(mintPublicKey, toPublicKey);

      // Get token decimals
      const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);
      const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;

      const amount = Math.floor(parseFloat(params.value || '0') * Math.pow(10, decimals));

      transaction.add(
        createTransferInstruction(
          fromAta,
          toAta,
          fromPublicKey,
          BigInt(amount),
          [],
          TOKEN_PROGRAM_ID
        )
      );
    } else {
      // Native SOL transfer
      const lamports = Math.floor(parseFloat(params.value || '0') * LAMPORTS_PER_SOL);

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(params.to),
          lamports
        })
      );
    }

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;

    // Sign transaction
    transaction.sign(keypair);

    return {
      chainType: ChainType.SOLANA,
      raw: transaction,
      signature: transaction.signature ? base58Encode(transaction.signature) : undefined
    };
  }

  async sendTransaction(networkId: string, signedTx: SignedTransaction): Promise<TransactionResult> {
    const connection = this.getConnection(networkId);
    const transaction = signedTx.raw as Transaction;

    // Send and confirm transaction
    const signature = await connection.sendRawTransaction(transaction.serialize());

    // Wait for confirmation
    await connection.confirmTransaction(signature);

    const feePayer = transaction.feePayer?.toBase58() || '';

    return {
      hash: signature,
      from: feePayer,
      to: '', // Extracted from instructions
      value: '0',
      explorerUrl: getSolanaExplorerUrl(networkId, 'tx', signature)
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
    const connection = this.getConnection(networkId);
    const keypair = Keypair.fromSeed(privateKey);

    const transaction = new Transaction();

    if (params.token) {
      const tokenMint = getSolanaTokenAddress(params.token, networkId);
      if (!tokenMint) {
        throw new Error(`Token ${params.token} not supported on ${networkId}`);
      }

      const mintPublicKey = new PublicKey(tokenMint);
      const fromAta = await getAssociatedTokenAddress(mintPublicKey, keypair.publicKey);
      const toAta = await getAssociatedTokenAddress(mintPublicKey, new PublicKey(params.to));

      const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);
      const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;
      const amount = Math.floor(parseFloat(params.value || '0') * Math.pow(10, decimals));

      transaction.add(
        createTransferInstruction(
          fromAta,
          toAta,
          keypair.publicKey,
          BigInt(amount),
          [],
          TOKEN_PROGRAM_ID
        )
      );
    } else {
      const lamports = Math.floor(parseFloat(params.value || '0') * LAMPORTS_PER_SOL);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(params.to),
          lamports
        })
      );
    }

    const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);

    return {
      hash: signature,
      from: keypair.publicKey.toBase58(),
      to: params.to,
      value: params.value || '0',
      explorerUrl: getSolanaExplorerUrl(networkId, 'tx', signature)
    };
  }

  async signMessage(privateKey: Uint8Array, message: string): Promise<SignedMessage> {
    const keypair = Keypair.fromSeed(privateKey);

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

    return {
      message,
      signature: base58Encode(signature),
      publicKey: keypair.publicKey.toBase58()
    };
  }

  validateAddress(address: string): boolean {
    return isValidSolanaAddress(address);
  }

  async estimateFee(_params: TransactionParams, _networkId: string): Promise<FeeEstimate> {
    // Solana transaction fees are typically very low (0.000005 SOL base)
    const baseFee = 5000; // lamports
    const estimatedFee = baseFee / LAMPORTS_PER_SOL;

    return {
      estimatedFee: estimatedFee.toFixed(9),
      currency: 'SOL',
      details: {
        computeUnits: 200000 // Default compute unit budget
      }
    };
  }

  getTokens(networkId: string): TokenConfig[] {
    return getSolanaNetworkTokens(networkId);
  }

  async getTokenBalance(address: string, tokenAddress: string, networkId: string): Promise<string> {
    return this.getBalance(address, networkId, tokenAddress);
  }

  /**
   * Get or create connection for a network
   */
  private getConnection(networkId: string): Connection {
    let connection = this.connectionCache.get(networkId);
    if (!connection) {
      const network = getSolanaNetwork(networkId);
      if (!network) {
        throw new Error(`Unknown Solana network: ${networkId}`);
      }
      connection = new Connection(network.rpcUrl, 'confirmed');
      this.connectionCache.set(networkId, connection);
    }
    return connection;
  }
}

// Export singleton instance
export const solanaAdapter = new SolanaAdapter();
