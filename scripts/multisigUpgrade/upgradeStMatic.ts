import hardhat from "hardhat";
import { getUpgradeContext } from "../utils";
import { createUpgradeProposal } from "./upgradeUtils";

const upgradeStMatic = () => {
    const { deployDetails } = getUpgradeContext(hardhat);
    createUpgradeProposal(deployDetails.stMATIC_proxy, "StMATIC");
};

upgradeStMatic();
