// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

library Operator {
    /// @notice OperatorShare struct
    struct OperatorShare {
        uint256 operatorId;
        address validatorShare;
        uint256 slashed;
        uint256 statusTimestamp;
        bool isTrusted;
    }
}
