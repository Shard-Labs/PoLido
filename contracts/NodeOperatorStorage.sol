//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

contract NodeOperatorStorage {
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
    }

    struct NodeOperatorRegistryStats {
        uint256 totalNodeOpearator;
        uint256 totalActiveNodeOpearator;
    }

    /// @dev Mapping of all node operators. Mapping is used to be able to extend the struct.
    mapping(uint256 => NodeOperator) internal operators;

    /// @dev Mapping of all owners with node operator id. Mapping is used to be able to extend the struct.
    mapping(address => uint256) internal operatorOwners;

    /// @dev Global stats for node operator registry.
    NodeOperatorRegistryStats public nodeOperatorRegistryStats;

    /// @dev Total number of operators.
    bytes32 internal constant TOTAL_OPERATORS_COUNT_POSITION =
        keccak256("shardlabs.polido.totalOperatorsCount");

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
