// SPDX-FileCopyrightText: 2021 Shardlabs
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.7;

/// @title LidoMatic interface.
/// @author 2021 Shardlabs
interface ILido {
    function withdrawTotalDelegated(address _validatorShare) external;
}
