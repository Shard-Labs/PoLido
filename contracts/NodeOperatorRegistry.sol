// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable, Initializable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./storages/NodeOperatorStorage.sol";
import "./interfaces/INodeOperatorRegistry.sol";
import "./interfaces/IValidatorFactory.sol";
import "./interfaces/IValidator.sol";
import "./lib/Operator.sol";
import "hardhat/console.sol";

/// @title NodeOperatorRegistry
/// @author 2021 Shardlabs.
/// @notice NodeOperatorRegistry is the main contract that manage validators
/// @dev NodeOperatorRegistry is the main contract that manage operators.
///
/// *********************************OPERATOR*********************************
/// Each operator is managed by one owner using the reward key submitted during
/// the add operator process.
///
/// **Stake**: after adding the operator, the next step is to stake on Polygon. The
/// stake func allows each operator's owner to stake, but before that, the owner
/// has to approve the amount + Heimdall fees to the ValidatorProxy. At the end of
/// this call, the status of the operator is set to STAKED.
///
/// **Restake**: restake allows an operator's owner to increase the total staked amount
/// on Polygon. The owner has to approve the amount to the ValidatorProxy then make
/// a call.
///
/// **TopUpForFee**: the operator's owner can topUp the heimdall fees by calling the
/// topUpForFee, but before that he need to approve the amount of heimdall fees to his
/// validatorProxy.
///
/// **UpdateSigner**: by calling this func the operator's owner can update the signer public key.
///
/// **Unstake**: when the operators's owner wants to quite the Lido system he can call
/// the unstake func, in this case, the operator status is set to UNSTAKED.
///
/// **Unjail**: when an operator is UNSTAKED the owner can switch back and stake the
/// operator by calling the unjail func, in this case, the operator status is set
/// to back STAKED.
///
/// **UnstakeClaim**: after the unstake the operator and waiting for the Polygon withdraw_delay
/// the owner can transfer back his staked balance by calling
/// unstakeClaim, after that the operator status is set to CLAIMED
///
/// **ClaimFee**: the operator's owner can claim the heimdall fees by calling claimFee
/// func, after that the operator status is set to EXIT.
///
/// *********************************GOVERNANCE*********************************
///
/// **AddOperator**: The operator life cycle starts when we call the addOperator
/// func allows adding a new operator. During this call, a new validatorProxy is
/// deployed by the ValidatorFactory which we can use later to interact with the
/// Polygon StakeManager. At the end of this call, the status of the operator
/// will be ACTIVE.
///
/// **RemoveOperator**: when the operator status is set to EXIT the GOVERNANCE can
/// call the removeOperator func to delete the operator, and the validatorProxy
/// used to interact with the Polygon stakeManager.
///
/// **UpgradeContract**: the GOVERNANCE can upgrade the contract.
///
/// **WithdrawRewards**: withdraw rewards from the validator using the _validatorId. Only the
/// owner can request withdraw in this the owner is this contract. This  functions is called
/// by a lido contract.
///
/// **UpdateOperatorCommissionRate**: update the commission rate for an operator on Polygon
/// stake manager.
///
/// **SetStakeAmountAndFees**: set the min and max amount to stake per operator and
/// the min and max Heimdall fees per operator.
///
/// **pause**: pause the operator contract.
///
/// **unpause**: unpause the operator contract.
///
/// **setRestake**: allows operators to restake.
///
/// **setUnjail**: allows operators to unjail.
///
/// **setLido**: set lido contract.
///
/// **setValidatorFactory**: set validato factory contract.
contract NodeOperatorRegistry is
    INodeOperatorRegistry,
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    NodeOperatorStorage
{
    // ====================================================================
    // =========================== MODIFIERS ==============================
    // ====================================================================

    /// @notice Check if the msg.sender has permission.
    /// @param _role role needed to call function.
    modifier userHasRole(bytes32 _role) {
        require(hasRole(_role, msg.sender), "Permission not found");
        _;
    }

    /// @notice Check if the amount to stake in bound.
    /// @param _amount amount to stake.
    modifier checkStakeAmount(uint256 _amount) {
        require(
            _amount >= state.minAmountStake && _amount <= state.maxAmountStake,
            "Invalid amount"
        );
        _;
    }

    /// @notice Check if the heimdall fees are in bound.
    /// @param _heimdallFee heimdall fee.
    modifier checkHeimdallFees(uint256 _heimdallFee) {
        require(
            _heimdallFee >= state.minHeimdallFees &&
                _heimdallFee <= state.maxHeimdallFees,
            "Invalid heimdallFee"
        );
        _;
    }

    // ====================================================================
    // =========================== FUNCTIONS ==============================
    // ====================================================================

    /// @notice Initialize the NodeOperator contract.
    function initialize(
        address _validatorFactory,
        // address _lido,
        address _stakeManager,
        address _polygonERC20
    ) public initializer {
        __Pausable_init();
        __AccessControl_init();

        // set default state
        state.validatorFactory = _validatorFactory;
        // state.lido = _lido;
        state.stakeManager = _stakeManager;
        state.polygonERC20 = _polygonERC20;
        state.commissionRate = 0;
        state.restake = false;
        state.unjail = false;
        state.maxAmountStake = 10 * 10**18;
        state.minAmountStake = 10 * 10**18;
        state.maxHeimdallFees = 20 * 10**18;
        state.minHeimdallFees = 20 * 10**18;

        // Set ACL roles
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADD_OPERATOR_ROLE, msg.sender);
        _setupRole(REMOVE_OPERATOR_ROLE, msg.sender);
        _setupRole(PAUSE_OPERATOR_ROLE, msg.sender);
        _setupRole(UPDATE_COMMISSION_RATE_ROLE, msg.sender);
        _setupRole(UPDATE_STAKE_HEIMDALL_FEES_ROLE, msg.sender);
    }

    /// @notice Add a new node operator to the system.
    /// @dev The operator life cycle starts when we call the addOperator
    /// func allows adding a new operator. During this call, a new validatorProxy is
    /// deployed by the ValidatorFactory which we can use later to interact with the
    /// Polygon StakeManager. At the end of this call, the status of the operator
    /// will be ACTIVE.
    /// @param _name the node operator name.
    /// @param _rewardAddress address used for ACL and receive rewards.
    /// @param _signerPubkey public key used on heimdall len 64 bytes.
    function addOperator(
        string memory _name,
        address _rewardAddress,
        bytes memory _signerPubkey
    ) public override whenNotPaused userHasRole(ADD_OPERATOR_ROLE) {
        require(_signerPubkey.length == 64, "Invalid Public Key");
        require(_rewardAddress != address(0), "Invalid reward address");
        require(operatorOwners[_rewardAddress] == 0, "Address already used");

        uint256 operatorId = state.totalNodeOpearator + 1;

        // deploy validator contract.
        address validatorContract = IValidatorFactory(state.validatorFactory)
            .create();

        // add the validator.
        operators[operatorId] = Operator.NodeOperator({
            status: Operator.NodeOperatorStatus.ACTIVE,
            name: _name,
            rewardAddress: _rewardAddress,
            validatorId: 0,
            signerPubkey: _signerPubkey,
            validatorShare: address(0),
            validatorContract: validatorContract,
            commissionRate: state.commissionRate
        });

        // update global state.
        operatorIds.push(operatorId);
        state.totalNodeOpearator++;
        state.totalActiveNodeOpearator++;

        // map user _rewardAddress with the operatorId.
        operatorOwners[_rewardAddress] = operatorId;

        // emit NewOperator event.
        emit NewOperator(
            operatorId,
            _name,
            _signerPubkey,
            Operator.NodeOperatorStatus.ACTIVE
        );
    }

    /// @notice Allows to remove an operator from the system.
    /// @dev when the operator status is set to EXIT the GOVERNANCE can
    /// call the removeOperator func to delete the operator, and the validatorProxy
    /// used to interact with the Polygon stakeManager.
    /// @param _operatorId the node operator id.
    function removeOperator(uint256 _operatorId)
        public
        override
        whenNotPaused
        userHasRole(REMOVE_OPERATOR_ROLE)
    {
        Operator.NodeOperator storage no = operators[_operatorId];
        require(
            no.status == Operator.NodeOperatorStatus.CLAIMED ||
                no.status == Operator.NodeOperatorStatus.EXIT,
            "Node Operator state isn't CLAIMED or EXIT"
        );

        state.totalNodeOpearator--;
        state.totalExitNodeOpearator--;

        // update the operatorIds array by removing the operator id.
        for (uint256 idx = 0; idx < operatorIds.length - 1; idx++) {
            if (_operatorId == operatorIds[idx]) {
                operatorIds[idx] = operatorIds[operatorIds.length - 1];
                break;
            }
        }
        operatorIds.pop();

        // remove validator proxy from the validatorFactory.
        IValidatorFactory(state.validatorFactory).remove(no.validatorContract);

        // delete operator and owner mappings from operators and operatorOwners.
        delete operatorOwners[no.rewardAddress];
        delete operators[_operatorId];

        emit RemoveOperator(_operatorId);
    }

    /// @notice Implement _authorizeUpgrade from UUPSUpgradeable contract to make the contract upgradable.
    /// @param newImplementation new contract implementation address.
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        userHasRole(DEFAULT_ADMIN_ROLE)
    {}

    // ====================================================================
    // ========================= VALIDATOR API ============================
    // ====================================================================

    /// @notice Allows to stake a validator on the Polygon stakeManager contract.
    /// @dev The stake func allows each operator's owner to stake, but before that,
    /// the owner has to approve the amount + Heimdall fees to the ValidatorProxy.
    /// At the end of this call, the status of the operator is set to STAKED.
    /// @param _amount amount to stake.
    /// @param _heimdallFee herimdall fees.
    function stake(uint256 _amount, uint256 _heimdallFee)
        external
        override
        whenNotPaused
        checkStakeAmount(_amount)
        checkHeimdallFees(_heimdallFee)
    {
        uint256 operatorId = operatorOwners[msg.sender];
        require(operatorId != 0, "Operator doesn't exist");

        Operator.NodeOperator storage no = operators[operatorId];
        require(
            no.status == Operator.NodeOperatorStatus.ACTIVE,
            "The Operator status is not active"
        );

        // stake a validator
        (no.validatorId, no.validatorShare) = IValidator(no.validatorContract)
            .stake(
                msg.sender,
                _amount,
                _heimdallFee,
                true,
                no.signerPubkey,
                no.commissionRate
            );

        // update the operator status to STAKED.
        no.status = Operator.NodeOperatorStatus.STAKED;
        no.commissionRate = state.commissionRate;

        // update global state.
        state.totalActiveNodeOpearator--;
        state.totalStakedNodeOpearator++;

        emit StakeOperator(operatorId, no.validatorId);
    }

    /// @notice Allows to restake Matics to Polygin stakeManager
    /// @dev restake allows an operator's owner to increase the total staked amount
    /// on Polygon. The owner has to approve the amount to the ValidatorProxy then make
    /// a call.
    /// @param _amount amount to stake.
    function restake(uint256 _amount)
        external
        override
        whenNotPaused
        checkStakeAmount(_amount)
    {
        require(_amount > 0, "Amount is ZERO");
        require(state.restake, "Restake is disabled");

        uint256 operatorId = operatorOwners[msg.sender];
        require(operatorId != 0, "Operator not exists");

        Operator.NodeOperator storage no = operators[operatorId];
        require(
            no.status == Operator.NodeOperatorStatus.STAKED,
            "The operator status is not STAKED"
        );

        IValidator(no.validatorContract).restake(
            msg.sender,
            no.validatorId,
            _amount,
            false
        );

        emit RestakeOperator(operatorId, no.validatorId);
    }

    /// @notice Unstake a validator from the Polygon stakeManager contract.
    /// @dev when the operators's owner wants to quite the Lido system he can call
    /// the unstake func, in this case, the operator status is set to UNSTAKED.
    function unstake() external override whenNotPaused {
        uint256 id = operatorOwners[msg.sender];
        require(id != 0, "Operator doesn't exist");

        Operator.NodeOperator storage no = operators[id];
        require(
            no.status == Operator.NodeOperatorStatus.STAKED,
            "The operator status is not STAKED"
        );
        IValidator(no.validatorContract).unstake(no.validatorId);

        no.status = Operator.NodeOperatorStatus.UNSTAKED;
        state.totalStakedNodeOpearator--;
        state.totalUnstakedNodeOpearator++;

        emit UnstakeOperator(id);
    }

    /// @notice Allows to unjail the validator and turn his status from UNSTAKED to STAKED.
    /// @dev when an operator is UNSTAKED the owner can switch back and stake the
    /// operator by calling the unjail func, in this case, the operator status is set
    /// to back STAKED.
    function unjail() external override whenNotPaused {
        require(state.unjail, "Unjail is disabled");

        uint256 operatorId = operatorOwners[msg.sender];
        require(operatorId != 0, "Operator doesn't exist");

        Operator.NodeOperator storage no = operators[operatorId];

        require(
            no.status == Operator.NodeOperatorStatus.UNSTAKED,
            "Operator status isn't UNSTAKED"
        );

        IValidator(no.validatorContract).unjail(no.validatorId);

        no.status = Operator.NodeOperatorStatus.STAKED;
        state.totalStakedNodeOpearator++;
        state.totalUnstakedNodeOpearator--;

        emit Unjail(operatorId, no.validatorId);
    }

    /// @notice Allows to top up heimdall fees.
    /// @dev the operator's owner can topUp the heimdall fees by calling the
    /// topUpForFee, but before that he need to approve the amount of heimdall
    /// fees to his validatorProxy.
    /// @param _heimdallFee amount
    function topUpForFee(uint256 _heimdallFee)
        external
        override
        whenNotPaused
        checkHeimdallFees(_heimdallFee)
    {
        uint256 id = operatorOwners[msg.sender];
        require(id != 0, "Operator doesn't exists");

        Operator.NodeOperator storage no = operators[id];
        require(
            no.status == Operator.NodeOperatorStatus.STAKED,
            "The operator status is not STAKED"
        );
        IValidator(no.validatorContract).topUpForFee(msg.sender, _heimdallFee);

        emit TopUpHeimdallFees(id, _heimdallFee);
    }

    /// @notice Allows to unstake staked tokens after withdraw delay.
    /// @dev after the unstake the operator and waiting for the Polygon withdraw_delay
    /// the owner can transfer back his staked balance by calling
    /// unstakeClaim, after that the operator status is set to CLAIMED
    function unstakeClaim() external override whenNotPaused {
        uint256 validatorId = operatorOwners[msg.sender];
        require(validatorId != 0, "Operator not exists");

        Operator.NodeOperator storage no = operators[validatorId];
        require(
            no.status == Operator.NodeOperatorStatus.UNSTAKED,
            "Operator status isn't UNSTAKED"
        );

        uint256 amount = IValidator(no.validatorContract).unstakeClaim(
            msg.sender,
            validatorId
        );

        no.status = Operator.NodeOperatorStatus.CLAIMED;
        state.totalUnstakedNodeOpearator--;
        state.totalExitNodeOpearator++;

        emit ClaimUnstake(validatorId, msg.sender, amount);
    }

    /// @notice Allows withdraw heimdall fees
    /// @dev the operator's owner can claim the heimdall fees.
    /// func, after that the operator status is set to EXIT.
    /// @param _accumFeeAmount accumulated heimdall fees
    /// @param _index index
    /// @param _proof proof
    function claimFee(
        uint256 _accumFeeAmount,
        uint256 _index,
        bytes memory _proof
    ) external override whenNotPaused {
        uint256 operatorId = operatorOwners[msg.sender];
        require(operatorId != 0, "Operator doesn't exist");

        Operator.NodeOperator memory no = operators[operatorId];

        require(
            no.status == Operator.NodeOperatorStatus.CLAIMED,
            "Operator status isn't CLAIMED"
        );

        require(_proof.length != 0, "Empty proof");
        require(_accumFeeAmount != 0, "AccumFeeAmount is ZERO");
        require(_index != 0, "index is ZERO");

        IValidator(no.validatorContract).claimFee(
            _accumFeeAmount,
            _index,
            _proof
        );

        emit ClaimFee(
            operatorId,
            no.validatorId,
            _accumFeeAmount,
            _index,
            _proof
        );
    }

    /// @notice Allows to update signer publickey
    /// @param _signerPubkey new signer publickey
    function updateSigner(bytes memory _signerPubkey)
        external
        override
        whenNotPaused
    {
        uint256 operatorId = operatorOwners[msg.sender];
        require(operatorId != 0, "Operator doesn't exist");

        Operator.NodeOperator storage no = operators[operatorId];

        require(
            no.status == Operator.NodeOperatorStatus.STAKED,
            "Operator status not STAKED"
        );

        IValidator(no.validatorContract).updateSigner(
            no.validatorId,
            _signerPubkey
        );

        no.signerPubkey = _signerPubkey;
        emit UpdateSignerPubkey(operatorId, no.validatorId, _signerPubkey);
    }

    // ====================================================================
    // ========================== GOVERNANCE ==============================
    // ====================================================================

    /// @notice Allows to withdraw rewards from the validator.
    /// @dev Allows to withdraw rewards from the validator using the _validatorId. Only the
    /// owner can request withdraw in this the owner is this contract. This  functions is called
    /// by a lido contract.
    function withdrawRewards()
        external
        override
        whenNotPaused
        returns (uint256[] memory, address[] memory)
    {
        require(msg.sender == state.lido, "Caller is not the lido contract");
        uint256[] memory shares = new uint256[](state.totalStakedNodeOpearator);
        address[] memory recipient = new address[](
            state.totalStakedNodeOpearator
        );
        uint256 index = 0;
        uint256 totalRewards = 0;

        // withdraw validator rewards
        for (uint256 id = 0; id < operatorIds.length; id++) {
            Operator.NodeOperator memory no = operators[operatorIds[id]];
            if (no.status == Operator.NodeOperatorStatus.STAKED) {
                uint256 rewards = IValidator(no.validatorContract)
                    .withdrawRewards(no.validatorId);

                recipient[index] = no.rewardAddress;
                shares[index] = rewards;
                totalRewards += rewards;
                index++;
            }
        }

        // calculate validators share
        for (uint256 idx = 0; idx < shares.length; idx++) {
            uint256 share = (shares[idx] * 100) / totalRewards;
            shares[idx] = share;
        }

        emit WithdrawRewards();

        return (shares, recipient);
    }

    /// @notice Allows to update commission rate
    /// @param _newCommissionRate new commission rate
    function updateOperatorCommissionRate(
        uint256 _operatorId,
        uint256 _newCommissionRate
    ) public override whenNotPaused userHasRole(UPDATE_COMMISSION_RATE_ROLE) {
        Operator.NodeOperator storage no = operators[_operatorId];
        require(
            no.status == Operator.NodeOperatorStatus.STAKED,
            "Operator status isn't STAKED"
        );

        IValidator(no.validatorContract).updateCommissionRate(
            no.validatorId,
            _newCommissionRate
        );

        no.commissionRate = state.commissionRate;

        emit UpdateCommissionRate(no.validatorId, _newCommissionRate);
    }

    /// @notice Allows to update the stake amount and heimdall fees
    /// @param _minAmountStake min amount to stake
    /// @param _maxAmountStake max amount to stake
    /// @param _minHeimdallFees min amount of heimdall fees
    /// @param _maxHeimdallFees max amount of heimdall fees
    function setStakeAmountAndFees(
        uint256 _minAmountStake,
        uint256 _maxAmountStake,
        uint256 _minHeimdallFees,
        uint256 _maxHeimdallFees
    ) public whenNotPaused userHasRole(UPDATE_STAKE_HEIMDALL_FEES_ROLE) {
        require(
            _minAmountStake >= 20 * 10**18 &&
                _minAmountStake <= _maxAmountStake,
            "Invalid amount"
        );
        require(
            _minHeimdallFees >= 10 * 10**18 &&
                _minHeimdallFees <= _maxHeimdallFees,
            "Invalid heimdallFees"
        );

        state.maxAmountStake = _maxAmountStake;
        state.minAmountStake = _minAmountStake;
        state.maxHeimdallFees = _maxHeimdallFees;
        state.minHeimdallFees = _minHeimdallFees;
    }

    /// @notice Allows to pause the contract.
    function pause() external userHasRole(PAUSE_OPERATOR_ROLE) {
        _pause();
    }

    /// @notice Allows to unpause the contract.
    function unpause() external userHasRole(PAUSE_OPERATOR_ROLE) {
        _unpause();
    }

    /// @notice Allows to toggle restake.
    function setRestake(bool _restake)
        external
        whenNotPaused
        userHasRole(DEFAULT_ADMIN_ROLE)
    {
        state.restake = _restake;
    }

    /// @notice Allows to toggle unjail.
    function setUnjail(bool _unjail)
        external
        whenNotPaused
        userHasRole(DEFAULT_ADMIN_ROLE)
    {
        state.unjail = _unjail;
    }

    /// @notice Allows to set the lido contract address.
    function setLido(address _lido)
        external
        whenNotPaused
        userHasRole(DEFAULT_ADMIN_ROLE)
    {
        state.lido = _lido;
    }

    /// @notice Allows to set the validator factory contract address.
    function setValidatorFactory(address _validatorFactory)
        external
        whenNotPaused
        userHasRole(DEFAULT_ADMIN_ROLE)
    {
        state.validatorFactory = _validatorFactory;
    }

    // ====================================================================
    // ============================ GETTERS ===============================
    // ====================================================================

    /// @notice Get the all operator ids availablein the system.
    /// @return Return a list of operator Ids.
    function getOperators() external view override returns (uint256[] memory) {
        return operatorIds;
    }

    /// @notice Allows to get a node operator by _operatorId.
    /// @param _operatorId the id of the operator.
    /// @param _full if true return the name of the operator else set to empty string.
    /// @return Returns node operator.
    function getNodeOperator(uint256 _operatorId, bool _full)
        external
        view
        override
        returns (Operator.NodeOperator memory)
    {
        Operator.NodeOperator memory opts = operators[_operatorId];
        if (!_full) {
            opts.name = "";
            return opts;
        }
        return opts;
    }

    /// @notice Get the validator factory address
    /// @return Returns the validator factory address.
    function getValidatorFactory() external view override returns (address) {
        return state.validatorFactory;
    }

    /// @notice Get the stake manager contract address.
    /// @return Returns the stake manager contract address.
    function getStakeManager() external view override returns (address) {
        return state.stakeManager;
    }

    /// @notice Get the polygon erc20 token (matic) contract address.
    /// @return Returns polygon erc20 token (matic) contract address.
    function getPolygonERC20() external view override returns (address) {
        return state.polygonERC20;
    }

    /// @notice Get the lido contract address.
    /// @return Returns lido contract address.
    function getLido() external view override returns (address) {
        return state.lido;
    }

    /// @notice Get the contract state.
    /// @return Returns the contract state.
    function getState()
        public
        view
        returns (Operator.NodeOperatorState memory)
    {
        return state;
    }

    /// @notice Get validator total stake.
    /// @param _validatorId validatorId.
    /// @return Returns the total staked by the validator.
    function validatorStake(uint256 _validatorId)
        external
        view
        override
        returns (uint256)
    {
        return IStakeManager(state.stakeManager).validatorStake(_validatorId);
    }

    /// @notice Get validator id by user address.
    /// @param _user user address.
    /// @return Returns the validator id.
    function getValidatorId(address _user)
        external
        view
        override
        returns (uint256)
    {
        return IStakeManager(state.stakeManager).getValidatorId(_user);
    }

    /// @notice Allows to get a list of operatorShare struct.
    /// @return Returns a list of operatorShare struct.
    function getOperatorShares()
        external
        view
        override
        returns (Operator.OperatorShare[] memory)
    {
        Operator.OperatorShare[]
            memory operatorShares = new Operator.OperatorShare[](
                state.totalStakedNodeOpearator
            );

        for (uint256 idx = 0; idx < operatorIds.length; idx++) {
            uint256 id = operatorIds[idx];
            if (operators[id].status == Operator.NodeOperatorStatus.STAKED) {
                operatorShares[idx] = Operator.OperatorShare({
                    operatorId: id,
                    validatorShare: operators[id].validatorShare
                });
            }
        }
        return operatorShares;
    }

    /// @notice Allows to get the address of the validatorShare of an operator.
    /// @return Returns the address of the validatorShare contract.
    function getOperatorShare(uint256 _operatorId)
        external
        view
        override
        returns (address)
    {
        return operators[_operatorId].validatorShare;
    }

    /// @notice get the reward addresses of the actual staked operators.
    /// @return Return the
    function getOperatorRewardAddresses()
        external
        view
        override
        returns (address[] memory)
    {
        address[] memory rewardAddresses = new address[](
            state.totalStakedNodeOpearator
        );
        uint256 index = 0;

        for (uint256 idx = 0; idx < operatorIds.length; idx++) {
            uint256 id = operatorIds[idx];
            if (operators[id].status == Operator.NodeOperatorStatus.STAKED) {
                rewardAddresses[index] = operators[id].rewardAddress;
                index++;
            }
        }
        return rewardAddresses;
    }

    /// @notice Get the contract version.
    /// @return Returns the contract version.
    function version() external view virtual override returns (string memory) {
        return "1.0.0";
    }
}
