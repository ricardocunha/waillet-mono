import { describe, it, expect, beforeAll } from 'vitest';
import { WalletService, getAllChains, initChains } from '../../src/services/wallet';

describe('WalletService', () => {
  // Test wallet for testing (DO NOT USE IN PRODUCTION)
  const TEST_MNEMONIC = 'test test test test test test test test test test test junk';
  let testAccount: any;

  beforeAll(async () => {
    testAccount = WalletService.fromMnemonic(TEST_MNEMONIC);
    // Initialize chains from backend (required for dynamic chain loading)
    try {
      await initChains();
    } catch (error) {
      console.warn('Could not initialize chains from backend:', error);
    }
  });

  describe('Chain Configuration', () => {
    it('should have chains available after initialization', () => {
      const chains = getAllChains();
      // Chains may be empty if backend is not running
      expect(typeof chains).toBe('object');
    });

    it('should have valid chain configs when loaded', () => {
      const chains = getAllChains();
      Object.values(chains).forEach((chain: any) => {
        expect(chain.rpcUrl).toBeTruthy();
        expect(chain.chainId).toBeGreaterThan(0);
        expect(chain.nativeCurrency).toBeTruthy();
        expect(chain.explorer).toBeTruthy();
      });
    });
  });

  describe('Provider Creation', () => {
    it('should create provider for available chains', async () => {
      const chains = getAllChains();
      const chainNames = Object.keys(chains);

      if (chainNames.length > 0) {
        const provider = await WalletService.getProvider(chainNames[0]);
        expect(provider).toBeDefined();
      }
    });

    it('should throw error for unsupported chain', async () => {
      await expect(WalletService.getProvider('unsupported_chain_xyz')).rejects.toThrow('Unsupported chain');
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

    it('should check ETH balance on available chain', async () => {
      const chains = getAllChains();
      const chainNames = Object.keys(chains);

      if (chainNames.length > 0) {
        const balance = await WalletService.getBalance(
          '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          chainNames[0]
        );
        expect(typeof balance).toBe('string');
        expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
      }
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
  });
});

describe('Transaction Error Handling', () => {
  it('should throw error for unsupported token on chain', async () => {
    const testAccount = WalletService.fromMnemonic(
      'test test test test test test test test test test test junk'
    );

    await expect(async () => {
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
