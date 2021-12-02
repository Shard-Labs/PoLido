// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IValidatorShare.sol";
import "../interfaces/IStakeManager.sol";

contract MockValidatorShare is IValidatorShare {
    address public token;

    uint256 public totalShares;
    uint256 public withdrawPool;
    uint256 public totalStaked;
    uint256 public totalWithdrawPoolShares;
    uint256 public override validatorId;

    mapping(address => mapping(uint256 => uint256))
        public user2WithdrawPoolShare;
    mapping(address => uint256) public override unbondNonces;

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
        uint256 totalAmount = IERC20(token).balanceOf(address(this));

        uint256 shares = totalAmount != 0
            ? (_amount * totalShares) / totalAmount
            : _amount;

        totalShares += shares;
        totalStaked += _amount;
        require(
            stakeManager.delegationDeposit(validatorId, _amount, msg.sender),
            "deposit failed"
        );

        return 1;
    }

    function sellVoucher_new(uint256 _claimAmount, uint256) external override {
        uint256 unbondNonce = unbondNonces[msg.sender] + 1;

        withdrawPool += _claimAmount;
        totalWithdrawPoolShares += _claimAmount;
        totalStaked -= _claimAmount;

        unbondNonces[msg.sender] = unbondNonce;
        user2WithdrawPoolShare[msg.sender][unbondNonce] = _claimAmount;
    }

    function unstakeClaimTokens_new(uint256 _unbondNonce) external override {
        uint256 withdrawPoolShare = user2WithdrawPoolShare[msg.sender][
            _unbondNonce
        ];
        uint256 amount2Transfer = (withdrawPoolShare * withdrawPool) /
            totalWithdrawPoolShares;

        withdrawPool -= amount2Transfer;
        totalShares -= withdrawPoolShare;
        totalWithdrawPoolShares -= withdrawPoolShare;
        IERC20(token).transfer(msg.sender, amount2Transfer);
    }

    function getTotalStake(address)
        external
        view
        override
        returns (uint256, uint256)
    {
        //getTotalStake returns totalStake of msg.sender but we need withdrawPool
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

    function slash(uint256 _amount) external override {
        IERC20(token).transfer(
            0x3cBbF9bFE20d28E7e04103C42aBF622E9362Dfa8,
            _amount
        );
        uint256 totalAmount = withdrawPool + totalStaked;
        withdrawPool -= (_amount * withdrawPool) / totalAmount;
        totalStaked -= (_amount * totalStaked) / totalAmount;
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
