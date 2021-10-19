import { ethers, upgrades } from "hardhat";
import * as GOERLI_DEPLOYMENT_DETAILS from "../deploy-goerli.json";

const main = async () => {
    const lidoMaticAddress = GOERLI_DEPLOYMENT_DETAILS.lido_matic;
    const LidoMatic = await ethers.getContractFactory("LidoMatic");
    const lidoMatic = await upgrades.upgradeProxy(lidoMaticAddress, LidoMatic);

    console.log("LidoMatic upgraded");
    console.log(lidoMatic.address);
};

main();
