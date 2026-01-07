// API Types for Backend Communication
import { IntentAction, FavoriteType } from '../constants/enums';

export interface Favorite {
  id: number;
  wallet_address: string;
  alias: string;
  address: string;
  chain: string;
  asset?: string;
  type: FavoriteType;
  value?: string;
  created_at: string;
  updated_at: string;
}

export interface FavoriteCreate {
  wallet_address: string;
  alias: string;
  address: string;
  chain: string;
  asset?: string;
  type: FavoriteType;
  value?: string;
}

export interface IntentRequest {
  prompt: string;
  wallet_address: string;
}

export interface IntentResponse {
  action: IntentAction;
  to?: string;
  value?: string;
  token?: string;
  chain?: string;
  resolved_from?: string;
  confidence: number;
  error?: string;
}

export interface Transaction {
  to: string;
  value: string;
  token: string;
  chain: string;
  from?: string;
}


