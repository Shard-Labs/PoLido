// SPDX-FileCopyrightText: 2021 ShardLabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

contract SelfDestructor {
    receive() external payable {}

    function selfdestruct(address _recipient) external {
        selfdestruct(payable(_recipient));
    }
}
