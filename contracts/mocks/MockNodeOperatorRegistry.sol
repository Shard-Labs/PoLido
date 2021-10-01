// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

contract MockNodeOperatorRegistry {
    /// @notice OperatorShare struct
    struct OperatorShare {
        uint256 operatorId;
        address validatorShare;
    }

    OperatorShare[] operatorShare;

    uint256[] operatorIds;
    address[] operatorAddresses;

    constructor(address _validatorShare, address _operator) {
        operatorShare.push(OperatorShare(1, _validatorShare));
        operatorAddresses.push(_operator);
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
    /// @param _user user address.
    /// @return Returns the validatorId of an address.
    function getValidatorId(address _user) external pure returns (uint256) {
        return 1;
    }

    /// @notice Get validatorShare contract address.
    /// @dev Get validatorShare contract address.
    /// @param _validatorId Validator Id
    /// @return Returns the address of the validatorShare contract.
    function getValidatorContract(uint256 _validatorId)
        external
        pure
        returns (address)
    {
        return address(0);
    }

    /// @notice Allows to get a list of operatorShare struct
    /// @return Returns a list of operatorShare struct
    function getOperatorShares()
        external
        view
        returns (OperatorShare[] memory)
    {
        return operatorShare;
    }

    function getOperatorAddresses() external returns (address[] memory) {
        return operatorAddresses;
    }
}
