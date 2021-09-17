pragma solidity ^0.8.0;

// note this contract interface is only for stakeManager use
interface IValidatorShare {
    function withdrawRewards() external;

    function unstakeClaimTokens() external;

    function getLiquidRewards(address user) external view returns (uint256);

    function owner() external view returns (address);

    function restake() external returns (uint256, uint256);

    function unlock() external;

    function lock() external;

    function drain(
        address token,
        address payable destination,
        uint256 amount
    ) external;

    function slash(
        uint256 valPow,
        uint256 delegatedAmount,
        uint256 totalAmountToSlash
    ) external returns (uint256);

    function updateDelegation(bool delegation) external;

    function migrateOut(address user, uint256 amount) external;

    function migrateIn(address user, uint256 amount) external;
}
