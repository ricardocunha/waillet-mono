# E2E Tests for wAIllet Extension

## Overview

End-to-end tests using Playwright for the wAIllet Chrome extension.

## Test Suites

### Extension Tests (Safe)
Basic wallet functionality tests using mock data:
- `onboarding.spec.ts` - Wallet creation and import
- `dashboard.spec.ts` - Dashboard UI and network switching
- `accounts.spec.ts` - Account management
- `balances.spec.ts` - Token balance display
- `unlock.spec.ts` - Wallet unlock flow

### Uniswap Tests (Mainnet - Real Tokens!)
Integration tests with Uniswap on Ethereum Mainnet:
- `uniswap.spec.ts` - Wallet connection, USDT→USDC swaps, approvals

## Running Tests

### Prerequisites

1. **Build the extension first:**
   ```bash
   npm run build
   ```

2. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

### Extension Tests (Safe)

```bash
# Run all extension tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run with debugging
npm run test:e2e:debug
```

### Uniswap Tests (Mainnet)

> ⚠️ **WARNING**: These tests use REAL tokens on Ethereum Mainnet!

**Before running:**

1. **Fund the test wallet** with:
   - ETH for gas fees (minimum 0.01 ETH)
   - USDT for swap testing (minimum 0.1 USDT)
2. **Set environment variables:**

```bash
# Option 1: Use environment variables
export TEST_WALLET_MNEMONIC="your twelve word mnemonic phrase here"
export TEST_WALLET_PASSWORD="yourpassword"
export SWAP_AMOUNT="0.1"  # Amount to swap (default: 0.1 USDT)

# Option 2: Create a .env.test file
echo 'TEST_WALLET_MNEMONIC="your mnemonic"' > .env.test
echo 'TEST_WALLET_PASSWORD="password"' >> .env.test
echo 'SWAP_AMOUNT="0.1"' >> .env.test
```

**Run tests:**

```bash
# Run Uniswap tests
npm run test:e2e:uniswap

# Run with debugging (step through)
npm run test:e2e:uniswap:debug

# Run all tests (extension + uniswap)
npm run test:e2e:all
```

### Test-Specific Commands

```bash
# Run a specific test file
npx playwright test uniswap.spec.ts

# Run a specific test by name
npx playwright test -g "should connect wallet to Uniswap"

# Run with verbose output
npx playwright test --reporter=line

# Generate HTML report
npx playwright test --reporter=html
```

## Test Configuration

Configuration is in `playwright.config.ts`:

| Project | Timeout | Viewport | Description |
|---------|---------|----------|-------------|
| `extension` | 30s | 400x600 | Basic extension tests |
| `uniswap` | 120s | 1280x800 | Blockchain integration tests |

## Test Wallet

Default test mnemonic (DO NOT USE FOR REAL FUNDS):
```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

This generates address: `0x9858EfFD232B4033E47d90003D41EC34EcaEda94`

## Troubleshooting

### Extension not loading
- Make sure to run `npm run build` first
- Check that `dist/` folder exists
- Verify Chrome is installed

### Connection timeouts
- Increase timeout in `playwright.config.ts`
- Check network connectivity
- Verify RPC endpoints are responding

### Swap failures
- Ensure sufficient ETH for gas fees
- Check USDT balance for swap amount
- Verify Uniswap liquidity for the USDT/USDC pair
- Ensure USDT approval is granted to Uniswap router

### Popup not appearing
- Extension popup requires user interaction
- Tests use programmatic approval via extension page

## Writing New Tests

```typescript
import { test, expect } from './fixtures/extension';
import { TEST_PASSWORD, TEST_MNEMONIC, importWallet } from './fixtures/helpers';

test.describe('My Feature', () => {
  test.beforeEach(async ({ extensionPage }) => {
    await extensionPage.evaluate(() => localStorage.clear());
    await extensionPage.reload();
    await importWallet(extensionPage);
  });

  test('should do something', async ({ extensionPage, context }) => {
    // Your test here
  });
});
```

## CI/CD Notes

- Extension tests run in headed mode (required for Chrome extensions)
- Use `xvfb-run` on Linux CI environments
- Uniswap tests should be excluded from CI (they use real funds)

```yaml
# GitHub Actions example
- name: Run E2E tests
  run: xvfb-run npm run test:e2e
```
