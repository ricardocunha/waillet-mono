import { Contract, Wallet, keccak256, toUtf8Bytes, formatUnits } from 'ethers';
import { WalletService } from './wallet';
import {
  ADDRESS_REGISTRY,
  IDENTIFIER_PATTERNS,
  IdentifierType,
  REGISTRY_STORAGE_KEY,
} from '../constants/registry';

export interface RegistrationResult {
  hash: string;
  identifier: string;
  identifierHash: string;
  explorerUrl: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  gasCost: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
  type?: IdentifierType;
}

export class RegistryService {
  /**
   * Normalize and hash an identifier
   * @param identifier Email or alias string
   * @returns bytes32 hash suitable for contract
   */
  static hashIdentifier(identifier: string): string {
    // Normalize: lowercase and trim
    const normalized = identifier.toLowerCase().trim();
    return keccak256(toUtf8Bytes(normalized));
  }

  /**
   * Detect identifier type from string
   */
  static getIdentifierType(identifier: string): IdentifierType | null {
    const normalized = identifier.toLowerCase().trim();

    if (IDENTIFIER_PATTERNS.EMAIL.test(normalized)) {
      return IdentifierType.EMAIL;
    }

    if (IDENTIFIER_PATTERNS.ALIAS.test(normalized)) {
      return IdentifierType.ALIAS;
    }

    // Check if it's a partial alias (without .waillet suffix)
    if (IDENTIFIER_PATTERNS.PARTIAL_ALIAS.test(normalized)) {
      return IdentifierType.ALIAS;
    }

    return null;
  }

  /**
   * Validate identifier format
   */
  static validateIdentifier(identifier: string): ValidationResult {
    const normalized = identifier.toLowerCase().trim();

    if (!normalized) {
      return { valid: false, error: 'Identifier cannot be empty' };
    }

    const type = this.getIdentifierType(normalized);

    if (type === IdentifierType.EMAIL) {
      return { valid: true, normalized, type };
    }

    if (type === IdentifierType.ALIAS) {
      // Auto-append .waillet if missing
      const finalAlias = normalized.endsWith('.waillet')
        ? normalized
        : `${normalized}.waillet`;
      return { valid: true, normalized: finalAlias, type };
    }

    return {
      valid: false,
      error: 'Invalid format. Use email (user@domain.com) or alias (myname.waillet)',
    };
  }

  /**
   * Get contract instance
   */
  private static async getContract(privateKey?: string): Promise<Contract> {
    const provider = await WalletService.getProvider(ADDRESS_REGISTRY.chain);

    if (privateKey) {
      const wallet = new Wallet(privateKey, provider);
      return new Contract(ADDRESS_REGISTRY.address, ADDRESS_REGISTRY.abi, wallet);
    }

    return new Contract(ADDRESS_REGISTRY.address, ADDRESS_REGISTRY.abi, provider);
  }

  /**
   * Register a new identifier
   */
  static async register(
    privateKey: string,
    identifier: string
  ): Promise<RegistrationResult> {
    const validation = this.validateIdentifier(identifier);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const identifierHash = this.hashIdentifier(validation.normalized!);
    const contract = await this.getContract(privateKey);

    // Check if already registered
    const existing = await contract.resolve(identifierHash);
    if (existing !== '0x0000000000000000000000000000000000000000') {
      throw new Error('This identifier is already registered');
    }

    const tx = await contract.register(identifierHash);
    await tx.wait();

    return {
      hash: tx.hash,
      identifier: validation.normalized!,
      identifierHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${tx.hash}`,
    };
  }

  /**
   * Remove a registration
   */
  static async removeRegistration(
    privateKey: string,
    identifier: string
  ): Promise<string> {
    const validation = this.validateIdentifier(identifier);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const identifierHash = this.hashIdentifier(validation.normalized!);
    const contract = await this.getContract(privateKey);

    const tx = await contract.removeRegistration(identifierHash);
    await tx.wait();

    return tx.hash;
  }

  /**
   * Resolve an identifier to address
   */
  static async resolve(identifier: string): Promise<string | null> {
    const validation = this.validateIdentifier(identifier);
    if (!validation.valid) {
      return null;
    }

    const identifierHash = this.hashIdentifier(validation.normalized!);
    const contract = await this.getContract();

    const address = await contract.resolve(identifierHash);

    if (address === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    return address;
  }

  /**
   * Estimate gas for registration
   */
  static async estimateRegistrationGas(
    privateKey: string,
    identifier: string
  ): Promise<GasEstimate> {
    const provider = await WalletService.getProvider(ADDRESS_REGISTRY.chain);
    const wallet = new Wallet(privateKey, provider);
    const contract = new Contract(ADDRESS_REGISTRY.address, ADDRESS_REGISTRY.abi, wallet);

    const validation = this.validateIdentifier(identifier);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const identifierHash = this.hashIdentifier(validation.normalized!);

    // Check if already registered first
    const existing = await contract.resolve(identifierHash);
    if (existing !== '0x0000000000000000000000000000000000000000') {
      throw new Error('This identifier is already registered');
    }

    const gasLimit = await contract.register.estimateGas(identifierHash);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    const gasCost = gasLimit * gasPrice;

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: formatUnits(gasPrice, 'gwei'),
      gasCost: formatUnits(gasCost, 18),
    };
  }

  /**
   * Save registered shortcut to chrome.storage (for UI display)
   * Since we can't reverse hashes, we store the original identifier locally
   */
  static async saveShortcutLocally(
    walletAddress: string,
    identifier: string
  ): Promise<void> {
    const result = await chrome.storage.local.get(REGISTRY_STORAGE_KEY);
    const shortcuts = result[REGISTRY_STORAGE_KEY] || {};
    const userShortcuts = shortcuts[walletAddress] || [];

    if (!userShortcuts.includes(identifier)) {
      userShortcuts.push(identifier);
      shortcuts[walletAddress] = userShortcuts;
      await chrome.storage.local.set({ [REGISTRY_STORAGE_KEY]: shortcuts });
    }
  }

  /**
   * Remove shortcut from chrome.storage
   */
  static async removeShortcutLocally(
    walletAddress: string,
    identifier: string
  ): Promise<void> {
    const result = await chrome.storage.local.get(REGISTRY_STORAGE_KEY);
    const shortcuts = result[REGISTRY_STORAGE_KEY] || {};
    const userShortcuts = shortcuts[walletAddress] || [];

    shortcuts[walletAddress] = userShortcuts.filter((s: string) => s !== identifier);
    await chrome.storage.local.set({ [REGISTRY_STORAGE_KEY]: shortcuts });
  }

  /**
   * Get locally stored shortcuts for an address
   */
  static async getLocalShortcuts(walletAddress: string): Promise<string[]> {
    const result = await chrome.storage.local.get(REGISTRY_STORAGE_KEY);
    const shortcuts = result[REGISTRY_STORAGE_KEY] || {};
    return shortcuts[walletAddress] || [];
  }
}
