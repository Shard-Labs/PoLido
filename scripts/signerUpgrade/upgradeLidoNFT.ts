import hardhat, { ethers, upgrades } from "hardhat";
import {
    PoLidoNFT__factory
} from "../../typechain";
import { exportAddresses, getUpgradeContext } from "../utils";

const upgradeLidoNFT = async () => {
    const { network, filePath, deployDetails } = getUpgradeContext(hardhat);

    console.log("Start upgrade contract on:", network);
    const lidoNFTAddress = deployDetails.lido_nft_proxy;
    const lidoNFTFactory: PoLidoNFT__factory = (
        await ethers.getContractFactory("PoLidoNFT")) as PoLidoNFT__factory;

    await upgrades.upgradeProxy(lidoNFTAddress, lidoNFTFactory);
    const lidoNFTImplAddress = await upgrades.erc1967.getImplementationAddress(
        lidoNFTAddress
    );

    console.log("Lido NFT upgraded");
    console.log("proxy:", lidoNFTAddress);
    console.log("Implementation:", lidoNFTImplAddress);

    exportAddresses(filePath, {
        lido_nft_proxy: lidoNFTAddress,
        lido_nft_implementation: lidoNFTImplAddress
    });
};

upgradeLidoNFT();
