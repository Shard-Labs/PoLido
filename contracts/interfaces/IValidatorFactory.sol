// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../Validator.sol";


/// @title Validator Factory interface.
/// @author 2021 Shardlabs
/// @notice Validator Factory interface.
interface IValidatorFactory {
    /// @notice Deploy a new validator contract.
    /// @dev The deployed validator contract use openzzepline clone proxy.
    /// @return return the address of the deployed contract
    function create() external returns (address);

    /// @notice Get the deployed validator contracts.
    /// @return returns a list of all deployed validator contracts.
    function getValidatorAddress() external view returns (Validator[] memory);

    /// @notice Get the stake manager address.
    /// @return Retrun the stake manager address.
    function getStakeManager() external view returns (address);
}