// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./Validator.sol";

interface IValidatorFactory {
    function create(address polygonStakeManager) external returns (address);

    function getValidatorAddress() external view returns (Validator[] memory);
}