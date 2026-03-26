# E2E Tests for wAIllet Extension

## Overview

End-to-end tests using Playwright for the wAIllet Chrome extension.

## Test Coverage

| Suite | File | Automated | Notes |
|-------|------|-----------|-------|
| Onboarding | `onboarding.spec.ts` | ✅ | Create & import wallet |
| Dashboard | `dashboard.spec.ts` | ✅ | UI + network switching |
| Accounts | `accounts.spec.ts` | ✅ | Account management |
| Balances | `balances.spec.ts` | ✅ | Token balance display |
| Unlock | `unlock.spec.ts` | ✅ | Lock/unlock flow |
| Uniswap | `uniswap.spec.ts` | ⚠️ | Real mainnet funds — run manually |

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

### Environment Setup

Create a `.env.test` file in `extension/e2e/` for test-specific config:

```env
# Backend URL for tests that require API calls
TEST_BACKEND_URL=http://localhost:8000

# Test wallet credentials (use the default test mnemonic for safe tests)
TEST_WALLET_MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
TEST_WALLET_PASSWORD=TestPassword123
```

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
- name: Install Playwright browsers
  run: npx playwright install chromium --with-deps

- name: Run E2E tests
  run: xvfb-run npm run test:e2e

- name: Upload test report
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Adding Test Data

To seed a test wallet with specific state before a test, use the `helpers.ts` utilities:

```typescript
import { importWallet, sendTestETH } from './fixtures/helpers';

test.beforeEach(async ({ extensionPage }) => {
  await importWallet(extensionPage);
  // Wallet now has the default test mnemonic loaded
});
```

For balance-dependent tests, fund the test address via the faucet before the test run (the test wallet address is always `0x9858EfFD232B4033E47d90003D41EC34EcaEda94`).

## RPC: Mock vs Real

Extension tests use a **real RPC endpoint** via the backend proxy by default. This requires the backend to be running.

To run tests without the backend, you can mock the RPC at the extension level by setting a local Hardhat/Anvil node:

```bash
# Start a local Ethereum node
npx hardhat node

# Point backend to it
ALCHEMY_API_KEY="" ETH_RPC_URL=http://localhost:8545 go run cmd/server/main.go
```

This gives deterministic blockchain state and fast tests without network calls.

## Running Specific Tests

Filter tests by tag or name to speed up focused testing:

```bash
# Run only onboarding tests
npx playwright test onboarding

# Run tests matching a name pattern
npx playwright test -g "should unlock wallet"

# Tag tests with @smoke and run only smoke tests
npx playwright test --grep @smoke
```

Add `@smoke` to critical test titles to create a fast smoke suite.

## Retry on Failure

To automatically retry flaky tests, add to `playwright.config.ts`:

```ts
retries: process.env.CI ? 2 : 0,
```

This retries failed tests up to 2 times in CI, keeping the local dev cycle fast with no retries.

## Parallel Execution

By default tests run sequentially (Chrome extension tests cannot share a browser context). To parallelise across multiple workers, each worker needs its own extension instance — this is not yet configured.

For now, run with a single worker:

```bash
npx playwright test --workers=1
```

## Screenshots on Failure

Playwright saves screenshots automatically when a test fails. Find them in:

```
extension/e2e/test-results/<test-name>/screenshot.png
```

To always capture screenshots (pass or fail), add to `playwright.config.ts`:

```ts
use: {
  screenshot: 'on',
},
```

## Known Limitations

- Extension popups require programmatic interaction — no real user-click simulation
- Uniswap tests are flaky on slow networks; increase `timeout` in `playwright.config.ts` if needed
- Tests must be run from the `extension/` directory (not the repo root)
