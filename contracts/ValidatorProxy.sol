// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IValidatorProxy.sol";

/// @title ValidatorProxy
/// @author 2021 ShardLabs.
/// @notice The validator proxy contract is a proxy used as a validator owner in the
/// stakeManager. Each time a new operator is added a new validator proxy is created
/// by the validator factory and assigned to the operator. Later we can use it to
/// stake the validator on the stakeManager and manage it.
contract ValidatorProxy is IValidatorProxy, Proxy {
    /// @notice the validator implementation address.
    address public implementation;
    /// @notice the operator address.
    address public operator;
    /// @notice validator factory address.
    address public validatorFactory;

    constructor(
        address _newImplementation,
        address _operator,
        address _validatorFactory
    ) {
        implementation = _newImplementation;
        operator = _operator;
        validatorFactory = _validatorFactory;
    }

    /// @notice check if the msg.sender is the validator factory.
    modifier isValidatorFactory() {
        require(
            msg.sender == validatorFactory,
            "Caller is not the validator factory"
        );
        _;
    }

    /// @notice Allows the validatorFactory to set the validator implementation.
    /// @param _newValidatorImplementation set a new implementation
    function setValidatorImplementation(address _newValidatorImplementation)
        external
        override
        isValidatorFactory
    {
        implementation = _newValidatorImplementation;
    }

    /// @notice Allows the validatorFactory to set the operator implementation.
    /// @param _newOperator set a new operator.
    function setOperator(address _newOperator)
        external
        override
        isValidatorFactory
    {
        operator = _newOperator;
    }

    /// @notice Allows to get the contract implementation address.
    /// @return Returns the address of the implementation
    function _implementation()
        internal
        view
        virtual
        override
        returns (address)
    {
        return implementation;
    }
}
