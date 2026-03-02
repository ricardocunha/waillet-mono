// SmartDocumentShare Contract Configuration

export const SMART_DOCUMENT_SHARE = {
  // Deployed contract address on Base Sepolia (update after deployment)
  address: '0x0000000000000000000000000000000000000000',

  // Chain where contract is deployed
  chain: 'base-sepolia',

  // Contract ABI (minimal interface for frontend)
  abi: [
    'function initialize() external',
    'function registerDocument(bytes32 docHash) external',
    'function shareDocument(bytes32 docHash, address recipient, uint256 expiresAt) external returns (uint256)',
    'function revokeShare(uint256 tokenId) external',
    'function isValid(uint256 tokenId) external view returns (bool)',
    'function getShareInfo(uint256 tokenId) external view returns (tuple(bytes32 docHash, address recipient, uint256 expiresAt, bool revoked))',
    'function getDocumentShares(bytes32 docHash) external view returns (uint256[])',
    'function getReceivedShares(address recipient) external view returns (uint256[])',
    'function documentOwner(bytes32 docHash) external view returns (address)',
    'event DocumentRegistered(bytes32 indexed docHash, address indexed owner, uint256 timestamp)',
    'event DocumentShared(uint256 indexed tokenId, bytes32 indexed docHash, address indexed recipient, uint256 expiresAt, uint256 timestamp)',
    'event ShareRevoked(uint256 indexed tokenId, bytes32 indexed docHash, uint256 timestamp)',
  ],
} as const;
