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

    return response.json();
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


