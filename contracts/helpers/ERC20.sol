// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Polygon is ERC20 {
    constructor() ERC20("polygon", "POL") { 
    }

    function mint(uint256 _amount) external {
        _mint(msg.sender, _amount);
    }
}
