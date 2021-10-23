// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

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
        uint256 slashed;
        uint256 statusTimestamp;
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
