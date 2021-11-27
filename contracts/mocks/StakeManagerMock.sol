// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../interfaces/IStakeManager.sol";
import "../helpers/ERC721Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../mocks/MockValidatorShare.sol";

contract StakeManagerMock is IStakeManager {
    struct State {
        address token;
        address stakeNFT;
        uint256 id;
        mapping(address => uint256) validators;
        mapping(uint256 => address) Owners;
        mapping(uint256 => uint256) stakedAmount;
        mapping(uint256 => address) signer;
        mapping(uint256 => address) validatorShares;
        mapping(address => uint256) delegator2Amount;
    }

    State private state;

    constructor(address _token, address _stakeNFT) {
        state.token = _token;
        state.stakeNFT = _stakeNFT;
    }

    function stakeFor(
        address _user,
        uint256 _amount,
        uint256 _heimdallFee,
        bool,
        bytes memory _signerPubkey
    ) external override {
        uint256 id = state.id + 1;
        state.validators[_user] = id;
        state.Owners[id] = _user;
        IERC20(state.token).transferFrom(
            msg.sender,
            address(this),
            _amount + _heimdallFee
        );
        state.id++;
        state.stakedAmount[id] = _amount;
        state.signer[id] = address(uint160(uint256(keccak256(_signerPubkey))));
        state.validatorShares[id] = address(
            new MockValidatorShare(state.token, address(this), id)
        );
    }

    function restake(
        uint256,
        uint256 _amount,
        bool
    ) external override {
        IERC20(state.token).transferFrom(msg.sender, address(this), _amount);
    }

    function unstake(uint256) external override {
        delete state.validators[msg.sender];
    }

    function topUpForFee(address _user, uint256 _heimdallFee)
        external
        override
    {}

    function getValidatorId(address _user)
        external
        view
        override
        returns (uint256)
    {
        return state.validators[_user];
    }

    function getValidatorContract(uint256 _validatorId)
        external
        view
        override
        returns (address)
    {
        return state.validatorShares[_validatorId];
    }

    function withdrawRewards(uint256) external override returns (uint256) {
        IERC20(state.token).transfer(msg.sender, 1000);
        return 1000;
    }

    function unstakeClaim(uint256) external override {
        IERC20(state.token).transfer(
            msg.sender,
            state.delegator2Amount[msg.sender]
        );
        state.delegator2Amount[msg.sender] = 0;
    }

    function validatorStake(uint256 _validatorId)
        external
        view
        override
        returns (uint256)
    {
        return state.stakedAmount[_validatorId];
    }

    function updateSigner(uint256 _validatorId, bytes memory _signerPubkey)
        external
        override
    {}

    function claimFee(
        uint256 _accumFeeAmount,
        uint256 _index,
        bytes memory _proof
    ) external override {}

    function updateCommissionRate(
        uint256 _validatorId,
        uint256 _newCommissionRate
    ) external override {}

    function unjail(uint256 _validatorId) external override {}

    function withdrawalDelay() external pure override returns (uint256) {
        return (2**13);
    }

    function delegationDeposit(
        uint256,
        uint256 amount,
        address delegator
    ) external override returns (bool) {
        state.delegator2Amount[msg.sender] += amount;
        console.log("%s", amount);
        IERC20(state.token).transferFrom(delegator, address(this), amount);
        console.log("%s", amount);
        return IERC20(state.token).transfer(msg.sender, amount);
    }

    function epoch() external pure override returns (uint256) {
        return 0;
    }

    function slash(uint256 _validatorId) external {
        state.stakedAmount[_validatorId] -= 1 ether;
    }

    function validators(uint256 _validatorId)
        external
        view
        override
        returns (Validator memory)
    {
        return
            Validator({
                amount: state.stakedAmount[_validatorId],
                reward: 0,
                activationEpoch: 0,
                deactivationEpoch: 0,
                jailTime: 0,
                signer: state.signer[_validatorId],
                contractAddress: state.validatorShares[_validatorId],
                status: Status.Active,
                commissionRate: 0,
                lastCommissionUpdate: 0,
                delegatorsReward: 0,
                delegatedAmount: 0,
                initialRewardPerStake: 0
            });
    }

    function NFTContract() external view override returns (address) {
        return state.stakeNFT;
    }

    /// @notice Returns the validator accumulated rewards on stake manager.
    function validatorReward(uint256) external pure override returns (uint256) {
        return 1000;
    }
}
