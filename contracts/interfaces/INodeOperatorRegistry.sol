// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "../storages/NodeOperatorStorage.sol";
import "../lib/Operator.sol";

/// @title Node operator registry interface
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
    /// @param _id node operator id.
    function removeOperator(uint256 _id) external;

    /// @notice Allows to stake an opearator on the Polygon stakeManager
    /// @dev Allows to stake an operator on the Polygon stakeManager.
    /// This function calls Polygon transferFrom so the totalAmount(_amount + _heimdallFee)
    /// has to be approved first.
    /// @param _amount amount to stake.
    /// @param _heimdallFee heimdallFee to stake.
    function stake(uint256 _amount, uint256 _heimdallFee) external;

    /// @notice Allows to unstake an operator from the stakeManager.
    /// @dev Unstake an operator from the stakeManager. After the withdraw_delay
    /// the operator owner can call claimStake func to withdraw the staked tokens.
    function unstake() external;

    /// @notice Allows to topup heimdall fees on polygon stakeManager.
    /// @param _heimdallFee amount to topup.
    function topUpForFee(uint256 _heimdallFee) external;

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

    /// @notice Allows to get the validatorContract address using the _validatorId.
    /// @param _validatorId validator id.
    /// @return Returns the validatorContract address
    function getValidatorContract(uint256 _validatorId)
        external
        view
        returns (address);

    /// @notice Allows to withdraw rewards accumulated in the stakeManager by all
    /// the operators, then calculate the shares per operator.
    /// @return Returns the shares of the operators and the receipient addresses
    function withdrawRewards()
        external
        returns (uint256[] memory, address[] memory);

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
    function getNodeOperator(uint256 _id, bool _full)
        external
        view
        returns (Operator.NodeOperator memory);
}
