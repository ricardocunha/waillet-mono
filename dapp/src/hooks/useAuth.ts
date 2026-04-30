import { useState, useCallback, useEffect, useRef } from 'react'
import { JsonRpcSigner } from 'ethers'
import { authService } from '../services'

export interface UseAuthReturn {
  isAuthenticated: boolean
  isAuthenticating: boolean
  error: string | null
  authenticate: (signer: JsonRpcSigner) => Promise<void>
  logout: () => void
}

export function useAuth(signer: JsonRpcSigner | null): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated())
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const authenticatingRef = useRef(false)

  const authenticate = useCallback(async (signer: JsonRpcSigner) => {
    if (authenticatingRef.current) return
    authenticatingRef.current = true

    try {
      setIsAuthenticating(true)
      setError(null)

      const walletAddress = await signer.getAddress()
      const { message } = await authService.getNonce(walletAddress)
      const signature = await signer.signMessage(message)
      await authService.verify(message, signature)

      setIsAuthenticated(true)
    } catch (err: unknown) {
      const error = err as { code?: string | number; message?: string }
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        setError('Sign-in rejected')
      } else {
        setError(error.message || 'Authentication failed')
      }
    } finally {
      setIsAuthenticating(false)
      authenticatingRef.current = false
    }
  }, [])

  const logout = useCallback(() => {
    authService.clearTokens()
    setIsAuthenticated(false)
    setError(null)
  }, [])

  // Auto-authenticate when signer becomes available
  useEffect(() => {
    if (signer && !authService.isAuthenticated()) {
      authenticate(signer)
    } else if (!signer) {
      logout()
    }
  }, [signer, authenticate, logout])

  return {
    isAuthenticated,
    isAuthenticating,
    error,
    authenticate,
    logout,
  }
}
