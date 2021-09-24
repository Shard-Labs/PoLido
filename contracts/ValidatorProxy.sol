// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ERC1967/ERC1967UpgradeUpgradeable.sol";

/// @title ValidatorProxy
/// @author 2021 Shardlabs.
contract ValidatorProxy is Proxy, ERC1967UpgradeUpgradeable {
    // ====================================================================
    // =========================== MODIFIERS ==============================
    // ====================================================================

    modifier isAdmin() {
        require(_getAdmin() == msg.sender, "You don't have permission");
        _;
    }

    // ====================================================================
    // =========================== FUNCTIONS ==============================
    // ====================================================================

    constructor(address _admin, address _newImplementation) {
        _changeAdmin(_admin);
        _upgradeTo(_newImplementation);
        __ERC1967Upgrade_init();
    }

    /// @notice Allows admin to upgrade the validator implementation
    /// @param _newImplementation set a new implementation
    function setImplementation(address _newImplementation) external isAdmin {
        _upgradeTo(_newImplementation);
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
        return _getImplementation();
    }
}
