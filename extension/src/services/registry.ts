import { keccak256, toUtf8Bytes } from 'ethers';
import {
  IDENTIFIER_PATTERNS,
  IdentifierType,
  REGISTRY_STORAGE_KEY,
} from '../constants/registry';

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
