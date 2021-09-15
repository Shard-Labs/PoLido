// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./NodeOperatorStorage.sol";
import "./INodeOperatorRegistry.sol";
import "./IValidatorFactory.sol";

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
    function initialize(address _validatorFactory, address _polygonStakeManager)
        public
        initializer
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADD_OPERATOR_ROLE, msg.sender);
        _setupRole(REMOVE_OPERATOR_ROLE, msg.sender);
        nodeOperatorRegistryStats.validatorFactory = _validatorFactory;
        nodeOperatorRegistryStats.polygonStakeManager = _polygonStakeManager;
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

        // deploy validator contract.
        address validatorContract = IValidatorFactory(
            nodeOperatorRegistryStats.validatorFactory
        ).create(nodeOperatorRegistryStats.polygonStakeManager);

        // add the validator.
        operators[id] = NodeOperator({
            state: NodeOperatorStatus.ACTIVE,
            name: _name,
            rewardAddress: _rewardAddress,
            validatorId: 0,
            signerPubkey: _signerPubkey,
            validatorContract: validatorContract
        });

        // update global state.
        operatorIds.push(id);
        nodeOperatorRegistryStats.totalNodeOpearator++;
        nodeOperatorRegistryStats.totalActiveNodeOpearator++;

        // map user _rewardAddress with the validator id.
        operatorOwners[_rewardAddress] = id;

        // emit NewOperator event.
        emit NewOperator(
            id,
            _name,
            _signerPubkey,
            NodeOperatorStatus.ACTIVE
        );
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

        // update the operatorIds array by removing the actual deleted operator
        for (uint256 i = 0; i < operatorIds.length - 1; i++) {
            if (_id == operatorIds[i]) {
                operatorIds[i] = operatorIds[operatorIds.length - 1];
                break;
            }
        }
        delete operatorIds[operatorIds.length - 1];
        operatorIds.pop();

        // delete operator and owner mappings from operators and operatorOwners;
        delete operatorOwners[op.rewardAddress];
        delete operators[_id];

        emit RemoveOperator(_id);
    }

    /// @notice Implement _authorizeUpgrade from UUPSUpgradeable contract to make the contract upgradable.
    /// @param newImplementation new contract implementation address.
    function _authorizeUpgrade(address newImplementation) internal override {}

    /// @notice Return the actual contract version.
    function version() external view virtual override returns (string memory) {
        return "1.0.0";
    }

    /// @notice Get the all operator ids availablein the system.
    /// @return Return a list of operator Ids.
    function getOperators() external view override returns (uint256[] memory) {
        return operatorIds;
    }
}
