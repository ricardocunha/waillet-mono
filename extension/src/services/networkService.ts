import { api, Network, TokenWithAddresses } from './api';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

interface NetworkCache {
  networks: Network[];
  tokens: Map<string, TokenWithAddresses[]>; // networkSlug -> tokens
  prices: Map<string, number>; // symbol -> price
  lastNetworkFetch: number;
  lastPriceFetch: number;
}

const cache: NetworkCache = {
  networks: [],
  tokens: new Map(),
  prices: new Map(),
  lastNetworkFetch: 0,
  lastPriceFetch: 0,
};

export class NetworkService {
  /**
   * Get all active networks
   */
  static async getNetworks(forceRefresh = false): Promise<Network[]> {
    const now = Date.now();

    if (!forceRefresh && cache.networks.length > 0 && now - cache.lastNetworkFetch < CACHE_TTL) {
      return cache.networks;
    }

    try {
      const networks = await api.getNetworks();
      cache.networks = networks;
      cache.lastNetworkFetch = now;
      return networks;
    } catch (error) {
      console.error('Failed to fetch networks:', error);
      // Return cached data if available
      if (cache.networks.length > 0) {
        return cache.networks;
      }
      throw error;
    }
  }

  /**
   * Get tokens available on a specific network
   */
  static async getTokensForNetwork(networkSlug: string): Promise<TokenWithAddresses[]> {
    const cached = cache.tokens.get(networkSlug);
    if (cached) {
      return cached;
    }

    try {
      const tokens = await api.getTokensForNetwork(networkSlug);
      cache.tokens.set(networkSlug, tokens);
      return tokens;
    } catch (error) {
      console.error(`Failed to fetch tokens for network ${networkSlug}:`, error);
      throw error;
    }
  }

  /**
   * Get prices for multiple tokens
   */
  static async getTokenPrices(symbols: string[]): Promise<Map<string, number>> {
    try {
      const prices = await api.getTokenPrices(symbols);

      // Update cache
      for (const [symbol, price] of Object.entries(prices)) {
        cache.prices.set(symbol, price);
      }
      cache.lastPriceFetch = Date.now();

      return new Map(Object.entries(prices));
    } catch (error) {
      console.error('Failed to fetch token prices:', error);
      // Return cached prices if available
      if (cache.prices.size > 0) {
        const cachedPrices = new Map<string, number>();
        for (const symbol of symbols) {
          const price = cache.prices.get(symbol);
          if (price !== undefined) {
            cachedPrices.set(symbol, price);
          }
        }
        return cachedPrices;
      }
      throw error;
    }
  }

  /**
   * Get a single token price
   */
  static async getTokenPrice(symbol: string): Promise<number | undefined> {
    // Check cache first
    const cachedPrice = cache.prices.get(symbol);
    if (cachedPrice !== undefined && Date.now() - cache.lastPriceFetch < CACHE_TTL) {
      return cachedPrice;
    }

    const prices = await this.getTokenPrices([symbol]);
    return prices.get(symbol);
  }

  /**
   * Get network by chain ID
   */
  static getNetworkByChainId(chainId: number): Network | undefined {
    return cache.networks.find(n => n.chain_id === chainId);
  }

  /**
   * Get network by slug
   */
  static getNetworkBySlug(slug: string): Network | undefined {
    return cache.networks.find(n => n.slug === slug);
  }

  /**
   * Get mainnet networks only
   */
  static getMainnetNetworks(): Network[] {
    return cache.networks.filter(n => !n.is_testnet);
  }

  /**
   * Get testnet networks only
   */
  static getTestnetNetworks(): Network[] {
    return cache.networks.filter(n => n.is_testnet);
  }

  /**
   * Get all supported chain IDs
   */
  static getSupportedChainIds(): number[] {
    return cache.networks.map(n => n.chain_id);
  }

  /**
   * Check if a chain ID is supported
   */
  static isChainSupported(chainId: number): boolean {
    return cache.networks.some(n => n.chain_id === chainId);
  }

  /**
   * Get chain ID from network slug
   */
  static getChainId(slug: string): number | undefined {
    const network = cache.networks.find(n => n.slug === slug);
    return network?.chain_id;
  }

  /**
   * Get network slug from chain ID
   */
  static getSlugFromChainId(chainId: number): string | undefined {
    const network = cache.networks.find(n => n.chain_id === chainId);
    return network?.slug;
  }

  /**
   * Clear all cached data
   */
  static clearCache(): void {
    cache.networks = [];
    cache.tokens.clear();
    cache.prices.clear();
    cache.lastNetworkFetch = 0;
    cache.lastPriceFetch = 0;
  }

  /**
   * Initialize the service by fetching networks
   */
  static async initialize(): Promise<void> {
    await this.getNetworks(true);
  }
}

export default NetworkService;
