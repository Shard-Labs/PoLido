// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../ValidatorFactory.sol";

/// @title ValidatorFactoryV2
/// @dev this contract is used only for test the upgradibility
contract ValidatorFactoryV2 is ValidatorFactory {
    uint256 x;
    
    function version() public pure override returns (string memory) {
        return "2.0.0";
    }
}
