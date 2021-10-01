//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

library Operator {
    /// @notice The node operator states.
    enum NodeOperatorStatus {
        NONE,
        ACTIVE,
        STAKED,
        UNSTAKED,
        CLAIMED,
        EXIT
    }

    /// @notice The node operator struct
    /// @param state node operator status(ACTIVE, UNACTIVE, STAKED, UNSTAKED).
    /// @param name node operator name.
    /// @param rewardAddress Validator public key used for access control and receive rewards.
    /// @param validatorId validator id of this node operator on the polygon stake manager.
    /// @param signerPubkey public key used on heimdall.
    struct NodeOperator {
        Operator.NodeOperatorStatus status;
        string name;
        address rewardAddress;
        uint256 validatorId;
        bytes signerPubkey;
        address validatorShare;
        address validatorContract;
        uint256 commissionRate;
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
        uint256 maxAmountStake;
        uint256 minAmountStake;
        uint256 maxHeimdallFees;
        uint256 minHeimdallFees;
        uint256 commissionRate;
        bool restake;
        bool unjail;
    }

    /// @notice State struct
    struct ValidatorFactoryState {
        address operator;
        address validatorImplementation;
    }

    /// @notice State struct
    struct ValidatorState {
        address owner;
        address implementation;
        address operator;
    }

    /// @notice OperatorShare struct
    struct OperatorShare {
        uint256 operatorId;
        address validatorShare;
    }
}
