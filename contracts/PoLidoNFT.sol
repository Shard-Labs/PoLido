// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";

import "./interfaces/IPoLidoNFT.sol";

contract PoLidoNFT is
    IPoLidoNFT,
    OwnableUpgradeable,
    ERC721Upgradeable,
    ERC721PausableUpgradeable
{
    address public stMATIC;
    uint256 public tokenIdIndex;
    string public version;

    // maps the address to array of the owned tokens
    mapping(address => uint256[]) public owner2Tokens;
    // token can be owned by only one address at the time, therefore tokenId is present in only one of those arrays in the mapping
    // this mapping stores the index of the tokenId in one of those arrays
    mapping(uint256 => uint256) public token2Index;

    // maps the address to array of the tokens that are approved to this address
    mapping(address => uint256[]) public address2Approved;
    // token can be approved to only one address at the time, therefore tokenId is present in only one of those arrays in the mapping
    // this mapping stores the index of the tokenId in one of those arrays
    mapping(uint256 => uint256) public tokenId2ApprovedIndex;

    modifier isLido() {
        require(msg.sender == stMATIC, "Caller is not stMATIC contract");
        _;
    }

    function initialize(string memory name_, string memory symbol_, address _stMATIC)
        external
        initializer
    {
        __Context_init_unchained();
        __ERC165_init_unchained();
        __Ownable_init_unchained();
        __ERC721_init_unchained(name_, symbol_);
        __Pausable_init_unchained();
        __ERC721Pausable_init_unchained();

        stMATIC = _stMATIC;
    }

    /**
     * @dev Increments the token supply and mints the token based on that index
     * @param _to - Address that will be the owner of minted token
     * @return Index of the minted token
     */
    function mint(address _to) external override isLido returns (uint256) {
        uint256 currentIndex = tokenIdIndex;
        currentIndex++;

        _mint(_to, currentIndex);

        tokenIdIndex = currentIndex;

        return currentIndex;
    }

    /**
     * @dev Burn the token with specified _tokenId
     * @param _tokenId - Id of the token that will be burned
     */
    function burn(uint256 _tokenId) external override isLido {
        _burn(_tokenId);
    }

    /**
     * @notice Override of the approve function
     * @param _to - Address that the token will be approved to
     * @param _tokenId - Id of the token that will be approved to _to
     */
    function approve(address _to, uint256 _tokenId)
        public
        override(ERC721Upgradeable, IERC721Upgradeable)
    {
        // If this token was approved before, remove it from the mapping of approvals
        if (getApproved(_tokenId) != address(0)) {
            _removeApproval(_tokenId);
        }

        super.approve(_to, _tokenId);

        uint256[] storage approvedTokens = address2Approved[_to];

        // Add the new approved token to the mapping
        approvedTokens.push(_tokenId);
        tokenId2ApprovedIndex[_tokenId] = approvedTokens.length - 1;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    )
        internal
        virtual
        override(ERC721Upgradeable, ERC721PausableUpgradeable)
        whenNotPaused
    {
        require(from != to, "Invalid operation");
        
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
            uint256 length = ownerTokens.length;

            if (tokenIndex != length - 1 && length != 1) {
                uint256 t = ownerTokens[ownerTokens.length - 1];
                token2Index[t] = tokenIndex;
                ownerTokens[tokenIndex] = ownerTokens[ownerTokens.length - 1];
            }
            ownerTokens.pop();

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

    /**
     * @dev Check if the spender is the owner or is the tokenId approved to him
     * @param _spender - Address that will be checked
     * @param _tokenId - Token id that will be checked against _spender
     */
    function isApprovedOrOwner(address _spender, uint256 _tokenId)
        external
        view
        override
        returns (bool)
    {
        return _isApprovedOrOwner(_spender, _tokenId);
    }

    /**
     * @dev Set stMATIC contract address
     * @param _stMATIC - address of the stMATIC contract
     */
    function setStMATIC(address _stMATIC) external override onlyOwner {
        stMATIC = _stMATIC;
    }

    /// @notice Set PoLidoNFT version
    /// @param _version - New version that will be set
    function setVersion(string calldata _version) external onlyOwner {
        version = _version;
    }

    /**
     * @dev Retrieve the array of owned tokens
     * @param _address - Address for which the tokens will be retrieved
     * @return - Array of owned tokens
     */
    function getOwnedTokens(address _address)
        external
        override
        view
        returns (uint256[] memory)
    {
        return owner2Tokens[_address];
    }

    /**
     * @dev Retrieve the array of approved tokens
     * @param _address - Address for which the tokens will be retrieved
     * @return - Array of approved tokens
     */
    function getApprovedTokens(address _address)
        external
        view
        returns (uint256[] memory)
    {
        return address2Approved[_address];
    }

    /**
     * @dev Remove the tokenId from the specific users array of approved tokens
     * @param _tokenId - Id of the token that will be removed
     */
    function _removeApproval(uint256 _tokenId) internal {
        uint256[] storage approvedTokens = address2Approved[
            getApproved(_tokenId)
        ];
        uint256 approvedIndex = tokenId2ApprovedIndex[_tokenId];

        uint256 length = approvedTokens.length;
        if (approvedIndex != length - 1 && length != 1) {
            uint256 t = approvedTokens[length - 1];
            tokenId2ApprovedIndex[t] = approvedIndex;
            approvedTokens[approvedIndex] = approvedTokens[approvedTokens.length - 1];
        }
        approvedTokens.pop();

        tokenId2ApprovedIndex[_tokenId] = 0;
    }
}
