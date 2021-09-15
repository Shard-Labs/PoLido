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
    /// @notice Default validator contract implementation.
    address internal validatorImplementation;

    /// @notice validators contracts.
    Validator[] internal validators;

    /// @notice Check if the msg.sender has permission.
    /// @param _role role needed to call function.
    modifier userHasRole(bytes32 _role) {
        require(hasRole(_role, msg.sender), "Permission not found");
        _;
    }

    /// @notice Initialize the NodeOperator contract.
    function initialize(address _validatorImplementation) public initializer {
        validatorImplementation = _validatorImplementation;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Deploy a new validator contract
    /// @return return the address of the new validator contract deployed
    function create(address _polygonStakeManager) public returns (address) {
        address clone = ClonesUpgradeable.clone(validatorImplementation);
        Validator(clone).initialize(_polygonStakeManager);
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

    function updateValidatorImplementation(address _validatorImplementation)
        external
    {
        validatorImplementation = _validatorImplementation;
    }
}
