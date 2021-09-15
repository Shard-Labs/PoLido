// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LidoMatic is ERC20("Staked Matic", "StMATIC") {
    /**
     * CONSTANTS
     * TODO: Extract constants to separate library
     * TODO: Replace token addresses with Ethereum Mainnet ones, these are for Mumbai Testnet
     */
    address public constant GOERLI_TEST_TOKEN =
        0x7af963cF6D228E564e2A0aA0DdBF06210B38615D;

    /**
     * @dev Send funds to the validator share contract with optional _referral parameter
     * @notice Requires that msg.sender has approved _amount of MATIC to this contract
     * @return Amount of StMATIC shares generated
     * TODO: Add referral param
     * TODO: Implement formula for minting StMATIC, now it returns 1:1 StMatic for MATIC
     */
    function buyVoucher(uint256 _amount) external returns (uint256) {
        require(_amount > 0, "Invalid amount");

        IERC20(GOERLI_TEST_TOKEN).transferFrom(
            msg.sender,
            address(this),
            _amount
        );

        _mint(msg.sender, _amount);

        return _amount;
    }

}
