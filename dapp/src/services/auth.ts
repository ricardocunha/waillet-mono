const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'waillet_access_token',
  REFRESH_TOKEN: 'waillet_refresh_token',
  EXPIRES_AT: 'waillet_expires_at',
} as const

interface NonceResponse {
  nonce: string
  message: string
}

interface AuthTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

class AuthService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  async getNonce(walletAddress: string): Promise<NonceResponse> {
    const response = await fetch(
      `${this.baseUrl}/auth/nonce?wallet_address=${encodeURIComponent(walletAddress)}`
    )

    if (!response.ok) {
      throw new Error(`Failed to get nonce: ${response.status}`)
    }

    return response.json()
  }

  async verify(message: string, signature: string): Promise<AuthTokenResponse> {
    const response = await fetch(`${this.baseUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    })

    if (!response.ok) {
      throw new Error(`Verification failed: ${response.status}`)
    }

    const data: AuthTokenResponse = await response.json()
    this.setTokens(data.access_token, data.refresh_token, data.expires_in)
    return data
  }

  async refresh(): Promise<AuthTokenResponse | null> {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
    if (!refreshToken) return null

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!response.ok) {
        this.clearTokens()
        return null
      }

      const data: AuthTokenResponse = await response.json()
      this.setTokens(data.access_token, data.refresh_token, data.expires_in)
      return data
    } catch {
      this.clearTokens()
      return null
    }
  }

  getAccessToken(): string | null {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
    if (!token) return null

    const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT)
    if (expiresAt && Date.now() >= parseInt(expiresAt, 10)) {
      return null
    }

    return token
  }

  isAuthenticated(): boolean {
    return this.getAccessToken() !== null
  }

  private setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
    localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, (Date.now() + expiresIn * 1000).toString())
  }

  clearTokens(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT)
  }
}

export const authService = new AuthService()
