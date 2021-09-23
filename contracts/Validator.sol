// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "./interfaces/IStakeManager.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/INodeOperatorRegistry.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

/// @title Validator
/// @author 2021 Shardlabs.
/// @notice Validator is the contract used to manage a staked validator on Polygon stake manager
/// @dev Validator is the contract used to manage a staked validator on Polygon stake manager
contract Validator is IValidator {
    using SafeERC20 for IERC20;

    // ====================================================================
    // =========================== Global Vars ============================
    // ====================================================================

    /// @notice node operator registry address
    Operator.ValidatorState internal state;

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

    // constructor (address _operator) {
    //     state.operator = _operator;
    // }

    /// @notice Stake allows to stake on the Polygon stakeManager contract
    /// @dev  Stake allows to stake on the Polygon stakeManager contract by
    /// calling stakeFor function and set the user address equal to this contract address
    /// @param _amount amount to stake with.
    /// @param _heimdallFee heimdall fees.
    /// @param _acceptDelegation accept delegation.
    /// @param _signerPubkey signer public key used on the heimdall node.
    function stake(
        address _sender,
        uint256 _amount,
        uint256 _heimdallFee,
        bool _acceptDelegation,
        bytes memory _signerPubkey
    ) external override isOperator {
        // get operator
        INodeOperatorRegistry operator = getOperator();

        // get stakeManager
        address stakeManager = operator.getStakeManager();

        uint256 totalAmount = _amount + _heimdallFee;
        // approve Polygon token to stake manager totalAmount
        address polygonERC20 = operator.getPolygonERC20();

        // transfer tokens from user to this contract
        IERC20(polygonERC20).safeTransferFrom(
            _sender,
            address(this),
            (_amount + _heimdallFee)
        );

        // approve to stakeManager
        IERC20(polygonERC20).safeApprove(stakeManager, totalAmount);

        // call polygon stake manager
        IStakeManager(stakeManager).stakeFor(
            address(this),
            _amount,
            _heimdallFee,
            _acceptDelegation,
            _signerPubkey
        );
    }

    /// @notice Restake Matics for a validator on polygon stake manager.
    /// @param _sender operator owner which approved tokens to the validato contract.
    /// @param _validatorId validator id.
    /// @param _amount amount to stake.
    /// @param _stakeRewards restake rewards.
    function restake(
        address _sender,
        uint256 _validatorId,
        uint256 _amount,
        bool _stakeRewards
    ) external override isOperator {
        // get operator
        INodeOperatorRegistry operator = getOperator();

        // get stakeManager
        address stakeManager = operator.getStakeManager();

        // approve Polygon token to stake manager totalAmount
        address polygonERC20 = operator.getPolygonERC20();

        // transfer tokens from user to this contract
        IERC20(polygonERC20).safeTransferFrom(_sender, address(this), _amount);

        // approve to stakeManager
        IERC20(polygonERC20).safeApprove(stakeManager, _amount);

        // call polygon stake manager
        IStakeManager(stakeManager).restake(
            _validatorId,
            _amount,
            _stakeRewards
        );
    }

    /// @notice Unstake a validator from the Polygon stakeManager contract.
    /// @dev Unstake a validator from the Polygon stakeManager contract by passing the validatorId
    /// @param _validatorId validatorId.
    function unstake(uint256 _validatorId) external override isOperator {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        IStakeManager(stakeManager).unstake(_validatorId);
    }

    /// @notice Allows to top up heimdall fees.
    /// @param _heimdallFee amount
    function topUpForFee(address _sender, uint256 _heimdallFee)
        external
        override
        isOperator
    {
        INodeOperatorRegistry operator = getOperator();

        // get stakeManager
        address stakeManager = operator.getStakeManager();

        address polygonERC20 = operator.getPolygonERC20();

        // transfer tokens from user to this contract
        IERC20(polygonERC20).safeTransferFrom(
            _sender,
            address(this),
            _heimdallFee
        );

        // approve to stakeManager
        IERC20(polygonERC20).safeApprove(stakeManager, _heimdallFee);

        // call polygon stake manager
        IStakeManager(stakeManager).topUpForFee(address(this), _heimdallFee);
    }

    /// @notice Allows to withdraw rewards from the validator.
    /// @dev Allows to withdraw rewards from the validator using the _validatorId. Only the
    /// owner can request withdraw in this the owner is this contract.
    /// @param _validatorId validator id.
    function withdrawRewards(uint256 _validatorId)
        external
        override
        isOperator
        returns (uint256)
    {
        INodeOperatorRegistry operator = getOperator();

        // call polygon stake manager
        // withdraw rewards
        IStakeManager(operator.getStakeManager()).withdrawRewards(_validatorId);

        // transfer rewards to lido contract.
        address polygonERC20 = operator.getPolygonERC20();
        uint256 balance = IERC20(polygonERC20).balanceOf(address(this));
        IERC20(polygonERC20).safeTransfer(operator.getLido(), balance);

        return balance;
    }

    /// @notice Allows to unstake the staked tokens by this validator contract
    /// @dev Allows to unstake the staked tokens by this validator contract and transfer staked
    /// tokens to the owner. but the rewards are buffred untile the rewards distribution happens.
    /// @param _ownerRecipient operator owner address.
    /// @param _validatorId validator id
    function unstakeClaim(address _ownerRecipient, uint256 _validatorId)
        external
        override
        isOperator
        returns (uint256)
    {
        INodeOperatorRegistry operator = getOperator();
        IStakeManager stakeManager = IStakeManager(operator.getStakeManager());

        stakeManager.unstakeClaim(_validatorId);
        uint256 balance = IERC20(operator.getPolygonERC20()).balanceOf(
            address(this)
        );
        IERC20(operator.getPolygonERC20()).safeTransfer(
            _ownerRecipient,
            balance
        );

        return balance;
    }

    /// @notice Allows to update signer publickey
    /// @param _validatorId validator id
    /// @param _signerPubkey new signer publickey
    function updateSigner(uint256 _validatorId, bytes memory _signerPubkey)
        external
        override
        isOperator
    {
        IStakeManager stakeManager = IStakeManager(getStakeManager());
        stakeManager.updateSigner(_validatorId, _signerPubkey);
    }

    /// @notice Allows withdraw heimdall fees
    /// @param _accumFeeAmount accumulated heimdall fees
    /// @param _index index
    /// @param _proof proof
    function claimFee(
        uint256 _accumFeeAmount,
        uint256 _index,
        bytes memory _proof
    ) external override isOperator {
        INodeOperatorRegistry operator = getOperator();
        IStakeManager stakeManager = IStakeManager(operator.getStakeManager());
        stakeManager.claimFee(_accumFeeAmount, _index, _proof);
    }

    /// @notice Allows to update commission rate
    /// @param _validatorId validator id
    /// @param _newCommissionRate new commission rate
    function updateCommissionRate(
        uint256 _validatorId,
        uint256 _newCommissionRate
    ) external override isOperator {
        IStakeManager stakeManager = IStakeManager(getStakeManager());
        stakeManager.updateCommissionRate(_validatorId, _newCommissionRate);
    }

    /// @notice Allows to unjail the validator.
    /// @param _validatorId validator id
    function unjail(uint256 _validatorId) external override isOperator {
        IStakeManager stakeManager = IStakeManager(getStakeManager());
        stakeManager.unjail(_validatorId);
    }

    /// @notice Allows to get the operator contract.
    /// @return Returns operator contract address.
    function getOperator() public view returns (INodeOperatorRegistry) {
        return INodeOperatorRegistry(state.operator);
    }

    /// @notice Allows to get the operator contract.
    /// @return Returns operator contract address.
    function getOperatorA() public view returns (address) {
        console.log(state.operator);
        return state.operator;
    }

    /// @notice Allows to set the operator contract.
    function setOperator(address _operator) external {
        // TODO: check why the default value is 0x1 not 0x0
        state.operator = _operator;
    }

    /// @notice Allows to set the operator contract.
    function getState()
        external
        view
        returns (Operator.ValidatorState memory)
    {
        return state;
    }

    /// @notice Allows to get the stakeManager contract.
    /// @return Returns stakeManager contract address.
    function getStakeManager() public view returns (address) {
        return INodeOperatorRegistry(state.operator).getStakeManager();
    }

    /// @notice Contract version.
    /// @dev Returns contract version.
    function version() public view virtual override returns (string memory) {
        return "1.0.0";
    }
}
