import type { Favorite, FavoriteCreate, IntentRequest, IntentResponse } from '../types/api';
import type { SmartDocument, DocumentShare, SharedDocumentView, InitiateShareResponse } from '../types/documents';
import { authService } from './auth';

const API_BASE_URL = 'http://localhost:8000/api';

// Endpoints that require authentication
const PROTECTED_ENDPOINTS = [
  '/favorites',
  '/policies',
  '/ai/',
  '/simulate/',
  '/settings/',
  '/auth/me',
  '/auth/logout',
  '/documents',
];

class WailletAPI {
  private isProtectedEndpoint(endpoint: string): boolean {
    return PROTECTED_ENDPOINTS.some(
      (protected_) => endpoint.startsWith(protected_) || endpoint === protected_.slice(0, -1)
    );
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    // Add auth header for protected endpoints
    if (this.isProtectedEndpoint(endpoint)) {
      const token = await authService.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 by attempting token refresh
    if (response.status === 401 && this.isProtectedEndpoint(endpoint)) {
      try {
        await authService.refreshAccessToken();
        const newToken = await authService.getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
        }
      } catch (refreshError) {
        console.error('[API] Token refresh failed:', refreshError);
        throw new Error('Authentication required. Please unlock your wallet.');
      }
    }

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

  private async uploadRequest<T>(endpoint: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};

    if (this.isProtectedEndpoint(endpoint)) {
      const token = await authService.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401 && this.isProtectedEndpoint(endpoint)) {
      try {
        await authService.refreshAccessToken();
        const newToken = await authService.getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: formData,
          });
        }
      } catch (refreshError) {
        console.error('[API] Token refresh failed:', refreshError);
        throw new Error('Authentication required. Please unlock your wallet.');
      }
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text);
  }

  // ==================== DOCUMENTS ====================

  async getDocuments(): Promise<SmartDocument[]> {
    return this.request<SmartDocument[]>('/documents');
  }

  async getDocument(id: number): Promise<SmartDocument> {
    return this.request<SmartDocument>(`/documents/${id}`);
  }

  async uploadDocument(file: File): Promise<SmartDocument> {
    const formData = new FormData();
    formData.append('file', file);
    return this.uploadRequest<SmartDocument>('/documents/upload', formData);
  }

  async getDocumentURL(id: number): Promise<string> {
    const res = await this.request<{ url: string }>(`/documents/${id}/url`);
    return res.url;
  }

  async renameDocument(id: number, title: string, fileName?: string): Promise<SmartDocument> {
    const body: { title: string; file_name?: string } = { title };
    if (fileName) {
      body.file_name = fileName;
    }
    return this.request<SmartDocument>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async deleteDocument(id: number): Promise<void> {
    return this.request<void>(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== DOCUMENT SHARING ====================

  async initiateShare(docId: number, recipientAddress: string, expiresAt: number): Promise<InitiateShareResponse> {
    return this.request<InitiateShareResponse>(`/documents/${docId}/share`, {
      method: 'POST',
      body: JSON.stringify({
        recipient_address: recipientAddress,
        expires_at: expiresAt,
      }),
    });
  }

  async confirmShare(shareId: number, tokenId: number, txHash: string): Promise<void> {
    return this.request<void>(`/documents/shares/${shareId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ token_id: tokenId, tx_hash: txHash }),
    });
  }

  async getDocumentShares(docId: number): Promise<DocumentShare[]> {
    return this.request<DocumentShare[]>(`/documents/${docId}/shares`);
  }

  async getSharedWithMe(): Promise<SharedDocumentView[]> {
    return this.request<SharedDocumentView[]>('/documents/shared-with-me');
  }

  async getSharedDocumentURL(shareId: number): Promise<string> {
    const res = await this.request<{ url: string }>(`/documents/shares/${shareId}/url`);
    return res.url;
  }

  async revokeShare(docId: number, shareId: number): Promise<void> {
    return this.request<void>(`/documents/${docId}/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  async confirmRevoke(shareId: number, txHash: string): Promise<void> {
    return this.request<void>(`/documents/shares/${shareId}/confirm-revoke`, {
      method: 'POST',
      body: JSON.stringify({ tx_hash: txHash }),
    });
  }

  // ==================== FAVORITES ====================

  async getFavorites(): Promise<Favorite[]> {
    return this.request<Favorite[]>('/favorites');
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

  // ==================== SETTINGS ====================

  async getOpenAIStatus(): Promise<{ configured: boolean }> {
    return this.request<{ configured: boolean }>('/settings/openai');
  }

  async setOpenAIKey(apiKey: string): Promise<void> {
    return this.request<void>('/settings/openai', {
      method: 'PUT',
      body: JSON.stringify({ api_key: apiKey }),
    });
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

  // ==================== CHAIN TYPES ====================

  async getChainTypes(): Promise<ChainTypeConfig[]> {
    return this.request<ChainTypeConfig[]>('/chain-types');
  }

  async getChainType(id: string): Promise<ChainTypeConfig> {
    return this.request<ChainTypeConfig>(`/chain-types/${id}`);
  }
}

// ==================== NETWORK & TOKEN TYPES ====================

export type ChainTypeAPI = 'evm' | 'solana' | 'sui' | 'ton';

export interface ChainTypeConfig {
  id: string;           // 'evm', 'solana', 'sui', 'ton'
  name: string;         // Display name
  coin_type: number;    // BIP-44 coin type
  curve: string;        // 'secp256k1' or 'ed25519'
  address_format: string;      // 'hex', 'base58', 'base64url'
  derivation_template: string; // Path with {index} placeholder
}

export interface Network {
  id: number;
  slug: string;
  chain_type: ChainTypeAPI;
  name: string;
  chain_id?: number; // Optional for non-EVM chains
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


