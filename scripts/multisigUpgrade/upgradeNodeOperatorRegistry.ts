import hardhat from "hardhat";
import { getUpgradeContext } from "../utils";
import { createUpgradeProposal } from "./upgradeUtils";

const upgradeNodeOperatorRegistry = () => {
    const { deployDetails } = getUpgradeContext(hardhat);
    createUpgradeProposal(deployDetails.node_operator_registry_proxy, "NodeOperatorRegistry");
};

upgradeNodeOperatorRegistry();
