/**
 * SUI token/coin configurations
 */

import { TokenConfig } from '../../types/chainTypes';

/**
 * Common SUI coin type addresses
 * Format: 0x{package_id}::{module}::{type}
 */
export const SUI_TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  USDC: {
    'sui-mainnet': '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
    'sui-testnet': '0x26b3bc67befc214058ca78ea9a2690298d731a2d4309485ec3d40198063c4abc::usdc::USDC'
  },
  USDT: {
    'sui-mainnet': '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN'
  },
  WETH: {
    'sui-mainnet': '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN'
  },
  CETUS: {
    'sui-mainnet': '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS'
  },
  SCA: {
    'sui-mainnet': '0x7016aae72cfc67f2fadf55769c0a7dd54291a583b63051a5ed71081cce836ac6::sca::SCA'
  },
  DEEP: {
    'sui-mainnet': '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP'
  },
  NS: {
    'sui-mainnet': '0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS'
  }
};

/**
 * Token metadata
 */
export const SUI_TOKEN_METADATA: Record<string, TokenConfig> = {
  SUI: {
    symbol: 'SUI',
    name: 'SUI',
    decimals: 9,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin (Bridged)',
    decimals: 6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png'
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD (Bridged)',
    decimals: 6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png'
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether (Bridged)',
    decimals: 8,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png'
  },
  CETUS: {
    symbol: 'CETUS',
    name: 'Cetus Protocol',
    decimals: 9,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23420.png'
  },
  SCA: {
    symbol: 'SCA',
    name: 'Scallop',
    decimals: 9,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28697.png'
  },
  DEEP: {
    symbol: 'DEEP',
    name: 'DeepBook',
    decimals: 6,
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/32472.png'
  }
};

/**
 * SUI native coin type
 */
export const SUI_COIN_TYPE = '0x2::sui::SUI';

/**
 * Get token type address for a network
 */
export function getSuiTokenAddress(symbol: string, networkId: string): string | undefined {
  if (symbol.toUpperCase() === 'SUI') {
    return SUI_COIN_TYPE;
  }
  return SUI_TOKEN_ADDRESSES[symbol.toUpperCase()]?.[networkId];
}

/**
 * Get token metadata
 */
export function getSuiTokenMetadata(symbol: string): TokenConfig | undefined {
  return SUI_TOKEN_METADATA[symbol.toUpperCase()];
}

/**
 * Get available tokens for a network
 */
export function getSuiNetworkTokens(networkId: string): TokenConfig[] {
  const tokens: TokenConfig[] = [];

  // Always include native SUI
  tokens.push(SUI_TOKEN_METADATA.SUI);

  for (const [symbol, addresses] of Object.entries(SUI_TOKEN_ADDRESSES)) {
    if (addresses[networkId]) {
      const metadata = SUI_TOKEN_METADATA[symbol];
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
