import { describe, it, expect, beforeAll } from 'vitest';
import { WalletService, CHAINS, TOKENS } from '../../src/services/wallet';

describe('WalletService - Phase 2B', () => {
  // Test wallet for testing (DO NOT USE IN PRODUCTION)
  const TEST_MNEMONIC = 'test test test test test test test test test test test junk';
  let testAccount: any;

  beforeAll(() => {
    testAccount = WalletService.fromMnemonic(TEST_MNEMONIC);
  });

  describe('Chain Configuration', () => {
    it('should have all supported chains configured', () => {
      expect(CHAINS.ethereum).toBeDefined();
      expect(CHAINS.polygon).toBeDefined();
      expect(CHAINS.bsc).toBeDefined();
      expect(CHAINS.base).toBeDefined();
    });

    it('should have valid RPC URLs for all chains', () => {
      Object.values(CHAINS).forEach((chain) => {
        expect(chain.rpcUrl).toMatch(/^https?:\/\/.+/);
        expect(chain.chainId).toBeGreaterThan(0);
        expect(chain.nativeCurrency).toBeTruthy();
        expect(chain.explorer).toMatch(/^https?:\/\/.+/);
      });
    });
  });

  describe('Token Configuration', () => {
    it('should have USDC configured for all chains', () => {
      expect(TOKENS.USDC.ethereum).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(TOKENS.USDC.polygon).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(TOKENS.USDC.bsc).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(TOKENS.USDC.base).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should have USDT configured for major chains', () => {
      expect(TOKENS.USDT.ethereum).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(TOKENS.USDT.polygon).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(TOKENS.USDT.bsc).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('Provider Creation', () => {
    it('should create provider for Ethereum', () => {
      const provider = WalletService.getProvider('ethereum');
      expect(provider).toBeDefined();
    });

    it('should create provider for Polygon', () => {
      const provider = WalletService.getProvider('polygon');
      expect(provider).toBeDefined();
    });

    it('should throw error for unsupported chain', () => {
      expect(() => WalletService.getProvider('unsupported')).toThrow('Unsupported chain');
    });

    it('should be case-insensitive for chain names', () => {
      expect(() => WalletService.getProvider('ETHEREUM')).not.toThrow();
      expect(() => WalletService.getProvider('Polygon')).not.toThrow();
    });
  });

  describe('Wallet Account', () => {
    it('should generate valid account from mnemonic', () => {
      expect(testAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(testAccount.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(testAccount.index).toBe(0);
    });

    it('should generate consistent address for same mnemonic', () => {
      const account1 = WalletService.fromMnemonic(TEST_MNEMONIC);
      const account2 = WalletService.fromMnemonic(TEST_MNEMONIC);
      expect(account1.address).toBe(account2.address);
    });

    it('should generate different addresses for different indices', () => {
      const account0 = WalletService.fromMnemonic(TEST_MNEMONIC, 0);
      const account1 = WalletService.fromMnemonic(TEST_MNEMONIC, 1);
      expect(account0.address).not.toBe(account1.address);
    });
  });

  describe.skip('Balance Checking (requires network)', () => {
    // These tests require actual network connection
    // Skip by default, run manually when needed
    
    it('should check ETH balance on Ethereum', async () => {
      const balance = await WalletService.getBalance(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        'ethereum'
      );
      expect(typeof balance).toBe('string');
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
    }, 30000);

    it('should check USDC balance on Polygon', async () => {
      const balance = await WalletService.getBalance(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        'polygon',
        'USDC'
      );
      expect(typeof balance).toBe('string');
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe.skip('Gas Estimation (requires network)', () => {
    // These tests require actual network connection and a funded wallet
    // Skip by default
    
    it('should estimate gas for ETH transfer', async () => {
      const estimate = await WalletService.estimateGas(
        testAccount.privateKey,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0.001',
        'ethereum'
      );
      
      expect(estimate.gasLimit).toBeTruthy();
      expect(estimate.gasPrice).toBeTruthy();
      expect(estimate.gasCost).toBeTruthy();
      expect(parseFloat(estimate.gasCost)).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Transaction Request Validation', () => {
    it('should validate Ethereum addresses', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      expect(validAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should reject invalid addresses', () => {
      const invalidAddresses = [
        '0x123',
        'not-an-address',
        '742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0xZZZ',
      ];
      
      invalidAddresses.forEach(addr => {
        expect(addr).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    it('should validate token symbols', () => {
      expect(TOKENS['USDC']).toBeDefined();
      expect(TOKENS['USDT']).toBeDefined();
      expect(TOKENS['INVALID_TOKEN']).toBeUndefined();
    });
  });
});

describe('Transaction Error Handling', () => {
  it('should throw error for unsupported token on chain', () => {
    const testAccount = WalletService.fromMnemonic(
      'test test test test test test test test test test test junk'
    );

    expect(async () => {
      await WalletService.sendToken(
        testAccount.privateKey,
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '10',
        'INVALID_TOKEN',
        'ethereum'
      );
    }).rejects.toThrow();
  });
});


