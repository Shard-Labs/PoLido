// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Polygon is ERC20 {
    constructor() ERC20("polygon", "POL") {
        _mint(address(this), 1000000 ether);
    }
}
