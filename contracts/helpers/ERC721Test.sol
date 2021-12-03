// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract ERC721Test is ERC721Upgradeable {
    function mint(address _user, uint256 tokenId) public {
        _mint(_user, tokenId);
    }
}
