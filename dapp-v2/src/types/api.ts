// Favorite address stored by user
export interface Favorite {
  id: string
  wallet_address: string
  alias: string
  address: string
  chain: string
  asset?: string
  type?: string
  value?: string
  created_at: string
  updated_at: string
}

// AI Intent action types
export type IntentAction =
  | 'TRANSFER'
  | 'SWAP'
  | 'APPROVE'
  | 'SAVE_FAVORITE'
  | 'LIST_FAVORITES'
  | 'UNKNOWN'

// AI Intent response from backend
export interface IntentResponse {
  action: IntentAction
  to?: string
  value?: string
  token?: string
  chain?: string
  resolved_from?: string
  alias?: string
  confidence: number
  error?: string
  favorites?: Favorite[]
}

// Risk levels
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// Risk severity
export enum RiskSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Risk factor types
export enum RiskFactorType {
  SCAM_ADDRESS = 'SCAM_ADDRESS',
  UNLIMITED_APPROVAL = 'UNLIMITED_APPROVAL',
  DELEGATECALL = 'DELEGATECALL',
  LARGE_VALUE = 'LARGE_VALUE',
  NEW_CONTRACT = 'NEW_CONTRACT',
  UNVERIFIED_CONTRACT = 'UNVERIFIED_CONTRACT',
}

// Risk recommendation actions
export enum RiskRecommendationAction {
  BLOCK = 'BLOCK',
  LIMIT_APPROVAL = 'LIMIT_APPROVAL',
  VERIFY_ADDRESS = 'VERIFY_ADDRESS',
  RESEARCH = 'RESEARCH',
  PROCEED = 'PROCEED',
  CAUTION = 'CAUTION',
}

// Risk factor in analysis
export interface RiskFactor {
  type: RiskFactorType
  severity: RiskSeverity
  description: string
}

// Risk recommendation
export interface RiskRecommendation {
  action: RiskRecommendationAction
  reason: string
}

// Risk analysis response
export interface RiskAnalysisResponse {
  risk_log_id: string
  risk_score: number
  risk_level: RiskLevel
  ai_summary: string
  factors: RiskFactor[]
  recommendations: RiskRecommendation[]
  contract_info?: {
    verified: boolean
    name?: string
  }
  value_usd?: number
}
