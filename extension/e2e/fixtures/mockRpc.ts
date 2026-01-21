import { Page, BrowserContext } from '@playwright/test';

// Mock balance values per chain (in human-readable format)
// These will be converted to wei/smallest unit when responding
export const MOCK_BALANCES = {
  ethereum: {
    ETH: '1.000000',
    USDC: '2.000000',
    USDT: '3.000000',
  },
  bsc: {
    BNB: '4.000000',
    USDC: '5.000000',
    USDT: '6.000000',
  },
  sepolia: {
    ETH: '10.000000',
    USDC: '20.000000',
    USDT: '30.000000',
  },
  base: {
    ETH: '7.000000',
    USDC: '8.000000',
  },
  'base-sepolia': {
    ETH: '70.000000',
    USDC: '80.000000',
  },
};

// Token decimals
const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  BNB: 18,
  USDC: 6,
  USDT: 6,
};

// Convert human-readable balance to hex wei value
function toHexWei(balance: string, decimals: number): string {
  const [whole, fraction = ''] = balance.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const weiString = whole + paddedFraction;
  const wei = BigInt(weiString);
  return '0x' + wei.toString(16);
}

// Known token contract addresses (lowercase)
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  ethereum: {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
  },
  bsc: {
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDC',
    '0x55d398326f99059ff775485246999027b3197955': 'USDT',
  },
  sepolia: {
    '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': 'USDC',
    '0x7169d38820dfd117c3fa1f22a697dba58d90ba06': 'USDT',
  },
  base: {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
  },
  'base-sepolia': {
    '0x036cbd53842c5426634e7929541ec2318f3dcf7e': 'USDC',
  },
};

// Extract token address from eth_call data (balanceOf call)
function extractTokenAddressFromCall(to: string): string {
  return to.toLowerCase();
}

/**
 * Setup mock RPC responses for E2E testing
 * Intercepts calls to the backend RPC proxy and returns mock balances
 */
export async function setupMockRpc(page: Page): Promise<void> {
  // Intercept the exact URL pattern used by the wallet
  await page.route('http://localhost:8000/api/rpc/proxy', async (route) => {
    const request = route.request();
    const postData = request.postDataJSON();

    if (!postData) {
      await route.continue();
      return;
    }

    const { chain, method, params, id } = postData;
    const chainBalances = MOCK_BALANCES[chain as keyof typeof MOCK_BALANCES];

    if (!chainBalances) {
      // Unknown chain, return zero balance
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: '0x0',
        }),
      });
      return;
    }

    // Handle eth_getBalance (native token)
    if (method === 'eth_getBalance') {
      const nativeToken = chain === 'bsc' ? 'BNB' : 'ETH';
      const balance = chainBalances[nativeToken as keyof typeof chainBalances] || '0';
      const decimals = TOKEN_DECIMALS[nativeToken];
      const hexBalance = toHexWei(balance, decimals);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: hexBalance,
        }),
      });
      return;
    }

    // Handle eth_call (ERC20 balanceOf)
    if (method === 'eth_call' && params?.[0]?.to) {
      const tokenAddress = extractTokenAddressFromCall(params[0].to);
      const chainTokens = TOKEN_ADDRESSES[chain as keyof typeof TOKEN_ADDRESSES] || {};
      const tokenSymbol = chainTokens[tokenAddress];

      if (tokenSymbol && chainBalances[tokenSymbol as keyof typeof chainBalances]) {
        const balance = chainBalances[tokenSymbol as keyof typeof chainBalances];
        const decimals = TOKEN_DECIMALS[tokenSymbol];
        // balanceOf returns a uint256, so we need to pad to 32 bytes
        const hexBalance = toHexWei(balance, decimals);
        const paddedResult = '0x' + hexBalance.slice(2).padStart(64, '0');

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: paddedResult,
          }),
        });
        return;
      }
    }

    // Handle eth_chainId
    if (method === 'eth_chainId') {
      const chainIds: Record<string, string> = {
        ethereum: '0x1',
        bsc: '0x38',
        sepolia: '0xaa36a7',
        base: '0x2105',
        'base-sepolia': '0x14a34',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: chainIds[chain] || '0x1',
        }),
      });
      return;
    }

    // Handle eth_gasPrice
    if (method === 'eth_gasPrice') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: '0x3b9aca00', // 1 gwei
        }),
      });
      return;
    }

    // For any other calls, return a default response
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: '0x0',
      }),
    });
  });
}

/**
 * Remove mock RPC interception
 */
export async function teardownMockRpc(page: Page): Promise<void> {
  await page.unroute('http://localhost:8000/api/rpc/proxy');
}

/**
 * Setup mock RPC at context level (intercepts all pages in the context)
 */
export async function setupMockRpcContext(context: BrowserContext): Promise<void> {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();

    // Only intercept RPC proxy calls
    if (!url.includes('localhost:8000/api/rpc/proxy')) {
      await route.continue();
      return;
    }

    try {
      const postData = request.postDataJSON();
      if (!postData) {
        await route.continue();
        return;
      }

      const { chain, method, params, id } = postData;
      const chainBalances = MOCK_BALANCES[chain as keyof typeof MOCK_BALANCES];

      if (!chainBalances) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id, result: '0x0' }),
        });
        return;
      }

      // Handle eth_getBalance (native token)
      if (method === 'eth_getBalance') {
        const nativeToken = chain === 'bsc' ? 'BNB' : 'ETH';
        const balance = chainBalances[nativeToken as keyof typeof chainBalances] || '0';
        const decimals = TOKEN_DECIMALS[nativeToken];
        const hexBalance = toHexWei(balance, decimals);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id, result: hexBalance }),
        });
        return;
      }

      // Handle eth_call (ERC20 balanceOf)
      if (method === 'eth_call' && params?.[0]?.to) {
        const tokenAddress = params[0].to.toLowerCase();
        const chainTokens = TOKEN_ADDRESSES[chain as keyof typeof TOKEN_ADDRESSES] || {};
        const tokenSymbol = chainTokens[tokenAddress];

        if (tokenSymbol && chainBalances[tokenSymbol as keyof typeof chainBalances]) {
          const balance = chainBalances[tokenSymbol as keyof typeof chainBalances];
          const decimals = TOKEN_DECIMALS[tokenSymbol];
          const hexBalance = toHexWei(balance, decimals);
          const paddedResult = '0x' + hexBalance.slice(2).padStart(64, '0');

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ jsonrpc: '2.0', id, result: paddedResult }),
          });
          return;
        }
      }

      // Handle eth_chainId
      if (method === 'eth_chainId') {
        const chainIds: Record<string, string> = {
          ethereum: '0x1', bsc: '0x38', sepolia: '0xaa36a7', base: '0x2105', 'base-sepolia': '0x14a34',
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id, result: chainIds[chain] || '0x1' }),
        });
        return;
      }

      // Default response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jsonrpc: '2.0', id, result: '0x0' }),
      });
    } catch (e) {
      await route.continue();
    }
  });
}
