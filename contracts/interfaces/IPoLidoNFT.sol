// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title PoLidoNFT interface.
/// @author 2021 ShardLabs
interface IPoLidoNFT is IERC721 {
    function mint(address _to) external returns (uint256);

    function burn(uint256 _tokenId) external;

    function isApprovedOrOwner(address _spender, uint256 _tokenId)
        external
        view
        returns (bool);

    function setLido(address _poLido) external;
}
