import type {IntentResponse, Favorite} from '../types'

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

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

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
        message,
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

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health')
  }
}

export const api = new ApiService()
