// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IValidatorShare.sol";
import "../interfaces/IStakeManager.sol";

import "hardhat/console.sol";

contract MockValidatorShare is IValidatorShare {
    address public token;

    uint256 public totalStaked;
    uint256 public totalShares;
    uint256 public override validatorId;

    mapping(address => uint256) public override unbondNonces;
    mapping(address => mapping(uint256 => uint256)) public amount2Claim;
    mapping(address => uint256) public user2Shares;

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
        user2Shares[msg.sender] += totalStaked != 0
            ? (_amount * totalShares) / totalStaked
            : _amount;

        totalStaked += _amount;
        totalShares += _amount;
        require(
            stakeManager.delegationDeposit(validatorId, _amount, msg.sender),
            "deposit failed"
        );

        return 1;
    }

    function sellVoucher_new(uint256 _claimAmount, uint256) external override {
        uint256 unbondNonce = unbondNonces[msg.sender] + 1;

        require(
            _claimAmount <= user2Shares[msg.sender],
            "Invalid amount to claim"
        );

        unbondNonces[msg.sender] = unbondNonce;
        amount2Claim[msg.sender][unbondNonce] = _claimAmount;
        user2Shares[msg.sender] -= _claimAmount;
    }

    function unstakeClaimTokens_new(uint256 _unbondNonce) external override {
        uint256 claimAmount = amount2Claim[msg.sender][_unbondNonce];
        uint256 amount2Transfer = (claimAmount * totalStaked) / totalShares;
        totalShares -= claimAmount;
        totalStaked -= amount2Transfer;
        //stakeManager.unstakeClaim(validatorId);
        console.log("%s", IERC20(token).balanceOf(address(this)));
        IERC20(token).transfer(msg.sender, amount2Transfer);
    }

    function getTotalStake(address)
        external
        view
        override
        returns (uint256, uint256)
    {
        return (totalStaked, 1);
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

    function slash(
        uint256,
        uint256,
        uint256
    ) external pure override returns (uint256) {
        return 1;
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
        return totalStaked;
    }
}
