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
    address public lido;
    uint256 public tokenIdIndex;

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
    function mint(address _to) external isLido returns (uint256) {
        tokenIdIndex++;
        _mint(_to, tokenIdIndex);
        return tokenIdIndex;
    }

    /// @notice Burn token.
    function burn(uint256 _tokenId) external isLido {
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

    // isApprovedOrOwner check if the spender is owner or an approved.
    function isApprovedOrOwner(address _spender, uint256 _tokenId)
        external
        view
        returns (bool)
    {
        return _isApprovedOrOwner(_spender, _tokenId);
    }

    /// @notice Set LidoMatic contract
    function setLido(address _lido) public {
        lido = _lido;
    }
}
