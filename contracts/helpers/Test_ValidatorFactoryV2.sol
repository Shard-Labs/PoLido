// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../ValidatorFactory.sol";

contract ValidatorFactoryV2 is ValidatorFactory {
    function version() public pure override returns (string memory) {
        return "2.0.0";
    }
}
