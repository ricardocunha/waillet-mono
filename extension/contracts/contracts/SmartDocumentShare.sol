// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title SmartDocumentShare
 * @notice Soulbound ERC-721 NFT contract for sharing smart documents
 * @dev Each token represents time-limited, non-transferable access to a document
 * @dev UUPS upgradeable - state variable order must never change, only append new variables
 */
contract SmartDocumentShare is
    Initializable,
    ERC721Upgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // ==================== STATE VARIABLES ====================
    // WARNING: Never reorder or remove existing state variables. Only append new ones at the end.

    /// @notice Auto-incrementing token ID counter
    uint256 private _nextTokenId;

    /// @notice Mapping from document hash to its owner address
    mapping(bytes32 => address) public documentOwner;

    /// @notice Share info stored per token
    struct ShareInfo {
        bytes32 docHash;
        address recipient;
        uint256 expiresAt;
        bool revoked;
    }

    /// @notice Mapping from token ID to share info
    mapping(uint256 => ShareInfo) public shares;

    /// @notice Mapping from document hash to array of token IDs (shares for that doc)
    mapping(bytes32 => uint256[]) private _docShares;

    /// @notice Mapping from recipient address to array of token IDs (shares received)
    mapping(address => uint256[]) private _receivedShares;

    // ==================== EVENTS ====================

    event DocumentRegistered(bytes32 indexed docHash, address indexed owner, uint256 timestamp);
    event DocumentShared(
        uint256 indexed tokenId,
        bytes32 indexed docHash,
        address indexed recipient,
        uint256 expiresAt,
        uint256 timestamp
    );
    event ShareRevoked(uint256 indexed tokenId, bytes32 indexed docHash, uint256 timestamp);

    // ==================== ERRORS ====================

    error NotDocumentOwner();
    error DocumentAlreadyRegistered();
    error DocumentNotRegistered();
    error InvalidRecipient();
    error InvalidExpiration();
    error ShareNotFound();
    error SoulboundTransferNotAllowed();
    error CannotShareToSelf();

    // ==================== CONSTRUCTOR & INITIALIZER ====================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract (replaces constructor for upgradeable pattern)
    function initialize() public initializer {
        __ERC721_init("SmartDocumentShare", "SDOC");
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        _nextTokenId = 1;
    }

    // ==================== EXTERNAL FUNCTIONS ====================

    /**
     * @notice Register a document on-chain, establishing ownership
     * @param docHash keccak256 hash of the document identifier
     */
    function registerDocument(bytes32 docHash) external nonReentrant {
        if (documentOwner[docHash] != address(0)) revert DocumentAlreadyRegistered();

        documentOwner[docHash] = msg.sender;

        emit DocumentRegistered(docHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Share a document with a recipient by minting a soulbound NFT
     * @param docHash The document hash (must be registered by caller)
     * @param recipient The wallet address to share with
     * @param expiresAt Unix timestamp when access expires
     * @return tokenId The minted token ID
     */
    function shareDocument(
        bytes32 docHash,
        address recipient,
        uint256 expiresAt
    ) external nonReentrant returns (uint256) {
        if (documentOwner[docHash] != msg.sender) revert NotDocumentOwner();
        if (recipient == address(0)) revert InvalidRecipient();
        if (recipient == msg.sender) revert CannotShareToSelf();
        if (expiresAt <= block.timestamp) revert InvalidExpiration();

        uint256 tokenId = _nextTokenId++;

        shares[tokenId] = ShareInfo({
            docHash: docHash,
            recipient: recipient,
            expiresAt: expiresAt,
            revoked: false
        });

        _docShares[docHash].push(tokenId);
        _receivedShares[recipient].push(tokenId);

        _mint(recipient, tokenId);

        emit DocumentShared(tokenId, docHash, recipient, expiresAt, block.timestamp);

        return tokenId;
    }

    /**
     * @notice Revoke a share by burning the NFT
     * @param tokenId The token to revoke
     * @dev Only the document owner can revoke
     */
    function revokeShare(uint256 tokenId) external nonReentrant {
        ShareInfo storage info = shares[tokenId];
        if (info.docHash == bytes32(0)) revert ShareNotFound();
        if (documentOwner[info.docHash] != msg.sender) revert NotDocumentOwner();

        info.revoked = true;
        _burn(tokenId);

        emit ShareRevoked(tokenId, info.docHash, block.timestamp);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Check if a share is currently valid (not revoked and not expired)
     * @param tokenId The token to check
     * @return True if the share is valid
     */
    function isValid(uint256 tokenId) external view returns (bool) {
        ShareInfo storage info = shares[tokenId];
        if (info.docHash == bytes32(0)) return false;
        if (info.revoked) return false;
        if (block.timestamp >= info.expiresAt) return false;
        return true;
    }

    /**
     * @notice Get share info for a token
     * @param tokenId The token to query
     * @return The ShareInfo struct
     */
    function getShareInfo(uint256 tokenId) external view returns (ShareInfo memory) {
        return shares[tokenId];
    }

    /**
     * @notice Get all share token IDs for a document
     * @param docHash The document hash
     * @return Array of token IDs
     */
    function getDocumentShares(bytes32 docHash) external view returns (uint256[] memory) {
        return _docShares[docHash];
    }

    /**
     * @notice Get all share token IDs received by an address
     * @param recipient The recipient address
     * @return Array of token IDs
     */
    function getReceivedShares(address recipient) external view returns (uint256[] memory) {
        return _receivedShares[recipient];
    }

    // ==================== SOULBOUND OVERRIDE ====================

    /**
     * @dev Override _update to prevent transfers (soulbound)
     * Only allows minting (from == address(0)) and burning (to == address(0))
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow mint (from == 0) and burn (to == 0), block transfers
        if (from != address(0) && to != address(0)) {
            revert SoulboundTransferNotAllowed();
        }

        return super._update(to, tokenId, auth);
    }

    // ==================== UUPS UPGRADE AUTHORIZATION ====================

    /// @notice Restricts upgrades to the contract owner
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
