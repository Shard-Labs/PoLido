import hardhat from "hardhat";
import { createUpgradeProposal } from "./upgradeUtils";
import { getUpgradeContext } from "../utils";

const upgradePoLidoNFT = () => {
    const { deployDetails } = getUpgradeContext(hardhat);
    createUpgradeProposal(deployDetails.lido_nft_proxy, "PoLidoNFT");
};

upgradePoLidoNFT();
