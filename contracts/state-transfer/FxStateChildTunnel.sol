// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {FxBaseChildTunnel} from "../tunnel/FxBaseChildTunnel.sol";

/**
 * @title FxStateChildTunnel
 */
contract FxStateChildTunnel is FxBaseChildTunnel {
    uint256 public latestStateId;
    address public latestRootMessageSender;
    bytes public latestData;

    constructor(address _fxChild, address _fxRoot) FxBaseChildTunnel(_fxChild) {
        setFxRootTunnel(_fxRoot);
    }

    function _processMessageFromRoot(
        uint256 stateId,
        address sender,
        bytes memory data
    ) internal override validateSender(sender) {
        latestStateId = stateId;
        latestRootMessageSender = sender;
        latestData = data;
    }

    /**
     * @dev Function that returns the amount of stMATIC and MATIC in the PoLido protocol
     * @return First return value is the number of stMATIC present, second value is MATIC
     */
    function getReserves() public view returns (uint256, uint256) {
        (uint256 stMATIC, uint256 MATIC) = abi.decode(
            latestData,
            (uint256, uint256)
        );

        return (stMATIC, MATIC);
    }
}
