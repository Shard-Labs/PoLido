// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LidoMatic is ERC20("Staked Matic", "StMATIC") {
    /**
     * STATE VARS
     */
    mapping(address => uint256) public userToShares;
    // Value of totalDelegated needs to be updated periodically off chain because of slashing and rewarding
    // It is calculated as the sum of delegated MATIC across all validatorShares
    uint256 public totalDelegated;
    // Value of totalBuffered needs to be set to 0 after the periodic update has been done
    uint256 public totalBuffered;
    // Address of Matic token
    address public token;

    constructor(address _token) {
        token = _token;
    }

    /**
     * @dev Send funds to LidoMatic contract and mint StMATIC to msg.sender
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
}
