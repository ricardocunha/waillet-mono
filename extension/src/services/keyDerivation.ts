/**
 * Key derivation service for multi-chain wallet
 * Implements SLIP-10 for Ed25519 key derivation (Solana, SUI, TON)
 * Uses BIP-32/BIP-44 for secp256k1 chains (EVM)
 */

import { ChainType, getDerivationPath as getChainDerivationPath } from '../types/chainTypes';

// SLIP-10 Ed25519 master key constant
const ED25519_SEED = 'ed25519 seed';

/**
 * HMAC-SHA512 implementation using Web Crypto API
 */
async function hmacSha512(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  // Create new ArrayBuffers to avoid SharedArrayBuffer issues
  const keyBuffer = new ArrayBuffer(key.length);
  new Uint8Array(keyBuffer).set(key);

  const dataBuffer = new ArrayBuffer(data.length);
  new Uint8Array(dataBuffer).set(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  return new Uint8Array(signature);
}

/**
 * Convert string to Uint8Array
 */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Parse a BIP-44 derivation path into components
 */
function parsePath(path: string): number[] {
  const components = path
    .replace(/^m\//, '')
    .split('/')
    .map(component => {
      const hardened = component.endsWith("'");
      const index = parseInt(component.replace("'", ''), 10);
      return hardened ? index + 0x80000000 : index;
    });
  return components;
}

/**
 * Derive master key from seed using SLIP-10 for Ed25519
 */
async function deriveMasterKey(seed: Uint8Array): Promise<{ key: Uint8Array; chainCode: Uint8Array }> {
  const I = await hmacSha512(stringToBytes(ED25519_SEED), seed);
  return {
    key: I.slice(0, 32),
    chainCode: I.slice(32)
  };
}

/**
 * Derive child key using SLIP-10 (hardened derivation only for Ed25519)
 */
async function deriveChildKey(
  parentKey: Uint8Array,
  parentChainCode: Uint8Array,
  index: number
): Promise<{ key: Uint8Array; chainCode: Uint8Array }> {
  // SLIP-10 Ed25519 only supports hardened derivation
  if (index < 0x80000000) {
    throw new Error('Ed25519 only supports hardened derivation');
  }

  // Data = 0x00 || parent_key || index
  const data = new Uint8Array(37);
  data[0] = 0;
  data.set(parentKey, 1);
  data[33] = (index >>> 24) & 0xff;
  data[34] = (index >>> 16) & 0xff;
  data[35] = (index >>> 8) & 0xff;
  data[36] = index & 0xff;

  const I = await hmacSha512(parentChainCode, data);
  return {
    key: I.slice(0, 32),
    chainCode: I.slice(32)
  };
}

/**
 * Derive Ed25519 private key from mnemonic using SLIP-10
 * @param seed - BIP-39 seed (64 bytes)
 * @param path - Derivation path (e.g., "m/44'/501'/0'/0'")
 * @returns Private key (32 bytes)
 */
export async function deriveEd25519Key(seed: Uint8Array, path: string): Promise<Uint8Array> {
  const indices = parsePath(path);

  let { key, chainCode } = await deriveMasterKey(seed);

  for (const index of indices) {
    const derived = await deriveChildKey(key, chainCode, index);
    key = derived.key;
    chainCode = derived.chainCode;
  }

  return key;
}

/**
 * Convert mnemonic to seed using PBKDF2
 * BIP-39 standard: PBKDF2(password=mnemonic, salt="mnemonic"+passphrase, iterations=2048, dkLen=64, prf=HMAC-SHA512)
 */
export async function mnemonicToSeed(mnemonic: string, passphrase: string = ''): Promise<Uint8Array> {
  const mnemonicBytes = stringToBytes(mnemonic.normalize('NFKD'));
  const saltBytes = stringToBytes(('mnemonic' + passphrase).normalize('NFKD'));

  // Create new ArrayBuffers to avoid SharedArrayBuffer issues
  const mnemonicBuffer = new ArrayBuffer(mnemonicBytes.length);
  new Uint8Array(mnemonicBuffer).set(mnemonicBytes);

  const saltBuffer = new ArrayBuffer(saltBytes.length);
  new Uint8Array(saltBuffer).set(saltBytes);

  const key = await crypto.subtle.importKey(
    'raw',
    mnemonicBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 2048,
      hash: 'SHA-512'
    },
    key,
    512 // 64 bytes
  );

  return new Uint8Array(derivedBits);
}

/**
 * Get the derivation path for a chain type and account index
 */
export function getDerivationPath(chainType: ChainType, index: number): string {
  return getChainDerivationPath(chainType, index);
}

/**
 * Base58 encoding (for Solana addresses)
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  // Count leading zeros
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) {
    zeros++;
  }

  // Convert to big integer
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }

  // Convert to base58
  let result = '';
  while (num > 0) {
    const remainder = Number(num % BigInt(58));
    num = num / BigInt(58);
    result = BASE58_ALPHABET[remainder] + result;
  }

  // Add leading '1's for each leading zero byte
  return '1'.repeat(zeros) + result;
}

export function base58Decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  // Count leading '1's
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') {
    zeros++;
  }

  // Convert from base58 to big integer
  let num = BigInt(0);
  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base58 character');
    num = num * BigInt(58) + BigInt(index);
  }

  // Convert to bytes
  const bytes: number[] = [];
  while (num > 0) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }

  // Add leading zeros
  const result = new Uint8Array(zeros + bytes.length);
  result.set(bytes, zeros);
  return result;
}

/**
 * Base64url encoding (for TON addresses)
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Validate a Solana address (Base58 encoded, 32 bytes)
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    const decoded = base58Decode(address);
    return decoded.length === 32;
  } catch {
    return false;
  }
}

/**
 * Validate a SUI address (0x prefixed hex, 32 bytes)
 */
export function isValidSuiAddress(address: string): boolean {
  if (!address.startsWith('0x')) return false;
  const hex = address.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(hex)) return false;
  return hex.length === 64; // 32 bytes = 64 hex chars
}

/**
 * Validate a TON address
 * TON uses raw (hex) or user-friendly (Base64url) formats
 */
export function isValidTonAddress(address: string): boolean {
  // User-friendly format: Base64url encoded, typically 48 chars
  // Raw format: 0: followed by 64 hex chars
  try {
    if (address.includes(':')) {
      // Raw format: workchain:address
      const [workchain, hex] = address.split(':');
      const wc = parseInt(workchain, 10);
      if (isNaN(wc) || wc < -128 || wc > 127) return false;
      if (!/^[0-9a-fA-F]{64}$/.test(hex)) return false;
      return true;
    } else {
      // User-friendly format (Base64url)
      const decoded = base64UrlDecode(address);
      return decoded.length === 36; // 1 byte tag + 1 byte workchain + 32 bytes hash + 2 bytes checksum
    }
  } catch {
    return false;
  }
}

/**
 * Validate an EVM address (0x prefixed hex, 20 bytes)
 */
export function isValidEvmAddress(address: string): boolean {
  if (!address.startsWith('0x')) return false;
  const hex = address.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(hex)) return false;
  return hex.length === 40; // 20 bytes = 40 hex chars
}
