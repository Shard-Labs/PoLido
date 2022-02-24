import { Contract, ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { publicKeyCreate } from "secp256k1";
import { DeployDetails } from "./types";
import fs from "fs";
import path from "path";

export const getPublicKey = (privateKey: string): Uint8Array => {
    const privKeyBytes = ethers.utils.arrayify(privateKey);
    const pubKeyBytes = publicKeyCreate(privKeyBytes, false).slice(1);

    return pubKeyBytes;
};

export const attachContract = async (
    hre: HardhatRuntimeEnvironment,
    contractAddress: string,
    contractName: string,
    privateKey?: string
): Promise<Contract> => {
    const admin = privateKey
        ? new ethers.Wallet(privateKey, hre.ethers.provider)
        : (await hre.ethers.getSigners())[0];

    const ContractFactory = await hre.ethers.getContractFactory(
        contractName,
        admin
    );
    const contract = ContractFactory.attach(contractAddress);

    return contract;
};

export const predictContractAddress = (address: string, nonce: number) => {
    const rlpEncoded = ethers.utils.RLP.encode([
        address,
        ethers.BigNumber.from(nonce.toString()).toHexString()
    ]);
    const contractAddressLong = ethers.utils.keccak256(rlpEncoded);
    const contractAddress = "0x".concat(contractAddressLong.substring(26));

    return ethers.utils.getAddress(contractAddress);
};

export const exportAddresses = (fullFilePath: string, addresses: object) => {
    console.log("Export to file...");
    const data = JSON.parse(fs.readFileSync(fullFilePath, "utf8"));
    fs.writeFileSync(fullFilePath, JSON.stringify({
        ...data,
        ...addresses
    }));
};

export const getUpgradeContext = (hre: HardhatRuntimeEnvironment) => {
    const network = hre.network.name;
    const filePath = `${network}-deployment-info.json`;
    const deployDetails: DeployDetails = require(path.join("..", filePath));

    return {
        network,
        filePath,
        deployDetails
    };
};

