// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IValidatorShare.sol";

contract MockValidatorShare is IValidatorShare {
    address public token;

    constructor(address _token) {
        token = _token;
    }

    function validatorId() external pure override returns (uint256) {
        return 1;
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

    function getLiquidRewards(address user)
        external
        pure
        override
        returns (uint256)
    {
        return 1;
    }

    function buyVoucher(uint256 _amount, uint256 _minSharesToMint)
        external
        override
        returns (uint256)
    {
        bool res = IERC20(token).transferFrom(
            msg.sender,
            address(this),
            _amount
        );

        require(res, "token transfer wasn't successful");

        return 1;
    }

    function sellVoucher_new(uint256 claimAmount, uint256 maximumSharesToBurn)
        external
        pure
        override
    {
        return;
    }

    function unstakeClaimTokens_new(uint256 unbondNonce) external override {
        IERC20(token).transfer(
            msg.sender,
            IERC20(token).balanceOf(address(this)) / 2
        );
    }

    function getTotalStake(address user)
        external
        pure
        override
        returns (uint256, uint256)
    {
        return (1, 1);
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
        address token,
        address payable destination,
        uint256 amount
    ) external pure override {
        return;
    }

    function slash(
        uint256 valPow,
        uint256 delegatedAmount,
        uint256 totalAmountToSlash
    ) external pure override returns (uint256) {
        return 1;
    }

    function updateDelegation(bool delegation) external pure override {
        return;
    }

    function migrateOut(address user, uint256 amount) external pure override {
        return;
    }

    function migrateIn(address user, uint256 amount) external pure override {
        return;
    }
}
