//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "../Validator.sol";
import "../lib/Operator.sol";

/// @title ValidatorStorage.
/// @author 2021 Shardlabs.
/// @notice Validator storage.
contract ValidatorStorage {
    // ====================================================================
    // =========================== Global Vars ============================
    // ====================================================================

    /// @notice Validator global state
    Operator.ValidatorState internal state;

    // ====================================================================
    // ============================== EVENTS ==============================
    // ====================================================================

    event Stake(
        address user,
        uint256 amount,
        uint256 heimdallFee,
        bool acceptDelegation,
        bytes signerPubkey
    );

    event Unstake(uint256 validatorId);
    event TopUpForFee(address user, uint256 heimdallFee);
    event WithdrawRewards(uint256 validatorId);
}
