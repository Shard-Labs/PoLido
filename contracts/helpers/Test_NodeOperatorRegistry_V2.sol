// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../NodeOperatorRegistry.sol";

contract NodeOperatorRegistryV2 is NodeOperatorRegistry {
    uint256 x;
    
    function version() public override pure returns (string memory) {
        return "2.0.0";
    }
}
