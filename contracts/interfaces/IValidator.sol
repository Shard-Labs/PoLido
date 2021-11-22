// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../Validator.sol";

/// @title IValidator.
/// @author 2021 Shardlabs
/// @notice Validator interface.
interface IValidator {
    /// @notice Allows to stake a validator on the Polygon stakeManager contract.
    /// @dev Stake a validator on the Polygon stakeManager contract.
    /// @param _sender msg.sender.
    /// @param _amount amount to stake.
    /// @param _heimdallFee herimdall fees.
    /// @param _acceptDelegation accept delegation.
    /// @param _signerPubkey signer public key used on the heimdall.
    /// @param _commisionRate commision rate of a validator
    function stake(
        address _sender,
        uint256 _amount,
        uint256 _heimdallFee,
        bool _acceptDelegation,
        bytes memory _signerPubkey,
        uint256 _commisionRate
    ) external returns (uint256, address);

    /// @notice Restake Matics for a validator on polygon stake manager.
    /// @param _sender operator owner which approved tokens to the validato contract.
    /// @param validatorId validator id.
    /// @param amount amount to stake.
    /// @param stakeRewards restake rewards.
    function restake(
        address _sender,
        uint256 validatorId,
        uint256 amount,
        bool stakeRewards
    ) external;

    /// @notice Unstake a validator from the Polygon stakeManager contract.
    /// @dev Unstake a validator from the Polygon stakeManager contract by passing the validatorId
    /// @param _validatorId validatorId.
    function unstake(uint256 _validatorId) external;

    /// @notice Allows to top up heimdall fees.
    /// @param _heimdallFee amount
    /// @param _sender msg.sender
    function topUpForFee(address _sender, uint256 _heimdallFee) external;

    /// @notice Allows to withdraw rewards from the validator.
    /// @dev Allows to withdraw rewards from the validator using the _validatorId. Only the
    /// owner can request withdraw in this the owner is this contract.
    /// @param _validatorId validator id.
    /// @return Returns the amount transfered to the user.
    function withdrawRewards(uint256 _validatorId, address _rewardAddress)
        external
        returns (uint256);

    /// @notice Allows to claim staked tokens on the stake Manager after the end of the
    /// withdraw delay
    /// @param _validatorId validator id.
    /// @param _rewardAddress user address used to transfer the staked tokens.
    /// @return Returns the amount transfered to the user.
    function unstakeClaim(uint256 _validatorId, address _rewardAddress)
        external
        returns (uint256);

    /// @notice Allows to update the signer pubkey
    /// @param _validatorId validator id
    /// @param _signerPubkey update signer public key
    function updateSigner(uint256 _validatorId, bytes memory _signerPubkey)
        external;

    /// @notice Allows to claim the heimdall fees.
    /// @param _accumFeeAmount accumulated fees amount
    /// @param _index index
    /// @param _proof proof
    function claimFee(
        uint256 _accumFeeAmount,
        uint256 _index,
        bytes memory _proof,
        address _ownerRecipient
    ) external;

    /// @notice Allows to update the commision rate of a validator
    /// @param _validatorId operator id
    /// @param _newCommissionRate commission rate
    function updateCommissionRate(
        uint256 _validatorId,
        uint256 _newCommissionRate
    ) external;

    /// @notice Allows to unjail a validator.
    /// @param _validatorId operator id
    function unjail(uint256 _validatorId) external;

    /// @notice Allows to migrate the ownership to an other user.
    /// @param _validatorId operator id.
    /// @param _stakeManagerNFT stake manager nft contract.
    /// @param _rewardAddress reward address.
    function migrate(
        uint256 _validatorId,
        address _stakeManagerNFT,
        address _rewardAddress
    ) external;

    function join(
        uint256 _validatorId,
        address _stakeManagerNFT,
        address _rewardAddress,
        uint256 _newCommissionRate
    ) external;
}