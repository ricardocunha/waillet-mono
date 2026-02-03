import React, { useState } from 'react';
import { Chain } from '../types/messaging';
import { CHAIN_DISPLAY, ChainDisplayInfo } from '../constants';

interface NetworkIconProps {
  chain: Chain;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showFallback?: boolean;
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export const NetworkIcon: React.FC<NetworkIconProps> = ({
  chain,
  size = 'md',
  className = '',
  showFallback = true,
}) => {
  const [imageError, setImageError] = useState(false);
  const chainInfo: ChainDisplayInfo | undefined = CHAIN_DISPLAY[chain];

  if (!chainInfo) {
    // Fallback for unknown chains
    return (
      <div
        className={`${sizeMap[size]} rounded-full bg-slate-500 ${className}`}
        title={chain}
      />
    );
  }

  // If image failed to load or no iconUrl, show color fallback
  if (imageError || !chainInfo.iconUrl) {
    if (showFallback) {
      return (
        <div
          className={`${sizeMap[size]} rounded-full ${className}`}
          style={{ backgroundColor: chainInfo.color }}
          title={chainInfo.name}
        />
      );
    }
    return null;
  }

  return (
    <img
      src={chainInfo.iconUrl}
      alt={chainInfo.name}
      className={`${sizeMap[size]} rounded-full object-cover ${className}`}
      onError={() => setImageError(true)}
      title={chainInfo.name}
    />
  );
};

export default NetworkIcon;
