//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

library Operator {
    /// @notice The node operator states.
    enum NodeOperatorStatus {
        ACTIVE,
        STAKED,
        UNSTAKED,
        EXIT
    }

    /// @notice The node operator struct
    /// @param state node operator status(ACTIVE, UNACTIVE, STAKED, UNSTAKED).
    /// @param name node operator name.
    /// @param rewardAddress Validator public key used for access control and receive rewards.
    /// @param validatorId validator id of this node operator on the polygon stake manager.
    /// @param signerPubkey public key used on heimdall.
    struct NodeOperator{
        Operator.NodeOperatorStatus status;
        string name;
        address rewardAddress;
        uint256 validatorId;
        bytes signerPubkey;
        address validatorContract;
        address validatorShare;
    }

    /// @notice Node operator registry state.
    struct NodeOperatorState {
        uint256 totalNodeOpearator;
        uint256 totalActiveNodeOpearator;
        uint256 totalStakedNodeOpearator;
        uint256 totalUnstakedNodeOpearator;
        uint256 totalExitNodeOpearator;
        address validatorFactory;
        address stakeManager;
        address polygonERC20;
        address lido;
    }

    /// @notice State struct
    struct ValidatorFactoryState {
        address operator;
    }

    //// @notice State struct
    struct ValidatorState {
        address operator;
    }
}