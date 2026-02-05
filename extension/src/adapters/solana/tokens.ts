/**
 * Solana SPL token configurations
 */

import { TokenConfig } from '../../types/chainTypes';

/**
 * Common SPL tokens on Solana mainnet
 * Token mint addresses
 */
export const SOLANA_TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  USDC: {
    'solana-mainnet': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'solana-devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
  },
  USDT: {
    'solana-mainnet': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  },
  BONK: {
    'solana-mainnet': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  },
  RAY: {
    'solana-mainnet': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'
  },
  SRM: {
    'solana-mainnet': 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt'
  },
  ORCA: {
    'solana-mainnet': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE'
  },
  MNGO: {
    'solana-mainnet': 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac'
  },
  JTO: {
    'solana-mainnet': 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL'
  },
  JUP: {
    'solana-mainnet': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'
  },
  WIF: {
    'solana-mainnet': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'
  },
  PYTH: {
    'solana-mainnet': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3'
  }
};

/**
 * Token metadata
 */
export const SOLANA_TOKEN_METADATA: Record<string, TokenConfig> = {
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png'
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png'
  },
  BONK: {
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23095.png'
  },
  RAY: {
    symbol: 'RAY',
    name: 'Raydium',
    decimals: 6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/8526.png'
  },
  JTO: {
    symbol: 'JTO',
    name: 'Jito',
    decimals: 9,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28541.png'
  },
  JUP: {
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/29210.png'
  },
  WIF: {
    symbol: 'WIF',
    name: 'dogwifhat',
    decimals: 6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28752.png'
  },
  PYTH: {
    symbol: 'PYTH',
    name: 'Pyth Network',
    decimals: 6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28177.png'
  }
};

/**
 * Get token mint address for a network
 */
export function getSolanaTokenAddress(symbol: string, networkId: string): string | undefined {
  return SOLANA_TOKEN_ADDRESSES[symbol.toUpperCase()]?.[networkId];
}

/**
 * Get token metadata
 */
export function getSolanaTokenMetadata(symbol: string): TokenConfig | undefined {
  return SOLANA_TOKEN_METADATA[symbol.toUpperCase()];
}

/**
 * Get available tokens for a network
 */
export function getSolanaNetworkTokens(networkId: string): TokenConfig[] {
  const tokens: TokenConfig[] = [];

  // Always include native SOL
  tokens.push(SOLANA_TOKEN_METADATA.SOL);

  for (const [symbol, addresses] of Object.entries(SOLANA_TOKEN_ADDRESSES)) {
    if (addresses[networkId]) {
      const metadata = SOLANA_TOKEN_METADATA[symbol];
      if (metadata) {
        tokens.push({
          ...metadata,
          address: addresses[networkId]
        });
      }
    }
  }

  return tokens;
}
