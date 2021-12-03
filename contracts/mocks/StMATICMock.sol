// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../interfaces/INodeOperatorRegistry.sol";

contract StMATICMock {
    address operator;

    function withdrawTotalDelegated(address _validatorShare) external pure {
        require(_validatorShare != address(0), "IStMATIC error");
    }

    function setOperator(address _operator) public {
        operator = _operator;
    }
}
