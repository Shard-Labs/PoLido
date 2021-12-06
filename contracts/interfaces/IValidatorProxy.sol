// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

interface IValidatorProxy {
    /// @notice Allows to set a new validator implementation.
    /// @param _newImplementation new address.
    function setValidatorImplementation(address _newImplementation) external;

    /// @notice Allows to set a new operator.
    /// @param _newOperator new address.
    function setOperator(address _newOperator) external;
}
