// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./NodeOperatorStorage.sol";
import "./INodeOperatorRegistry.sol";

contract NodeOperatorRegistry is
    INodeOperatorRegistry,
    NodeOperatorStorage,
    Initializable,
    AccessControl,
    UUPSUpgradeable
{
    bytes32 public constant ADD_OPERATOR_ROLE = keccak256("ADD_OPERATOR");
    bytes32 public constant REMOVE_OPERATOR_ROLE = keccak256("REMOVE_OPERATOR");

    /// @notice Check if the PublicKey is valid.
    /// @param _pubkey publick key used in the heimdall node.
    modifier isValidPublickey(bytes memory _pubkey) {
        require(_pubkey.length == 64, "Invalid Public Key");
        _;
    }

    /// @notice Check if the msg.sender has permission.
    /// @param _role role needed to call function.
    modifier userHasRole(bytes32 _role) {
        require(hasRole(_role, msg.sender), "Permission not found");
        _;
    }

    /// @notice Initialize the NodeOperator contract.
    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADD_OPERATOR_ROLE, msg.sender);
        _setupRole(REMOVE_OPERATOR_ROLE, msg.sender);
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
    )
        public
        override
        isValidPublickey(_signerPubkey)
        userHasRole(ADD_OPERATOR_ROLE)
    {
        uint256 id = nodeOperatorRegistryStats.totalNodeOpearator + 1;

        operators[id] = NodeOperator({
            state: NodeOperatorStatus.ACTIVE,
            name: _name,
            rewardAddress: _rewardAddress,
            validatorId: 0,
            signerPubkey: _signerPubkey
        });

        nodeOperatorRegistryStats.totalNodeOpearator++;
        nodeOperatorRegistryStats.totalActiveNodeOpearator++;

        operatorOwners[_rewardAddress] = id;

        emit NewOperator(id, _name, _signerPubkey, NodeOperatorStatus.ACTIVE);
    }

    function removeOperator(uint256 _id)
        public
        override
        userHasRole(REMOVE_OPERATOR_ROLE)
    {
        NodeOperator storage op = operators[_id];
        // Todo: un comment this when the operator switch state to unactive
        // require(
        //     op.state == NodeOperatorStatus.UNACTIVE,
        //     "Node Operator state not unactive"
        // );

        nodeOperatorRegistryStats.totalNodeOpearator--;
        nodeOperatorRegistryStats.totalActiveNodeOpearator--;

        delete operatorOwners[op.rewardAddress];
        delete operators[_id];

        emit RemoveOperator(_id);
    }

    function _authorizeUpgrade(address newImplementation) internal override {}

    function version() public pure returns (string memory) {
        return "1.0.0";
    }
}
