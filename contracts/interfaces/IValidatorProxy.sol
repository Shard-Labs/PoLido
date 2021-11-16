// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

interface IValidatorProxy {
    function setValidatorImplementation(address _newImplementation) external;

    function setOperator(address _newOperator) external;
}
