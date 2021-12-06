// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../NodeOperatorRegistry.sol";

/// @title NodeOperatorRegistryV2
/// @dev this contract is used only for test the upgradibility
contract NodeOperatorRegistryV2 is NodeOperatorRegistry {
    uint256 x;

    function setX(uint256 _x) public {
        x = _x;
    }

    function getX() public view returns (uint256) {
        return x;
    }
}
