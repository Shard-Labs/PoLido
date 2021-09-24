// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "./ValidatorProxy.sol";
import "./storages/ValidatorFactoryStorage.sol";
import "./interfaces/INodeOperatorRegistry.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title ValidatorFactory
/// @author 2021 Shardlabs.
/// @notice ValidatorFactory is a Factory that allows to clone new validators from
/// a validator contract implementation
/// @dev ValidatorFactory is a Factory that allows to clone new validators from
/// a validator contract implementation
contract ValidatorFactory is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ValidatorFactoryStorage
{
    // ====================================================================
    // =========================== MODIFIERS ==============================
    // ====================================================================

    /// @notice Check if the msg.sender is the owner.
    modifier isOwner() {
        require(owner() == msg.sender, "Permission not found");
        _;
    }

    /// @notice Check if the operator contract is the msg.sender.
    modifier isOperator() {
        require(
            state.operator == msg.sender,
            "Caller is not the operator contract"
        );
        _;
    }

    // ====================================================================
    // =========================== FUNCTIONS ==============================
    // ====================================================================

    /// @notice Initialize the NodeOperator contract.
    function initialize(address _validatorImplementation) public initializer {
        __Ownable_init();
        state.validatorImplementation = _validatorImplementation;
    }

    /// @notice Deploy a new validator contract
    /// @return return the address of the new validator contract deployed
    function create() external isOperator returns (address) {
        require(state.operator != address(0), "Operator contract not set");

        // create a new validator proxy
        address proxy = address(
            new ValidatorProxy(owner(), state.validatorImplementation)
        );

        // set the operator address.
        (bool success, ) = proxy.call(
            abi.encodeWithSignature("setOperator(address)", state.operator)
        );
        require(success, "Set operator fails");

        validators.push(proxy);

        emit CreateValidator(proxy);
        return proxy;
    }

    /// @notice Remove a validator proxy from the list.
    function remove(address _validatorProxy) external isOperator {
        for (uint256 idx = 0; idx < validators.length; idx++) {
            if (_validatorProxy == validators[idx]) {
                validators[idx] = validators[validators.length-1];
                validators.pop();
            }
        }
    }

    /// @notice Get validators contracts.
    /// @return return a list of deployed validator contracts.
    function getValidators() public view returns (address[] memory) {
        return validators;
    }

    /// @notice Implement _authorizeUpgrade from UUPSUpgradeable contract to make the contract upgradable.
    /// @param newImplementation new contract implementation address.
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        isOwner
    {}

    /// @notice Allows to set the NodeOperatorRegistry contract.
    /// @dev Allows to set the NodeOperatorRegistry contract. this is done only one time.
    function setOperatorAddress(address _operator) public {
        if (state.operator == address(0)) {
            require(
                INodeOperatorRegistry(_operator).getValidatorFactory() ==
                    address(this),
                "Operator contract not valide"
            );
            state.operator = _operator;
            emit SetOperatorContract(_operator);
            return;
        }
        revert("Operator already set");
    }

    /// @notice Alows to get the operator contract.
    /// @dev Returns operator address.
    function getOperator() external view returns (address) {
        return state.operator;
    }

    /// @notice Contract version.
    /// @dev Returns contract version.
    function version() public view virtual returns (string memory) {
        return "1.0.0";
    }
}
