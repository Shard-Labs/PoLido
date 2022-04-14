// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "./interfaces/IValidatorShare.sol";
import "./interfaces/INodeOperatorRegistry.sol";
import "./interfaces/IStakeManager.sol";
import "./interfaces/IPoLidoNFT.sol";
import "./interfaces/IFxStateRootTunnel.sol";
import "./interfaces/IStMATIC.sol";

contract StMATIC is
    IStMATIC,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable
{
    event SubmitEvent(address indexed _from, uint256 indexed _amount);
    event RequestWithdrawEvent(address indexed _from, uint256 indexed _amount);
    event DistributeRewardsEvent(uint256 indexed _amount);
    event WithdrawTotalDelegatedEvent(
        address indexed _from,
        uint256 indexed _amount
    );
    event DelegateEvent(
        uint256 indexed _amountDelegated,
        uint256 indexed _remainder
    );
    event ClaimTokensEvent(
        address indexed _from,
        uint256 indexed _id,
        uint256 indexed _amountClaimed,
        uint256 _amountBurned
    );

    event ClaimTotalDelegatedEvent(
        address indexed _from,
        uint256 indexed _amountClaimed
    );

    using SafeERC20Upgradeable for IERC20Upgradeable;

    INodeOperatorRegistry public override nodeOperatorRegistry;
    FeeDistribution public override entityFees;
    IStakeManager public override stakeManager;
    IPoLidoNFT public override poLidoNFT;
    IFxStateRootTunnel public override fxStateRootTunnel;

    string public override version;
    address public override dao;
    address public override insurance;
    address public override token;
    uint256 public override lastWithdrawnValidatorId;
    uint256 public override totalBuffered;
    uint256 public override delegationLowerBound;
    uint256 public override rewardDistributionLowerBound;
    uint256 public override reservedFunds;
    uint256 public override submitThreshold;

    bool public override submitHandler;

    mapping(uint256 => RequestWithdraw) public override token2WithdrawRequest;

    bytes32 public constant override DAO = keccak256("DAO");

    RequestWithdraw[] public stMaticWithdrawRequest;

    /**
     * @param _nodeOperatorRegistry - Address of the node operator registry
     * @param _token - Address of MATIC token on Ethereum Mainnet
     * @param _dao - Address of the DAO
     * @param _insurance - Address of the insurance
     * @param _stakeManager - Address of the stake manager
     * @param _poLidoNFT - Address of the stMATIC NFT
     * @param _fxStateRootTunnel - Address of the FxStateRootTunnel
     */
    function initialize(
        address _nodeOperatorRegistry,
        address _token,
        address _dao,
        address _insurance,
        address _stakeManager,
        address _poLidoNFT,
        address _fxStateRootTunnel,
        uint256 _submitThreshold
    ) external override initializer {
        __AccessControl_init();
        __Pausable_init();
        __ERC20_init("Staked MATIC", "stMATIC");

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DAO, _dao);

        nodeOperatorRegistry = INodeOperatorRegistry(_nodeOperatorRegistry);
        stakeManager = IStakeManager(_stakeManager);
        poLidoNFT = IPoLidoNFT(_poLidoNFT);
        fxStateRootTunnel = IFxStateRootTunnel(_fxStateRootTunnel);
        dao = _dao;
        token = _token;
        insurance = _insurance;

        entityFees = FeeDistribution(25, 50, 25);
        submitThreshold = _submitThreshold;
        submitHandler = true;
    }

    /**
     * @dev Send funds to StMATIC contract and mints StMATIC to msg.sender
     * @notice Requires that msg.sender has approved _amount of MATIC to this contract
     * @param _amount - Amount of MATIC sent from msg.sender to this contract
     * @return Amount of StMATIC shares generated
     */
    function submit(uint256 _amount)
        external
        override
        whenNotPaused
        returns (uint256)
    {
        require(_amount > 0, "Invalid amount");

        if (submitHandler) {
            require(
                _amount + getTotalPooledMatic() <= submitThreshold,
                "Submit threshold reached"
            );
        }

        IERC20Upgradeable(token).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        (
            uint256 amountToMint,
            uint256 totalShares,
            uint256 totalPooledMatic
        ) = convertMaticToStMatic(_amount);

        _mint(msg.sender, amountToMint);

        totalBuffered += _amount;

        fxStateRootTunnel.sendMessageToChild(
            abi.encode(totalShares + amountToMint, totalPooledMatic + _amount)
        );

        emit SubmitEvent(msg.sender, _amount);

        return amountToMint;
    }

    /**
     * @dev Stores users request to withdraw into a RequestWithdraw struct
     * @param _amount - Amount of StMATIC that is requested to withdraw
     */
    function requestWithdraw(uint256 _amount) external override whenNotPaused {
        require(_amount > 0, "Invalid amount");

        Operator.OperatorInfo[] memory operatorInfos = nodeOperatorRegistry
            .getOperatorInfos(false, true);

        uint256 operatorInfosLength = operatorInfos.length;

        uint256 tokenId;
        (
            uint256 totalAmount2WithdrawInMatic,
            uint256 totalShares,
            uint256 totalPooledMATIC
        ) = convertStMaticToMatic(_amount);
        uint256 currentAmount2WithdrawInMatic = totalAmount2WithdrawInMatic;

        uint256 totalDelegated = getTotalStakeAcrossAllValidators();

        uint256 minValidatorBalance = _getMinValidatorBalance(operatorInfos);

        uint256 allowedAmount2RequestFromValidators = 0;

        if (totalDelegated != 0) {
            require(
                (totalDelegated + totalBuffered) >=
                    currentAmount2WithdrawInMatic +
                        minValidatorBalance *
                        operatorInfosLength,
                "Too much to withdraw"
            );
            allowedAmount2RequestFromValidators =
                totalDelegated -
                minValidatorBalance *
                operatorInfosLength;
        } else {
            require(
                totalBuffered >= currentAmount2WithdrawInMatic,
                "Too much to withdraw"
            );
        }

        while (currentAmount2WithdrawInMatic != 0) {
            tokenId = poLidoNFT.mint(msg.sender);

            if (allowedAmount2RequestFromValidators != 0) {
                if (lastWithdrawnValidatorId > operatorInfosLength - 1) {
                    lastWithdrawnValidatorId = 0;
                }
                address validatorShare = operatorInfos[lastWithdrawnValidatorId]
                    .validatorShare;

                (uint256 validatorBalance, ) = IValidatorShare(validatorShare)
                    .getTotalStake(address(this));

                if (validatorBalance <= minValidatorBalance) {
                    lastWithdrawnValidatorId++;
                    continue;
                }

                uint256 allowedAmount2Withdraw = validatorBalance -
                    minValidatorBalance;

                uint256 amount2WithdrawFromValidator = (allowedAmount2Withdraw <=
                        currentAmount2WithdrawInMatic)
                        ? allowedAmount2Withdraw
                        : currentAmount2WithdrawInMatic;

                sellVoucher_new(
                    validatorShare,
                    amount2WithdrawFromValidator,
                    type(uint256).max
                );

                token2WithdrawRequest[tokenId] = RequestWithdraw(
                    0,
                    IValidatorShare(validatorShare).unbondNonces(address(this)),
                    stakeManager.epoch() + stakeManager.withdrawalDelay(),
                    validatorShare
                );

                allowedAmount2RequestFromValidators -= amount2WithdrawFromValidator;
                currentAmount2WithdrawInMatic -= amount2WithdrawFromValidator;
                lastWithdrawnValidatorId++;
            } else {
                token2WithdrawRequest[tokenId] = RequestWithdraw(
                    currentAmount2WithdrawInMatic,
                    0,
                    stakeManager.epoch() + stakeManager.withdrawalDelay(),
                    address(0)
                );

                reservedFunds += currentAmount2WithdrawInMatic;
                currentAmount2WithdrawInMatic = 0;
            }
        }

        _burn(msg.sender, _amount);

        fxStateRootTunnel.sendMessageToChild(
            abi.encode(
                totalShares - _amount,
                totalPooledMATIC - totalAmount2WithdrawInMatic
            )
        );

        emit RequestWithdrawEvent(msg.sender, _amount);
    }

    /**
     * @notice This will be included in the cron job
     * @dev Delegates tokens to validator share contract
     */
    function delegate() external override whenNotPaused {
        require(
            totalBuffered > delegationLowerBound + reservedFunds,
            "Amount to delegate lower than minimum"
        );
        Operator.OperatorInfo[] memory operatorInfos = nodeOperatorRegistry
            .getOperatorInfos(true, false);
        uint256 operatorInfosLength = operatorInfos.length;

        require(operatorInfosLength > 0, "No operator shares, cannot delegate");

        uint256 availableAmountToDelegate = totalBuffered - reservedFunds;
        uint256 maxDelegateLimitsSum;
        uint256 remainder;

        for (uint256 i = 0; i < operatorInfosLength; i++) {
            maxDelegateLimitsSum += operatorInfos[i].maxDelegateLimit;
        }

        require(maxDelegateLimitsSum > 0, "maxDelegateLimitsSum=0");

        uint256 totalToDelegatedAmount = maxDelegateLimitsSum <=
            availableAmountToDelegate
            ? maxDelegateLimitsSum
            : availableAmountToDelegate;

        IERC20Upgradeable(token).safeApprove(address(stakeManager), 0);

        IERC20Upgradeable(token).safeApprove(
            address(stakeManager),
            totalToDelegatedAmount
        );

        uint256 amountDelegated;

        for (uint256 i = 0; i < operatorInfosLength; i++) {
            uint256 amountToDelegatePerOperator = (operatorInfos[i]
                .maxDelegateLimit * totalToDelegatedAmount) /
                maxDelegateLimitsSum;

            buyVoucher(
                operatorInfos[i].validatorShare,
                amountToDelegatePerOperator,
                0
            );

            amountDelegated += amountToDelegatePerOperator;
        }

        remainder = availableAmountToDelegate - amountDelegated;
        totalBuffered = remainder + reservedFunds;

        emit DelegateEvent(amountDelegated, remainder);
    }

    /**
     * @dev Claims tokens from validator share and sends them to the
     * user if his request is in the userToWithdrawRequest
     * @param _tokenId - Id of the token that wants to be claimed
     */
    function claimTokens(uint256 _tokenId) external override whenNotPaused {
        require(poLidoNFT.isApprovedOrOwner(msg.sender, _tokenId), "Not owner");
        RequestWithdraw storage usersRequest = token2WithdrawRequest[_tokenId];

        require(
            stakeManager.epoch() >= usersRequest.requestEpoch,
            "Not able to claim yet"
        );

        poLidoNFT.burn(_tokenId);

        uint256 amountToClaim;

        if (usersRequest.validatorAddress != address(0)) {
            uint256 balanceBeforeClaim = IERC20Upgradeable(token).balanceOf(
                address(this)
            );

            unstakeClaimTokens_new(
                usersRequest.validatorAddress,
                usersRequest.validatorNonce
            );

            amountToClaim =
                IERC20Upgradeable(token).balanceOf(address(this)) -
                balanceBeforeClaim;
        } else {
            amountToClaim = usersRequest.amount2WithdrawFromStMATIC;

            reservedFunds -= amountToClaim;
            totalBuffered -= amountToClaim;
        }

        IERC20Upgradeable(token).safeTransfer(msg.sender, amountToClaim);

        emit ClaimTokensEvent(msg.sender, _tokenId, amountToClaim, 0);
    }

    /**
     * @dev Distributes rewards claimed from validator shares based on fees defined in entityFee
     */
    function distributeRewards() external override whenNotPaused {
        Operator.OperatorInfo[] memory operatorInfos = nodeOperatorRegistry
            .getOperatorInfos(true, false);

        uint256 operatorInfosLength = operatorInfos.length;

        for (uint256 i = 0; i < operatorInfosLength; i++) {
            IValidatorShare validatorShare = IValidatorShare(
                operatorInfos[i].validatorShare
            );
            uint256 stMaticReward = validatorShare.getLiquidRewards(
                address(this)
            );
            uint256 rewardThreshold = validatorShare.minAmount();
            if (stMaticReward >= rewardThreshold) {
                validatorShare.withdrawRewards();
            }
        }

        uint256 totalRewards = (
            (IERC20Upgradeable(token).balanceOf(address(this)) - totalBuffered)
        ) / 10;

        require(
            totalRewards > rewardDistributionLowerBound,
            "Amount to distribute lower than minimum"
        );

        uint256 balanceBeforeDistribution = IERC20Upgradeable(token).balanceOf(
            address(this)
        );

        uint256 daoRewards = (totalRewards * entityFees.dao) / 100;
        uint256 insuranceRewards = (totalRewards * entityFees.insurance) / 100;
        uint256 operatorsRewards = (totalRewards * entityFees.operators) / 100;
        uint256 operatorReward = operatorsRewards / operatorInfosLength;

        IERC20Upgradeable(token).safeTransfer(dao, daoRewards);
        IERC20Upgradeable(token).safeTransfer(insurance, insuranceRewards);

        for (uint256 i = 0; i < operatorInfosLength; i++) {
            IERC20Upgradeable(token).safeTransfer(
                operatorInfos[i].rewardAddress,
                operatorReward
            );
        }

        uint256 currentBalance = IERC20Upgradeable(token).balanceOf(
            address(this)
        );

        uint256 totalDistributed = balanceBeforeDistribution - currentBalance;

        // Add the remainder to totalBuffered
        totalBuffered = currentBalance;

        emit DistributeRewardsEvent(totalDistributed);
    }

    /**
     * @notice Only NodeOperatorRegistry can call this function
     * @dev Withdraws funds from unstaked validator
     * @param _validatorShare - Address of the validator share that will be withdrawn
     */
    function withdrawTotalDelegated(address _validatorShare) external override {
        require(
            msg.sender == address(nodeOperatorRegistry),
            "Not a node operator"
        );

        (uint256 stakedAmount, ) = getTotalStake(
            IValidatorShare(_validatorShare)
        );

        if (stakedAmount == 0) {
            return;
        }

        sellVoucher_new(_validatorShare, stakedAmount, type(uint256).max);

        stMaticWithdrawRequest.push(
            RequestWithdraw(
                uint256(0),
                IValidatorShare(_validatorShare).unbondNonces(address(this)),
                stakeManager.epoch() + stakeManager.withdrawalDelay(),
                _validatorShare
            )
        );

        fxStateRootTunnel.sendMessageToChild(
            abi.encode(totalSupply(), getTotalPooledMatic())
        );

        emit WithdrawTotalDelegatedEvent(_validatorShare, stakedAmount);
    }

    /**
     * @dev Claims tokens from validator share and sends them to the
     * StMATIC contract
     * @param _index - index the request.
     */
    function claimTotalDelegated2StMatic(uint256 _index)
        external
        override
        whenNotPaused
    {
        uint256 length = stMaticWithdrawRequest.length;
        require(_index < length, "invalid index");

        RequestWithdraw memory lidoRequests = stMaticWithdrawRequest[_index];

        require(
            stakeManager.epoch() >= lidoRequests.requestEpoch,
            "Not able to claim yet"
        );

        uint256 balanceBeforeClaim = IERC20Upgradeable(token).balanceOf(
            address(this)
        );

        unstakeClaimTokens_new(
            lidoRequests.validatorAddress,
            lidoRequests.validatorNonce
        );

        uint256 claimedAmount = IERC20Upgradeable(token).balanceOf(
            address(this)
        ) - balanceBeforeClaim;

        totalBuffered += claimedAmount;
        
        if (_index != length - 1 && length != 1) {
            stMaticWithdrawRequest[_index] = stMaticWithdrawRequest[length - 1];
        }
        stMaticWithdrawRequest.pop();

        fxStateRootTunnel.sendMessageToChild(
            abi.encode(totalSupply(), getTotalPooledMatic())
        );

        emit ClaimTotalDelegatedEvent(address(this), claimedAmount);
    }

    /**
     * @dev Flips the pause state
     */
    function togglePause() external override onlyRole(DEFAULT_ADMIN_ROLE) {
        paused() ? _unpause() : _pause();
    }

    ////////////////////////////////////////////////////////////
    /////                                                    ///
    /////             ***ValidatorShare API***               ///
    /////                                                    ///
    ////////////////////////////////////////////////////////////

    /**
     * @dev API for delegated buying vouchers from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @param _amount - Amount of MATIC to use for buying vouchers
     * @param _minSharesToMint - Minimum of shares that is bought with _amount of MATIC
     * @return Actual amount of MATIC used to buy voucher, might differ from _amount because of _minSharesToMint
     */
    function buyVoucher(
        address _validatorShare,
        uint256 _amount,
        uint256 _minSharesToMint
    ) private returns (uint256) {
        uint256 amountSpent = IValidatorShare(_validatorShare).buyVoucher(
            _amount,
            _minSharesToMint
        );

        return amountSpent;
    }

    /**
     * @dev API for delegated restaking rewards to validatorShare
     * @param _validatorShare - Address of validatorShare contract
     */
    function restake(address _validatorShare) private {
        IValidatorShare(_validatorShare).restake();
    }

    /**
     * @dev API for delegated unstaking and claiming tokens from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @param _unbondNonce - Unbond nonce
     */
    function unstakeClaimTokens_new(
        address _validatorShare,
        uint256 _unbondNonce
    ) private {
        IValidatorShare(_validatorShare).unstakeClaimTokens_new(_unbondNonce);
    }

    /**
     * @dev API for delegated selling vouchers from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @param _claimAmount - Amount of MATIC to claim
     * @param _maximumSharesToBurn - Maximum amount of shares to burn
     */
    function sellVoucher_new(
        address _validatorShare,
        uint256 _claimAmount,
        uint256 _maximumSharesToBurn
    ) private {
        IValidatorShare(_validatorShare).sellVoucher_new(
            _claimAmount,
            _maximumSharesToBurn
        );
    }

    /**
     * @dev API for getting total stake of this contract from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @return Total stake of this contract and MATIC -> share exchange rate
     */
    function getTotalStake(IValidatorShare _validatorShare)
        public
        view
        override
        returns (uint256, uint256)
    {
        return _validatorShare.getTotalStake(address(this));
    }

    /**
     * @dev API for liquid rewards of this contract from validatorShare
     * @param _validatorShare - Address of validatorShare contract
     * @return Liquid rewards of this contract
     */
    function getLiquidRewards(IValidatorShare _validatorShare)
        external
        view
        override
        returns (uint256)
    {
        return _validatorShare.getLiquidRewards(address(this));
    }

    ////////////////////////////////////////////////////////////
    /////                                                    ///
    /////            ***Helpers & Utilities***               ///
    /////                                                    ///
    ////////////////////////////////////////////////////////////
    /**
     * @dev Returns the stMaticWithdrawRequest list
     */
    function getTotalWithdrawRequest()
        public
        view
        returns (RequestWithdraw[] memory)
    {
        return stMaticWithdrawRequest;
    }

    /**
     * @dev Helper function for that returns total pooled MATIC
     * @return Total pooled MATIC
     */
    function getTotalStakeAcrossAllValidators()
        public
        view
        override
        returns (uint256)
    {
        uint256 totalStake;
        Operator.OperatorInfo[] memory operatorInfos = nodeOperatorRegistry
            .getOperatorInfos(false, true);

        uint256 operatorInfosLength = operatorInfos.length;
        for (uint256 i = 0; i < operatorInfosLength; i++) {
            (uint256 currValidatorShare, ) = getTotalStake(
                IValidatorShare(operatorInfos[i].validatorShare)
            );

            totalStake += currValidatorShare;
        }

        return totalStake;
    }

    /**
     * @dev Function that calculates total pooled Matic
     * @return Total pooled Matic
     */
    function getTotalPooledMatic() public view override returns (uint256) {
        uint256 totalStaked = getTotalStakeAcrossAllValidators();
        return
            totalStaked +
            totalBuffered +
            calculatePendingBufferedTokens() -
            reservedFunds;
    }

    /**
     * @dev Function that converts arbitrary stMATIC to Matic
     * @param _balance - Balance in stMATIC
     * @return Balance in Matic, totalShares and totalPooledMATIC
     */
    function convertStMaticToMatic(uint256 _balance)
        public
        view
        override
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 totalShares = totalSupply();
        totalShares = totalShares == 0 ? 1 : totalShares;

        uint256 totalPooledMATIC = getTotalPooledMatic();
        totalPooledMATIC = totalPooledMATIC == 0 ? 1 : totalPooledMATIC;

        uint256 balanceInMATIC = (_balance * totalPooledMATIC) / totalShares;

        return (balanceInMATIC, totalShares, totalPooledMATIC);
    }

    /**
     * @dev Function that converts arbitrary Matic to stMATIC
     * @param _balance - Balance in Matic
     * @return Balance in stMATIC, totalShares and totalPooledMATIC
     */
    function convertMaticToStMatic(uint256 _balance)
        public
        view
        override
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 totalShares = totalSupply();
        totalShares = totalShares == 0 ? 1 : totalShares;

        uint256 totalPooledMatic = getTotalPooledMatic();
        totalPooledMatic = totalPooledMatic == 0 ? 1 : totalPooledMatic;

        uint256 balanceInStMatic = (_balance * totalShares) / totalPooledMatic;

        return (balanceInStMatic, totalShares, totalPooledMatic);
    }

    /**
     * @dev Function that calculates minimal allowed validator balance (lower bound)
     * @return Minimal validator balance in MATIC
     */
    function getMinValidatorBalance() external view override returns (uint256) {
        Operator.OperatorInfo[] memory operatorInfos = nodeOperatorRegistry
            .getOperatorInfos(false, true);

        return _getMinValidatorBalance(operatorInfos);
    }

    function _getMinValidatorBalance(
        Operator.OperatorInfo[] memory operatorInfos
    ) private view returns (uint256) {
        uint256 operatorInfosLength = operatorInfos.length;
        uint256 minValidatorBalance = type(uint256).max;

        for (uint256 i = 0; i < operatorInfosLength; i++) {
            (uint256 validatorShare, ) = getTotalStake(
                IValidatorShare(operatorInfos[i].validatorShare)
            );
            // 10% of current validatorShare
            uint256 minValidatorBalanceCurrent = validatorShare / 10;

            if (
                minValidatorBalanceCurrent != 0 &&
                minValidatorBalanceCurrent < minValidatorBalance
            ) {
                minValidatorBalance = minValidatorBalanceCurrent;
            }
        }

        return minValidatorBalance;
    }

    ////////////////////////////////////////////////////////////
    /////                                                    ///
    /////                 ***Setters***                      ///
    /////                                                    ///
    ////////////////////////////////////////////////////////////

    /**
     * @dev Function that sets entity fees
     * @notice Callable only by dao
     * @param _daoFee - DAO fee in %
     * @param _operatorsFee - Operator fees in %
     * @param _insuranceFee - Insurance fee in %
     */
    function setFees(
        uint8 _daoFee,
        uint8 _operatorsFee,
        uint8 _insuranceFee
    ) external override onlyRole(DAO) {
        require(
            _daoFee + _operatorsFee + _insuranceFee == 100,
            "sum(fee)!=100"
        );
        entityFees.dao = _daoFee;
        entityFees.operators = _operatorsFee;
        entityFees.insurance = _insuranceFee;
    }

    /**
     * @dev Function that sets new dao address
     * @notice Callable only by dao
     * @param _address - New dao address
     */
    function setDaoAddress(address _address) external override onlyRole(DAO) {
        revokeRole(DAO, dao);
        dao = _address;
        _setupRole(DAO, dao);
    }

    /**
     * @dev Function that sets new insurance address
     * @notice Callable only by dao
     * @param _address - New insurance address
     */
    function setInsuranceAddress(address _address)
        external
        override
        onlyRole(DAO)
    {
        insurance = _address;
    }

    /**
     * @dev Function that sets new node operator address
     * @notice Only callable by dao
     * @param _address - New node operator address
     */
    function setNodeOperatorRegistryAddress(address _address)
        external
        override
        onlyRole(DAO)
    {
        nodeOperatorRegistry = INodeOperatorRegistry(_address);
    }

    /**
     * @dev Function that sets new lower bound for delegation
     * @notice Only callable by dao
     * @param _delegationLowerBound - New lower bound for delegation
     */
    function setDelegationLowerBound(uint256 _delegationLowerBound)
        external
        override
        onlyRole(DAO)
    {
        delegationLowerBound = _delegationLowerBound;
    }

    /**
     * @dev Function that sets new lower bound for rewards distribution
     * @notice Only callable by dao
     * @param _rewardDistributionLowerBound - New lower bound for rewards distribution
     */
    function setRewardDistributionLowerBound(
        uint256 _rewardDistributionLowerBound
    ) external override onlyRole(DAO) {
        rewardDistributionLowerBound = _rewardDistributionLowerBound;
    }

    /**
     * @dev Function that sets the poLidoNFT address
     * @param _poLidoNFT new poLidoNFT address
     */
    function setPoLidoNFT(address _poLidoNFT) external override onlyRole(DAO) {
        poLidoNFT = IPoLidoNFT(_poLidoNFT);
    }

    /**
     * @dev Function that sets the fxStateRootTunnel address
     * @param _fxStateRootTunnel address of fxStateRootTunnel
     */
    function setFxStateRootTunnel(address _fxStateRootTunnel)
        external
        override
        onlyRole(DAO)
    {
        fxStateRootTunnel = IFxStateRootTunnel(_fxStateRootTunnel);
    }

    /**
     * @dev Function that sets the submitThreshold
     * @param _submitThreshold new value for submit threshold
     */
    function setSubmitThreshold(uint256 _submitThreshold)
        external
        override
        onlyRole(DAO)
    {
        submitThreshold = _submitThreshold;
    }

    /**
     * @dev Function that sets the submitHandler value to its NOT value
     */
    function flipSubmitHandler() external override onlyRole(DAO) {
        submitHandler = !submitHandler;
    }

    /**
     * @dev Function that sets the new version
     * @param _version - New version that will be set
     */
    function setVersion(string calldata _version)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        version = _version;
    }

    /**
     * @dev Function that retrieves the amount of matic that will be claimed from the NFT token
     * @param _tokenId - Id of the PolidoNFT
     */
    function getMaticFromTokenId(uint256 _tokenId)
        public
        view
        override
        returns (uint256)
    {
        return _getMaticFromRequestWithdraw(token2WithdrawRequest[_tokenId]);
    }

    function _getMaticFromRequestWithdraw(RequestWithdraw memory requestData)
        public
        view
        returns (uint256)
    {
        if (requestData.validatorAddress == address(0)) {
            return requestData.amount2WithdrawFromStMATIC;
        }

        IValidatorShare validatorShare = IValidatorShare(
            requestData.validatorAddress
        );
        uint256 validatorId = validatorShare.validatorId();
        
        // see here for more details about how to exchangeRatePrecision is calculated:
        // https://github.com/maticnetwork/contracts/blob/v0.3.0-backport/contracts/staking/validatorShare/ValidatorShare.sol#L313
        uint256 exchangeRatePrecision = validatorId < 8 ? 100 : 10**29;
        uint256 withdrawExchangeRate = validatorShare.withdrawExchangeRate();
        IValidatorShare.DelegatorUnbond memory unbond = validatorShare
            .unbonds_new(address(this), requestData.validatorNonce);

        return (withdrawExchangeRate * unbond.shares) / exchangeRatePrecision;
    }

    /**
     * @dev Function that calculates the total pending buffered tokens in LidoNFT contract.
     */
    function calculatePendingBufferedTokens()
        public
        view
        returns (uint256 pendingBufferedTokens)
    {
        RequestWithdraw[] memory requestData = stMaticWithdrawRequest;
        uint256 length = requestData.length;
        for (uint256 i = 0; i < length; i++) {
            pendingBufferedTokens += _getMaticFromRequestWithdraw(requestData[i]);
        }
    }
}
