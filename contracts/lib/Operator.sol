//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

library Operator {
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
    struct NodeOperator{
        Operator.NodeOperatorStatus status;
        string name;
        address rewardAddress;
        uint256 validatorId;
        bytes signerPubkey;
        address validatorContract;
    }

    /// @notice Node operator registry state.
    struct NodeOperatorState {
        uint256 totalNodeOpearator;
        uint256 totalActiveNodeOpearator;
        address validatorFactory;
        address stakeManager;
        address polygonERC20;
        address lido;
    }

    /// @notice State struct
    struct ValidatorFactoryState {
        address validatorImplementation;
        address operator;
    }

    //// @notice State struct
    struct ValidatorState {
        address operator;
    }
}