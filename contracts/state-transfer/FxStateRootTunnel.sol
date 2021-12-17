// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {FxBaseRootTunnel} from "../tunnel/FxBaseRootTunnel.sol";

/**
 * @title FxStateRootTunnel
 */
contract FxStateRootTunnel is FxBaseRootTunnel {
    bytes public latestData;
    address public stMATIC;

    constructor(address _checkpointManager, address _fxRoot)
        FxBaseRootTunnel(_checkpointManager, _fxRoot)
    {}

    function _processMessageFromChild(bytes memory data) internal override {
        latestData = data;
    }

    function setStMATIC(address _stMATIC) external {
        require(
            stMATIC == address(0x0),
            "FxBaseRootTunnel: STMATIC_ALREADY_SET"
        );
        stMATIC = _stMATIC;
    }

    function sendMessageToChild(bytes memory message) public {
        require(msg.sender == stMATIC, "Not stMATIC");
        _sendMessageToChild(message);
    }
}
