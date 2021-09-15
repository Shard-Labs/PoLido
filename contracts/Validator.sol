// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "hardhat/console.sol";
import "./interfaces/IStakeManager.sol";
import "./interfaces/IValidatorFactory.sol";

contract Validator is Initializable {
    /// @notice State struct
    struct State {
        address validatorFactory;
    }

    /// @notice Global state
    State internal state;

    /// @notice Initialize the NodeOperator contract.
    function initialize(address _validatorFactory) public initializer {
        state.validatorFactory = _validatorFactory;
    }

    function stake(
        uint256 _amount,
        uint256 _heimdallFee,
        bool _acceptDelegation,
        bytes memory _signerPubkey
    ) external returns (uint256) {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        IStakeManager(stakeManager).stakeFor(
            address(this),
            _amount,
            _heimdallFee,
            _acceptDelegation,
            _signerPubkey
        );

        return getValidatorId(address(this));
    }

    function unstake(uint256 _validatorId) external {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        IStakeManager(stakeManager).unstake(_validatorId);
    }

    function topUpForFee(address _user, uint256 _heimdallFee) external {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        IStakeManager(stakeManager).topUpForFee(_user, _heimdallFee);
    }

    function getValidatorId(address _user) public view returns (uint256) {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        return IStakeManager(stakeManager).getValidatorId(_user);
    }

    function getValidatorContract(uint256 _validatorId)
        external
        view
        returns (address)
    {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        return IStakeManager(stakeManager).getValidatorContract(_validatorId);
    }

    function withdrawRewards(uint256 _validatorId) external {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        IStakeManager(stakeManager).withdrawRewards(_validatorId);

        // TODO: transfer rewards to Lido contract
    }

    function getStakeManager() public view returns (address) {
        return IValidatorFactory(state.validatorFactory).getStakeManager();
    }
}
