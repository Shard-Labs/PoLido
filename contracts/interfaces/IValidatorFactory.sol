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

    /// @notice Remove a validator proxy from the validators.
    /// @dev This function is called by the operator.
    function remove(address _validatorProxy) external;

    /// @notice Get the deployed validator contracts.
    /// @return returns a list of all deployed validator contracts.
    function getValidators() external view returns (Validator[] memory);

    /// @notice Get the node operator contract address.
    /// @return Retrun the node operator contract address.
    function getOperatorAddress() external view returns (address);

    /// @notice Set the node operator contract address.
    function setOperatorAddress(address _operator) external;
}
