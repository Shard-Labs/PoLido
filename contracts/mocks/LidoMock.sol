// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../interfaces/INodeOperatorRegistry.sol";

contract LidoMock {
    address operator;

    function withdrawTotalDelegated(address _validatorShare) pure external{
        require(_validatorShare != address(0), "ILido error");
    }

    function setOperator(address _operator) public {
        operator = _operator;
    }
}
