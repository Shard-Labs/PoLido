// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

import "./interfaces/IStakeManager.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/INodeOperatorRegistry.sol";

/// @title Validator
/// @author 2021 Shardlabs.
/// @notice The Validator is a contract implementation used by the validator proxy.
/// The msg.sender has to be always the node operator registry contract.
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

    /// @notice Stake allows to stake on the Polygon stakeManager contract
    /// @dev Allows to stake on the Polygon stakeManager contract by
    /// calling stakeFor function and set the user as the equal to this validator proxy
    /// address.
    /// @param _sender the address of the operator-owner that approved Matics.
    /// @param _amount the amount to stake with.
    /// @param _heimdallFee the heimdall fees.
    /// @param _acceptDelegation accept delegation.
    /// @param _signerPubkey signer public key used on the heimdall node.
    /// @param _commissionRate validator commision rate
    /// @return Returns the validatorId and the validatorShare contract address.
    function stake(
        address _sender,
        uint256 _amount,
        uint256 _heimdallFee,
        bool _acceptDelegation,
        bytes memory _signerPubkey,
        uint256 _commissionRate
    ) external override isOperator returns (uint256, address) {
        // get operator
        INodeOperatorRegistry operator = getOperator();

        // get stakeManager
        IStakeManager stakeManager = IStakeManager(operator.getStakeManager());

        uint256 totalAmount = _amount + _heimdallFee;
        // approve Polygon token to stake manager totalAmount
        IERC20 polygonERC20 = IERC20(operator.getPolygonERC20());

        // transfer tokens from user to this contract
        polygonERC20.safeTransferFrom(_sender, address(this), totalAmount);

        // approve to stakeManager
        polygonERC20.safeApprove(address(stakeManager), totalAmount);

        // call polygon stake manager
        stakeManager.stakeFor(
            address(this),
            _amount,
            _heimdallFee,
            _acceptDelegation,
            _signerPubkey
        );
        // get validator id
        uint256 validatorId = stakeManager.getValidatorId(address(this));
        // get validatorShare contract
        address validatorShare = stakeManager.getValidatorContract(validatorId);
        // set commision
        stakeManager.updateCommissionRate(validatorId, _commissionRate);

        return (validatorId, validatorShare);
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
        IERC20 polygonERC20 = IERC20(operator.getPolygonERC20());

        // transfer tokens from user to this contract
        polygonERC20.safeTransferFrom(_sender, address(this), _amount);

        // approve to stakeManager
        polygonERC20.safeApprove(stakeManager, _amount);

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
        // call polygon stake manager
        IStakeManager(getStakeManager()).unstake(_validatorId);
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

        IERC20 polygonERC20 = IERC20(operator.getPolygonERC20());

        // transfer tokens from user to this contract
        polygonERC20.safeTransferFrom(_sender, address(this), _heimdallFee);

        // approve to stakeManager
        polygonERC20.safeApprove(stakeManager, _heimdallFee);

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
        IERC20 polygonERC20 = IERC20(operator.getPolygonERC20());
        uint256 balance = polygonERC20.balanceOf(address(this));
        polygonERC20.safeTransfer(operator.getLido(), balance);

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

        // get total staked before unstake.
        uint256 amountStaked = stakeManager.validatorStake(_validatorId);

        // claim unstake
        stakeManager.unstakeClaim(_validatorId);

        // get the balance of this contract.
        uint256 balance = IERC20(operator.getPolygonERC20()).balanceOf(
            address(this)
        );

        uint256 amount = (balance >= amountStaked ? amountStaked : balance);
        // transfer the amount to the owner.
        IERC20(operator.getPolygonERC20()).safeTransfer(
            _ownerRecipient,
            amount
        );

        if (balance - amount > 0) {
            // transfer the rest(rewards) to the lido contract
            IERC20(operator.getPolygonERC20()).safeTransfer(
                operator.getLido(),
                balance - amount
            );
        }

        return amount;
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

    /// @notice Allows to set the operator contract.
    function getState() external view returns (Operator.ValidatorState memory) {
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
