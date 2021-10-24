// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./interfaces/IValidatorShare.sol";
import "./interfaces/INodeOperatorRegistry.sol";
import "./interfaces/IStakeManager.sol";
import "./interfaces/ILidoNFT.sol";

contract LidoMatic is AccessControlUpgradeable, ERC20Upgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public DelegationDelay;
    // percentage to delegate to a validator whene it's not trusted.
    uint256 public DelegationMin;
    // percentage of rewards a validator will take if he was slashed.
    uint256 public RewardMin;

    INodeOperatorRegistry public nodeOperator;
    FeeDistribution public entityFees;
    IStakeManager public stakeManager;

    address public lidoNFT;
    address public dao;
    address public insurance;
    address public token;
    uint256 public lastWithdrawnValidatorId;
    uint256 public totalDelegated;
    uint256 public totalBuffered;
    uint256 public delegationLowerBound;
    uint256 public rewardDistributionLowerBound;
    uint256 public reservedFunds;
    uint256 public lockedAmountStMatic;
    uint256 public lockedAmountMatic;
    uint256 public minValidatorBalance;
    bool public paused;

    // mapping(address => RequestWithdraw[]) public user2WithdrawRequest;
    mapping(uint256 => RequestWithdraw) public token2WithdrawRequest;

    mapping(address => uint256) public validator2DelegatedAmount;
    mapping(address => uint256) public user2Shares;
    mapping(address => uint256) public validator2Nonce;
    mapping(address => uint256) public user2Nonce;

    bytes32 public constant DAO = keccak256("DAO");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    bytes32 public constant MANAGE_FEE = keccak256("MANAGE_FEE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 public constant SET_TREASURY = keccak256("SET_TREASURY");

    struct RequestWithdraw {
        uint256 amountToClaim; // Matic
        uint256 amountToBurn; // StMatic
        uint256 validatorNonce;
        uint256 requestTime;
        address validatorAddress;
        bool active;
    }

    struct FeeDistribution {
        uint256 dao;
        uint256 operators;
        uint256 insurance;
    }

    /** Modifiers */
    modifier auth(bytes32 _role) {
        require(hasRole(_role, msg.sender), "Not authorized");
        _;
    }

    modifier notPaused() {
        require(!paused, "System is paused");
        _;
    }

    /**
     * @param _token - Address of MATIC token on Ethereum Mainnet
     * @param _nodeOperator - Address of the node operator
     */
    function initialize(
        address _nodeOperator,
        address _token,
        address _dao,
        address _insurance,
        address _stakeManager,
        address _lidoNFT
    ) public initializer {
        __ERC20_init("Staked MATIC", "StMATIC");
        __AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(PAUSE_ROLE, msg.sender);
        _setupRole(DAO, _dao);
        _setupRole(MANAGE_FEE, _dao);
        _setupRole(BURN_ROLE, _dao);
        _setupRole(SET_TREASURY, _dao);

        nodeOperator = INodeOperatorRegistry(_nodeOperator);
        stakeManager = IStakeManager(_stakeManager);
        dao = _dao;
        token = _token;
        insurance = _insurance;
        lidoNFT = _lidoNFT;

        DelegationDelay = 2**13;
        DelegationMin = 10;
        RewardMin = 80;

        minValidatorBalance = type(uint256).max;
        entityFees = FeeDistribution(5, 5, 90);
    }

    /**
     * @dev Send funds to LidoMatic contract and mints StMATIC to msg.sender
     * @notice Requires that msg.sender has approved _amount of MATIC to this contract
     * @param _amount - Amount of MATIC sent from msg.sender to this contract
     * @return Amount of StMATIC shares generated
     */
    function submit(uint256 _amount) external returns (uint256) {
        require(_amount > 0, "Invalid amount");

        IERC20Upgradeable(token).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        // Reduce totalShares by amount of StMatic locked in the LidoMatic contract
        // This StMatic shouldn't be considered in minting new tokens
        // because it is about to be burned after the WITHDRAWAL_DELAY expires
        uint256 totalShares = totalSupply() - lockedAmountStMatic;
        uint256 totalPooledMatic = totalBuffered +
            totalDelegated -
            lockedAmountMatic;
        uint256 amountToMint = totalDelegated != 0
            ? (_amount * totalShares) / totalPooledMatic
            : _amount;

        _mint(msg.sender, amountToMint);

        totalBuffered += _amount;

        return amountToMint;
    }

    /**
     * @dev Stores users request to withdraw into a RequestWithdraw struct
     * @param _amount - Amount of StMATIC that is requested to withdraw
     */
    function requestWithdraw(uint256 _amount) external notPaused {
        Operator.OperatorShare[] memory operatorShares = nodeOperator
            .getOperatorShares();

        uint256 tokenId = ILidoNFT(lidoNFT).mint(msg.sender);
        require(
            IERC20Upgradeable(address(this)).transferFrom(
                msg.sender,
                address(this),
                _amount
            ),
            "Transferring StMatic failed"
        );

        uint256 totalBurned;
        uint256 totalAmount2WithdrawInMatic = convertStMaticToMatic(_amount);
        uint256 currentAmount2WithdrawInMatic = totalAmount2WithdrawInMatic;

        lockedAmountStMatic += _amount;
        lockedAmountMatic += totalAmount2WithdrawInMatic;

        if (totalDelegated > currentAmount2WithdrawInMatic) {
            while (currentAmount2WithdrawInMatic != 0) {
                if (lastWithdrawnValidatorId > operatorShares.length - 1) {
                    lastWithdrawnValidatorId = 0;
                }

                address validatorShare = operatorShares[
                    lastWithdrawnValidatorId
                ].validatorShare;

                uint256 validatorBalance = IValidatorShare(validatorShare)
                    .activeAmount();

                uint256 allowedAmount2Withdraw = validatorBalance -
                    minValidatorBalance;

                uint256 amount2WithdrawFromValidator = (allowedAmount2Withdraw >
                    currentAmount2WithdrawInMatic)
                    ? currentAmount2WithdrawInMatic
                    : allowedAmount2Withdraw;

                if (amount2WithdrawFromValidator == 0) {
                    continue;
                }

                uint256 amount2Burn = (_amount * amount2WithdrawFromValidator) /
                    totalAmount2WithdrawInMatic;

                sellVoucher_new(
                    validatorShare,
                    amount2WithdrawFromValidator,
                    type(uint256).max
                );

                validator2Nonce[validatorShare]++;

                user2Nonce[msg.sender]++;

                totalBurned += amount2Burn;

                // Burn the remainder, if any, in the last step
                if (
                    currentAmount2WithdrawInMatic -
                        amount2WithdrawFromValidator ==
                    0
                ) {
                    amount2Burn += (_amount - totalBurned);
                }

                token2WithdrawRequest[tokenId] = RequestWithdraw(
                    amount2WithdrawFromValidator,
                    amount2Burn,
                    validator2Nonce[validatorShare],
                    block.timestamp,
                    validatorShare,
                    true
                );

                currentAmount2WithdrawInMatic -= amount2WithdrawFromValidator;

                lastWithdrawnValidatorId++;
            }
        } else {
            token2WithdrawRequest[tokenId] = RequestWithdraw(
                currentAmount2WithdrawInMatic,
                _amount,
                0,
                block.timestamp,
                address(0),
                true
            );

            reservedFunds += currentAmount2WithdrawInMatic;
        }
    }

    /**
     * @notice This will be included in the cron job
     * @dev Delegates tokens to validator share contract
     */
    function delegate() external {
        require(
            totalBuffered > delegationLowerBound,
            "Amount to delegate lower than minimum"
        );
        Operator.OperatorShare[] memory operatorShares = nodeOperator
            .getOperatorShares();

        require(
            operatorShares.length > 0,
            "No operator shares, cannot delegate"
        );

        // calculated the ratio for each validator, if the validator is trusted
        // the ratio is DELEGATE_MAX if not yet trusted the amount is DelegationMin.
        uint256[] memory ratios = new uint256[](operatorShares.length);
        uint256 totalRatio = 0;

        for (uint256 idx = 0; idx < operatorShares.length; idx++) {
            uint256 delegateRatio = operatorShares[idx].statusTimestamp +
                DelegationDelay >=
                block.timestamp ||
                operatorShares[idx].isTrusted
                ? 100
                : DelegationMin;
            ratios[idx] = delegateRatio;
            totalRatio += delegateRatio;
        }

        uint256 amountToDelegate = totalBuffered - reservedFunds;
        uint256 totalAmountDelegated;

        IERC20Upgradeable(token).approve(
            address(stakeManager),
            amountToDelegate
        );

        for (uint256 i = 0; i < operatorShares.length; i++) {
            uint256 amountPerValidator = (amountToDelegate * ratios[i]) /
                totalRatio;
            totalAmountDelegated += amountPerValidator;
            buyVoucher(operatorShares[i].validatorShare, amountPerValidator, 0);

            // Take the 10% of current validator balance
            uint256 minValidatorBalanceCurrent = (IValidatorShare(
                operatorShares[i].validatorShare
            ).activeAmount() * 10) / 100;

            if (
                minValidatorBalanceCurrent != 0 &&
                minValidatorBalanceCurrent < minValidatorBalance
            ) {
                minValidatorBalance = minValidatorBalanceCurrent;
            }

            validator2DelegatedAmount[
                operatorShares[i].validatorShare
            ] += amountPerValidator;
        }

        uint256 remainder = amountToDelegate - totalAmountDelegated;
        totalDelegated += amountToDelegate - remainder;
        totalBuffered = remainder + reservedFunds;
    }

    /**
     * @dev Claims tokens from validator share and sends them to the
     * user if his request is in the userToWithdrawRequest
     */
    function claimTokens(uint256 _tokenId) external {
        // check if the token is owner by the msg.sender.
        require(
            ILidoNFT(lidoNFT).isApprovedOrOwner(msg.sender, _tokenId),
            "Not owner"
        );

        RequestWithdraw storage userRequests = token2WithdrawRequest[_tokenId];

        require(userRequests.active, "No active withdrawals");
        require(
            block.timestamp >=
                userRequests.requestTime + stakeManager.withdrawalDelay(),
            "Not able to claim yet"
        );

        // Amount in Matic requested by the user
        uint256 amountToClaim = userRequests.amountToClaim;

        if (userRequests.validatorAddress != address(0)) {
            unstakeClaimTokens_new(
                userRequests.validatorAddress,
                userRequests.validatorNonce
            );

            totalDelegated -= amountToClaim;

            validator2DelegatedAmount[
                userRequests.validatorAddress
            ] -= amountToClaim;
        } else {
            reservedFunds -= amountToClaim;
            totalBuffered -= amountToClaim;
        }

        uint256 amountToBurn = userRequests.amountToBurn;

        _burn(address(this), amountToBurn);
        ILidoNFT(lidoNFT).burn(_tokenId);

        lockedAmountMatic -= amountToClaim;
        lockedAmountStMatic -= amountToBurn;

        IERC20Upgradeable(token).safeTransfer(msg.sender, amountToClaim);

        userRequests.active = false;
    }

    /**
     * @dev Distributes rewards claimed from validator shares based on fees defined in entityFee
     */
    function distributeRewards() external {
        Operator.OperatorShare[] memory operatorShares = nodeOperator
            .getOperatorShares();

        for (uint256 i = 0; i < operatorShares.length; i++) {
            IValidatorShare(operatorShares[i].validatorShare).withdrawRewards();
        }

        uint256 totalRewards = IERC20Upgradeable(token).balanceOf(
            address(this)
        ) - totalBuffered;

        require(
            totalRewards > rewardDistributionLowerBound,
            "Amount to distribute lower than minimum"
        );

        uint256 daoRewards = (totalRewards * entityFees.dao) / 100;
        uint256 insuranceRewards = (totalRewards * entityFees.insurance) / 100;
        uint256 operatorsRewards = (totalRewards * entityFees.operators) / 100;

        IERC20Upgradeable(token).safeTransfer(dao, daoRewards);
        IERC20Upgradeable(token).safeTransfer(insurance, insuranceRewards);

        Operator.OperatorReward[] memory operators = nodeOperator
            .getOperatorRewardAddresses();
        require(
            operators.length == operatorShares.length,
            "Operators Length doesn't match"
        );

        uint256[] memory ratios = new uint256[](operatorShares.length);
        uint256 totalRatio = 0;

        for (uint256 idx = 0; idx < operators.length; idx++) {
            uint256 rewardRatio = operators[idx].penality
                ? RewardMin
                : 100;
            ratios[idx] = rewardRatio;
            totalRatio += rewardRatio;
        }

        for (uint256 i = 0; i < operators.length; i++) {
            IERC20Upgradeable(token).safeTransfer(
                operators[i].rewardAddress,
                (operatorsRewards * ratios[i]) / totalRatio
            );
        }

        // Add the remainder to totalBuffered
        uint256 remainder = IERC20Upgradeable(token).balanceOf(address(this)) -
            totalBuffered;
        totalBuffered += remainder;
    }

    /**
     * @notice Only NodeOperator can call this function
     * @dev Withdraws funds from unstaked validator
     * @param _validatorShare - Address of the validator share that will be withdrawn
     */
    function withdrawTotalDelegated(address _validatorShare) external {
        require(msg.sender == address(nodeOperator), "Not a node operator");

        uint256 tokenId = ILidoNFT(lidoNFT).mint(address(this));

        (uint256 stakedAmount, ) = IValidatorShare(_validatorShare)
            .getTotalStake(address(this));

        sellVoucher_new(_validatorShare, stakedAmount, type(uint256).max);

        validator2Nonce[_validatorShare]++;

        user2Nonce[address(this)]++;

        token2WithdrawRequest[tokenId] = RequestWithdraw(
            stakedAmount,
            uint256(0),
            validator2Nonce[_validatorShare],
            block.timestamp,
            _validatorShare,
            true
        );
    }

    /**
     * @notice This will be included in the cron job
     * @dev Claims tokens from validator share and sends them to the
     * LidoMatic contract
     */
    function claimTokens2LidoMatic(uint256 _tokenId) public {
        RequestWithdraw storage lidoRequests = token2WithdrawRequest[_tokenId];

        ILidoNFT lidoFNTContract = ILidoNFT(lidoNFT);
        require(
            lidoFNTContract.ownerOf(_tokenId) == address(this),
            "Not owner of the NFT"
        );

        // Return from function if request has already been processed or withdrawal delay isnt fulfilled
        require(lidoRequests.active, "No active withdrawals");

        require(
            block.timestamp >=
                lidoRequests.requestTime + stakeManager.withdrawalDelay(),
            "Not able to claim yet"
        );

        unstakeClaimTokens_new(
            lidoRequests.validatorAddress,
            lidoRequests.validatorNonce
        );

        // Update totalBuffered after claiming the amount
        totalBuffered += lidoRequests.amountToClaim;

        // Update delegated amount for a validator
        // Not sure if this part is necessary because the validator is unstaked
        validator2DelegatedAmount[lidoRequests.validatorAddress] -= lidoRequests
            .amountToClaim;

        // Wrap up the request
        lidoRequests.active = false;

        // burn nft
        lidoFNTContract.burn(_tokenId);
    }

    /**
     * @notice Only PAUSE_ROLE can call this function. This function puts certain functionalities on pause.
     * @param _pause - Determines if the contract will be paused (true) or unpaused (false)
     */
    function pause(bool _pause) external auth(PAUSE_ROLE) {
        paused = _pause;
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
     * @param _unbondNonce - TODO
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
        public
        view
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
     * @dev Helper function for that returns total pooled MATIC
     * @return Total pooled MATIC
     */
    function getTotalStakeAcrossAllValidators() public view returns (uint256) {
        uint256 totalStake;

        Operator.OperatorShare[] memory operatorShares = nodeOperator
            .getOperatorShares();

        for (uint256 i = 0; i < operatorShares.length; i++) {
            (uint256 currValidatorShare, ) = getTotalStake(
                IValidatorShare(operatorShares[i].validatorShare)
            );

            totalStake += currValidatorShare;
        }

        return totalStake;
    }

    /**
     * @dev Function that converts arbitrary StMatic to Matic
     * @param _balance - Balance in StMatic
     * @return Balance in Matic
     */
    function convertStMaticToMatic(uint256 _balance)
        public
        view
        returns (uint256)
    {
        if (totalDelegated == 0) return _balance;

        uint256 totalShares = totalSupply();
        uint256 totalPooledMATIC = getTotalStakeAcrossAllValidators();

        uint256 balanceInMATIC = (_balance * totalPooledMATIC) / totalShares;

        return balanceInMATIC;
    }

    ////////////////////////////////////////////////////////////
    /////                                                    ///
    /////                 ***Setters***                      ///
    /////                                                    ///
    ////////////////////////////////////////////////////////////

    /**
     * @dev Function that sets new dao fee
     * @notice Callable only by dao
     * @param _fee - New fee in %
     */
    function setDaoFee(uint256 _fee) external auth(DAO) {
        entityFees.dao = _fee;
    }

    /**
     * @dev Function that sets new operators fee
     * @notice Callable only by dao
     * @param _fee - New fee in %
     */
    function setOperatorsFee(uint256 _fee) external auth(DAO) {
        entityFees.operators = _fee;
    }

    /**
     * @dev Function that sets new insurance fee
     * @notice Callable only by dao
     * @param _fee - New fee in %
     */
    function setInsuranceFee(uint256 _fee) external auth(DAO) {
        entityFees.insurance = _fee;
    }

    /**
     * @dev Function that sets new dao address
     * @notice Callable only by dao
     * @param _address - New dao address
     */
    function setDaoAddress(address _address) external auth(DAO) {
        dao = _address;
    }

    /**
     * @dev Function that sets new insurance address
     * @notice Callable only by dao
     * @param _address - New insurance address
     */
    function setInsuranceAddress(address _address) external auth(DAO) {
        insurance = _address;
    }

    /**
     * @dev Function that sets new node operator address
     * @notice Only callable by dao
     * @param _address - New node operator address
     */
    function setNodeOperatorAddress(address _address) external auth(DAO) {
        nodeOperator = INodeOperatorRegistry(_address);
    }

    /**
     * @dev Function that sets new lower bound for delegation
     * @notice Only callable by dao
     * @param _delegationLowerBound - New lower bound for delegation
     */
    function setDelegationLowerBound(uint256 _delegationLowerBound)
        external
        auth(DAO)
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
    ) external auth(DAO) {
        rewardDistributionLowerBound = _rewardDistributionLowerBound;
    }

    /**
     * @dev Function that sets the delegation stats
     * @notice Only callable by dao role
     * @param _delay the delay that should wait to trust a validator
     * @param _delegatMin in percent to delegate to a non trusted validator.
     */
    function setDelegationBound(
        uint256 _delay,
        uint256 _delegatMin
    ) external auth(DAO) {
        require(_delegatMin <= 100 , "invalid min reward value");
        DelegationDelay = _delay;
        DelegationMin = _delegatMin;
    }

    /**
     * @dev Function that sets the min rewards
     * @notice Only callable by dao role
     * @param _rewardMin in percent to delegate to a non trusted validator.
     */
    function setRewardBound(
        uint256 _rewardMin
    ) external auth(DAO) {
        require(_rewardMin <= 100 , "invalid min reward value");
        RewardMin = _rewardMin;
    }
}
