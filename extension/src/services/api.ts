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
}

export const api = new WailletAPI();


