// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AddressRegistry
 * @notice On-chain registry mapping identifier hashes (emails, aliases) to wallet addresses
 * @dev Identifiers are hashed off-chain using keccak256 for privacy
 */
contract AddressRegistry is ReentrancyGuard, Ownable {

    // ==================== STATE VARIABLES ====================

    /// @notice Mapping from identifier hash to registered wallet address
    mapping(bytes32 => address) public registry;

    /// @notice Mapping from wallet address to array of registered identifier hashes
    mapping(address => bytes32[]) public userAliases;

    /// @notice Mapping to track index of each hash in userAliases array (for efficient removal)
    mapping(bytes32 => uint256) private aliasIndex;

    /// @notice Maximum number of aliases per address
    uint256 public constant MAX_ALIASES_PER_ADDRESS = 10;

    /// @notice Pause flag for emergency situations
    bool public paused;

    // ==================== EVENTS ====================

    event AliasRegistered(
        bytes32 indexed identifierHash,
        address indexed wallet,
        uint256 timestamp
    );

    event AliasUpdated(
        bytes32 indexed identifierHash,
        address indexed oldWallet,
        address indexed newWallet,
        uint256 timestamp
    );

    event AliasRemoved(
        bytes32 indexed identifierHash,
        address indexed wallet,
        uint256 timestamp
    );

    event RegistryPaused(bool paused);

    // ==================== ERRORS ====================

    error RegistryPaused();
    error AliasAlreadyRegistered();
    error NotAliasOwner();
    error MaxAliasesReached();
    error AliasNotFound();
    error InvalidAddress();

    // ==================== CONSTRUCTOR ====================

    constructor() Ownable(msg.sender) {}
}
