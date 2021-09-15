// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "hardhat/console.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract Validator is Initializable {
    string internal name;

    /// @notice Initialize the NodeOperator contract.
    function initialize(address _polygonStakeManager) public initializer {}
}
