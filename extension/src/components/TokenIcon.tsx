import React, { useState } from 'react';

// CoinMarketCap IDs for common tokens
const TOKEN_CMC_IDS: Record<string, number> = {
  // Major tokens
  ETH: 1027,
  BTC: 1,
  BNB: 1839,
  USDT: 825,
  USDC: 3408,
  BUSD: 4687,
  DAI: 4943,

  // Native tokens for various chains
  MATIC: 3890,
  POL: 3890, // Polygon rebranded from MATIC to POL
  AVAX: 5805,
  FTM: 3513,
  CRO: 3635,
  xDAI: 5601,
  CELO: 5567,
  GLMR: 6836,
  KAVA: 4846,
  ONE: 3945,
  MNT: 27075,
  METIS: 9640,

  // DeFi tokens
  LINK: 1975,
  UNI: 7083,
  AAVE: 7278,
  COMP: 5692,
  MKR: 1518,
  SNX: 2586,
  CRV: 6538,
  SUSHI: 6758,

  // Other popular tokens
  SHIB: 5994,
  DOGE: 74,
  ARB: 11841,
  OP: 11840,
  APE: 18876,
  LDO: 8000,
  PEPE: 24478,
};

interface TokenIconProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

const textSizeMap = {
  sm: 'text-[8px]',
  md: 'text-[10px]',
  lg: 'text-xs',
};

export const TokenIcon: React.FC<TokenIconProps> = ({
  symbol,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const upperSymbol = symbol.toUpperCase();
  const cmcId = TOKEN_CMC_IDS[upperSymbol];

  // If we have a CMC ID and image hasn't failed, show the icon
  if (cmcId && !imageError) {
    const iconUrl = `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`;

    return (
      <img
        src={iconUrl}
        alt={symbol}
        className={`${sizeMap[size]} rounded-full object-cover ${className}`}
        onError={() => setImageError(true)}
        title={symbol}
      />
    );
  }

  // Fallback: show first 2 characters of symbol
  return (
    <div
      className={`${sizeMap[size]} bg-purple-600 rounded-full flex items-center justify-center font-bold ${textSizeMap[size]} ${className}`}
      title={symbol}
    >
      {upperSymbol.slice(0, 2)}
    </div>
  );
};

export default TokenIcon;
