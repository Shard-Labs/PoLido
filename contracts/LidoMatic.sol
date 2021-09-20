// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IValidatorShare.sol";

contract LidoMatic is ERC20("Staked Matic", "StMATIC"), AccessControl {
    ////////////////////////////////////////////////////////////////
    /////                                                    //////
    /////             ***State Variables***                  /////
    /////                                                    ////
    ////////////////////////////////////////////////////////////

    mapping(address => RequestWithdraw) public userToWithdrawRequest;
    // Value of totalDelegated needs to be updated periodically off chain because of slashing and rewarding
    // It is calculated as the sum of delegated MATIC across all validatorShares
    mapping(address => uint256) public userToShares;
    // Value of totalBuffered needs to be set to 0 after the periodic update has been done
    uint256 public totalDelegated;
    uint256 public totalBuffered;
    // Address of Matic token
    address public token;

    // Withdrawal structure
    struct RequestWithdraw {
        uint256 amount;
        uint256 validatorNonce;
        address validatorShareAddress;
        bool done;
    }

    /** Roles */
    bytes32 public constant GOVERNANCE = keccak256("GOVERNANCE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    bytes32 public constant MANAGE_FEE = keccak256("MANAGE_FEE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 public constant SET_TREASURY = keccak256("SET_TREASURY");

    /** Modifiers */
    modifier auth(bytes32 _role) {
        require(hasRole(_role, msg.sender));
        _;
    }

    /**
     * @param _token - Address of MATIC token on Ethereum Mainnet
     */
    constructor(address _token) {
        token = _token;
    }

    /**
     * @dev Send funds to LidoMatic contract and mints StMATIC to msg.sender
     * @notice Requires that msg.sender has approved _amount of MATIC to this contract
     * @param _amount - Amount of MATIC sent from msg.sender to this contract
     * @return Amount of StMATIC shares generated
     */
    function submit(uint256 _amount) external returns (uint256) {
        require(_amount > 0, "Invalid amount");

        IERC20(token).transferFrom(msg.sender, address(this), _amount);

        uint256 totalShares = totalSupply();
        uint256 totalPooledMatic = totalBuffered + totalDelegated;
        uint256 amountToMint = totalShares != 0
            ? (_amount * totalShares) / totalPooledMatic
            : _amount;

        _mint(msg.sender, amountToMint);

        totalBuffered += _amount;

        return amountToMint;
    }

    /**
     * @dev Stores users request to withdraw into a RequestWithdraw struct
     * @param _amount - Amount of MATIC that is requested to withdraw
     */
    function requestWithdraw(uint256 _amount) external {
        userToWithdrawRequest[msg.sender] = RequestWithdraw(
            _amount,
            0, // TODO
            address(0), // TODO
            false
        );
    }

    ////////////////////////////////////////////////////////////////
    /////                                                    //////
    /////             ***ValidatorShare API***               /////
    /////                                                    ////
    ////////////////////////////////////////////////////////////

    /**
     * @dev API for delegatet buying vouchers from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @param _amount - Amount of MATIC to use for buying vouchers
     * @param _minSharesToMint - Minimum of shares that is bought with _amount of MATIC
     * @return Actual amount of MATIC used to buy voucher, might differ from _amount because of _minSharesToMint
     */
    function buyVoucher(
        address _validatorShare,
        uint256 _amount,
        uint256 _minSharesToMint
    ) public returns (bytes memory) {
        (bool success, bytes memory data) = _validatorShare.delegatecall(
            abi.encodeWithSignature(
                "buyVoucher(uint256,uint256)",
                _amount,
                _minSharesToMint
            )
        );

        require(success, "buyVoucher delegatecall failed");

        return data;
    }

    /**
     * @dev API for delegated restaking rewards to validatorShare
     * @param _validatorShare - Address of validatorShare contract
     */
    function restake(address _validatorShare) public {
        (bool success, ) = _validatorShare.delegatecall(
            abi.encodeWithSignature("restake()")
        );

        require(success, "restake delegatecall failed");
    }

    /**
     * @dev API for delegated unstaking and claiming tokens from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @param _unbondNonce - TODO
     */
    function unstakeClaimTokens_new(
        address _validatorShare,
        uint256 _unbondNonce
    ) public {
        (bool success, ) = _validatorShare.delegatecall(
            abi.encodeWithSignature(
                "unstakeClaimTokens_new(uint256)",
                _unbondNonce
            )
        );

        require(success, "unstakeClaimTokens_new delegatecall failed");
    }

    /**
     * @dev API for delegated selling vouchers from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @param _claimAmount - Amount of MATIC to claim
     * @param _maximumSharesToBurn - Maximum amount of shares to burn
     */
    function sellVoucher_new(
        address _validatorShare,
        uint256 _claimAmount,
        uint256 _maximumSharesToBurn
    ) public {
        (bool success, ) = _validatorShare.delegatecall(
            abi.encodeWithSignature(
                "sellVoucher_new(uint256,uint256)",
                _claimAmount,
                _maximumSharesToBurn
            )
        );

        require(success, "sellVoucher_new delegatecall failed");
    }

    /**
     * @dev API for getting total stake of an user from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @param _user - Address of user
     * @return Total stake of _user and MATIC -> share exchange rate
     */
    function getTotalStake(IValidatorShare _validatorShare, address _user)
        public
        view
        returns (uint256, uint256)
    {
        return _validatorShare.getTotalStake(_user);
    }

    /**
     * @dev API for liquid rewards of an user from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @param _user - Address of user
     * @return Liquid rewards of _user
     */
    function getLiquidRewards(IValidatorShare _validatorShare, address _user)
        public
        view
        returns (uint256)
    {
        return _validatorShare.getLiquidRewards(_user);
    }
}
