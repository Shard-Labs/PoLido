// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "./interfaces/IStakeManager.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/INodeOperatorRegistry.sol";
import "hardhat/console.sol";

/// @title ValidatorImplementation
/// @author 2021 Shardlabs.
/// @notice The validator contract is a simple implementation of the stakeManager API, the
/// ValidatorProxies use this contract to interact with the stakeManager.
/// When a ValidatorProxy calls this implementation the state is copied
/// (owner, implementation, operator), then they are used to check if the msg-sender is the
/// node operator contract, and if the validatorProxy implementation match with the current
/// validator contract.
contract Validator is IERC721Receiver, IValidator {
    using SafeERC20 for IERC20;

    address private implementation;
    address private operator;
    address private validatorFactory;

    /// @notice Check if the operator contract is the msg.sender.
    modifier isOperator() {
        require(
            msg.sender == operator,
            "Caller should be the operator contract"
        );
        _;
    }

    /// @notice Allows to stake on the Polygon stakeManager contract by
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
        INodeOperatorRegistry no = getOperator();
        IStakeManager stakeManager = IStakeManager(no.getStakeManager());
        IERC20 polygonERC20 = IERC20(no.getPolygonERC20());

        uint256 totalAmount = _amount + _heimdallFee;
        polygonERC20.safeTransferFrom(_sender, address(this), totalAmount);
        polygonERC20.safeApprove(address(stakeManager), totalAmount);
        stakeManager.stakeFor(
            address(this),
            _amount,
            _heimdallFee,
            _acceptDelegation,
            _signerPubkey
        );

        uint256 validatorId = stakeManager.getValidatorId(address(this));
        address validatorShare = stakeManager.getValidatorContract(validatorId);
        if (_commissionRate > 0) {
            stakeManager.updateCommissionRate(validatorId, _commissionRate);
        }

        return (validatorId, validatorShare);
    }

    /// @notice Restake validator rewards or new Matics validator on stake manager.
    /// @param _sender operator's owner that approved tokens to the validator contract.
    /// @param _validatorId validator id.
    /// @param _amount amount to stake.
    /// @param _stakeRewards restake rewards.
    /// @param amountStaked total amount staked by the operator in stake manager.
    /// @return return a bool and the new total amount staked in stake manager.
    function restake(
        address _sender,
        uint256 _validatorId,
        uint256 _amount,
        bool _stakeRewards,
        uint256 amountStaked
    ) external override isOperator returns (bool, uint256){
        INodeOperatorRegistry no = getOperator();
        IStakeManager stakeManager = IStakeManager(no.getStakeManager());

        if (_amount > 0) {
            IERC20 polygonERC20 = IERC20(no.getPolygonERC20());
            polygonERC20.safeTransferFrom(_sender, address(this), _amount);
            polygonERC20.safeApprove(address(stakeManager), _amount);
        }
        if (stakeManager.validatorStake(_validatorId) != amountStaked) {
            return (false, 0);
        }

        stakeManager.restake(_validatorId, _amount, _stakeRewards);

        return (true, stakeManager.validatorStake(_validatorId));
    }

    /// @notice Unstake a validator from the Polygon stakeManager contract.
    /// @param _validatorId validatorId.
    function unstake(uint256 _validatorId) external override isOperator {
        IStakeManager(getOperator().getStakeManager()).unstake(_validatorId);
    }

    /// @notice Allows a validator to top-up the heimdall fees.
    /// @param _sender address that approved the _heimdallFee amount.
    /// @param _heimdallFee amount.
    function topUpForFee(address _sender, uint256 _heimdallFee)
        external
        override
        isOperator
    {
        INodeOperatorRegistry no = getOperator();
        IStakeManager stakeManager = IStakeManager(no.getStakeManager());
        IERC20 polygonERC20 = IERC20(no.getPolygonERC20());

        polygonERC20.safeTransferFrom(_sender, address(this), _heimdallFee);
        polygonERC20.safeApprove(address(stakeManager), _heimdallFee);
        stakeManager.topUpForFee(address(this), _heimdallFee);
    }

    /// @notice Allows to withdraw rewards from the validator using the _validatorId. Only the
    /// owner can request withdraw. The rewards are transfered to the _rewardAddress.
    /// @param _validatorId validator id.
    /// @param _rewardAddress reward address.
    function withdrawRewards(uint256 _validatorId, address _rewardAddress)
        external
        override
        isOperator
        returns (uint256)
    {
        INodeOperatorRegistry no = getOperator();
        IStakeManager(no.getStakeManager()).withdrawRewards(_validatorId);

        IERC20 polygonERC20 = IERC20(no.getPolygonERC20());
        uint256 balance = polygonERC20.balanceOf(address(this));
        polygonERC20.safeTransfer(_rewardAddress, balance);

        return balance;
    }

    /// @notice Allows to unstake the staked tokens (+rewards) and transfer them
    /// to the owner rewardAddress.
    /// @param _validatorId validator id.
    /// @param _rewardAddress rewardAddress address.
    function unstakeClaim(uint256 _validatorId, address _rewardAddress)
        external
        override
        isOperator
        returns (uint256)
    {
        INodeOperatorRegistry no = getOperator();
        IStakeManager stakeManager = IStakeManager(no.getStakeManager());
        stakeManager.unstakeClaim(_validatorId);

        IERC20 polygonERC20 = IERC20(no.getPolygonERC20());
        uint256 balance = polygonERC20.balanceOf(address(this));
        polygonERC20.safeTransfer(_rewardAddress, balance);

        return balance;
    }

    /// @notice Allows to update signer publickey.
    /// @param _validatorId validator id.
    /// @param _signerPubkey new publickey.
    function updateSigner(uint256 _validatorId, bytes memory _signerPubkey)
        external
        override
        isOperator
    {
        IStakeManager(getOperator().getStakeManager()).updateSigner(
            _validatorId,
            _signerPubkey
        );
    }

    /// @notice Allows withdraw heimdall fees.
    /// @param _accumFeeAmount accumulated heimdall fees.
    /// @param _index index.
    /// @param _proof proof.
    function claimFee(
        uint256 _accumFeeAmount,
        uint256 _index,
        bytes memory _proof,
        address _rewardAddress
    ) external override isOperator {
        INodeOperatorRegistry no = getOperator();
        IStakeManager stakeManager = IStakeManager(no.getStakeManager());
        stakeManager.claimFee(_accumFeeAmount, _index, _proof);

        IERC20 polygonERC20 = IERC20(no.getPolygonERC20());
        uint256 balance = polygonERC20.balanceOf(address(this));
        polygonERC20.safeTransfer(_rewardAddress, balance);
    }

    /// @notice Allows to update commission rate of a validator.
    /// @param _validatorId validator id.
    /// @param _newCommissionRate new commission rate.
    function updateCommissionRate(
        uint256 _validatorId,
        uint256 _newCommissionRate
    ) public override isOperator {
        IStakeManager(getOperator().getStakeManager()).updateCommissionRate(
            _validatorId,
            _newCommissionRate
        );
    }

    /// @notice Allows to unjail a validator.
    /// @param _validatorId validator id
    function unjail(uint256 _validatorId) external override isOperator {
        IStakeManager(getOperator().getStakeManager()).unjail(_validatorId);
    }

    /// @notice Allows to transfer the validator nft token to the reward address a validator.
    /// @param _validatorId operator id.
    /// @param _stakeManagerNFT stake manager nft contract.
    /// @param _rewardAddress reward address.
    function migrate(
        uint256 _validatorId,
        address _stakeManagerNFT,
        address _rewardAddress
    ) external override isOperator {
        IERC721 erc721 = IERC721(_stakeManagerNFT);
        erc721.approve(_rewardAddress, _validatorId);
        erc721.safeTransferFrom(address(this), _rewardAddress, _validatorId);
    }

    function join(
        uint256 _validatorId,
        address _stakeManagerNFT,
        address _rewardAddress,
        uint256 _newCommissionRate
    ) external override isOperator {
        IERC721 erc721 = IERC721(_stakeManagerNFT);
        erc721.safeTransferFrom(_rewardAddress, address(this), _validatorId);
        updateCommissionRate(_validatorId, _newCommissionRate);
    }

    /// @notice Allows to get the operator contract interface.
    /// @return Returns the node operator contract interface.
    function getOperator() internal view returns (INodeOperatorRegistry) {
        return INodeOperatorRegistry(operator);
    }

    /// @notice Allows to get the version of the validator implementation.
    /// @return Returns the version.
    function version() external pure returns (string memory) {
        return "1.0.0";
    }   

    /// @notice Implement @openzeppelin/contracts/token/ERC721/IERC721Receiver.sol interface.
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return
            bytes4(
                keccak256("onERC721Received(address,address,uint256,bytes)")
            );
    }
}