import hardhat, { ethers, upgrades } from "hardhat";
import {
    StMATIC__factory
} from "../typechain";
import { exportAddresses, getUpgradeContext } from "./utils";

const upgradeStMATIC = async () => {
    const { network, filePath, deployDetails } = getUpgradeContext(hardhat);

    console.log("Start upgrade contracts on:", network);
    const stMATICAddress = deployDetails.stMATIC_proxy;
    const StMATICFactory: StMATIC__factory = (
        await ethers.getContractFactory("StMATIC")) as StMATIC__factory;

    await upgrades.upgradeProxy(stMATICAddress, StMATICFactory);
    const stMATICImplAddress = await upgrades.erc1967.getImplementationAddress(
        stMATICAddress
    );

    console.log("StMATIC upgraded");
    console.log("proxy:", stMATICAddress);
    console.log("Implementation:", stMATICImplAddress);

    exportAddresses(filePath, {
        stMATIC_proxy: stMATICAddress,
        stMATIC_implementation: stMATICImplAddress
    });
};

upgradeStMATIC();
