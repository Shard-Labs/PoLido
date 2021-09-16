// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
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
    function initialize(
        address _lido,
        address _validatorImplementation,
        address _stakeManager,
        address _polygonERC20
    ) public initializer {
        state.lido = _lido;
        state.validatorImplementation = _validatorImplementation;
        state.stakeManager = _stakeManager;
        state.polygonERC20 = _polygonERC20;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Deploy a new validator contract
    /// @return return the address of the new validator contract deployed
    function create() public isOperator returns (address) {
        address clone = ClonesUpgradeable.clone(state.validatorImplementation);
        Validator(clone).initialize(state.stakeManager);
        validators.push(Validator(clone));
        emit CreateValidator(clone);
        return clone;
    }

    /// @notice set the validator contract implementation
    /// @param _validatorImplementation new validator contract implementtation address.
    function setValidatorImplementation(address _validatorImplementation)
        external
        isOperator
    {
        state.validatorImplementation = _validatorImplementation;
        emit SetValidatorImplementation(_validatorImplementation);
    }

    /// @notice Get validators contracts.
    /// @return return a list of deployed validator contracts.
    function getValidatorsAddress() public view returns (Validator[] memory) {
        return validators;
    }

    /// @notice Return the Polygon stake manager contract address.
    /// @return return stake manager address
    function getStakeManager() external view returns (address) {
        return state.stakeManager;
    }

    /// @notice Return the Polygon ERC20 token address.
    /// @return return Polygon ERC20 token address
    function getPolygonAddress() external view returns (address) {
        return state.polygonERC20;
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
                INodeOperatorRegistry(_operator).getValidatorFactoryAddress() ==
                    address(this),
                "Operator contract not valide"
            );
            state.operator = _operator;
            emit SetOperatorContract(_operator);
        }
    }

    /// @notice Contract version.
    /// @dev Returns contract version.
    function version() public view virtual returns (string memory) {
        return "1.0.0";
    }
}
