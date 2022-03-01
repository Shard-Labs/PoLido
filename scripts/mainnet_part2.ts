import { ethers, upgrades } from "hardhat";
import {
    DEPLOYER_PRIVATE_KEY,
    CHILD_CHAIN_RPC
} from "../environment";

const initSigner = (privateKey: string, rpc: string) => {
    const provider = new ethers.providers.JsonRpcProvider(rpc);
    const signer = new ethers.Wallet(privateKey, provider);
    return signer;
};

const main = async () => {
    console.log("Deploy contracts...");

    // console.log("Deploy FxStateChildTunnel");
    // const childSigner = initSigner(DEPLOYER_PRIVATE_KEY, CHILD_CHAIN_RPC);

    const fxRootFactory = await ethers.getContractFactory("FxStateRootTunnel");
    const fxRootContract = await fxRootFactory.deploy(
        "0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287",
        "0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2",
        "0x0833f5bD45803E05ef54E119a77E463cE6b1a963",
        "0x9ee91F9f426fA633d227f7a9b000E28b9dfd8599",
        { gasPrice: 65000000000 }
    );

    await fxRootContract.deployed();

    // const fxChildFactory = await ethers.getContractFactory("FxStateChildTunnel", childSigner);
    // const fxChildContract = await fxChildFactory.deploy(
    //     "0x8397259c983751DAf40400790063935a11afa28a",
    //     "0xc7dd5c30DcA04f487c9ede0c5AC580c91587fc66",
    //     { gasPrice: 150000000000 }
    // );
    // await fxChildContract.deployed();

    // console.log("FxStateChildTunnel deployed at:", fxChildContract.address);

    // console.log("Deploy StMatic");
    // const stMaticFactory = await ethers.getContractFactory("StMATIC");
    // const stMaticContract = await upgrades.deployProxy(stMaticFactory, [
    //     "0x797C1369e578172112526dfcD0D5f9182067c928", // NodeOperatorRegistry,
    //     "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", // MATIC_TOKEN
    //     "0x59d07dc34B135B17b87840a86BFF7302039E7EDf", // DAO
    //     "0x3e40D73EB977Dc6a537aF587D48316feE66E9C8c", // INSURANCE
    //     "0x5e3Ef299fDDf15eAa0432E6e66473ace8c13D908", // STAKE_MANAGER
    //     "0x60a91E2B7A1568f0848f3D43353C453730082E46", // PoLidoNFT
    //     "0xd085eF2eA5BBAA54A548686611E8F8c2C21186A9", // FxStateRootTunnel,
    //     ethers.utils.parseEther("0") // STMATIC_SUBMIT_THRESHOLD
    // ]);
    // console.log("StMatic deployed at:", stMaticContract.address);
};

main();