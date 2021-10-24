// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;


import "../../LidoMatic.sol";

contract LidoMaticUpgrade is LidoMatic {

    bool public constant upgraded = true;

    /**
     * @dev Used for testing purposes only
     */
    function simulateSlashing() external {
        totalDelegated = totalSupply() / 2;
        totalBuffered = 0;
    }

    /**
     * @dev Used for testing purposes only
     */
    function simulateRewarding() external {
        totalDelegated = totalSupply() * 2;
        totalBuffered = 0;
    }
}
