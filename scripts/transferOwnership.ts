import hardhat, { upgrades } from "hardhat";
import { getUpgradeContext } from "./utils";

const transferOwnership = async () => {
    const { deployDetails } = getUpgradeContext(hardhat);
    console.log("Transferring ownership of ProxyAdmin...");
    await upgrades.admin.transferProxyAdminOwnership(deployDetails.dao);
    console.log("Transferred ownership of ProxyAdmin to:", deployDetails.dao);
};

transferOwnership();
