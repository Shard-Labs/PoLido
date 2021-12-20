// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {FxBaseChildTunnel} from "../tunnel/FxBaseChildTunnel.sol";

/**
 * @title FxStateChildTunnel
 */
contract FxStateChildTunnel is FxBaseChildTunnel {
    uint256 public latestStateId;
    address public latestRootMessageSender;
    bytes public latestData;

    constructor(address _fxChild) FxBaseChildTunnel(_fxChild) {}

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
     * @dev Function that will return the amount of stMATIC and MATIC in the PoLido protocol
     * @return First return value is the number of stMATIC present, second value is MATIC
     */
    function getReserves() public view returns (uint256, uint256) {
        bytes memory latest = latestData;
        uint256 stMATIC;
        uint256 MATIC;
        assembly {
            stMATIC := mload(add(latest, 0x20))
            MATIC := mload(add(latest, add(0x20, 32)))
        }
        return (stMATIC, MATIC);
    }

    // function sendMessageToRoot(bytes memory message) public {
    //     _sendMessageToRoot(message);
    // }
}
