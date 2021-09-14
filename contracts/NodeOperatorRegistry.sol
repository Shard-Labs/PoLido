// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./NodeOperatorStorage.sol";
import "./INodeOperatorRegistry.sol";

contract NodeOperatorRegistry is
    INodeOperatorRegistry,
    NodeOperatorStorage,
    Initializable,
    AccessControl
{
    /// @notice The NodeOperatorRegistry contract allows managing a set of validators
    /// staked on polygon stake manager. Also, handle fees for reward distribution.

    bytes32 public constant ADD_OPERATOR_ROLE = keccak256("ADD_OPERATOR");

    /// @notice Check if the PublicKey is valid.
    /// @param _pubkey publick key used in the heimdall node.
    modifier isValidPublickey(bytes memory _pubkey) {
        require(_pubkey.length == 64, "Invalid Public Key");
        _;
    }

    /// @notice Initialize the NodeOperator contract.
    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADD_OPERATOR_ROLE, msg.sender);
    }

    /// @notice Add a new node operator to the system.
    /// @dev Add a new operator
    /// @param _name the node operator name.
    /// @param _rewardAddress public address used for ACL and receive rewards.
    /// @param _signerPubkey public key used on heimdall len 64 bytes.
    function addOperator(
        string memory _name,
        address _rewardAddress,
        bytes memory _signerPubkey
    ) public override isValidPublickey(_signerPubkey) {
        require(hasRole(ADD_OPERATOR_ROLE, msg.sender), "Permission not found");

        uint256 id = nodeOperatorRegistryStats.totalNodeOpearator + 1;

        operators[id] = NodeOperator({
            state: NodeOperatorStatus.ACTIVE,
            name: _name,
            rewardAddress: _rewardAddress,
            validatorId: 0,
            signerPubkey: _signerPubkey
        });

        nodeOperatorRegistryStats.totalNodeOpearator = id;
        nodeOperatorRegistryStats.totalActiveNodeOpearator++;

        operatorOwners[_rewardAddress] = id;

        emit NewOperator(id, _name, _signerPubkey, NodeOperatorStatus.ACTIVE);
    }
}
