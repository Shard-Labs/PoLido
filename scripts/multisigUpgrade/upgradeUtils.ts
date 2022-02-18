import { defender, ethers } from "hardhat";

export const createUpgradeProposal = async (proxyAddress: string, contractFactory: string) => {
    console.log("Preparing proposal...");
    const factory = await ethers.getContractFactory(contractFactory);
    const proposal = await defender.proposeUpgrade(proxyAddress, factory);
    console.log("Upgrade proposal created at:", proposal.url);
};
