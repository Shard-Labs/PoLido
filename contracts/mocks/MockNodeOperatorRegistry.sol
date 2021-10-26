// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../lib/Operator.sol";

contract MockNodeOperatorRegistry {
    Operator.OperatorShare[] operatorShare;
    Operator.OperatorReward[] operatorRewards;

    uint256[] operatorIds;

    // address[] operatorAddresses;

    constructor(address _validatorShare, address _operator) {
        uint256 MAX_INT = 2**256 - 1;
        operatorShare.push(
            Operator.OperatorShare(1, _validatorShare, 0, block.timestamp, MAX_INT)
        );
        operatorRewards.push(Operator.OperatorReward(_operator, false));
    }

    /// @notice Get the all operator ids availablein the system.
    /// @return Return a list of operator Ids.
    function getOperators() external returns (uint256[] memory) {
        operatorIds.push(1);
        operatorIds.push(2);
        operatorIds.push(3);

        return operatorIds;
    }

    /// @notice Get validator total stake.
    /// @return Returns the validatorId of an address.
    function getValidatorId(address) external pure returns (uint256) {
        return 1;
    }

    /// @notice Get validatorShare contract address.
    /// @dev Get validatorShare contract address.
    /// @return Returns the address of the validatorShare contract.
    function getValidatorContract(uint256) external pure returns (address) {
        return address(0);
    }

    /// @notice Allows to get a list of operatorShare struct
    /// @return Returns a list of operatorShare struct
    function getOperatorShares()
        external
        view
        returns (Operator.OperatorShare[] memory)
    {
        return operatorShare;
    }

    function getOperatorRewardAddresses()
        external
        view
        returns (Operator.OperatorReward[] memory)
    {
        return operatorRewards;
    }
}
