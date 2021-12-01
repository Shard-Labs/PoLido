// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IValidatorShare.sol";
import "../interfaces/IStakeManager.sol";

import "hardhat/console.sol";

contract MockValidatorShare is IValidatorShare {
    address public token;

    uint256 public totalShares;
    uint256 public override validatorId;
    uint256 public withdrawPool;

    mapping(address => uint256) public override unbondNonces;
    mapping(address => mapping(uint256 => uint256)) public amount2Claim;
    mapping(address => uint256) public user2Shares;
    mapping(address => mapping(uint256 => uint256))
        public amountStakedDuringClaim;

    IStakeManager stakeManager;

    constructor(
        address _token,
        address _stakeManager,
        uint256 _id
    ) {
        token = _token;
        stakeManager = IStakeManager(_stakeManager);
        validatorId = _id;
    }

    function withdrawRewards() external override {
        IERC20(token).transfer(
            msg.sender,
            IERC20(token).balanceOf(address(this))
        );
    }

    function unstakeClaimTokens() external pure override {
        return;
    }

    function getLiquidRewards(address)
        external
        pure
        override
        returns (uint256)
    {
        return 1;
    }

    function buyVoucher(uint256 _amount, uint256)
        external
        override
        returns (uint256)
    {
        uint256 totalStaked = IERC20(token).balanceOf(address(this));

        user2Shares[msg.sender] += totalStaked != 0
            ? (_amount * totalShares) / totalStaked
            : _amount;

        totalShares += _amount;
        require(
            stakeManager.delegationDeposit(validatorId, _amount, msg.sender),
            "deposit failed"
        );

        return 1;
    }

    function sellVoucher_new(uint256 _claimAmount, uint256) external override {
        uint256 unbondNonce = unbondNonces[msg.sender] + 1;
        // console.log(
        //     "%s %s %s",
        //     _claimAmount,
        //     user2Shares[msg.sender],
        //     validatorId
        // );
        require(
            _claimAmount <= user2Shares[msg.sender],
            "Invalid amount to claim"
        );

        withdrawPool += _claimAmount;

        unbondNonces[msg.sender] = unbondNonce;
        amount2Claim[msg.sender][unbondNonce] = _claimAmount;
        amountStakedDuringClaim[msg.sender][unbondNonce] = IERC20(token)
            .balanceOf(address(this));
        user2Shares[msg.sender] -= _claimAmount;
    }

    function unstakeClaimTokens_new(uint256 _unbondNonce) external override {
        uint256 claimAmount = amount2Claim[msg.sender][_unbondNonce];
        uint256 amountStaked = amountStakedDuringClaim[msg.sender][
            _unbondNonce
        ];
        uint256 amount2Transfer = claimAmount;
        console.log(
            "ClaimAmount: %s, Amount2Transfer: %s, AmountStaked: %s",
            claimAmount,
            amount2Transfer,
            amountStaked
        );
        console.log(
            "Balance: %s",
            IERC20(token).balanceOf(address(this))
        );
        //stakeManager.unstakeClaim(validatorId);
        IERC20(token).transfer(msg.sender, amount2Transfer);
        withdrawPool -= claimAmount;
        totalShares -= claimAmount;
    }

    function getTotalStake(address)
        external
        view
        override
        returns (uint256, uint256)
    {
        console.log(
            "Validator balance: %s",
            IERC20(token).balanceOf(address(this))
        );

        return (IERC20(token).balanceOf(address(this)), 1);
    }

    function owner() external pure override returns (address) {
        return address(0);
    }

    function restake() external pure override returns (uint256, uint256) {
        return (1, 1);
    }

    function unlock() external pure override {
        return;
    }

    function lock() external pure override {
        return;
    }

    function drain(
        address,
        address payable,
        uint256
    ) external pure override {
        return;
    }

    function slash(uint256 _amount) external override {
        IERC20(token).transfer(
            0x3cBbF9bFE20d28E7e04103C42aBF622E9362Dfa8,
            _amount
        );
    }

    function updateDelegation(bool) external pure override {
        return;
    }

    function migrateOut(address, uint256) external pure override {
        return;
    }

    function migrateIn(address, uint256) external pure override {
        return;
    }

    function activeAmount() external view override returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
