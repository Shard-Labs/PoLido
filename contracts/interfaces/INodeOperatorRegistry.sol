// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../storages/NodeOperatorStorage.sol";
import "../lib/Operator.sol";

/// @title Node operator registry interface
/// @author 2021 Shardlabs
/// @notice Node operator registry interface
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

    /// @notice Remove a node operator from the system.
    /// @dev Remove a node operator from the system using the _id.
    /// @param _id node operator id.
    function removeOperator(uint256 _id) external;

    /// @notice The version of the actual contract.
    /// @return return the contract version.
    function version() external returns (string memory);

    /// @notice Get the all operator ids availablein the system.
    /// @return Return a list of operator Ids.
    function getOperators() external returns (uint256[] memory);

    function getValidatorFactory() external view returns (address);

    function getStakeManager() external view returns (address);

    function getPolygonERC20() external view returns (address);

    function getLido() external view returns (address);

    function getNodeOperator(uint256 _id, bool _full)
        external
        view
        returns (Operator.NodeOperator memory);

    function withdrawRewards()
        external
        returns (uint256[] memory, address[] memory);
}
