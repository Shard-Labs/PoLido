// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

import "../interfaces/INodeOperatorRegistry.sol";

contract LidoMock {
    address operator;
    event LogRewards(uint256 share, address recipient);

    function withdrawRewards() public {
        (
            uint256[] memory shares,
            address[] memory recipients
        ) = INodeOperatorRegistry(operator).withdrawRewards();
        require(shares.length == recipients.length, "Shares != Recipients");
        for (uint256 idx = 0; idx < recipients.length; idx++) {
            emit LogRewards(shares[idx], recipients[idx]);
        }
    }

    function setOperator(address _operator) public {
        operator = _operator;
    }
}
