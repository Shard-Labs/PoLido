// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./interfaces/IStakeManager.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/INodeOperatorRegistry.sol";
import "./storages/ValidatorStorage.sol";

/// @title Validator
/// @author 2021 Shardlabs.
/// @notice Validator is the contract used to manage a staked validator on Polygon stake manager
/// @dev Validator is the contract used to manage a staked validator on Polygon stake manager
contract Validator is IValidator, ValidatorStorage, Initializable {
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

        emit Stake(
            address(this),
            _amount,
            _heimdallFee,
            _acceptDelegation,
            _signerPubkey
        );
    }

    /// @notice Unstake a validator from the Polygon stakeManager contract.
    /// @dev Unstake a validator from the Polygon stakeManager contract by passing the validatorId
    /// @param _validatorId validatorId.
    function unstake(uint256 _validatorId) external override isOperator {
        address stakeManager = getStakeManager();

        // call polygon stake manager
        IStakeManager(stakeManager).unstake(_validatorId);
        emit Unstake(_validatorId);
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
        emit TopUpForFee(address(this), _heimdallFee);
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

        emit WithdrawRewards(_validatorId);
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
        returns (uint256, uint256)
    {
        INodeOperatorRegistry operator = getOperator();
        IStakeManager stakeManager = IStakeManager(operator.getStakeManager());
        
        uint256 amount = stakeManager.validatorStake(_validatorId);
        stakeManager.unstakeClaim(_validatorId);
        uint256 balance = IERC20(operator.getPolygonERC20()).balanceOf(address(this));
        IERC20(operator.getPolygonERC20()).safeTransfer(_ownerRecipient, amount);

        return (amount, balance - amount);
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

    // /// @notice Implement _authorizeUpgrade from UUPSUpgradeable contract to make the contract upgradable.
    // /// @param newImplementation new contract implementation address.
    // function _authorizeUpgrade(address newImplementation)
    //     internal
    //     override
    //     isOperator
    // {}

    /// @notice Contract version.
    /// @dev Returns contract version.
    function version() public view virtual override returns (string memory) {
        return "1.0.0";
    }
}
