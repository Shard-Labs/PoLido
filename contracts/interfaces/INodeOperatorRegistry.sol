// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../storages/NodeOperatorStorage.sol";
import "../lib/Operator.sol";

/// @title INodeOperatorRegistry
/// @author 2021 Shardlabs
/// @notice Node operator registry interface
interface INodeOperatorRegistry {
    /// @notice Add a new node operator to the system.
    /// @dev Add a new operator
    /// @param _name the node operator name.
    /// @param _rewardAddress public address used for ACL and receive rewards.
    /// @param _signerPubkey public key used on heimdall len 64 bytes.
    function addOperator(
        string memory _name,
        address _rewardAddress,
        bytes memory _signerPubkey
    ) external;

    /// @notice Remove a node operator from the system.
    /// @dev Remove a node operator from the system using the _id.
    /// @param _operatorId node operator id.
    function removeOperator(uint256 _operatorId) external;

    /// @notice Allows to stake an opearator on the Polygon stakeManager
    /// @dev Allows to stake an operator on the Polygon stakeManager.
    /// This function calls Polygon transferFrom so the totalAmount(_amount + _heimdallFee)
    /// has to be approved first.
    /// @param _amount amount to stake.
    /// @param _heimdallFee heimdallFee to stake.
    function stake(uint256 _amount, uint256 _heimdallFee) external;

    /// @notice Restake Matics for a validator on polygon stake manager.
    /// @param amount amount to stake.
    function restake(uint256 amount) external;

    /// @notice Allows to unstake an operator from the stakeManager.
    /// @dev Unstake an operator from the stakeManager. After the withdraw_delay
    /// the operator owner can call claimStake func to withdraw the staked tokens.
    function unstake() external;

    /// @notice Allows to topup heimdall fees on polygon stakeManager.
    /// @param _heimdallFee amount to topup.
    function topUpForFee(uint256 _heimdallFee) external;

    /// @notice Allows to claim staked tokens on the stake Manager after the end of the
    /// withdraw delay
    function unstakeClaim() external;

    /// @notice Allows to get the total staked by a validator.
    /// @param _validatorId validator id.
    /// @return Returns the total staked.
    function validatorStake(uint256 _validatorId)
        external
        view
        returns (uint256);

    /// @notice Allows to get the validator id of an owner.
    /// @param _user owner address of the validator.
    /// @return Returns the validator id
    function getValidatorId(address _user) external view returns (uint256);

    /// @notice Allows to withdraw rewards accumulated in the stakeManager by all
    /// the operators, then calculate the shares per operator.
    /// @return Returns the shares of the operators and the receipient addresses
    function withdrawRewards()
        external
        returns (uint256[] memory, address[] memory);

    /// @notice Allows to update the signer pubkey
    /// @param _signerPubkey update signer public key
    function updateSigner(bytes memory _signerPubkey) external;

    /// @notice Allows to claim the heimdall fees staked by the owner of the operator
    /// @param _accumFeeAmount accumulated fees amount
    /// @param _index index
    /// @param _proof proof
    function claimFee(
        uint256 _accumFeeAmount,
        uint256 _index,
        bytes memory _proof
    ) external;

    /// @notice Allows to update the commision rate of an operator
    /// @param _operatorId operator id
    /// @param _newCommissionRate commission rate
    function updateOperatorCommissionRate(
        uint256 _operatorId,
        uint256 _newCommissionRate
    ) external;

    /// @notice Allows to unjail a validator and switch from UNSTAKE status to STAKED
    function unjail() external;

    /// @notice The version of the actual contract.
    /// @return return the contract version.
    function version() external returns (string memory);

    /// @notice Get the all operator ids availablein the system.
    /// @return Return a list of operator Ids.
    function getOperators() external returns (uint256[] memory);

    /// @notice Allows to get the validator factory address.
    /// @return Returns the validator factory address.
    function getValidatorFactory() external view returns (address);

    /// @notice Allows to get the stake manager address.
    /// @return Returns the stake manager address.
    function getStakeManager() external view returns (address);

    /// @notice Allows to get the polygon erc20 token address.
    /// @return Returns the polygon erc20 token address.
    function getPolygonERC20() external view returns (address);

    /// @notice Allows to get the lido contract address.
    /// @return Returns the lido contract address.
    function getLido() external view returns (address);

    /// @notice Allows to get node operator details.
    /// @return Returns node operator details.
    function getNodeOperator(uint256 _operatorId, bool _full)
        external
        view
        returns (Operator.NodeOperator memory);

    /// @notice Allows to get the validatorShare address of an operator.
    /// @param _operatorId operator id.
    function getOperatorShare(uint256 _operatorId) external returns (address);

    /// @notice Allows to list all the staked operator validatorShare address and id.
    function getOperatorShares()
        external
        returns (Operator.OperatorShare[] memory);

    /// @notice get the operator reward addresses.
    /// @return return a list of staked operator reward addresses.
    function getOperatorRewardAddresses() external returns (address[] memory);
}
