import type { LifiQuoteResponse } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export interface LifiQuoteParams {
  fromChain: string
  toChain: string
  fromToken: string
  toToken: string
  fromAmount: string
  fromAddress: string
  slippage?: string
}

class LifiService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  async getQuote(params: LifiQuoteParams): Promise<LifiQuoteResponse> {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.set(key, value)
    })

    const response = await fetch(`${this.baseUrl}/lifi/quote?${searchParams}`)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `LI.FI quote error: ${response.status}`)
    }
    return response.json()
  }

  async getTokens(chainIds?: number[]): Promise<Record<string, unknown>> {
    const params = chainIds ? `?chains=${chainIds.join(',')}` : ''
    const response = await fetch(`${this.baseUrl}/lifi/tokens${params}`)
    if (!response.ok) throw new Error(`LI.FI tokens error: ${response.status}`)
    return response.json()
  }

  async getChains(): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/lifi/chains`)
    if (!response.ok) throw new Error(`LI.FI chains error: ${response.status}`)
    return response.json()
  }

  async getStatus(txHash: string, fromChain?: string, toChain?: string): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({ txHash })
    if (fromChain) params.set('fromChain', fromChain)
    if (toChain) params.set('toChain', toChain)

    const response = await fetch(`${this.baseUrl}/lifi/status?${params}`)
    if (!response.ok) throw new Error(`LI.FI status error: ${response.status}`)
    return response.json()
  }
}

export const lifiService = new LifiService()
