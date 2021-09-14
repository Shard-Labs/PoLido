// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

interface INodeOperatorRegistry {
    /// @notice Add a new node operator to the system.
    /// @dev Add a new operator
    /// @param _name the node operator name.
    /// @param _rewardAddress public address used for ACL and receive rewards.
    /// @param _signerPubkey public key used on heimdall len 64 bytes.
    function addOperator(
        string memory _name,
        address _rewardAddress,
        bytes memory _signerPubkey
    ) external;
}
