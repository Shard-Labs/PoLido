// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./Validator.sol";
import "./storages/ValidatorFactoryStorage.sol";
import "./interfaces/INodeOperatorRegistry.sol";

/// @title ValidatorFactory
/// @author 2021 Shardlabs.
/// @notice ValidatorFactory is a Factory that allows to clone new validators from
/// a validator contract implementation
/// @dev ValidatorFactory is a Factory that allows to clone new validators from
/// a validator contract implementation
contract ValidatorFactory is
    ValidatorFactoryStorage,
    Initializable,
    AccessControl,
    UUPSUpgradeable
{
    // ====================================================================
    // =========================== MODIFIERS ==============================
    // ====================================================================

    /// @notice Check if the msg.sender has permission.
    /// @param _role role needed to call function.
    modifier userHasRole(bytes32 _role) {
        require(hasRole(_role, msg.sender), "Permission not found");
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
    function initialize()
        public
        initializer
    {   
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Deploy a new validator contract
    /// @return return the address of the new validator contract deployed
    function create() public isOperator returns (address) {
        require(state.operator != address(0), "Operator contract not set");
        Validator validator = new Validator();
        validator.initialize(state.operator);
        validators.push(Validator(validator));
        emit CreateValidator(address(validator));
        return address(validator);
    }

    /// @notice Get validators contracts.
    /// @return return a list of deployed validator contracts.
    function getValidators() public view returns (Validator[] memory) {
        return validators;
    }

    /// @notice Implement _authorizeUpgrade from UUPSUpgradeable contract to make the contract upgradable.
    /// @param newImplementation new contract implementation address.
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        userHasRole(DEFAULT_ADMIN_ROLE)
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
