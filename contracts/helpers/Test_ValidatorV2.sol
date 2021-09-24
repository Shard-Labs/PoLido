// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../Validator.sol";

/// @title ValidatorV2
/// @dev this contract is used only for test the upgradibility
contract ValidatorV2 is Validator {
    uint256 x;
    
    function version() public pure override returns (string memory) {
        return "2.0.0";
    }
}
