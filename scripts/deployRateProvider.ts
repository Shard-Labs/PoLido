import hardhat, { ethers } from "hardhat";
import {
    DEPLOYER_PRIVATE_KEY,
    CHILD_CHAIN_RPC
} from "../environment";
import { getUpgradeContext } from "./utils";

const main = async () => {
    const { deployDetails } = getUpgradeContext(hardhat);
    const provider = new ethers.providers.JsonRpcProvider(CHILD_CHAIN_RPC);
    const childSigner = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
    const rateProviderFactory = await ethers.getContractFactory("RateProvider", childSigner);
    const rateProviderContract = await rateProviderFactory
        .deploy(deployDetails.fx_state_child_tunnel);
    await rateProviderContract._deployed();

    console.log(rateProviderContract.address);
};

main();
