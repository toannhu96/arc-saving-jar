// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SavingsJar
/// @notice Owner-operated, time-locked savings jars for a constructor-selected USDC token.
/// @dev Jar IDs start at zero. Amounts are in token base units (6 decimals for Arc USDC).
///      Jars remain reusable after unlocking; subsequent deposits are immediately withdrawable.
///      There are no administrative privileges or recovery functions.
contract SavingsJar is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The token accepted by every jar.
    IERC20 public immutable usdc;

    /// @notice A user's named, time-locked balance.
    struct Jar {
        address owner;
        uint64 unlockTime;
        uint256 balance;
        string name;
    }

    /// @notice The number of jars created, also the next jar ID.
    uint256 public jarCount;
    mapping(uint256 => Jar) internal jars;
    mapping(address => uint256[]) internal jarIdsByOwner;

    /// @notice The token address cannot be zero.
    error ZeroAddress();
    /// @notice A jar name must contain between 1 and 64 bytes.
    error InvalidName();
    /// @notice The requested unlock time must be strictly in the future.
    error UnlockTimeNotInFuture();
    /// @notice The requested jar does not exist.
    error JarNotFound();
    /// @notice Only the jar owner may change its balance.
    error NotJarOwner();
    /// @notice The requested or received amount must be positive.
    error InvalidAmount();
    /// @notice The withdrawal exceeds the jar's balance.
    error InsufficientBalance();
    /// @notice Withdrawals are unavailable before the specified unlock time.
    error StillLocked(uint64 unlockTime);

    /// @notice Emitted when a jar is created.
    event JarCreated(uint256 indexed jarId, address indexed owner, string name, uint64 unlockTime);
    /// @notice Emitted with the actual amount received and the resulting jar balance.
    event Deposited(uint256 indexed jarId, address indexed owner, uint256 amount, uint256 newBalance);
    /// @notice Emitted with the amount withdrawn and the resulting jar balance.
    event Withdrawn(uint256 indexed jarId, address indexed owner, uint256 amount, uint256 newBalance);

    /// @param usdc_ The USDC ERC-20 contract; its address is not hardcoded.
    constructor(IERC20 usdc_) {
        if (address(usdc_) == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    /// @notice Create a jar owned by the caller with an immutable unlock time.
    /// @param name A name containing between 1 and 64 bytes.
    /// @param unlockTime A Unix timestamp strictly greater than the current timestamp.
    /// @return jarId The newly allocated, zero-based jar ID.
    function createJar(string calldata name, uint64 unlockTime) external returns (uint256 jarId) {
        uint256 nameLength = bytes(name).length;
        if (nameLength == 0 || nameLength > 64) revert InvalidName();
        if (uint256(unlockTime) <= block.timestamp) revert UnlockTimeNotInFuture();

        jarId = jarCount++;
        jars[jarId] = Jar({owner: msg.sender, unlockTime: unlockTime, balance: 0, name: name});
        jarIdsByOwner[msg.sender].push(jarId);

        emit JarCreated(jarId, msg.sender, name, unlockTime);
    }

    /// @notice Deposit tokens into a jar owned by the caller, even after unlocking.
    /// @dev Requires prior token approval. Only the actual received balance delta is credited.
    ///      Checks precede interactions. Exact credit necessarily follows the transfer;
    ///      nonReentrant protects this balance-measurement/accounting sequence.
    /// @param jarId The jar to credit.
    /// @param amount The positive amount to request from the caller, in token base units.
    function deposit(uint256 jarId, uint256 amount) external nonReentrant {
        Jar storage jar = _ownedJar(jarId);
        if (amount == 0) revert InvalidAmount();

        uint256 balanceBefore = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = usdc.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert InvalidAmount();

        jar.balance += received;
        emit Deposited(jarId, msg.sender, received, jar.balance);
    }

    /// @notice Withdraw a positive amount from an unlocked jar owned by the caller.
    /// @param jarId The jar to debit.
    /// @param amount The amount to withdraw, in token base units.
    function withdraw(uint256 jarId, uint256 amount) external nonReentrant {
        Jar storage jar = _ownedJar(jarId);
        _withdraw(jarId, jar, amount);
    }

    /// @notice Withdraw the full positive balance from an unlocked jar owned by the caller.
    /// @param jarId The jar to empty. An empty jar reverts with InvalidAmount.
    function withdrawAll(uint256 jarId) external nonReentrant {
        Jar storage jar = _ownedJar(jarId);
        _withdraw(jarId, jar, jar.balance);
    }

    /// @notice Read an existing jar and its current unlock status.
    /// @param jarId The jar to read.
    /// @return owner The jar owner.
    /// @return name The jar name.
    /// @return unlockTime The Unix timestamp at which withdrawals become available.
    /// @return balance The accounted token balance in base units.
    /// @return unlocked Whether withdrawals are currently permitted.
    function getJar(uint256 jarId)
        external
        view
        returns (address owner, string memory name, uint64 unlockTime, uint256 balance, bool unlocked)
    {
        Jar storage jar = _getJar(jarId);
        return (jar.owner, jar.name, jar.unlockTime, jar.balance, block.timestamp >= jar.unlockTime);
    }

    /// @notice Return all zero-based jar IDs belonging to an owner, in creation order.
    /// @param owner The address whose jars are requested.
    /// @return The owner's jar IDs, or an empty array if none exist.
    function getJarIdsByOwner(address owner) external view returns (uint256[] memory) {
        return jarIdsByOwner[owner];
    }

    /// @notice Return the number of seconds until a jar unlocks, or zero if unlocked.
    /// @param jarId The existing jar to inspect.
    /// @return The remaining lock duration in seconds.
    function timeRemaining(uint256 jarId) external view returns (uint256) {
        Jar storage jar = _getJar(jarId);
        if (block.timestamp >= jar.unlockTime) return 0;
        return uint256(jar.unlockTime) - block.timestamp;
    }

    /// @dev Resolve an existing jar; the zero owner address is the existence sentinel.
    function _getJar(uint256 jarId) internal view returns (Jar storage jar) {
        jar = jars[jarId];
        if (jar.owner == address(0)) revert JarNotFound();
    }

    /// @dev Resolve a jar and require the caller to own it.
    function _ownedJar(uint256 jarId) internal view returns (Jar storage jar) {
        jar = _getJar(jarId);
        if (jar.owner != msg.sender) revert NotJarOwner();
    }

    /// @dev Shared withdrawal logic; external callers hold the reentrancy guard.
    ///      Checks and accounting effects precede the outbound token interaction.
    function _withdraw(uint256 jarId, Jar storage jar, uint256 amount) internal {
        if (block.timestamp < jar.unlockTime) revert StillLocked(jar.unlockTime);
        if (amount == 0) revert InvalidAmount();
        if (amount > jar.balance) revert InsufficientBalance();

        jar.balance -= amount;
        usdc.safeTransfer(jar.owner, amount);

        emit Withdrawn(jarId, jar.owner, amount, jar.balance);
    }
}
