// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./interfaces/IStakeManager.sol";
import "./interfaces/INodeOperatorRegistry.sol";
import "./storages/ValidatorStorage.sol";

/// @title Validator
/// @author 2021 Shardlabs.
/// @notice Validator is the contract used to manage a staked validator on Polygon stake manager
/// @dev Validator is the contract used to manage a staked validator on Polygon stake manager
contract Validator is ValidatorStorage, Initializable {
    using SafeERC20 for IERC20;

    // ====================================================================
    // =========================== MODIFIERS ==============================
    // ====================================================================

    /// @notice Check if the operator contract is the msg.sender.
    modifier isOperator() {
        require(
            msg.sender == state.operator,
            "Caller should be the operator contract"
        );
        _;
    }

    // ====================================================================
    // =========================== FUNCTIONS ==============================
    // ====================================================================

    /// @notice Initialize the NodeOperator contract.
    function initialize(address _operator) public initializer {
        state.operator = _operator;
    }

    /// @notice Stake allows to stake on the Polygon stakeManager contract
    /// @dev  Stake allows to stake on the Polygon stakeManager contract by
    /// calling stakeFor function and set the user address equal to this contract address
    /// @param _amount amount to stake with.
    /// @param _heimdallFee heimdall fees.
    /// @param _acceptDelegation accept delegation.
    /// @param _signerPubkey signer public key used on the heimdall node.
    /// @return Returns the validatorId of this contract set by the Polygon stakeManager.
    function stake(
        uint256 _amount,
        uint256 _heimdallFee,
        bool _acceptDelegation,
        bytes memory _signerPubkey
    ) external isOperator returns (uint256) {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        IStakeManager(stakeManager).stakeFor(
            address(this),
            _amount,
            _heimdallFee,
            _acceptDelegation,
            _signerPubkey
        );

        emit Stake(
            address(this),
            _amount,
            _heimdallFee,
            _acceptDelegation,
            _signerPubkey
        );
        return getValidatorId(address(this));
    }

    /// @notice Unstake a validator from the Polygon stakeManager contract.
    /// @dev Unstake a validator from the Polygon stakeManager contract by passing the validatorId
    /// @param _validatorId validatorId.
    function unstake(uint256 _validatorId) external isOperator {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        IStakeManager(stakeManager).unstake(_validatorId);
        emit Unstake(_validatorId);
    }

    /// @notice Allows to top up heimdall fees.
    /// @param _heimdallFee amount
    function topUpForFee(uint256 _heimdallFee) external isOperator {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        IStakeManager(stakeManager).topUpForFee(address(this), _heimdallFee);
        emit TopUpForFee(address(this), _heimdallFee);
    }

    /// @notice Get validator id by user address.
    /// @param _user user address.
    /// @return Returns the validatorId of an address.
    function getValidatorId(address _user) public view returns (uint256) {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        return IStakeManager(stakeManager).getValidatorId(_user);
    }

    /// @notice Get validatorShare contract address.
    /// @dev Get validatorShare contract address.
    /// @param _validatorId Validator Id
    /// @return Returns the address of the validatorShare contract.
    function getValidatorContract(uint256 _validatorId)
        external
        view
        returns (address)
    {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        return IStakeManager(stakeManager).getValidatorContract(_validatorId);
    }

    /// @notice Allows to withdraw rewards from the validator.
    /// @dev Allows to withdraw rewards from the validator using the _validatorId. Only the
    /// owner can request withdraw in this the owner is this contract.
    /// @param _validatorId validator id.
    function withdrawRewards(uint256 _validatorId) external isOperator {
        INodeOperatorRegistry operator = getOperator();

        // call polygon stake manager
        // withdraw rewards
        IStakeManager(operator.getStakeManager()).withdrawRewards(_validatorId);

        // transfer rewards to lido contract.
        address polygonERC20 = operator.getPolygonERC20();
        uint256 balance = IERC20(polygonERC20).balanceOf(address(this));
        IERC20(polygonERC20).safeTransfer(operator.getLido(), balance);

        emit WithdrawRewards(_validatorId);
    }

    /// @notice Allows to get the operator contract.
    /// @return Returns operator contract address.
    function getOperator() public view returns (INodeOperatorRegistry) {
        return INodeOperatorRegistry(state.operator);
    }

    /// @notice Allows to get the stakeManager contract.
    /// @return Returns stakeManager contract address.
    function getStakeManager() public view returns (address) {
        return INodeOperatorRegistry(state.operator).getStakeManager();
    }
}
