//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "../Validator.sol";

/// @title ValidatorStorage.
/// @author 2021 Shardlabs.
/// @notice Validator storage.
contract ValidatorStorage {
    // ====================================================================
    // ========================== Struct & enum ===========================
    // ====================================================================

    //// @notice State struct
    struct State {
        address validatorFactory;
    }

    // ====================================================================
    // =========================== Global Vars ============================
    // ====================================================================

    /// @notice Validator global state
    State internal state;

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
