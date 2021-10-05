// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../Validator.sol";

/// @title ValidatorV2
/// @dev this contract is used only for test the upgradibility
contract ValidatorV2 is Validator {
    uint256 x;

    function version() public pure override returns (string memory) {
        return "2.0.0";
    }

    function setX(uint256 _x) public {
        x = _x;
    }

    function getX() public view returns (uint256) {
        return x;
    }
}
