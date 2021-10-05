// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ValidatorProxy
/// @author 2021 Shardlabs.
contract ValidatorProxy is Ownable, Proxy {
    address private implementation;
    address private operator;
    
    // ====================================================================
    // =========================== FUNCTIONS ==============================
    // ====================================================================

    constructor(address _admin, address _newImplementation, address _operator) {
        implementation = _newImplementation;
        operator = _operator;
        transferOwnership(_admin);
    }

    /// @notice Allows admin to upgrade the validator implementation
    /// @param _newImplementation set a new implementation
    function setImplementation(address _newImplementation) external onlyOwner() {
        implementation = _newImplementation;
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

    /// @notice Allows admin to set the operator address
    /// @param _newoperator set a new operator.
    function setOperator(address _newoperator) external onlyOwner() {
        operator = _newoperator;
    }
}
