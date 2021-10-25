import hardhat, { ethers, upgrades } from "hardhat";
import * as GOERLI_DEPLOYMENT_DETAILS from "../deploy-goerli.json";

const main = async () => {
    console.log("deploy LidoNFT...");
    const LidoNFT = await ethers.getContractFactory("LidoNFT");
    const lidoNFT = await upgrades.deployProxy(LidoNFT, [
        "PoLido",
        "PLO"
    ]);
    await lidoNFT.deployed();
    const lidoNFTImplAddress =
        await upgrades.erc1967.getImplementationAddress(
            lidoNFT.address
        );
    console.log("LidoNFT Impl address:", lidoNFTImplAddress);
    console.log("LidoNFT Proxy address:", lidoNFT.address);

    console.log("deploy LidoMatic...");
    const LidoMatic = await ethers.getContractFactory("LidoMatic");
    const lidoMatic = await upgrades.deployProxy(LidoMatic, [
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy,
        GOERLI_DEPLOYMENT_DETAILS.matic_erc20_address,
        GOERLI_DEPLOYMENT_DETAILS.dao,
        GOERLI_DEPLOYMENT_DETAILS.dao,
        GOERLI_DEPLOYMENT_DETAILS.matic_stake_manager_proxy,
        lidoNFT.address
    ]);

    await lidoNFT.setLido(lidoMatic.address);

    await lidoMatic.deployed();
    const lidoMaticImplAddress =
        await upgrades.erc1967.getImplementationAddress(
            lidoMatic.address
        );

    console.log("LidoMatic Implementation address:", lidoMaticImplAddress);
    console.log("LidoMatic Proxy address:", lidoMatic.address);

    // Update nodeOperatorLido address
    const nodeOperatorLidoArtifact = await hardhat.artifacts.readArtifact("NodeOperatorRegistry");
    const nor = await ethers.getContractAt(
        nodeOperatorLidoArtifact.abi,
        GOERLI_DEPLOYMENT_DETAILS.node_operator_registry_proxy
    );
    await nor.setLido(GOERLI_DEPLOYMENT_DETAILS.lido_matic_proxy);
};

main();
