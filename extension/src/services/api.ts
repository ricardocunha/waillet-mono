import type { Favorite, FavoriteCreate, IntentRequest, IntentResponse } from '../types/api';

const API_BASE_URL = 'http://localhost:8000/api';

class WailletAPI {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    // Handle empty responses (e.g., 204 No Content from DELETE)
    const contentLength = response.headers.get('content-length');
    if (response.status === 204 || contentLength === '0') {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text);
  }

  async getFavorites(walletAddress: string): Promise<Favorite[]> {
    return this.request<Favorite[]>(`/favorites/${walletAddress}`);
  }

  async createFavorite(favorite: FavoriteCreate): Promise<Favorite> {
    return this.request<Favorite>('/favorites', {
      method: 'POST',
      body: JSON.stringify(favorite),
    });
  }

  async updateFavorite(id: number, favorite: Partial<FavoriteCreate>): Promise<Favorite> {
    return this.request<Favorite>(`/favorites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(favorite),
    });
  }

  async deleteFavorite(id: number): Promise<void> {
    return this.request<void>(`/favorites/${id}`, {
      method: 'DELETE',
    });
  }

  async parseIntent(request: IntentRequest): Promise<IntentResponse> {
    return this.request<IntentResponse>('/ai/parse-intent', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch('http://localhost:8000/health');
    return response.json();
  }

  // ==================== RISK ANALYSIS ====================

  async analyzeRisk(params: {
    wallet_address: string;
    to_address: string;
    value: string;
    data?: string;
    chain: string;
  }): Promise<RiskAnalysisResponse> {
    return this.request<RiskAnalysisResponse>('/simulate/risk-analysis', {
      method: 'POST',
      body: JSON.stringify({
        wallet_address: params.wallet_address,
        to_address: params.to_address,
        value: params.value,
        data: params.data || '0x',
        chain: params.chain
      }),
    });
  }

  async recordRiskDecision(params: {
    risk_log_id: number;
    approved: boolean;
    tx_hash?: string;
  }): Promise<{ success: boolean; risk_log_id: number; decision: string }> {
    return this.request('/simulate/risk-decision', {
      method: 'POST',
      body: JSON.stringify({
        risk_log_id: params.risk_log_id,
        approved: params.approved,
        tx_hash: params.tx_hash || null
      }),
    });
  }

  // ==================== NETWORKS ====================

  async getNetworks(): Promise<Network[]> {
    return this.request<Network[]>('/networks');
  }

  async getNetwork(slug: string): Promise<Network> {
    return this.request<Network>(`/networks/${slug}`);
  }

  // ==================== TOKENS ====================

  async getTokens(limit?: number): Promise<Token[]> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<Token[]>(`/tokens${query}`);
  }

  async getToken(symbol: string): Promise<TokenWithAddresses> {
    return this.request<TokenWithAddresses>(`/tokens/${symbol}`);
  }

  async getTokensForNetwork(networkSlug: string): Promise<TokenWithAddresses[]> {
    return this.request<TokenWithAddresses[]>(`/tokens/network/${networkSlug}`);
  }

  async getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
    return this.request<Record<string, number>>(`/tokens/prices?symbols=${symbols.join(',')}`);
  }
}

// ==================== NETWORK & TOKEN TYPES ====================

export interface Network {
  id: number;
  slug: string;
  name: string;
  chain_id: number;
  rpc_url: string;
  rpc_url_fallback?: string;
  explorer_url: string;
  native_currency_symbol: string;
  native_currency_name: string;
  native_currency_decimals: number;
  is_testnet: boolean;
  display_color: string;
  icon_url?: string;
}

export interface Token {
  id: number;
  cmc_id: number;
  symbol: string;
  name: string;
  slug: string;
  cmc_rank?: number;
  price_usd?: number;
  market_cap_usd?: number;
  volume_24h_usd?: number;
  percent_change_24h?: number;
  percent_change_7d?: number;
  logo_url?: string;
}

export interface TokenAddressDTO {
  contract_address: string;
  decimals: number;
  is_native: boolean;
}

export interface TokenWithAddresses {
  token: Token;
  addresses: Record<string, TokenAddressDTO>; // key: network slug
}

export const api = new WailletAPI();

// ==================== ENUMS ====================

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum RiskSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum RiskFactorType {
  SCAM_ADDRESS = 'SCAM_ADDRESS',
  UNLIMITED_APPROVAL = 'UNLIMITED_APPROVAL',
  DELEGATECALL = 'DELEGATECALL',
  LARGE_VALUE = 'LARGE_VALUE',
  UNVERIFIED_CONTRACT = 'UNVERIFIED_CONTRACT',
  FIRST_INTERACTION = 'FIRST_INTERACTION',
  EOA_TRANSFER = 'EOA_TRANSFER',
  ANALYSIS_ERROR = 'ANALYSIS_ERROR'
}

export enum RiskRecommendationAction {
  BLOCK = 'block',
  LIMIT_APPROVAL = 'limit_approval',
  VERIFY_SOURCE = 'verify_source',
  VERIFY_RECIPIENT = 'verify_recipient',
  VERIFY_CONTRACT = 'verify_contract',
  RESEARCH = 'research',
  PROCEED = 'proceed',
  CAUTION = 'caution'
}

// ==================== TYPES ====================

export interface RiskFactor {
  type: RiskFactorType;
  severity: RiskSeverity;
  title: string;
  description: string;
  points: number;
}

export interface RiskRecommendation {
  icon: string;
  text: string;
  action: RiskRecommendationAction;
}

export interface ContractInfo {
  is_contract: boolean;
  verified: boolean;
  name: string | null;
}

export interface RiskAnalysisResponse {
  risk_log_id: number;
  risk_score: number;
  risk_level: RiskLevel;
  ai_summary: string;
  factors: RiskFactor[];
  recommendations: RiskRecommendation[];
  contract_info: ContractInfo;
  is_contract: boolean;
  value_usd: number;
}


