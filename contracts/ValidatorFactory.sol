// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

// todo: INFO[3] delete
import "hardhat/console.sol";
import "./ValidatorProxy.sol";
import "./interfaces/INodeOperatorRegistry.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title ValidatorFactory
/// @author 2021 Shardlabs.
/// @notice Allows to create an remove validator proxy that are used as validator's
// owner on Polygon StakeManager
contract ValidatorFactory is
    Initializable,
    OwnableUpgradeable
{
    // ====================================================================
    // =========================== Global Vars ============================
    // ====================================================================

    address[] internal validators;

    ValidatorFactoryState internal state;

    // todo: INFO[1] delete struct and create flat vars.
    /// @notice State struct
    struct ValidatorFactoryState {
        address operator;
        address validatorImplementation;
    }
    // ====================================================================
    // ============================== EVENTS ==============================
    // ====================================================================

    event CreateValidator(address validator);
    event SetOperatorContract(address operator);
    // todo: INFO[5] use this
    event SetValidatorImplementation(address validatorImplementation);

    // ====================================================================
    // =========================== MODIFIERS ==============================
    // ====================================================================

    // todo: INFO[3] use onlyOwner from OwnableUpgradeable.
    /// @notice Check if the msg.sender is the owner.
    modifier isOwner() {
        require(owner() == msg.sender, "Permission not found");
        _;
    }

    /// @notice Check if the operator contract is the msg.sender.
    modifier isOperator() {
        require(
            state.operator == msg.sender,
            "Caller is not the operator contract"
        );
        _;
    }

    // ====================================================================
    // =========================== FUNCTIONS ==============================
    // ====================================================================

    /// @notice Initialize the NodeOperator contract.
    function initialize(address _validatorImplementation) public initializer {
        __Ownable_init();
        state.validatorImplementation = _validatorImplementation;
    }

    /// @notice Deploy a new validator contract
    /// @return return the address of the new validator contract deployed
    function create() external isOperator returns (address) {
        require(state.operator != address(0), "Operator contract not set");

        // create a new validator proxy
        address proxy = address(
            new ValidatorProxy(
                owner(),
                state.validatorImplementation,
                state.operator
            )
        );

        validators.push(proxy);

        emit CreateValidator(proxy);
        return proxy;
    }

    /// @notice Remove a validator proxy from the list.
    function remove(address _validatorProxy) external isOperator {
        for (uint256 idx = 0; idx < validators.length; idx++) {
            if (_validatorProxy == validators[idx]) {
                validators[idx] = validators[validators.length - 1];
                validators.pop();
            }
        }
    }

    /// @notice Allows to set the NodeOperatorRegistry contract.
    /// @dev Allows to set the NodeOperatorRegistry contract. this is done only one time.
    function setOperatorAddress(address _operator) public isOwner {
        state.operator = _operator;
        emit SetOperatorContract(_operator);
    }

    /// @notice Get validators contracts.
    /// @return return a list of deployed validator contracts.
    function getValidators() public view returns (address[] memory) {
        return validators;
    }

    /// @notice Alows to get the operator contract.
    /// @dev Returns operator address.
    function getOperator() external view returns (address) {
        return state.operator;
    }

    /// @notice Contract version.
    /// @dev Returns contract version.
    function version() public view virtual returns (string memory) {
        return "1.0.0";
    }
}
