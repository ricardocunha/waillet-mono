// AddressRegistry Contract Configuration

export const ADDRESS_REGISTRY = {
  // Deployed contract address on Base Sepolia
  address: '0x3a3f6A7bf012bFcb03e187C3D43364a6834c9A81',

  // Chain where registry is deployed
  chain: 'base-sepolia',

  // Contract ABI (minimal interface for frontend)
  abi: [
    'function register(bytes32 identifierHash) external',
    'function updateRegistration(bytes32 identifierHash, address newAddress) external',
    'function removeRegistration(bytes32 identifierHash) external',
    'function resolve(bytes32 identifierHash) external view returns (address)',
    'function getAliases(address wallet) external view returns (bytes32[])',
    'function getAliasCount(address wallet) external view returns (uint256)',
    'function isRegistered(bytes32 identifierHash) external view returns (bool)',
    'event AliasRegistered(bytes32 indexed identifierHash, address indexed wallet, uint256 timestamp)',
    'event AliasUpdated(bytes32 indexed identifierHash, address indexed oldWallet, address indexed newWallet, uint256 timestamp)',
    'event AliasRemoved(bytes32 indexed identifierHash, address indexed wallet, uint256 timestamp)',
  ],
} as const;

// Supported identifier formats
export enum IdentifierType {
  EMAIL = 'email',
  ALIAS = 'alias',
}

// Regex patterns for validation
export const IDENTIFIER_PATTERNS = {
  // Email pattern: user@domain.tld
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // Custom alias pattern: alphanumeric with dots, 3-32 chars, ends with .waillet
  ALIAS: /^[a-z0-9][a-z0-9.]{1,28}[a-z0-9]\.waillet$/,

  // Partial alias (without .waillet suffix) - will be auto-appended
  PARTIAL_ALIAS: /^[a-z0-9][a-z0-9.]{0,28}[a-z0-9]$/,
} as const;

// Storage key for registered shortcuts in chrome.storage
export const REGISTRY_STORAGE_KEY = 'registeredShortcuts';
