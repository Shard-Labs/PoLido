import { ethers, upgrades } from "hardhat";
import * as GOERLI_DEPLOYMENT_DETAILS from "../deploy-goerli.json";

const main = async () => {
    const stMATICAddres = GOERLI_DEPLOYMENT_DETAILS.stMATIC_proxy;
    const StMATIC = await ethers.getContractFactory("StMATIC");
    const stMATIC = await upgrades.upgradeProxy(stMATICAddres, StMATIC);

    console.log("StMATIC upgraded");
    console.log(stMATIC.address);
};

main();
