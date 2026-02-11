import { Chain } from '../types'
import type { NetworkApiResponse, TokenApiResponse, TokenListItemResponse } from '../types'
import { CHAIN_CONFIG, CHAIN_NAME_MAP } from '../constants/chains'
import { TOKEN_CONFIG, TOKEN_ADDRESSES } from '../constants/tokens'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

async function fetchJson<T>(endpoint: string): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${endpoint}`)
  if (!r.ok) throw new Error(`${endpoint}: ${r.status}`)
  return r.json() as Promise<T>
}

/**
 * Fetches network and token config from the backend and populates
 * CHAIN_CONFIG / CHAIN_NAME_MAP / TOKEN_CONFIG / TOKEN_ADDRESSES in-place.
 * Never throws — on failure the objects remain empty (or with hardcoded defaults).
 */
export async function initConfig(): Promise<void> {
  try {
    // Phase 1: fetch networks + token list in parallel
    const [networksResult, tokenListResult] = await Promise.allSettled([
      fetchJson<NetworkApiResponse[]>('/networks'),
      fetchJson<TokenListItemResponse[]>('/tokens'),
    ])

    // slug → Chain lookup built from the networks response
    const slugToChain: Record<string, Chain> = {}

    // --- Networks ---
    if (networksResult.status === 'fulfilled') {
      for (const net of networksResult.value) {
        // Match backend network to a CHAIN_CONFIG entry by chainId
        const chain = Object.entries(CHAIN_CONFIG).find(
          ([, cfg]) => cfg.chainId === net.chain_id
        )?.[0] as Chain | undefined

        if (!chain) continue

        // Build slug → Chain mapping
        slugToChain[net.slug] = chain

        // Populate CHAIN_NAME_MAP with slug variants + native currency symbol
        CHAIN_NAME_MAP[net.slug] = chain
        CHAIN_NAME_MAP[net.slug.replace(/-/g, '_')] = chain
        if (net.native_currency_symbol) {
          CHAIN_NAME_MAP[net.native_currency_symbol.toLowerCase()] = chain
        }

        const cfg = CHAIN_CONFIG[chain]

        // Mutate in-place, preserving bridge addresses (dapp-specific)
        cfg.name = net.name
        cfg.rpcUrl = net.rpc_url
        cfg.explorer = net.explorer_url
        cfg.color = net.display_color
        cfg.isTestnet = net.is_testnet
      }
      console.log('[configLoader] Network config updated from backend')
    } else {
      console.warn(
        '[configLoader] Failed to fetch networks:',
        networksResult.reason
      )
    }

    // --- Tokens ---
    if (tokenListResult.status !== 'fulfilled') {
      console.warn(
        '[configLoader] Failed to fetch token list:',
        tokenListResult.reason
      )
      return
    }

    const symbols = tokenListResult.value.map((t) => t.symbol)

    // Phase 2: fetch each token's addresses in parallel
    const tokenDetails = await Promise.allSettled(
      symbols.map((sym) => fetchJson<TokenApiResponse>(`/tokens/${sym}`))
    )

    let tokenUpdated = false

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i]
      const result = tokenDetails[i]

      if (result.status !== 'fulfilled') {
        console.warn(
          `[configLoader] Failed to fetch token ${symbol}:`,
          result.reason
        )
        continue
      }

      const data = result.value

      // Populate TOKEN_CONFIG
      TOKEN_CONFIG[symbol] = {
        name: data.token.name,
        symbol: data.token.symbol,
        decimals: Object.values(data.addresses)[0]?.decimals ?? 0,
        enabled: true,
      }

      // Populate TOKEN_ADDRESSES
      TOKEN_ADDRESSES[symbol] = {}

      for (const [slug, addr] of Object.entries(data.addresses)) {
        const chain = slugToChain[slug]
        if (!chain) continue

        const chainId = CHAIN_CONFIG[chain]?.chainId
        if (chainId == null) continue

        TOKEN_ADDRESSES[symbol][chainId] = addr.contract_address
      }

      tokenUpdated = true
    }

    if (tokenUpdated) {
      console.log('[configLoader] Token config updated from backend')
    }
  } catch (err) {
    console.warn(
      '[configLoader] Unexpected error during config init:',
      err
    )
  }
}
