import hardhat, { upgrades } from "hardhat";
import { getUpgradeContext } from "./utils";

const transferOwnership = async () => {
    console.log("Transferring ownership of ProxyAdmin...");
    const { deployDetails } = getUpgradeContext(hardhat);
    await upgrades.admin.transferProxyAdminOwnership(deployDetails.dao);
    console.log("Transferred ownership of ProxyAdmin to:", deployDetails.dao);
};

transferOwnership();
