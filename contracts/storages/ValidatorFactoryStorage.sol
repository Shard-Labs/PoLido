//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.7;

import "../Validator.sol";
import "../lib/Operator.sol";

/// @title ValidatorFactoryStorage
/// @author 2021 Shardlabs
/// @notice Validator factory storage
contract ValidatorFactoryStorage {

    // ====================================================================
    // =========================== Global Vars ============================
    // ====================================================================

    /// @notice Global state
    Operator.ValidatorFactoryState internal state;

    /// @notice validators contracts.
    Validator[] internal validators;

    // ====================================================================
    // ============================== EVENTS ==============================
    // ====================================================================

    event CreateValidator(address validator);
    event SetOperatorContract(address operator);
    event SetValidatorImplementation(address validatorImplementation);
}
