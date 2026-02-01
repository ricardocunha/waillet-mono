// API Types for Backend Communication
import { IntentAction, FavoriteType } from '../constants/enums';

export interface Favorite {
  id: number;
  wallet_address: string;
  alias: string;
  address: string;
  asset?: string;
  type: FavoriteType;
  value?: string;
  created_at: string;
  updated_at: string;
}

export interface FavoriteCreate {
  alias: string;
  address: string;
  asset?: string;
  type: FavoriteType;
  value?: string;
}

export interface IntentRequest {
  prompt: string;
  wallet_address: string;
}

export interface FavoriteItem {
  alias: string;
  address: string;
  asset?: string;
}

export interface IntentResponse {
  action: IntentAction;
  to?: string;
  value?: string;
  token?: string;
  chain?: string;
  needs_network?: boolean;  // True when user needs to select a network
  resolved_from?: string;
  alias?: string;
  confidence: number;
  error?: string;
  favorites?: FavoriteItem[];
}

export interface Transaction {
  to: string;
  value: string;
  token: string;
  chain: string;
  from?: string;
}


