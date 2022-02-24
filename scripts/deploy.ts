
import { ethers } from "hardhat";
import {
    DEPLOYER_PRIVATE_KEY,
    CHILD_CHAIN_RPC
} from "../environment";
import { PoLidoDeployer } from "./deployers";

const initSigner = (privateKey: string, rpc: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpc);
    const signer = new ethers.Wallet(privateKey, provider);

    return signer;
};

const main = async () => {
    const [rootSigner] = await ethers.getSigners();
    const childSigner = initSigner(DEPLOYER_PRIVATE_KEY, CHILD_CHAIN_RPC);

    const poLidoDeployer = await PoLidoDeployer.CreatePoLidoDeployer(
        rootSigner,
        childSigner
    );
    await poLidoDeployer.deploy();
    await poLidoDeployer.export();
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
