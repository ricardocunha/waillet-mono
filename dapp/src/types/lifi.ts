export interface LifiToken {
  address: string
  symbol: string
  name: string
  decimals: number
  chainId: number
  logoURI?: string
  priceUSD?: string
}

export interface LifiQuoteAction {
  fromChainId: number
  toChainId: number
  fromToken: LifiToken
  toToken: LifiToken
  fromAmount: string
  slippage: number
}

export interface LifiGasCost {
  type: string
  estimate: string
  amountUSD?: string
  token: LifiToken
}

export interface LifiFeeCost {
  name: string
  percentage: string
  amount: string
  amountUSD?: string
  token: LifiToken
}

export interface LifiEstimate {
  fromAmount: string
  toAmount: string
  toAmountMin: string
  approvalAddress?: string
  executionDuration: number
  gasCosts?: LifiGasCost[]
  feeCosts?: LifiFeeCost[]
}

export interface LifiTransactionRequest {
  to: string
  data: string
  value: string
  gasLimit?: string
  gasPrice?: string
  chainId: number
}

export interface LifiQuoteResponse {
  id: string
  type: string
  tool: string
  action: LifiQuoteAction
  estimate: LifiEstimate
  transactionRequest: LifiTransactionRequest
}
