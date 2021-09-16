//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

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
    // ========================== Struct & enum ===========================
    // ====================================================================

    /// @notice The node operator states.
    enum NodeOperatorStatus {
        ACTIVE,
        UNACTIVE,
        STAKED,
        UNSTAKED
    }

    /// @notice The node operator struct
    /// @param state node operator status(ACTIVE, UNACTIVE, STAKED, UNSTAKED).
    /// @param name node operator name.
    /// @param rewardAddress Validator public key used for access control and receive rewards.
    /// @param validatorId validator id of this node operator on the polygon stake manager.
    /// @param signerPubkey public key used on heimdall.
    struct NodeOperator {
        NodeOperatorStatus state;
        string name;
        address rewardAddress;
        uint256 validatorId;
        bytes signerPubkey;
        address validatorContract;
    }

    /// @notice Node operator registry state.
    struct NodeOperatorRegistryState {
        uint256 totalNodeOpearator;
        uint256 totalActiveNodeOpearator;
        address validatorFactory;
        address polygonStakeManager;
    }

    // ====================================================================
    // =========================== Global Vars ============================
    // ====================================================================

    /// @dev Mapping of all node operators. Mapping is used to be able to extend the struct.
    mapping(uint256 => NodeOperator) internal operators;

    /// @dev This stores the operators ids.
    uint256[] internal operatorIds;

    /// @dev Mapping of all owners with node operator id. Mapping is used to be able to extend the struct.
    mapping(address => uint256) internal operatorOwners;

    /// @dev Global stats for node operator registry.
    NodeOperatorRegistryState public nodeOperatorRegistryStats;

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
        NodeOperatorStatus state
    );

    /// @dev A node operator was removed.
    /// @param id node operator id.
    event RemoveOperator(uint256 id);
}
