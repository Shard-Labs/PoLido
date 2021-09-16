//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "../Validator.sol";

/// @title ValidatorFactoryStorage
/// @author 2021 Shardlabs
/// @notice Validator factory storage
contract ValidatorFactoryStorage {
    // ====================================================================
    // ========================== Struct & enum ===========================
    // ====================================================================

    /// @notice State struct
    struct State {
        address lido;
        address operator;
        address stakeManager;
        address validatorImplementation;
        address polygonERC20;
    }

    // ====================================================================
    // =========================== Global Vars ============================
    // ====================================================================

    /// @notice Global state
    State internal state;

    /// @notice validators contracts.
    Validator[] internal validators;

    // ====================================================================
    // ============================== EVENTS ==============================
    // ====================================================================

    event CreateValidator(address validator);
    event SetOperatorContract(address operator);
    event SetValidatorImplementation(address validatorImplementation);
}
