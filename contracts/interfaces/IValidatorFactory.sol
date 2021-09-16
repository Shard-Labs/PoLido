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
    function getValidatorsAddress() external view returns (Validator[] memory);

    /// @notice Get the stake manager address.
    /// @return Retrun the stake manager address.
    function getStakeManager() external view returns (address);

    /// @notice Get the polygon ERC20 token address.
    /// @return Retrun the polygon ERC20 token address.
    function getPolygonAddress() external view returns (address);

    /// @notice Get the polygon lido contract address.
    /// @return Retrun the polygon lido contract address.
    function getLidoAddress() external view returns (address);

    /// @notice Get the node operator contract address.
    /// @return Retrun the node operator contract address.
    function getOperatorAddress() external view returns (address);
}
