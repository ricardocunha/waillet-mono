import http from 'http';

// Mock balance values per chain (in human-readable format)
export const MOCK_BALANCES = {
  ethereum: { ETH: '1.000000', USDC: '2.000000', USDT: '3.000000' },
  bsc: { BNB: '4.000000', USDC: '5.000000', USDT: '6.000000' },
  sepolia: { ETH: '10.000000', USDC: '20.000000', USDT: '30.000000' },
  base: { ETH: '7.000000', USDC: '8.000000' },
  'base-sepolia': { ETH: '70.000000', USDC: '80.000000' },
};

const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18, BNB: 18, USDC: 6, USDT: 6,
};

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
  base: { '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC' },
  'base-sepolia': { '0x036cbd53842c5426634e7929541ec2318f3dcf7e': 'USDC' },
};

function toHexWei(balance: string, decimals: number): string {
  const [whole, fraction = ''] = balance.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const weiString = whole + paddedFraction;
  const wei = BigInt(weiString);
  return '0x' + wei.toString(16);
}

let server: http.Server | null = null;

export function startMockServer(port: number = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Accept both exact path and any POST to handle the request
      if (req.method !== 'POST') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      console.log(`[MockServer] Received ${req.method} ${req.url}`);

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        console.log(`[MockServer] Body: ${body}`);
        try {
          const { chain, method, params, id } = JSON.parse(body);
          console.log(`[MockServer] Chain: ${chain}, Method: ${method}`);
          const chainBalances = MOCK_BALANCES[chain as keyof typeof MOCK_BALANCES];
          let result = '0x0';

          if (chainBalances) {
            if (method === 'eth_getBalance') {
              const nativeToken = chain === 'bsc' ? 'BNB' : 'ETH';
              const balance = chainBalances[nativeToken as keyof typeof chainBalances] || '0';
              result = toHexWei(balance, TOKEN_DECIMALS[nativeToken]);
            } else if (method === 'eth_call' && params?.[0]?.to) {
              const tokenAddress = params[0].to.toLowerCase();
              const chainTokens = TOKEN_ADDRESSES[chain as keyof typeof TOKEN_ADDRESSES] || {};
              const tokenSymbol = chainTokens[tokenAddress];
              if (tokenSymbol && chainBalances[tokenSymbol as keyof typeof chainBalances]) {
                const balance = chainBalances[tokenSymbol as keyof typeof chainBalances];
                const hexBalance = toHexWei(balance, TOKEN_DECIMALS[tokenSymbol]);
                result = '0x' + hexBalance.slice(2).padStart(64, '0');
              }
            } else if (method === 'eth_chainId') {
              const chainIds: Record<string, string> = {
                ethereum: '0x1', bsc: '0x38', sepolia: '0xaa36a7', base: '0x2105', 'base-sepolia': '0x14a34',
              };
              result = chainIds[chain] || '0x1';
            } else if (method === 'eth_gasPrice') {
              result = '0x3b9aca00';
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
        } catch (e) {
          res.writeHead(500);
          res.end('Server error');
        }
      });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} in use, mock server might already be running`);
        resolve();
      } else {
        reject(err);
      }
    });

    server.listen(port, () => {
      console.log(`Mock RPC server started on port ${port}`);
      resolve();
    });
  });
}

export function stopMockServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
