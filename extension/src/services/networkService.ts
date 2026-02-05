import { api, Network as APINetwork, ChainTypeAPI } from './api';
import { ChainType, NetworkConfig } from '../types/chainTypes';

// Cache duration in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

interface NetworkCache {
  networks: APINetwork[];
  timestamp: number;
}

class NetworkServiceImpl {
  private cache: NetworkCache | null = null;
  private fetchPromise: Promise<APINetwork[]> | null = null;

  /**
   * Maps API chain type to internal ChainType enum
   */
  private mapChainType(apiChainType: ChainTypeAPI): ChainType {
    switch (apiChainType) {
      case 'evm':
        return ChainType.EVM;
      case 'solana':
        return ChainType.SOLANA;
      case 'sui':
        return ChainType.SUI;
      case 'ton':
        return ChainType.TON;
      default:
        return ChainType.EVM;
    }
  }

  /**
   * Converts API network to internal NetworkConfig
   */
  private toNetworkConfig(network: APINetwork): NetworkConfig {
    return {
      id: network.slug,
      name: network.name,
      chainType: this.mapChainType(network.chain_type),
      chainId: network.chain_id,
      rpcUrl: network.rpc_url,
      explorerUrl: network.explorer_url,
      nativeCurrency: {
        symbol: network.native_currency_symbol,
        name: network.native_currency_name,
        decimals: network.native_currency_decimals,
      },
      isTestnet: network.is_testnet,
      iconUrl: network.icon_url,
      displayColor: network.display_color,
    };
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache) return false;
    return Date.now() - this.cache.timestamp < CACHE_TTL;
  }

  /**
   * Fetch networks from API (with deduplication)
   */
  private async fetchNetworks(): Promise<APINetwork[]> {
    // If a fetch is already in progress, return that promise
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = api.getNetworks().then((networks) => {
      this.cache = {
        networks,
        timestamp: Date.now(),
      };
      this.fetchPromise = null;
      return networks;
    }).catch((error) => {
      this.fetchPromise = null;
      console.error('[NetworkService] Failed to fetch networks:', error);
      throw error;
    });

    return this.fetchPromise;
  }

  /**
   * Get all networks (cached)
   */
  async getAllNetworks(): Promise<APINetwork[]> {
    if (this.isCacheValid()) {
      return this.cache!.networks;
    }
    return this.fetchNetworks();
  }

  /**
   * Get networks by chain type
   */
  async getNetworksByChainType(chainType: ChainType): Promise<NetworkConfig[]> {
    const networks = await this.getAllNetworks();
    const apiChainType = chainType.toLowerCase() as ChainTypeAPI;

    return networks
      .filter((n) => n.chain_type === apiChainType)
      .map((n) => this.toNetworkConfig(n));
  }

  /**
   * Get network by slug
   */
  async getNetwork(slug: string): Promise<NetworkConfig | undefined> {
    const networks = await this.getAllNetworks();
    const network = networks.find((n) => n.slug === slug);
    return network ? this.toNetworkConfig(network) : undefined;
  }

  /**
   * Get network by EVM chain ID
   */
  async getNetworkByChainId(chainId: number): Promise<NetworkConfig | undefined> {
    const networks = await this.getAllNetworks();
    const network = networks.find((n) => n.chain_id === chainId);
    return network ? this.toNetworkConfig(network) : undefined;
  }

  /**
   * Get default network for a chain type (first non-testnet, or first network)
   */
  async getDefaultNetwork(chainType: ChainType): Promise<NetworkConfig | undefined> {
    const networks = await this.getNetworksByChainType(chainType);
    // Prefer mainnet over testnet
    const mainnet = networks.find((n) => !n.isTestnet);
    return mainnet || networks[0];
  }

  /**
   * Clear cache (useful when user manually refreshes)
   */
  clearCache(): void {
    this.cache = null;
    this.fetchPromise = null;
  }

  /**
   * Get all network configs as a map for quick lookup
   */
  async getNetworkMap(): Promise<Map<string, NetworkConfig>> {
    const networks = await this.getAllNetworks();
    const map = new Map<string, NetworkConfig>();
    for (const network of networks) {
      map.set(network.slug, this.toNetworkConfig(network));
    }
    return map;
  }

}

// Export singleton instance
export const networkService = new NetworkServiceImpl();

/**
 * Static-like API for backwards compatibility with existing code
 * that uses NetworkService.getTokenPrices() syntax
 */
export const NetworkService = {
  /**
   * Get token prices from the API
   */
  async getTokenPrices(symbols: string[]): Promise<Map<string, number>> {
    try {
      const prices = await api.getTokenPrices(symbols);
      return new Map(Object.entries(prices));
    } catch (error) {
      console.error('[NetworkService] Failed to fetch token prices:', error);
      return new Map();
    }
  },

  /**
   * Get all networks
   */
  async getNetworks(): Promise<NetworkConfig[]> {
    const networks = await networkService.getAllNetworks();
    return networks.map((n) => ({
      id: n.slug,
      name: n.name,
      chainType: n.chain_type === 'evm' ? ChainType.EVM :
                 n.chain_type === 'solana' ? ChainType.SOLANA :
                 n.chain_type === 'sui' ? ChainType.SUI : ChainType.TON,
      chainId: n.chain_id,
      rpcUrl: n.rpc_url,
      explorerUrl: n.explorer_url,
      nativeCurrency: {
        symbol: n.native_currency_symbol,
        name: n.native_currency_name,
        decimals: n.native_currency_decimals,
      },
      isTestnet: n.is_testnet,
      iconUrl: n.icon_url,
      displayColor: n.display_color,
    }));
  },

  /**
   * Get networks by chain type
   */
  getNetworksByChainType: networkService.getNetworksByChainType.bind(networkService),

  /**
   * Get network by slug
   */
  getNetwork: networkService.getNetwork.bind(networkService),

  /**
   * Clear network cache
   */
  clearCache: networkService.clearCache.bind(networkService),
};
