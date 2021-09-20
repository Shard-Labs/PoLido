//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "../lib/Operator.sol";

/// @title NodeOperatorStatus.
/// @author 2021 Shardlabs.
/// @notice Node operator registry storage.
contract NodeOperatorStorage {
    // ====================================================================
    // =========================== ACL ROLES ==============================
    // ====================================================================

    bytes32 public constant ADD_OPERATOR_ROLE = keccak256("ADD_OPERATOR");
    bytes32 public constant REMOVE_OPERATOR_ROLE = keccak256("REMOVE_OPERATOR");

    // ====================================================================
    // =========================== Global Vars ============================
    // ====================================================================

    /// @dev Mapping of all node operators. Mapping is used to be able to extend the struct.
    mapping(uint256 => Operator.NodeOperator) internal operators;

    /// @dev This stores the operators ids.
    uint256[] internal operatorIds;

    /// @dev Mapping of all owners with node operator id. Mapping is used to be able to extend the struct.
    mapping(address => uint256) internal operatorOwners;

    /// @dev Global stats for node operator registry.
    Operator.NodeOperatorState internal state;

    // ====================================================================
    // ============================== EVENTS ==============================
    // ====================================================================

    /// @dev A new node operator was added.
    /// @param id node operator id.
    /// @param name node operator name.
    /// @param signerPubkey public key used on heimdall.
    /// @param state node operator status.
    event NewOperator(
        uint256 id,
        string name,
        bytes signerPubkey,
        Operator.NodeOperatorStatus state
    );

    /// @dev A node operator was removed.
    /// @param id node operator id.
    event RemoveOperator(uint256 id);

    /// @dev A node operator was staked.
    /// @param id node operator id.
    event StakeOperator(uint256 id);

    /// @dev A node operator was unstaked.
    /// @param id node operator id.
    event UnstakeOperator(uint256 id);

    /// @dev TopUp heimadall fees.
    /// @param id node operator id.
    /// @param amount amount.
    event TopUpHeimdallFees(uint256 id, uint256 amount);

    /// @dev Withdraw rewards.
    event WithdrawRewards();

    /// @dev approve erc20 to a validator contract.
    event ApproveToValidator(uint256 id, uint256 amount);
}
