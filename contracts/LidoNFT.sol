// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract LidoNFT is OwnableUpgradeable, ERC721Upgradeable, PausableUpgradeable {
    // lido contract
    address public lido;
    uint256 public tokenIdIndex;

    mapping(address => uint256[]) public owner2Tokens;
    mapping(uint256 => uint256) public token2Index;

    mapping(address => uint256[]) public address2Approved;
    mapping(uint256 => uint256) public tokenId2ApprovedIndex;

    // check if lido contract is the caller
    modifier isLido() {
        require(msg.sender == lido, "Caller is not lido contract");
        _;
    }

    function initialize(string memory _name, string memory _symbol)
        public
        initializer
    {
        __Ownable_init();
        __ERC721_init(_name, _symbol);
        __Pausable_init();
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

    function approve(address to, uint256 tokenId) public override {
        // Check if this token was ever approved before
        // If it was retrieve the address that this token was approved to
        // Retrieve the old owners approved token array
        // Retrieve the index of that token inside the old approved token array
        // Delete the tokenId at the retrieved index from the old approved array
        if (getApproved(tokenId) != address(0)) {
            _removeApproval(tokenId);
        }

        super.approve(to, tokenId);

        // Retrieve the array of the address that this token will be approved to
        // Push this tokenId to the retrieved array
        // Update the tokens index by seeting it to the retrieved array.length - 1
        // Update the approval status of the approved token
        uint256[] storage approvedTokens = address2Approved[to];

        approvedTokens.push(tokenId);
        tokenId2ApprovedIndex[tokenId] = approvedTokens.length - 1;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId);

        // Minting
        if (from == address(0)) {
            uint256[] storage ownerTokens = owner2Tokens[to];

            ownerTokens.push(tokenId);
            token2Index[tokenId] = ownerTokens.length - 1;
        }
        // Burning
        else if (to == address(0)) {
            uint256[] storage ownerTokens = owner2Tokens[from];

            uint256 tokenIndex = token2Index[tokenId];
            delete ownerTokens[tokenIndex];

            token2Index[tokenId] = 0;

            if (getApproved(tokenId) != address(0)) {
                _removeApproval(tokenId);
            }
        }
        // Transferring
        else if (from != to) {
            if (getApproved(tokenId) != address(0)) {
                _removeApproval(tokenId);
            }

            uint256[] storage senderTokens = owner2Tokens[from];
            uint256[] storage receiverTokens = owner2Tokens[to];

            uint256 tokenIndex = token2Index[tokenId];
            delete senderTokens[tokenIndex];

            receiverTokens.push(tokenId);
            token2Index[tokenId] = receiverTokens.length - 1;
        }
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
    function setLido(address _lido) external onlyOwner {
        lido = _lido;
    }

    function _removeApproval(uint256 _tokenId) internal {
        uint256[] storage lastApprovedTokens = address2Approved[
            getApproved(_tokenId)
        ];
        uint256 approvedIndex = tokenId2ApprovedIndex[_tokenId];

        delete lastApprovedTokens[approvedIndex];
        tokenId2ApprovedIndex[_tokenId] = 0;
    }
}