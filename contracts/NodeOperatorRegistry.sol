// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./interfaces/INodeOperatorRegistry.sol";
import "./interfaces/IValidatorFactory.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/IStMATIC.sol";

/// @title NodeOperatorRegistry
/// @author 2021 ShardLabs.
/// @notice NodeOperatorRegistry is the main contract that manage validators
/// @dev NodeOperatorRegistry is the main contract that manage operators.
contract NodeOperatorRegistry is
    INodeOperatorRegistry,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    enum NodeOperatorStatus {
        INACTIVE,
        ACTIVE,
        STOPPED,
        UNSTAKED,
        CLAIMED,
        WAIT,
        EXIT
    }
    /// @notice The node operator struct
    /// @param status node operator status(INACTIVE, ACTIVE, STOPPED, CLAIMED, UNSTAKED, WAIT, EXIT).
    /// @param name node operator name.
    /// @param rewardAddress Validator public key used for access control and receive rewards.
    /// @param validatorId validator id of this node operator on the polygon stake manager.
    /// @param signerPubkey public key used on heimdall.
    /// @param validatorShare validator share contract used to delegate for on polygon.
    /// @param validatorProxy the validator proxy, the owner of the validator.
    /// @param commissionRate the commission rate applied by the operator on polygon.
    /// @param slashed the number of times this operator was slashed, will be decreased after the slashedTimestamp + slashingDelay < block.timestamp.
    /// @param slashedTimestamp the timestamp when the operator was slashed.
    /// @param statusUpdatedTimestamp the timestamp when the operator updated the status (ex: INACTIVE -> ACTIVE)
    /// @param maxDelegateLimit max delegation limit that StMatic contract will delegate to this operator each time delegate function is called.
    struct NodeOperator {
        NodeOperatorStatus status;
        string name;
        address rewardAddress;
        bytes signerPubkey;
        address validatorShare;
        address validatorProxy;
        uint256 validatorId;
        uint256 commissionRate;
        uint256 slashed;
        uint256 slashedTimestamp;
        uint256 statusUpdatedTimestamp;
        uint256 maxDelegateLimit;
        uint256 amountStaked;
    }

    /// @notice all the roles.
    bytes32 public constant REMOVE_OPERATOR_ROLE =
        keccak256("LIDO_REMOVE_OPERATOR");
    bytes32 public constant PAUSE_OPERATOR_ROLE =
        keccak256("LIDO_PAUSE_OPERATOR");
    bytes32 public constant DAO_ROLE = keccak256("LIDO_DAO");

    /// @notice contract version.
    string public version;
    /// @notice total node operators.
    uint256 private totalNodeOperator;
    /// @notice total inactive node operators.
    uint256 private totalInactiveNodeOperator;
    /// @notice total active node operators.
    uint256 private totalActiveNodeOperator;
    /// @notice total stopped node operators.
    uint256 private totalStoppedNodeOperator;
    /// @notice total unstaked node operators.
    uint256 private totalUnstakedNodeOperator;
    /// @notice total claimed node operators.
    uint256 private totalClaimedNodeOperator;
    /// @notice total wait node operators.
    uint256 private totalWaitNodeOperator;
    /// @notice total exited node operators.
    uint256 private totalExitNodeOperator;

    /// @notice validatorFactory address.
    address private validatorFactory;
    /// @notice stakeManager address.
    address private stakeManager;
    /// @notice polygonERC20 token (Matic) address.
    address private polygonERC20;
    /// @notice stMATIC address.
    address private stMATIC;

    /// @notice min amount allowed to stake per validator.
    uint256 public minAmountStake;

    /// @notice min HeimdallFees allowed to stake per validator.
    uint256 public minHeimdallFees;

    /// @notice commision rate applied to all the operators.
    uint256 public commissionRate;

    /// @notice allows restake.
    bool public allowsRestake;

    /// @notice allows unjail a validator.
    bool public allowsUnjail;

    /// @notice the default period where an operator will marked as "was slashed".
    uint256 public slashingDelay;

    /// @notice default max delgation limit.
    uint256 public defaultMaxDelegateLimit;

    /// @notice This stores the operators ids.
    uint256[] private operatorIds;

    /// @notice Mapping of all owners with node operator id. Mapping is used to be able to
    /// extend the struct.
    mapping(address => uint256) private operatorOwners;

    /// @notice Mapping of all validatorShare with operatorId
    mapping(address => uint256) private validatorShare2OperatorId;

    /// @notice Mapping of all node operators. Mapping is used to be able to extend the struct.
    mapping(uint256 => NodeOperator) private operators;

    /// --------------------------- Modifiers-----------------------------------

    /// @notice Check if the msg.sender has permission.
    /// @param _role role needed to call function.
    modifier userHasRole(bytes32 _role) {
        checkCondition(hasRole(_role, msg.sender), "unauthorized");
        _;
    }

    /// @notice Check if the amount is inbound.
    /// @param _amount amount to stake.
    modifier checkStakeAmount(uint256 _amount) {
        checkCondition(_amount >= minAmountStake, "Invalid amount");
        _;
    }

    /// @notice Check if the heimdall fee is inbound.
    /// @param _heimdallFee heimdall fee.
    modifier checkHeimdallFees(uint256 _heimdallFee) {
        checkCondition(_heimdallFee >= minHeimdallFees, "Invalid fees");
        _;
    }

    /// @notice Check if the maxDelegateLimit is less or equal to 10 Billion.
    /// @param _maxDelegateLimit max delegate limit.
    modifier checkMaxDelegationLimit(uint256 _maxDelegateLimit) {
        checkCondition(
            _maxDelegateLimit <= 10000000000 ether,
            "Max amount <= 10B"
        );
        _;
    }

    /// @notice Check if the rewardAddress is already used.
    /// @param _rewardAddress new reward address.
    modifier checkIfRewardAddressIsUsed(address _rewardAddress) {
        checkCondition(
            operatorOwners[_rewardAddress] == 0 && _rewardAddress != address(0),
            "Address used"
        );
        _;
    }

    /// -------------------------- initialize ----------------------------------

    /// @notice Initialize the NodeOperator contract.
    function initialize(
        address _validatorFactory,
        address _stakeManager,
        address _polygonERC20
    ) external initializer {
        __Pausable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        validatorFactory = _validatorFactory;
        stakeManager = _stakeManager;
        polygonERC20 = _polygonERC20;

        minAmountStake = 10 * 10**18;
        minHeimdallFees = 20 * 10**18;
        slashingDelay = 2**13;
        defaultMaxDelegateLimit = 10 ether;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(REMOVE_OPERATOR_ROLE, msg.sender);
        _setupRole(PAUSE_OPERATOR_ROLE, msg.sender);
        _setupRole(DAO_ROLE, msg.sender);
    }

    /// ----------------------------- API --------------------------------------

    /// @notice Add a new node operator to the system.
    /// @dev The operator life cycle starts when we call the addOperator
    /// func allows adding a new operator. During this call, a new validatorProxy is
    /// deployed by the ValidatorFactory which we can use later to interact with the
    /// Polygon StakeManager. At the end of this call, the status of the operator
    /// will be INACTIVE.
    /// @param _name the node operator name.
    /// @param _rewardAddress address used for ACL and receive rewards.
    /// @param _signerPubkey public key used on heimdall len 64 bytes.
    function addOperator(
        string memory _name,
        address _rewardAddress,
        bytes memory _signerPubkey
    )
        external
        override
        whenNotPaused
        userHasRole(DAO_ROLE)
        checkIfRewardAddressIsUsed(_rewardAddress)
    {
        uint256 operatorId = totalNodeOperator + 1;
        address validatorProxy = IValidatorFactory(validatorFactory).create();

        operators[operatorId] = NodeOperator({
            status: NodeOperatorStatus.INACTIVE,
            name: _name,
            rewardAddress: _rewardAddress,
            validatorId: 0,
            signerPubkey: _signerPubkey,
            validatorShare: address(0),
            validatorProxy: validatorProxy,
            commissionRate: commissionRate,
            slashed: 0,
            slashedTimestamp: 0,
            statusUpdatedTimestamp: block.timestamp,
            maxDelegateLimit: defaultMaxDelegateLimit,
            amountStaked: 0
        });
        operatorIds.push(operatorId);
        totalNodeOperator++;
        totalInactiveNodeOperator++;

        operatorOwners[_rewardAddress] = operatorId;

        emit AddOperator(operatorId);
    }

    /// @notice Allows to stop an operator from the system.
    /// @param _operatorId the node operator id.
    function stopOperator(uint256 _operatorId)
        external
        override
        userHasRole(DAO_ROLE)
    {
        (, NodeOperator storage no) = getOperator(_operatorId);
        NodeOperatorStatus status = no.status;
        checkCondition(
            no.rewardAddress != address(0) &&
                status <= NodeOperatorStatus.ACTIVE,
            "Invalid status"
        );

        if (status == NodeOperatorStatus.INACTIVE) {
            no.status = NodeOperatorStatus.EXIT;
            totalInactiveNodeOperator--;
            totalExitNodeOperator++;
        } else if (status == NodeOperatorStatus.ACTIVE) {
            IStMATIC(stMATIC).withdrawTotalDelegated(no.validatorShare);
            no.status = NodeOperatorStatus.STOPPED;
            totalActiveNodeOperator--;
            totalStoppedNodeOperator++;
        }

        emit StopOperator(_operatorId);
    }

    /// @notice Allows to switch an operator status from WAIT to EXIT.
    /// this function should only be called by the StMatic contract inside claimTokens2StMatic.
    function exitOperator(address _validatorShare) external override {
        checkCondition(msg.sender == stMATIC, "Caller is not stMATIC contract");

        uint256 operatorId = validatorShare2OperatorId[_validatorShare];
        checkCondition(operatorId != 0, "Operator not found");

        NodeOperator storage no = operators[operatorId];
        NodeOperatorStatus status = no.status;

        delete validatorShare2OperatorId[no.validatorShare];

        if (
            status == NodeOperatorStatus.UNSTAKED ||
            status == NodeOperatorStatus.CLAIMED
        ) {
            return;
        }

        checkCondition(status == NodeOperatorStatus.WAIT, "Invalid status");
        no.status = NodeOperatorStatus.EXIT;

        totalWaitNodeOperator--;
        totalExitNodeOperator++;
    }

    /// @notice Allows to remove an operator from the system.when the operator status is
    /// set to EXIT the GOVERNANCE can call the removeOperator func to delete the operator,
    /// and the validatorProxy used to interact with the Polygon stakeManager.
    /// @param _operatorId the node operator id.
    function removeOperator(uint256 _operatorId)
        external
        override
        whenNotPaused
        userHasRole(REMOVE_OPERATOR_ROLE)
    {
        (, NodeOperator storage no) = getOperator(_operatorId);
        checkCondition(no.status == NodeOperatorStatus.EXIT, "Invalid status");

        // update the operatorIds array by removing the operator id.
        for (uint256 idx = 0; idx < operatorIds.length - 1; idx++) {
            if (_operatorId == operatorIds[idx]) {
                operatorIds[idx] = operatorIds[operatorIds.length - 1];
                break;
            }
        }
        operatorIds.pop();

        totalNodeOperator--;
        totalExitNodeOperator--;
        IValidatorFactory(validatorFactory).remove(no.validatorProxy);
        delete operatorOwners[no.rewardAddress];
        delete operators[_operatorId];

        emit RemoveOperator(_operatorId);
    }

    /// @notice Allows a validator that was already staked on the polygon stake manager
    /// to join the PoLido protocol.
    function joinOperator() external override whenNotPaused {
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.INACTIVE,
            "Invalid status"
        );

        IStakeManager sm = IStakeManager(stakeManager);
        uint256 validatorId = sm.getValidatorId(msg.sender);

        checkCondition(validatorId != 0, "ValidatorId=0");

        IStakeManager.Validator memory poValidator = sm.validators(validatorId);

        checkCondition(
            poValidator.contractAddress != address(0),
            "Validator has no ValidatorShare"
        );

        checkCondition(
            poValidator.status == IStakeManager.Status.Active,
            "Validator isn't ACTIVE"
        );

        checkCondition(
            poValidator.signer ==
                address(uint160(uint256(keccak256(no.signerPubkey)))),
            "Invalid Signer"
        );

        IValidator(no.validatorProxy).join(
            validatorId,
            sm.NFTContract(),
            msg.sender,
            no.commissionRate,
            stakeManager
        );

        no.amountStaked = sm.validatorStake(no.validatorId);
        no.status = NodeOperatorStatus.ACTIVE;
        no.validatorId = validatorId;
        no.statusUpdatedTimestamp = block.timestamp;

        address validatorShare = sm.getValidatorContract(validatorId);
        no.validatorShare = validatorShare;
        validatorShare2OperatorId[validatorShare] = operatorId;

        totalActiveNodeOperator++;
        totalInactiveNodeOperator--;

        emit JoinOperator(operatorId);
    }

    /// ------------------------Stake Manager API-------------------------------

    /// @notice Allows to stake a validator on the Polygon stakeManager contract.
    /// @dev The stake func allows each operator's owner to stake, but before that,
    /// the owner has to approve the amount + Heimdall fees to the ValidatorProxy.
    /// At the end of this call, the status of the operator is set to ACTIVE.
    /// @param _amount amount to stake.
    /// @param _heimdallFee herimdall fees.
    function stake(uint256 _amount, uint256 _heimdallFee)
        external
        override
        whenNotPaused
        checkStakeAmount(_amount)
        checkHeimdallFees(_heimdallFee)
    {
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.INACTIVE,
            "Invalid status"
        );
        (uint256 validatorId, address validatorShare) = IValidator(
            no.validatorProxy
        ).stake(
                msg.sender,
                _amount,
                _heimdallFee,
                true,
                no.signerPubkey,
                no.commissionRate,
                stakeManager,
                polygonERC20
            );

        no.validatorId = validatorId;
        no.validatorShare = validatorShare;
        no.amountStaked += _amount;
        no.status = NodeOperatorStatus.ACTIVE;
        no.statusUpdatedTimestamp = block.timestamp;

        totalInactiveNodeOperator--;
        totalActiveNodeOperator++;
        validatorShare2OperatorId[validatorShare] = operatorId;

        emit StakeOperator(operatorId, _amount, _heimdallFee);
    }

    /// @notice Allows to restake Matics to Polygon stakeManager
    /// @dev restake allows an operator's owner to increase the total staked amount
    /// on Polygon. The owner has to approve the amount to the ValidatorProxy then make
    /// a call. The owner can restake the rewards accumulated by setting the "_restakeRewards"
    /// to true
    /// @param _amount amount to stake.
    /// @param _restakeRewards bool to restake rewards.
    function restake(uint256 _amount, bool _restakeRewards)
        external
        override
        whenNotPaused
    {
        checkCondition(allowsRestake, "Restake is disabled");
        if (_amount == 0 && !_restakeRewards) {
            revert("Amount is ZERO");
        }

        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.ACTIVE,
            "Invalid status"
        );
        (bool ok, uint256 newAmount) = IValidator(no.validatorProxy).restake(
            msg.sender,
            no.validatorId,
            _amount,
            false,
            no.amountStaked,
            stakeManager,
            polygonERC20
        );

        checkCondition(ok, "Could not restake, try later");
        no.amountStaked = newAmount;

        emit RestakeOperator(operatorId, _amount, _restakeRewards);
    }

    /// @notice Unstake a validator from the Polygon stakeManager contract.
    /// @dev when the operators's owner wants to quite the PoLido protocol he can call
    /// the unstake func, in this case, the operator status is set to UNSTAKED.
    function unstake() external override whenNotPaused {
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.ACTIVE,
            "Invalid status"
        );
        IValidator(no.validatorProxy).unstake(no.validatorId, stakeManager);
        IStMATIC(stMATIC).withdrawTotalDelegated(no.validatorShare);

        no.status = NodeOperatorStatus.UNSTAKED;
        no.statusUpdatedTimestamp = block.timestamp;
        totalActiveNodeOperator--;
        totalUnstakedNodeOperator++;

        emit UnstakeOperator(operatorId);
    }

    /// @notice Allows the operator's owner to migrate the validator ownership to rewardAddress.
    /// This can be done only in the case where this operator was stopped by the DAO.
    function migrate() external override nonReentrant {
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.STOPPED,
            "Invalid status"
        );
        IValidator(no.validatorProxy).migrate(
            no.validatorId,
            IStakeManager(stakeManager).NFTContract(),
            no.rewardAddress
        );

        totalStoppedNodeOperator--;
        totalWaitNodeOperator++;
        no.status = NodeOperatorStatus.WAIT;

        emit MigrateOperator(operatorId);
    }

    /// @notice Allows to unjail the validator and turn his status from UNSTAKED to ACTIVE.
    /// @dev when an operator is UNSTAKED the owner can switch back and stake the
    /// operator by calling the unjail func, in this case, the operator status is set
    /// to back ACTIVE.
    function unjail() external override whenNotPaused {
        checkCondition(allowsUnjail, "Unjail is disabled");

        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.UNSTAKED,
            "Invalid status"
        );
        IValidator(no.validatorProxy).unjail(no.validatorId, stakeManager);

        no.status = NodeOperatorStatus.ACTIVE;
        no.statusUpdatedTimestamp = block.timestamp;

        totalActiveNodeOperator++;
        totalUnstakedNodeOperator--;

        emit Unjail(operatorId);
    }

    /// @notice Allows to top up heimdall fees.
    /// @dev the operator's owner can topUp the heimdall fees by calling the
    /// topUpForFee, but before that node operator needs to approve the amount of heimdall
    /// fees to his validatorProxy.
    /// @param _heimdallFee amount
    function topUpForFee(uint256 _heimdallFee)
        external
        override
        whenNotPaused
        checkHeimdallFees(_heimdallFee)
    {
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.ACTIVE,
            "Invalid status"
        );
        IValidator(no.validatorProxy).topUpForFee(
            msg.sender,
            _heimdallFee,
            stakeManager,
            polygonERC20
        );

        emit TopUpHeimdallFees(operatorId, _heimdallFee);
    }

    /// @notice Allows to unstake staked tokens after withdraw delay.
    /// @dev after the unstake the operator and waiting for the Polygon withdraw_delay
    /// the owner can transfer back his staked balance by calling
    /// unstakeClaim, after that the operator status is set to CLAIMED
    function unstakeClaim() external override whenNotPaused {
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.UNSTAKED,
            "Invalid status"
        );
        uint256 amount = IValidator(no.validatorProxy).unstakeClaim(
            no.validatorId,
            msg.sender,
            stakeManager,
            polygonERC20
        );

        no.status = NodeOperatorStatus.CLAIMED;
        no.statusUpdatedTimestamp = block.timestamp;
        no.amountStaked = 0;

        totalUnstakedNodeOperator--;
        totalClaimedNodeOperator++;

        emit UnstakeClaim(operatorId, amount);
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
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.CLAIMED,
            "Invalid status"
        );
        IValidator(no.validatorProxy).claimFee(
            _accumFeeAmount,
            _index,
            _proof,
            no.rewardAddress,
            stakeManager,
            polygonERC20
        );

        totalClaimedNodeOperator--;

        if (validatorShare2OperatorId[no.validatorShare] != 0) {
            no.status = NodeOperatorStatus.WAIT;
            totalWaitNodeOperator++;
        } else {
            no.status = NodeOperatorStatus.EXIT;
            totalExitNodeOperator++;
            delete validatorShare2OperatorId[no.validatorShare];
        }
        no.statusUpdatedTimestamp = block.timestamp;

        emit ClaimFee(operatorId);
    }

    /// @notice Allows the operator's owner to withdraw rewards.
    function withdrawRewards() external override whenNotPaused {
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status == NodeOperatorStatus.ACTIVE,
            "Invalid status"
        );
        address rewardAddress = no.rewardAddress;
        uint256 rewards = IValidator(no.validatorProxy).withdrawRewards(
            no.validatorId,
            rewardAddress,
            stakeManager,
            polygonERC20
        );

        emit WithdrawRewards(operatorId, rewardAddress, rewards);
    }

    /// @notice Allows the operator's owner to update signer publickey.
    /// @param _signerPubkey new signer publickey
    function updateSigner(bytes memory _signerPubkey)
        external
        override
        whenNotPaused
    {
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status <= NodeOperatorStatus.ACTIVE,
            "Invalid status"
        );
        if (no.status == NodeOperatorStatus.ACTIVE) {
            IValidator(no.validatorProxy).updateSigner(
                no.validatorId,
                _signerPubkey,
                stakeManager
            );
        }

        no.signerPubkey = _signerPubkey;

        emit UpdateSignerPubkey(operatorId);
    }

    /// @notice Allows the operator owner to update the name.
    /// @param _name new operator name.
    function setOperatorName(string memory _name)
        external
        override
        whenNotPaused
    {
        // uint256 operatorId = getOperatorId(msg.sender);
        // NodeOperator storage no = operators[operatorId];
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(
            no.status <= NodeOperatorStatus.ACTIVE,
            "Invalid status"
        );
        no.name = _name;

        emit NewName(operatorId, _name);
    }

    /// @notice Allows the operator owner to update the rewardAddress.
    /// @param _rewardAddress new reward address.
    function setOperatorRewardAddress(address _rewardAddress)
        external
        override
        whenNotPaused
        checkIfRewardAddressIsUsed(_rewardAddress)
    {
        (uint256 operatorId, NodeOperator storage no) = getOperator(0);
        checkCondition(no.rewardAddress != address(0), "Invalid status");
        no.rewardAddress = _rewardAddress;

        operatorOwners[_rewardAddress] = operatorId;
        delete operatorOwners[msg.sender];

        emit NewRewardAddress(operatorId, _rewardAddress);
    }

    /// -------------------------------DAO--------------------------------------

    /// @notice Allows the DAO to set the operator defaultMaxDelegateLimit.
    /// @param _defaultMaxDelegateLimit default max delegation amount.
    function setDefaultMaxDelegateLimit(uint256 _defaultMaxDelegateLimit)
        external
        override
        userHasRole(DAO_ROLE)
        checkMaxDelegationLimit(_defaultMaxDelegateLimit)
    {
        defaultMaxDelegateLimit = _defaultMaxDelegateLimit;
    }

    /// @notice Allows the DAO to set the operator maxDelegateLimit.
    /// @param _operatorId operator id.
    /// @param _maxDelegateLimit max amount to delegate .
    function setMaxDelegateLimit(uint256 _operatorId, uint256 _maxDelegateLimit)
        external
        override
        userHasRole(DAO_ROLE)
        checkMaxDelegationLimit(_maxDelegateLimit)
    {
        (, NodeOperator storage no) = getOperator(_operatorId);
        checkCondition(no.rewardAddress != address(0), "Invalid status");
        no.maxDelegateLimit = _maxDelegateLimit;
    }

    /// @notice Allows the DAO to set the slashingDelay.
    /// @param _slashingDelay slashing delay in seconds.
    function setSlashingDelay(uint256 _slashingDelay)
        external
        override
        userHasRole(DAO_ROLE)
    {
        slashingDelay = _slashingDelay;
    }

    /// @notice Allows to set the commission rate used.
    function setCommissionRate(uint256 _commissionRate)
        external
        override
        userHasRole(DAO_ROLE)
    {
        commissionRate = _commissionRate;
    }

    /// @notice Allows the dao to update commission rate for an operator.
    /// @param _operatorId id of the operator
    /// @param _newCommissionRate new commission rate
    function updateOperatorCommissionRate(
        uint256 _operatorId,
        uint256 _newCommissionRate
    ) external override userHasRole(DAO_ROLE) {
        (, NodeOperator storage no) = getOperator(_operatorId);
        checkCondition(
            no.rewardAddress != address(0) ||
                no.status == NodeOperatorStatus.ACTIVE,
            "Invalid status"
        );

        if (no.status == NodeOperatorStatus.ACTIVE) {
            IValidator(no.validatorProxy).updateCommissionRate(
                no.validatorId,
                _newCommissionRate,
                stakeManager
            );
        }

        no.commissionRate = _newCommissionRate;

        emit UpdateCommissionRate(_operatorId, _newCommissionRate);
    }

    /// @notice Allows to update the stake amount and heimdall fees
    /// @param _minAmountStake min amount to stake
    /// @param _minHeimdallFees min amount of heimdall fees
    function setStakeAmountAndFees(
        uint256 _minAmountStake,
        uint256 _minHeimdallFees
    )
        external
        override
        userHasRole(DAO_ROLE)
        checkStakeAmount(_minAmountStake)
        checkHeimdallFees(_minHeimdallFees)
    {
        minAmountStake = _minAmountStake;
        minHeimdallFees = _minHeimdallFees;
    }

    /// @notice Allows to pause the contract.
    function togglePause() external override userHasRole(PAUSE_OPERATOR_ROLE) {
        paused() ? _unpause() : _pause();
    }

    /// @notice Allows to toggle restake.
    function setRestake(bool _restake) external override userHasRole(DAO_ROLE) {
        allowsRestake = _restake;
    }

    /// @notice Allows to toggle unjail.
    function setUnjail(bool _unjail) external override userHasRole(DAO_ROLE) {
        allowsUnjail = _unjail;
    }

    /// @notice Allows to set the StMATIC contract address.
    function setStMATIC(address _stMATIC)
        external
        override
        userHasRole(DAO_ROLE)
    {
        stMATIC = _stMATIC;
    }

    /// @notice Allows to set the validator factory contract address.
    function setValidatorFactory(address _validatorFactory)
        external
        override
        userHasRole(DAO_ROLE)
    {
        validatorFactory = _validatorFactory;
    }

    /// @notice Allows to set the stake manager contract address.
    function setStakeManager(address _stakeManager)
        external
        override
        userHasRole(DAO_ROLE)
    {
        stakeManager = _stakeManager;
    }

    /// @notice Allows to set the contract version.
    /// @param _version contract version
    function setVersion(string memory _version)
        external
        override
        userHasRole(DEFAULT_ADMIN_ROLE)
    {
        version = _version;
    }

    /// @notice Allows to get a node operator by msg.sender.
    /// @param _owner a valid address of an operator owner, if not set msg.sender will be used.
    /// @return Returns a node operator.
    function getNodeOperator(address _owner)
        external
        view
        returns (NodeOperator memory)
    {
        uint256 operatorId = operatorOwners[_owner];
        return operators[operatorId];
    }

    /// @notice Allows to get a node operator by _operatorId.
    /// @param _operatorId the id of the operator.
    /// @return Returns a node operator.
    function getNodeOperator(uint256 _operatorId)
        external
        view
        returns (NodeOperator memory)
    {
        return operators[_operatorId];
    }

    /// @notice Allows to get a list of node operators that are in ACTIVE, UNSTAKE,
    /// STOPPED CLAIMED or WAIT.
    function getNodeOperatorState()
        external
        view
        override
        returns (address[] memory)
    {
        uint256 num = totalActiveNodeOperator +
            totalStoppedNodeOperator +
            totalUnstakedNodeOperator +
            totalClaimedNodeOperator +
            totalWaitNodeOperator;

        address[] memory adds = new address[](num);
        uint256 index;

        uint256[] memory memOperatorIds = operatorIds;

        for (uint256 i = 0; i < memOperatorIds.length; i++) {
            NodeOperator memory no = operators[memOperatorIds[i]];
            NodeOperatorStatus status = no.status;
            if (
                status == NodeOperatorStatus.INACTIVE ||
                status == NodeOperatorStatus.EXIT
            ) {
                continue;
            }
            adds[index] = no.validatorShare;
            index++;
        }

        return adds;
    }

    /// @notice Get the stMATIC contract addresses
    function getContracts()
        external
        view
        override
        returns (
            address _validatorFactory,
            address _stakeManager,
            address _polygonERC20,
            address _stMATIC
        )
    {
        _validatorFactory = validatorFactory;
        _stakeManager = stakeManager;
        _polygonERC20 = polygonERC20;
        _stMATIC = stMATIC;
    }

    /// @notice Get the global state
    function getState()
        external
        view
        override
        returns (
            uint256 _totalNodeOperator,
            uint256 _totalInactiveNodeOperator,
            uint256 _totalActiveNodeOperator,
            uint256 _totalStoppedNodeOperator,
            uint256 _totalUnstakedNodeOperator,
            uint256 _totalClaimedNodeOperator,
            uint256 _totalWaitNodeOperator,
            uint256 _totalExitNodeOperator
        )
    {
        _totalNodeOperator = totalNodeOperator;
        _totalInactiveNodeOperator = totalInactiveNodeOperator;
        _totalActiveNodeOperator = totalActiveNodeOperator;
        _totalStoppedNodeOperator = totalStoppedNodeOperator;
        _totalUnstakedNodeOperator = totalUnstakedNodeOperator;
        _totalClaimedNodeOperator = totalClaimedNodeOperator;
        _totalWaitNodeOperator = totalWaitNodeOperator;
        _totalExitNodeOperator = totalExitNodeOperator;
    }

    /// @notice Get operatorIds.
    function getOperatorIds()
        external
        view
        override
        returns (uint256[] memory)
    {
        return operatorIds;
    }

    /// @notice Get validator total stake.
    /// @param _rewardAddress reward address.
    /// @return Returns the total staked by the validator.
    function getValidatorStake(address _rewardAddress)
        external
        view
        override
        returns (uint256)
    {
        if (_rewardAddress == address(0)) {
            _rewardAddress = msg.sender;
        }

        uint256 operatorId = getOperatorId(_rewardAddress);
        NodeOperator memory no = operators[operatorId];
        return IStakeManager(stakeManager).validatorStake(no.validatorId);
    }

    /// @notice Allows listing all the operator's status by checking if the local stakedAmount
    /// is not equal to the stakedAmount on stake manager.
    function getIfOperatorsWereSlashed()
        external
        view
        override
        returns (bool[] memory)
    {
        IStakeManager sm = IStakeManager(stakeManager);
        uint256 length = operatorIds.length;
        bool[] memory slashedOperatorIds = new bool[](length);

        for (uint256 idx = 0; idx < length; idx++) {
            uint256 operatorId = operatorIds[idx];
            NodeOperator memory no = operators[operatorId];

            if (no.status == NodeOperatorStatus.ACTIVE) {
                uint256 amountStakedSM = sm.validatorStake(no.validatorId);
                if (no.amountStaked != amountStakedSM) {
                    slashedOperatorIds[idx] = true;
                    continue;
                }
            }
            slashedOperatorIds[idx] = false;
        }
        return slashedOperatorIds;
    }

    /// @notice Allows slashing all the operators if the local stakedAmount is not equal
    /// to the stakedAmount on stake manager.
    function slashOperators(bool[] memory _slashedOperatorIds)
        external
        override
    {
        IStakeManager sm = IStakeManager(stakeManager);
        uint256 length = _slashedOperatorIds.length;

        checkCondition(length == operatorIds.length, "slahed operators length");

        uint256[] memory _operatorIds = operatorIds;

        for (uint256 idx = 0; idx < length; idx++) {
            if (_slashedOperatorIds[idx]) {
                uint256 operatorId = _operatorIds[idx];
                NodeOperator storage no = operators[operatorId];
                if (!(no.status == NodeOperatorStatus.ACTIVE)) {
                    continue;
                }
                uint256 amountStakedSM = sm.validatorStake(no.validatorId);
                uint256 slashedTimestamp = no.slashedTimestamp;

                if (no.amountStaked != amountStakedSM) {
                    no.slashed++;
                    no.slashedTimestamp += slashedTimestamp != 0
                        ? slashingDelay
                        : block.timestamp + slashingDelay;
                    no.amountStaked = amountStakedSM;
                } else if (
                    slashedTimestamp != 0 &&
                    no.slashedTimestamp < block.timestamp
                ) {
                    no.slashedTimestamp = 0;
                }
            }
        }
    }

    /// @notice Allows to get a list of operatorInfo for all active operators.
    /// @param _rewardData calculate operator reward.
    /// @return Returns a list of operatorInfo for all active operators.
    function getOperatorInfos(bool _rewardData)
        external
        view
        override
        returns (Operator.OperatorInfo[] memory)
    {
        Operator.OperatorInfo[]
            memory operatorInfos = new Operator.OperatorInfo[](
                totalActiveNodeOperator
            );

        uint256 length = operatorIds.length;
        uint256 index;

        for (uint256 idx = 0; idx < length; idx++) {
            uint256 operatorId = operatorIds[idx];
            NodeOperator storage no = operators[operatorId];

            if (no.status == NodeOperatorStatus.ACTIVE) {
                operatorInfos[index] = Operator.OperatorInfo({
                    operatorId: operatorId,
                    validatorShare: no.validatorShare,
                    maxDelegateLimit: no.maxDelegateLimit,
                    rewardPercentage: _rewardData
                        ? _getRewardPercentage(no.slashedTimestamp)
                        : 0,
                    rewardAddress: no.rewardAddress
                });
                index++;
            }
        }
        return operatorInfos;
    }

    function _getRewardPercentage(uint256 _slashedTimestamp)
        private
        view
        returns (uint8)
    {
        if (_slashedTimestamp == 0 || _slashedTimestamp <= block.timestamp) {
            return 100;
        }

        uint256 t = _slashedTimestamp - block.timestamp;
        uint256 penalty = ((t / slashingDelay) + (t == slashingDelay ? 0 : 1)) *
            10;
        uint8 p = penalty > 100 ? 100 : uint8(penalty);
        uint8 percentage = 100 - p;
        return percentage > 0 ? percentage : 1;
    }

    /// @notice Checks condition and displays the message
    /// @param _condition a condition
    /// @param _message message to display
    function checkCondition(bool _condition, string memory _message)
        private
        pure
    {
        require(_condition, _message);
    }

    /// @notice Retrieve the operator struct based on the operatorId
    /// @param _operatorId id of the operator
    /// @return NodeOperator structure
    function getOperator(uint256 _operatorId)
        private
        view
        returns (uint256, NodeOperator storage)
    {
        if (_operatorId == 0) {
            _operatorId = getOperatorId(msg.sender);
        }
        NodeOperator storage no = operators[_operatorId];

        return (_operatorId, no);
    }

    /// @notice Retrieve the operator struct based on the operator owner address
    /// @param _user address of the operator owner
    /// @return NodeOperator structure
    function getOperatorId(address _user) private view returns (uint256) {
        uint256 operatorId = operatorOwners[_user];
        checkCondition(operatorId != 0, "Operator not found");
        return operatorId;
    }

    /// -------------------------------Events-----------------------------------

    /// @notice A new node operator was added.
    /// @param operatorId node operator id.
    event AddOperator(uint256 operatorId);

    /// @notice A new node operator joined.
    /// @param operatorId node operator id.
    event JoinOperator(uint256 operatorId);

    /// @notice A node operator was removed.
    /// @param operatorId node operator id.
    event RemoveOperator(uint256 operatorId);

    /// @param operatorId node operator id.
    event StopOperator(uint256 operatorId);

    /// @param operatorId node operator id.
    event MigrateOperator(uint256 operatorId);

    /// @notice A node operator was staked.
    /// @param operatorId node operator id.
    event StakeOperator(
        uint256 operatorId,
        uint256 amount,
        uint256 heimdallFees
    );

    /// @notice A node operator restaked.
    /// @param operatorId node operator id.
    /// @param amount amount to restake.
    /// @param restakeRewards restake rewards.
    event RestakeOperator(
        uint256 operatorId,
        uint256 amount,
        bool restakeRewards
    );

    /// @notice A node operator was unstaked.
    /// @param operatorId node operator id.
    event UnstakeOperator(uint256 operatorId);

    /// @notice TopUp heimadall fees.
    /// @param operatorId node operator id.
    /// @param amount amount.
    event TopUpHeimdallFees(uint256 operatorId, uint256 amount);

    /// @notice Withdraw rewards.
    /// @param operatorId node operator id.
    /// @param rewardAddress reward address.
    /// @param amount amount.
    event WithdrawRewards(
        uint256 operatorId,
        address rewardAddress,
        uint256 amount
    );

    /// @notice claims unstake.
    /// @param operatorId node operator id.
    /// @param amount amount.
    event UnstakeClaim(uint256 operatorId, uint256 amount);

    /// @notice update signer publickey.
    /// @param operatorId node operator id.
    event UpdateSignerPubkey(uint256 operatorId);

    /// @notice claim herimdall fee.
    /// @param operatorId node operator id.
    event ClaimFee(uint256 operatorId);

    /// @notice update commission rate.
    event UpdateCommissionRate(uint256 operatorId, uint256 newCommissionRate);

    /// @notice Unjail a validator.
    event Unjail(uint256 operatorId);

    /// @notice update operator name.
    event NewName(uint256 operatorId, string name);

    /// @notice update operator name.
    event NewRewardAddress(uint256 operatorId, address rewardAddress);
}
