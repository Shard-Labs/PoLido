// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./ValidatorProxy.sol";
import "./interfaces/INodeOperatorRegistry.sol";
import "./interfaces/IValidatorProxy.sol";
import "./interfaces/IValidatorFactory.sol";

/// @title ValidatorFactory
/// @author 2021 ShardLabs.
/// @notice The validator Factory is the contract that allows creating new validatorProxies
// and managing them to update the operator and the validator implementation addresses.
contract ValidatorFactory is IValidatorFactory, OwnableUpgradeable {
    /// @notice the list of all the validatorProxies.
    address[] public validators;
    /// @notice the contract version.
    string public version;
    /// @notice the node operator address.
    address public operatorRegistry;
    /// @notice the validator implementation address.
    address public validatorImplementation;

    /// @notice Check if the operator contract is the msg.sender.
    modifier isOperatorRegistry() {
        require(operatorRegistry == msg.sender, "Caller is not the operator contract");
        _;
    }

    /// @notice Initialize the NodeOperator contract.
    function initialize(
        address _validatorImplementation,
        address _nodeOperatorRegistry
    ) external initializer {
        __Ownable_init();

        validatorImplementation = _validatorImplementation;
        setOperator(_nodeOperatorRegistry);
    }

    /// @notice Deploy a new validator contract
    /// @return return the address of the new validator contract deployed
    function create() external override isOperatorRegistry returns (address) {
        require(operatorRegistry != address(0), "Operator contract not set");

        // create a new validator proxy
        address proxy = address(
            new ValidatorProxy(validatorImplementation, operatorRegistry, address(this))
        );

        validators.push(proxy);

        return proxy;
    }

    /// @notice Remove a validator proxy from the list.
    /// @param _validatorProxy validator proxy address.
    function remove(address _validatorProxy) external override isOperatorRegistry {
        require(
            _validatorProxy != address(0),
            "Could not remove a zero address"
        );

        uint256 length = validators.length;
        for (uint256 idx = 0; idx < length; idx++) {
            if (_validatorProxy == validators[idx]) {
                validators[idx] = validators[length - 1];
                break;
            }
        }
        validators.pop();
    }

    /// @notice Allows to set the NodeOperatorRegistry address and update all the validatorProxies
    /// with the new address.
    /// @param _newOperator new operator address.
    function setOperator(address _newOperator) public override onlyOwner {
        operatorRegistry = _newOperator;

        uint256 length = validators.length;
        for (uint256 idx = 0; idx < length; idx++) {
            IValidatorProxy(validators[idx]).setOperator(_newOperator);
        }

        emit SetOperatorContract(_newOperator);
    }

    /// @notice Allows to set the validator implementation address and update all the
    /// validatorProxies with the new address.
    /// @param _validatorImplementation new validator implementation address.
    function setValidatorImplementation(address _validatorImplementation)
        external
        override
        onlyOwner
    {
        validatorImplementation = _validatorImplementation;

        uint256 length = validators.length;
        for (uint256 idx = 0; idx < length; idx++) {
            IValidatorProxy(validators[idx]).setValidatorImplementation(
                _validatorImplementation
            );
        }
        emit SetValidatorImplementation(_validatorImplementation);
    }

    /// @notice set contract version.
    function setVersion(string memory _version) external onlyOwner {
        version = _version;
    }

    /// @notice Get a list of all validatorProxy contracts deployed.
    /// @return return a list of deployed validatorProxy contracts.
    function getValidators() external view returns (address[] memory) {
        return validators;
    }

    event SetOperatorContract(address operator);
    event SetValidatorImplementation(address validatorImplementation);
}
