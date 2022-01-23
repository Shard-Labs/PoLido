// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

import {FxBaseRootTunnel} from "../tunnel/FxBaseRootTunnel.sol";

/**
 * @title FxStateRootTunnel
 */
contract FxStateRootTunnel is FxBaseRootTunnel, Ownable {
    bytes public latestData;
    address public stMATIC;

    constructor(
        address _checkpointManager,
        address _fxRoot,
        address _fxChildTunnel,
        address _stMATIC
    ) FxBaseRootTunnel(_checkpointManager, _fxRoot) {
        setFxChildTunnel(_fxChildTunnel);
        stMATIC = _stMATIC;
    }

    function _processMessageFromChild(bytes memory data) internal override {
        latestData = data;
    }

    function sendMessageToChild(bytes memory message) public {
        require(msg.sender == stMATIC, "Not stMATIC");
        _sendMessageToChild(message);
    }

    function setStMATIC(address _stMATIC) external onlyOwner {
        stMATIC = _stMATIC;
    }
}
