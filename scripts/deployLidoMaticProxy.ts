import { ethers, upgrades } from "hardhat";
import * as GOERLI_DEPLOYMENT_DETAILS from "../deploy-goerli.json";

const main = async () => {
    const LidoMatic = await ethers.getContractFactory("LidoMatic");
    const lidoMatic = await upgrades.deployProxy(LidoMatic, [
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy,
        GOERLI_DEPLOYMENT_DETAILS.matic_erc20_address,
        GOERLI_DEPLOYMENT_DETAILS.dao,
        GOERLI_DEPLOYMENT_DETAILS.dao,
        GOERLI_DEPLOYMENT_DETAILS.matic_stake_manager_proxy
    ]);

    console.log(lidoMatic.address);
};

main();
