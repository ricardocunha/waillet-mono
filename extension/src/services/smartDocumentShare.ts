import { Contract, Wallet, keccak256, toUtf8Bytes, formatUnits } from 'ethers';
import { WalletService } from './wallet';
import { SMART_DOCUMENT_SHARE } from '../constants/smartDocumentShare';

export interface ShareResult {
  txHash: string;
  tokenId: number;
  explorerUrl: string;
}

export interface RevokeResult {
  txHash: string;
  explorerUrl: string;
}

export interface ShareInfo {
  docHash: string;
  recipient: string;
  expiresAt: number;
  revoked: boolean;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  gasCost: string;
}

export class SmartDocumentShareService {
  /**
   * Hash a document identifier for on-chain use
   */
  static hashDocument(identifier: string): string {
    return keccak256(toUtf8Bytes(identifier));
  }

  /**
   * Get contract instance
   */
  private static async getContract(privateKey?: string): Promise<Contract> {
    const provider = await WalletService.getProvider(SMART_DOCUMENT_SHARE.chain);

    if (privateKey) {
      const wallet = new Wallet(privateKey, provider);
      return new Contract(SMART_DOCUMENT_SHARE.address, SMART_DOCUMENT_SHARE.abi, wallet);
    }

    return new Contract(SMART_DOCUMENT_SHARE.address, SMART_DOCUMENT_SHARE.abi, provider);
  }

  /**
   * Register a document on-chain (establishes ownership)
   */
  static async registerDocument(privateKey: string, identifier: string): Promise<string> {
    const docHash = this.hashDocument(identifier);
    const contract = await this.getContract(privateKey);

    // Check if already registered
    const owner = await contract.documentOwner(docHash);
    if (owner !== '0x0000000000000000000000000000000000000000') {
      // Already registered, skip
      return docHash;
    }

    const tx = await contract.registerDocument(docHash);
    await tx.wait();

    return docHash;
  }

  /**
   * Share a document by minting a soulbound NFT
   */
  static async shareDocument(
    privateKey: string,
    identifier: string,
    recipient: string,
    expiresAt: number
  ): Promise<ShareResult> {
    const docHash = this.hashDocument(identifier);
    const contract = await this.getContract(privateKey);

    const tx = await contract.shareDocument(docHash, recipient, expiresAt);
    const receipt = await tx.wait();

    // Parse the DocumentShared event to get tokenId
    let tokenId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed?.name === 'DocumentShared') {
          tokenId = Number(parsed.args[0]); // tokenId is first indexed arg
          break;
        }
      } catch {
        // Not our event, skip
      }
    }

    return {
      txHash: tx.hash,
      tokenId,
      explorerUrl: `https://sepolia.basescan.org/tx/${tx.hash}`,
    };
  }

  /**
   * Revoke a share by burning the NFT
   */
  static async revokeShare(privateKey: string, tokenId: number): Promise<RevokeResult> {
    const contract = await this.getContract(privateKey);

    const tx = await contract.revokeShare(tokenId);
    await tx.wait();

    return {
      txHash: tx.hash,
      explorerUrl: `https://sepolia.basescan.org/tx/${tx.hash}`,
    };
  }

  /**
   * Check if a share token is still valid
   */
  static async isValid(tokenId: number): Promise<boolean> {
    const contract = await this.getContract();
    return contract.isValid(tokenId);
  }

  /**
   * Get share info for a token
   */
  static async getShareInfo(tokenId: number): Promise<ShareInfo> {
    const contract = await this.getContract();
    const info = await contract.getShareInfo(tokenId);
    return {
      docHash: info.docHash,
      recipient: info.recipient,
      expiresAt: Number(info.expiresAt),
      revoked: info.revoked,
    };
  }

  /**
   * Get all share token IDs for a document
   */
  static async getDocumentShares(identifier: string): Promise<number[]> {
    const docHash = this.hashDocument(identifier);
    const contract = await this.getContract();
    const tokenIds = await contract.getDocumentShares(docHash);
    return tokenIds.map((id: bigint) => Number(id));
  }

  /**
   * Get all share token IDs received by an address
   */
  static async getReceivedShares(address: string): Promise<number[]> {
    const contract = await this.getContract();
    const tokenIds = await contract.getReceivedShares(address);
    return tokenIds.map((id: bigint) => Number(id));
  }

  /**
   * Estimate gas for sharing a document
   */
  static async estimateShareGas(
    privateKey: string,
    identifier: string,
    recipient: string,
    expiresAt: number
  ): Promise<GasEstimate> {
    const provider = await WalletService.getProvider(SMART_DOCUMENT_SHARE.chain);
    const wallet = new Wallet(privateKey, provider);
    const contract = new Contract(SMART_DOCUMENT_SHARE.address, SMART_DOCUMENT_SHARE.abi, wallet);

    const docHash = this.hashDocument(identifier);

    // Check if doc needs registration (add that gas too)
    const owner = await contract.documentOwner(docHash);
    let totalGas = BigInt(0);

    if (owner === '0x0000000000000000000000000000000000000000') {
      const registerGas = await contract.registerDocument.estimateGas(docHash);
      totalGas += registerGas;
    }

    const shareGas = await contract.shareDocument.estimateGas(docHash, recipient, expiresAt);
    totalGas += shareGas;

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    const gasCost = totalGas * gasPrice;

    return {
      gasLimit: totalGas.toString(),
      gasPrice: formatUnits(gasPrice, 'gwei'),
      gasCost: formatUnits(gasCost, 18),
    };
  }
}
