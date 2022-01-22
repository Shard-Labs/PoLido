import { Wallet } from "@ethersproject/wallet";
import hardhat, { ethers } from "hardhat";
import {
    POLYGON_RPC,
    MUMBAI_RPC,
    MAINNET_PRIVATE_KEY,
    GOERLI_PRIVATE_KEY,
    MAINNET_RPC,
    GOERLI_RPC
} from "../environment";
import { PoLidoDeployer } from "./deployers";

const initSigner = (privateKey: string, rpc: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpc);
    const signer = new ethers.Wallet(privateKey, provider);

    return signer;
};

const main = async () => {
    let rootSigner: Wallet;
    let childSigner: Wallet;

    if (hardhat.network.name === "mainnet") {
        rootSigner = initSigner(MAINNET_PRIVATE_KEY, MAINNET_RPC);
        childSigner = initSigner(MAINNET_PRIVATE_KEY, POLYGON_RPC);
    } else {
        rootSigner = initSigner(GOERLI_PRIVATE_KEY, GOERLI_RPC);
        childSigner = initSigner(GOERLI_PRIVATE_KEY, MUMBAI_RPC);
    }

    const poLidoDeployer = await PoLidoDeployer.CreatePoLidoDeployer(childSigner, rootSigner);
    await poLidoDeployer.deploy();
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
