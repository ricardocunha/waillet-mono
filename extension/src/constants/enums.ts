// Transaction Status
export enum TransactionStatus {
  IDLE = 'idle',
  ESTIMATING = 'estimating',
  CONFIRMING = 'confirming',
  SENDING = 'sending',
  SUCCESS = 'success',
  ERROR = 'error',
}

// Message Types (for AgentChat)
export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

// Intent Actions
export enum IntentAction {
  TRANSFER = 'transfer',
  SWAP = 'swap',
  APPROVE = 'approve',
  UNKNOWN = 'unknown',
}

// Favorite Types
export enum FavoriteType {
  ADDRESS = 'address',
  CONTRACT = 'contract',
  TOKEN = 'token',
}

// Onboarding Modes
export enum OnboardingMode {
  CHOICE = 'choice',
  CREATE = 'create',
  IMPORT = 'import',
}
