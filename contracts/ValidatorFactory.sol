// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Validator.sol";

contract ValidatorFactory is Initializable, AccessControl, UUPSUpgradeable {
    /// @notice State struct
    struct State {
        address stakeManager;
        address validatorImplementation;
    }

    /// @notice Global state
    State internal state;

    /// @notice validators contracts.
    Validator[] internal validators;

    /// @notice Check if the msg.sender has permission.
    /// @param _role role needed to call function.
    modifier userHasRole(bytes32 _role) {
        require(hasRole(_role, msg.sender), "Permission not found");
        _;
    }

    /// @notice Initialize the NodeOperator contract.
    function initialize(address _validatorImplementation, address _stakeManager)
        public
        initializer
    {
        state.validatorImplementation = _validatorImplementation;
        state.stakeManager = _stakeManager;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Deploy a new validator contract
    /// @return return the address of the new validator contract deployed
    function create() public returns (address) {
        address clone = ClonesUpgradeable.clone(state.validatorImplementation);
        Validator(clone).initialize(state.stakeManager);
        validators.push(Validator(clone));
        return clone;
    }

    /// @notice Get validators contracts.
    /// @return return a list of deployed validator contracts.
    function getValidatorAddress() public view returns (Validator[] memory) {
        return validators;
    }

    /// @notice Implement _authorizeUpgrade from UUPSUpgradeable contract to make the contract upgradable.
    /// @param newImplementation new contract implementation address.
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        userHasRole(DEFAULT_ADMIN_ROLE)
    {}

    /// @notice set the validator contract implementation
    /// @param _validatorImplementation new validator contract implementtation address.
    function setValidatorImplementation(address _validatorImplementation)
        external
    {
        state.validatorImplementation = _validatorImplementation;
    }

    /// @notice Return the Polygon stake manager contract address.
    /// @return return stake manager address
    function getStakeManager() external view returns (address) {
        return state.stakeManager;
    }
}
