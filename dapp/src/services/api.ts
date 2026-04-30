import type {IntentResponse, Favorite, TokenListItemResponse } from '../types'
import { authService } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

class ApiService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    const token = authService.getAccessToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    let response = await fetch(url, { ...options, headers })

    // On 401, try refreshing the token once
    if (response.status === 401 && token) {
      const refreshed = await authService.refresh()
      if (refreshed) {
        headers['Authorization'] = `Bearer ${refreshed.access_token}`
        response = await fetch(url, { ...options, headers })
      }
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Parse user intent with AI
  async parseIntent(
    message: string,
    walletAddress: string,
    chain?: string
  ): Promise<IntentResponse> {
    return this.request<IntentResponse>('/ai/parse-intent', {
      method: 'POST',
      body: JSON.stringify({
        prompt: message,
        wallet_address: walletAddress,
        chain,
      }),
    })
  }

  // Get favorites for a wallet
  async getFavorites(walletAddress: string): Promise<Favorite[]> {
    return this.request<Favorite[]>(`/favorites/${walletAddress}`)
  }

  // Save a new favorite
  async saveFavorite(favorite: Omit<Favorite, 'id' | 'created_at' | 'updated_at'>): Promise<Favorite> {
    return this.request<Favorite>('/favorites', {
      method: 'POST',
      body: JSON.stringify(favorite),
    })
  }

  // Delete a favorite
  async deleteFavorite(id: string): Promise<void> {
    await this.request(`/favorites/${id}`, {
      method: 'DELETE',
    })
  }

  // Get token list (top 100 by market cap)
  async getTokenList(limit: number = 100): Promise<TokenListItemResponse[]> {
    return this.request<TokenListItemResponse[]>(`/tokens?limit=${limit}`)
  }

  // Get prices for specific tokens
  async getTokenPrices(symbols: string[]): Promise<Record<string, { price_usd: number; percent_change_24h: number; percent_change_7d: number }>> {
    return this.request(`/tokens/prices?symbols=${symbols.join(',')}`)
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health')
  }
}

export const api = new ApiService()
