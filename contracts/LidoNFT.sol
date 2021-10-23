// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract LidoNFT is
    OwnableUpgradeable,
    ERC721EnumerableUpgradeable,
    PausableUpgradeable
{
    // lido contract
    address lido;

    // check if lido contract is the caller
    modifier isLido() {
        require(msg.sender == lido, "Caller is not lido contract");
        _;
    }

    function initialize(string memory _name, string memory _symbol)
        public
        initializer
    {
        __ERC721_init(_name, _symbol);
        __ERC721Enumerable_init();
    }

    /// @notice Mint token.
    function mint(address _to, uint256 _tokenId) public isLido {
        _mint(_to, _tokenId);
    }

    /// @notice Burn token.
    function burn(uint256 _tokenId) public isLido {
        _burn(_tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId);

        require(!paused(), "ERC721Pausable: token transfer while paused");
    }

    /// @notice Set LidoMatic contract
    function setLido(address _lido) public onlyOwner {
        lido = _lido;
    }
}
