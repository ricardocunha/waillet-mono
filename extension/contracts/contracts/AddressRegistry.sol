// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title AddressRegistry
 * @notice On-chain registry mapping identifier hashes (emails, aliases) to wallet addresses
 * @dev Identifiers are hashed off-chain using keccak256 for privacy
 * @dev UUPS upgradeable - state variable order must never change, only append new variables
 */
contract AddressRegistry is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, UUPSUpgradeable {

    // ==================== STATE VARIABLES ====================
    // WARNING: Never reorder or remove existing state variables. Only append new ones at the end.

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

    error RegistryIsPaused();
    error AliasAlreadyRegistered();
    error NotAliasOwner();
    error MaxAliasesReached();
    error AliasNotFound();
    error InvalidAddress();

    // ==================== CONSTRUCTOR & INITIALIZER ====================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract (replaces constructor for upgradeable pattern)
    /// @dev Can only be called once via the proxy
    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    // ==================== EXTERNAL FUNCTIONS ====================

    /**
     * @notice Register a new identifier hash to caller's address
     * @param identifierHash keccak256 hash of the identifier (email or alias)
     * @dev Identifier should be normalized (lowercase, trimmed) before hashing off-chain
     */
    function register(bytes32 identifierHash) external nonReentrant {
        if (paused) revert RegistryIsPaused();
        if (registry[identifierHash] != address(0)) revert AliasAlreadyRegistered();
        if (userAliases[msg.sender].length >= MAX_ALIASES_PER_ADDRESS) revert MaxAliasesReached();

        registry[identifierHash] = msg.sender;
        aliasIndex[identifierHash] = userAliases[msg.sender].length;
        userAliases[msg.sender].push(identifierHash);

        emit AliasRegistered(identifierHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Update an existing registration to a new address
     * @param identifierHash The identifier hash to update
     * @param newAddress The new wallet address to register
     * @dev Only the current owner of the alias can update it
     */
    function updateRegistration(bytes32 identifierHash, address newAddress) external nonReentrant {
        if (paused) revert RegistryIsPaused();
        if (registry[identifierHash] != msg.sender) revert NotAliasOwner();
        if (newAddress == address(0)) revert InvalidAddress();
        if (newAddress == msg.sender) return; // No change needed

        // Check new address has room for aliases
        if (userAliases[newAddress].length >= MAX_ALIASES_PER_ADDRESS) revert MaxAliasesReached();

        address oldAddress = msg.sender;

        // Remove from old address's alias list
        _removeFromUserAliases(oldAddress, identifierHash);

        // Add to new address's alias list
        registry[identifierHash] = newAddress;
        aliasIndex[identifierHash] = userAliases[newAddress].length;
        userAliases[newAddress].push(identifierHash);

        emit AliasUpdated(identifierHash, oldAddress, newAddress, block.timestamp);
    }

    /**
     * @notice Remove a registration
     * @param identifierHash The identifier hash to remove
     * @dev Only the current owner can remove their alias
     */
    function removeRegistration(bytes32 identifierHash) external nonReentrant {
        if (registry[identifierHash] != msg.sender) revert NotAliasOwner();

        _removeFromUserAliases(msg.sender, identifierHash);
        delete registry[identifierHash];

        emit AliasRemoved(identifierHash, msg.sender, block.timestamp);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Resolve an identifier hash to its registered address
     * @param identifierHash keccak256 hash of the identifier
     * @return The registered wallet address, or address(0) if not found
     */
    function resolve(bytes32 identifierHash) external view returns (address) {
        return registry[identifierHash];
    }

    /**
     * @notice Check if an identifier hash is already registered
     * @param identifierHash The identifier hash to check
     * @return True if registered, false otherwise
     */
    function isRegistered(bytes32 identifierHash) external view returns (bool) {
        return registry[identifierHash] != address(0);
    }

    /**
     * @notice Get all identifier hashes registered to an address
     * @param wallet The wallet address to query
     * @return Array of identifier hashes
     */
    function getAliases(address wallet) external view returns (bytes32[] memory) {
        return userAliases[wallet];
    }

    /**
     * @notice Get the number of aliases registered to an address
     * @param wallet The wallet address to query
     * @return Number of registered aliases
     */
    function getAliasCount(address wallet) external view returns (uint256) {
        return userAliases[wallet].length;
    }

    // ==================== ADMIN FUNCTIONS ====================

    /**
     * @notice Pause or unpause the registry
     * @param _paused New pause state
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit RegistryPaused(_paused);
    }

    // ==================== UUPS UPGRADE AUTHORIZATION ====================

    /// @notice Restricts upgrades to the contract owner
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ==================== INTERNAL FUNCTIONS ====================

    /**
     * @dev Remove an identifier hash from a user's alias list
     * Uses swap-and-pop for gas efficiency
     */
    function _removeFromUserAliases(address user, bytes32 identifierHash) internal {
        bytes32[] storage aliases = userAliases[user];
        uint256 index = aliasIndex[identifierHash];
        uint256 lastIndex = aliases.length - 1;

        if (index != lastIndex) {
            bytes32 lastHash = aliases[lastIndex];
            aliases[index] = lastHash;
            aliasIndex[lastHash] = index;
        }

        aliases.pop();
        delete aliasIndex[identifierHash];
    }
}
