import { Chain } from '../types'
import { CHAIN_CONFIG } from '../constants'

export interface EtherscanTransaction {
  hash: string
  from: string
  to: string
  value: string
  timeStamp: string
  isError: string
  functionName: string
}

export interface TransactionDisplay {
  hash: string
  from: string
  to: string
  value: string
  timestamp: Date
  relativeTime: string
  isIncoming: boolean
  isFailed: boolean
  explorerUrl: string
}

const API_BASE_URL = 'https://api.etherscan.io/v2/api'

function getChainName(chain: Chain): string {
  switch (chain) {
    case Chain.ETHEREUM:
      return 'etherscan.io'
    case Chain.BASE:
      return 'basescan.org'
    case Chain.SEPOLIA:
      return 'sepolia.etherscan.io'
    case Chain.BASE_SEPOLIA:
      return 'sepolia.basescan.org'
    default:
      return 'etherscan.io'
  }
}

function formatRelativeTime(timestamp: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - timestamp.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'Just now'
}

export async function fetchTransactionHistory(
  address: string,
  chain: Chain,
  limit: number = 10
): Promise<TransactionDisplay[]> {
  const apiKey = import.meta.env.VITE_ETHERSCAN_API_KEY

  if (!apiKey) {
    console.warn('Etherscan API key not configured')
    return []
  }

  const chainId = CHAIN_CONFIG[chain].chainId

  try {
    const response = await fetch(
      `${API_BASE_URL}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${apiKey}`
    )

    const data = await response.json()

    if (data.status !== '1' || !Array.isArray(data.result)) {
      return []
    }

    return data.result.map((tx: EtherscanTransaction): TransactionDisplay => {
      const timestamp = new Date(parseInt(tx.timeStamp) * 1000)
      const isIncoming = tx.to.toLowerCase() === address.toLowerCase()
      const explorer = CHAIN_CONFIG[chain].explorer

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: (parseInt(tx.value) / 1e18).toFixed(4),
        timestamp,
        relativeTime: formatRelativeTime(timestamp),
        isIncoming,
        isFailed: tx.isError === '1',
        explorerUrl: `${explorer}/tx/${tx.hash}`,
      }
    })
  } catch (error) {
    console.error('Failed to fetch transaction history:', error)
    return []
  }
}
