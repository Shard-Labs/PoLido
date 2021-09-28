// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IValidatorShare.sol";
import "./interfaces/INodeOperatorRegistry.sol";

contract LidoMatic is AccessControl, ERC20 {
    ////////////////////////////////////////////////////////////
    ///                                                      ///
    ///               ***State Variables***                  ///
    ///                                                      ///
    ////////////////////////////////////////////////////////////
    uint256 constant WITHDRAWAL_DELAY = 2**13;

    INodeOperatorRegistry public nodeOperator;
    FeeDistribution public entityFees;
    address public governance;
    address public insurance;
    uint256 public lastWithdrawnValidatorId;
    uint256 public totalDelegated;
    uint256 public totalBuffered;
    address public token;
    bool public paused;

    IValidatorShare[] validatorShares;

    mapping(address => RequestWithdraw[]) public user2WithdrawRequest;
    mapping(address => uint256) public validator2DelegatedAmount;
    mapping(address => uint256) public user2Shares;
    mapping(address => uint256) public validator2Nonce;
    mapping(address => uint256) public user2Nonce;

    struct RequestWithdraw {
        uint256 amount;
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

    /** Roles */
    bytes32 public constant GOVERNANCE = keccak256("GOVERNANCE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    bytes32 public constant MANAGE_FEE = keccak256("MANAGE_FEE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 public constant SET_TREASURY = keccak256("SET_TREASURY");

    /** Modifiers */
    modifier auth(bytes32 _role) {
        require(hasRole(_role, msg.sender));
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
    constructor(
        address _nodeOperator,
        address _token,
        address _governance
    ) ERC20("Staked MATIC", "StMATIC") {
        nodeOperator = INodeOperatorRegistry(_nodeOperator);
        governance = _governance;
        token = _token;

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

        IERC20(token).transferFrom(msg.sender, address(this), _amount);

        uint256 totalShares = totalSupply();
        uint256 totalPooledMatic = totalBuffered + totalDelegated;
        uint256 amountToMint = totalShares != 0
            ? (_amount * totalShares) / totalPooledMatic
            : _amount;

        _mint(msg.sender, amountToMint);

        totalBuffered += _amount;

        return amountToMint;
    }

    /**
     * How to select a validator that we are going to withdraw from?
     *
     * @dev Stores users request to withdraw into a RequestWithdraw struct
     * @param _amount - Amount of MATIC that is requested to withdraw
     */
    function requestWithdraw(uint256 _amount) external notPaused {
        // Add a function that converts MATIC to StMATIC and reverse
        // Check how many StMATIC does a caller have
        // Add a mapping between a validator address and a nonce (starts at 1)
        // Increment nonce by 1 everytime a user calls a withdrawal function
        // Burn StMATIC after checking if _amount satisfies user's balance
        // A nonce is dependent on a validator
        // Add a nonce per user
        Operator.OperatorShare[] memory operatorShares = nodeOperator
            .getOperatorShares();

        if (lastWithdrawnValidatorId > operatorShares.length - 1) {
            lastWithdrawnValidatorId = 0;
        }

        address validatorShare = operatorShares[lastWithdrawnValidatorId]
            .validatorShare;

        uint256 callerBalance = balanceOf(msg.sender);

        require(callerBalance <= _amount, "Invalid amount");

        _burn(msg.sender, _amount);

        uint256 amountInMATIC = getUserBalanceInMATIC();

        sellVoucher_new(validatorShare, amountInMATIC, type(uint256).max);

        if (validator2Nonce[validatorShare] == 0)
            validator2Nonce[validatorShare] = 1;

        validator2Nonce[validatorShare]++;

        if (user2Nonce[msg.sender] == 0) user2Nonce[msg.sender] = 1;

        user2Nonce[msg.sender]++;

        RequestWithdraw[] storage requestWithdraws = user2WithdrawRequest[
            msg.sender
        ];

        requestWithdraws.push(
            RequestWithdraw(
                amountInMATIC,
                validator2Nonce[validatorShare],
                block.timestamp,
                validatorShare,
                true
            )
        );

        lastWithdrawnValidatorId++;
    }

    /**
     * @dev Delegates tokens to validator share contract
     */
    function delegate() external auth(GOVERNANCE) {
        Operator.OperatorShare[] memory operatorShares = nodeOperator
            .getOperatorShares();

        uint256 amountPerValidator = totalBuffered / operatorShares.length;
        uint256 remainder = totalBuffered % operatorShares.length;

        for (uint256 i = 0; i < operatorShares.length; i++) {
            IERC20(token).approve(
                operatorShares[i].validatorShare,
                amountPerValidator
            );

            buyVoucher(operatorShares[i].validatorShare, amountPerValidator, 0);

            validator2DelegatedAmount[
                operatorShares[i].validatorShare
            ] = amountPerValidator;
        }

        totalDelegated += totalBuffered - remainder;
        totalBuffered = remainder;
    }

    /**
     * @dev Claims tokens from validator share and sends them to the
     * user if his request is in the userToWithdrawRequest
     */
    function claimTokens() external {
        RequestWithdraw[] storage userRequests = user2WithdrawRequest[
            msg.sender
        ];

        uint256 requestIndex;

        for (uint256 i = userRequests.length - 1; i >= 0; i--) {
            if (i > 0 && userRequests[i - 1].active) continue;
            requestIndex = i;
            break;
        }

        require(userRequests[requestIndex].active, "No active withdrawals");

        require(
            block.timestamp >=
                userRequests[requestIndex].requestTime + WITHDRAWAL_DELAY,
            "Not able to claim yet"
        );

        uint256 balanceBeforeClaim = IERC20(token).balanceOf(address(this));

        unstakeClaimTokens_new(
            userRequests[requestIndex].validatorAddress,
            userRequests[requestIndex].validatorNonce
        );

        uint256 balanceAfterClaim = IERC20(token).balanceOf(address(this));
        uint256 amount = balanceAfterClaim - balanceBeforeClaim;

        IERC20(token).transfer(msg.sender, amount);

        userRequests[requestIndex].active = false;

        totalDelegated -= amount;
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

        uint256 totalRewards = IERC20(token).balanceOf(address(this)) -
            totalBuffered;

        uint256 daoRewards = (totalRewards * entityFees.dao) / 100;
        uint256 insuranceRewards = (totalRewards * entityFees.insurance) / 100;
        uint256 operatorsRewards = (totalRewards * entityFees.operators) / 100;

        IERC20(token).transfer(governance, daoRewards);
        IERC20(token).transfer(insurance, insuranceRewards);

        address[] memory operators = nodeOperator.getOperatorAddresses();
        uint256 rewardsPerOperator = operatorsRewards / operators.length;

        for (uint256 i = 0; i < operators.length; i++) {
            IERC20(token).transfer(operators[i], rewardsPerOperator);
        }

        // Add the remainder to totalBuffered
        uint256 remainder = IERC20(token).balanceOf(address(this)) -
            totalBuffered;
        totalBuffered += remainder;
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
    ) public returns (uint256) {
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
    function restake(address _validatorShare) public {
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
    ) public {
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
    ) public {
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

        for (uint256 i = 0; i < validatorShares.length; i++) {
            (uint256 currValidatorShare, ) = getTotalStake(validatorShares[i]);

            totalStake += currValidatorShare;
        }

        return totalStake;
    }

    /**
     * @dev Function that converts users StMATIC to MATIC
     * @return Users balance in MATIC
     */
    function getUserBalanceInMATIC() public view returns (uint256) {
        uint256 userShares = balanceOf(msg.sender);
        uint256 totalShares = totalSupply();
        uint256 totalPooledMATIC = getTotalStakeAcrossAllValidators();

        uint256 userBalanceInMATIC = (userShares * totalPooledMATIC) /
            totalShares;

        return userBalanceInMATIC;
    }

    ////////////////////////////////////////////////////////////
    /////                                                    ///
    /////                 ***Setters***                      ///
    /////                                                    ///
    ////////////////////////////////////////////////////////////

    /**
     * @dev Function that sets new dao fee
     * @notice Callable only by governance
     * @param _fee - New fee in %
     */
    function setDaoFee(uint256 _fee) external auth(GOVERNANCE) {
        entityFees.dao = _fee;
    }

    /**
     * @dev Function that sets new operators fee
     * @notice Callable only by governance
     * @param _fee - New fee in %
     */
    function setOperatorsFee(uint256 _fee) external auth(GOVERNANCE) {
        entityFees.operators = _fee;
    }

    /**
     * @dev Function that sets new insurance fee
     * @notice Callable only by governance
     * @param _fee - New fee in %
     */
    function setInsuranceFee(uint256 _fee) external auth(GOVERNANCE) {
        entityFees.insurance = _fee;
    }

    /**
     * @dev Function that sets new dao address
     * @notice Callable only by governance
     * @param _address - New dao address
     */
    function setDaoAddress(address _address) external auth(GOVERNANCE) {
        governance = _address;
    }

    /**
     * @dev Function that sets new insurance address
     * @notice Callable only by governance
     * @param _address - New insurance address
     */
    function setInsuranceAddress(address _address) external auth(GOVERNANCE) {
        insurance = _address;
    }

    /**
     * @dev Function that sets new node operator address
     * @notice Only callable by governance
     * @param _address - New node operator address
     */
    function setNodeOperatorAddress(address _address)
        external
        auth(GOVERNANCE)
    {
        nodeOperator = INodeOperatorRegistry(_address);
    }
}
